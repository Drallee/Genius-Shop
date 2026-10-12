package me.dralle.shop.data;

import me.dralle.shop.economy.EconomyHook;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RefundRecoveryTest {
    @TempDir Path folder;
    private final UUID id = UUID.randomUUID();
    private final UUID uuid = UUID.randomUUID();
    private Player player() {
        Player player = mock(Player.class);
        when(player.getUniqueId()).thenReturn(uuid);
        return player;
    }

    @Test
    void failedAutomaticRefundPersistsAndRetryRecordsWhoAndWhen() throws Exception {
        var file = folder.resolve("refunds.db").toFile();
        Player player = player();
        EconomyHook economy = mock(EconomyHook.class);
        when(economy.tryDeposit(player, 100)).thenReturn(new EconomyHook.EconomyOperationResult(false, "provider rejected"));
        try (var queue = new RefundRecovery(file)) {
            assertFalse(queue.automatic(id, player, 100, "delivery failed", economy).success());
            var entry = queue.get(id);
            assertEquals(RefundRecovery.Status.PENDING, entry.status());
            assertEquals(uuid, entry.playerId());
            assertEquals(100, entry.amount());
            assertTrue(entry.reason().contains("delivery failed"));
            assertTrue(entry.reason().contains("provider rejected"));
            assertEquals(1, entry.attempts());
            assertFalse(queue.enqueue(id, uuid, 999, "duplicate"));
        }
        try (var queue = new RefundRecovery(file)) {
            when(economy.tryDeposit(player, 100)).thenReturn(new EconomyHook.EconomyOperationResult(true, null));
            assertTrue(queue.retry(id, player, "admin-uuid (Alice)", economy).success());
            var entry = queue.get(id);
            assertEquals(RefundRecovery.Status.RECOVERED, entry.status());
            assertEquals("admin-uuid (Alice)", entry.completedBy());
            assertNotNull(entry.completed());
            assertTrue(entry.completed() >= entry.created());
            assertEquals(2, entry.attempts());
            assertTrue(queue.list(1).isEmpty());
            assertFalse(queue.retry(id, player, "another admin", economy).success());
        }
        verify(economy, times(2)).tryDeposit(player, 100);
        try (var queue = new RefundRecovery(file)) {
            assertEquals(RefundRecovery.Status.RECOVERED, queue.get(id).status());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"ambiguous", "null", "exception", "partial-success"})
    void uncertainOutcomeBlocksRetryUntilProviderReview(String outcome) throws Exception {
        Player player = player();
        EconomyHook economy = mock(EconomyHook.class);
        when(economy.tryDeposit(player, 100)).thenReturn(new EconomyHook.EconomyOperationResult(false, "connection lost", true));
        if (outcome.equals("null")) when(economy.tryDeposit(player, 100)).thenReturn(null);
        if (outcome.equals("exception")) when(economy.tryDeposit(player, 100)).thenThrow(new IllegalStateException("connection lost"));
        if (outcome.equals("partial-success")) when(economy.tryDeposit(player, 100)).thenReturn(new EconomyHook.EconomyOperationResult(true, null, true));
        try (var queue = new RefundRecovery(folder.resolve("refunds.db").toFile())) {
            queue.automatic(id, player, 100, "delivery failed", economy);
            assertEquals(RefundRecovery.Status.REVIEW, queue.get(id).status());
            assertFalse(queue.retry(id, player, "admin", economy).success());
            verify(economy, times(1)).tryDeposit(player, 100);
            assertThrows(IllegalArgumentException.class, () -> queue.review(id, false, "admin", " "));
            assertTrue(queue.review(id, false, "admin", "Provider logs confirm no credit"));
            doReturn(new EconomyHook.EconomyOperationResult(true, null)).when(economy).tryDeposit(player, 100);
            assertTrue(queue.retry(id, player, "admin", economy).success());
            assertTrue(queue.get(id).reviewNote().contains("Provider logs confirm no credit"));
        }
    }

    @Test
    void paidReviewClosesCaseWithoutAnotherPayment() throws Exception {
        var file = folder.resolve("refunds.db").toFile();
        try (var queue = new RefundRecovery(file)) {
            queue.enqueue(id, uuid, 100, "failed delivery");
            assertTrue(queue.claim(id, "automatic"));
        }
        try (var queue = new RefundRecovery(file)) {
            assertEquals(RefundRecovery.Status.REVIEW, queue.get(id).status());
            assertTrue(queue.review(id, true, "Alice", "Credit verified in provider history"));
            EconomyHook economy = mock(EconomyHook.class);
            assertFalse(queue.retry(id, player(), "Alice", economy).success());
            verifyNoInteractions(economy);
            assertEquals("Alice", queue.get(id).completedBy());
            assertNotNull(queue.get(id).completed());
        }
    }

    @Test
    void concurrentRetriesCanDepositOnlyOnce() throws Exception {
        try (var queue = new RefundRecovery(folder.resolve("refunds.db").toFile());
             var otherConnection = new RefundRecovery(folder.resolve("refunds.db").toFile()); var pool = Executors.newFixedThreadPool(2)) {
            queue.enqueue(id, uuid, 100, "delivery failed");
            Player player = player();
            EconomyHook economy = mock(EconomyHook.class);
            CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
            when(economy.tryDeposit(player, 100)).thenAnswer(invocation -> {
                assertEquals(RefundRecovery.Status.REFUNDING, queue.get(id).status());
                entered.countDown();
                assertTrue(release.await(5, TimeUnit.SECONDS));
                return new EconomyHook.EconomyOperationResult(true, null);
            });
            var first = pool.submit(() -> queue.retry(id, player, "first", economy));
            assertTrue(entered.await(5, TimeUnit.SECONDS));
            try {
                var second = pool.submit(() -> otherConnection.retry(id, player, "second", economy));
                assertFalse(second.get(5, TimeUnit.SECONDS).success());
                assertFalse(queue.review(id, false, "admin", "Cannot change an active attempt"));
            } finally { release.countDown(); }
            assertTrue(first.get(5, TimeUnit.SECONDS).success());
            verify(economy, times(1)).tryDeposit(player, 100);
        }
    }

    @Test
    void cannotPayUntilClaimIsDurableAndFailedCompletionCannotPayAgain() throws Exception {
        var file = folder.resolve("refunds.db");
        Player player = player();
        EconomyHook economy = mock(EconomyHook.class);
        when(economy.tryDeposit(player, 100)).thenReturn(new EconomyHook.EconomyOperationResult(true, null));
        try (var queue = new RefundRecovery(file.toFile()); var connection = DriverManager.getConnection("jdbc:sqlite:" + file);
             var statement = connection.createStatement()) {
            queue.enqueue(id, uuid, 100, "delivery failed");
            statement.execute("CREATE TRIGGER block_claim BEFORE UPDATE ON refunds WHEN NEW.status='REFUNDING' BEGIN SELECT RAISE(ABORT, 'test'); END");
            assertThrows(java.sql.SQLException.class, () -> queue.retry(id, player, "admin", economy));
            verifyNoInteractions(economy);
            statement.execute("DROP TRIGGER block_claim");
            statement.execute("CREATE TRIGGER block_finish BEFORE UPDATE ON refunds WHEN NEW.status='RECOVERED' BEGIN SELECT RAISE(ABORT, 'test'); END");
            assertThrows(java.sql.SQLException.class, () -> queue.retry(id, player, "admin", economy));
            assertEquals(RefundRecovery.Status.REVIEW, queue.get(id).status());
            assertFalse(queue.retry(id, player, "admin", economy).success());
            verify(economy, times(1)).tryDeposit(player, 100);
        }
        try (var queue = new RefundRecovery(file.toFile())) {
            assertEquals(RefundRecovery.Status.REVIEW, queue.get(id).status());
        }
    }

    @Test
    void wrongPlayerAndInvalidAmountsCannotBeRepaid() throws Exception {
        try (var queue = new RefundRecovery(folder.resolve("refunds.db").toFile())) {
            assertThrows(IllegalArgumentException.class, () -> queue.enqueue(id, uuid, Double.NaN, "failed"));
            assertThrows(IllegalArgumentException.class, () -> queue.enqueue(id, uuid, -1, "failed"));
            queue.enqueue(id, uuid, 100, "failed");
            Player wrong = mock(Player.class);
            when(wrong.getUniqueId()).thenReturn(UUID.randomUUID());
            EconomyHook economy = mock(EconomyHook.class);
            assertFalse(queue.retry(id, wrong, "admin", economy).success());
            verifyNoInteractions(economy);
            assertEquals(0, queue.get(id).attempts());
        }
    }
}
