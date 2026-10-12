package me.dralle.shop.data;

import me.dralle.shop.ShopPlugin;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TransactionLedgerTest {
    @TempDir Path folder;
    private final UUID player = UUID.randomUUID();
    private final Instant time = Instant.parse("2026-10-12T12:00:00Z");

    private TransactionEntry entry(String shop, String item, TransactionEntry.Type type, Instant at) {
        return new TransactionEntry(UUID.randomUUID(), UUID.randomUUID(), at, player, "Alice", type, shop, item, 4, 250D, 1000D);
    }

    private TransactionLedger.Query all() {
        return new TransactionLedger.Query(null, null, null, null, null, null, 100, 0);
    }

    @Test
    void survivesReopenAndDuplicateEntriesKeepTheirOriginalData() throws Exception {
        Path file = folder.resolve("transactions.db");
        TransactionEntry entry = entry("market", "diamond", TransactionEntry.Type.PURCHASE, time);
        try (var ledger = new TransactionLedger(file.toFile())) {
            ledger.append(List.of(entry));
            ledger.append(List.of(entry));
        }
        try (var ledger = new TransactionLedger(file.toFile())) {
            assertEquals(List.of(entry), ledger.search(all()));
            ledger.append(List.of(entry));
            assertEquals(List.of(entry), ledger.search(all()));
        }
    }

    @Test
    void eachFilterAndCombinedFiltersReturnOnlyMatchingRecords() throws Exception {
        try (var ledger = new TransactionLedger(folder.resolve("ledger.db").toFile())) {
            var target = entry("market", "diamond", TransactionEntry.Type.WAND_SALE, time);
            var otherShop = entry("blocks", "stone", TransactionEntry.Type.SALE, time.minusSeconds(1));
            var otherPlayer = new TransactionEntry(UUID.randomUUID(), UUID.randomUUID(), time.plusSeconds(1), UUID.randomUUID(),
                    "Bob", TransactionEntry.Type.PURCHASE, "premium", "emerald", 1, 500D, 500D);
            ledger.append(List.of(target, otherShop, otherPlayer));
            for (var query : List.of(
                    new TransactionLedger.Query(null, "market", null, null, null, null, 10, 0),
                    new TransactionLedger.Query(null, null, "diamond", null, null, null, 10, 0),
                    new TransactionLedger.Query(null, null, null, TransactionEntry.Type.WAND_SALE, null, null, 10, 0),
                    new TransactionLedger.Query(null, null, null, null, time, time.plusSeconds(1), 10, 0),
                    new TransactionLedger.Query("alice", "market", "diamond", TransactionEntry.Type.WAND_SALE, time, time.plusSeconds(1), 10, 0))) {
                assertEquals(List.of(target), ledger.search(query));
            }
            assertEquals(List.of(target, otherShop), ledger.search(new TransactionLedger.Query(player.toString(), null, null, null, null, null, 10, 0)));
            assertEquals(List.of(target, otherShop), ledger.search(new TransactionLedger.Query("ALICE", null, null, null, null, null, 10, 0)));
            assertEquals(List.of(), ledger.search(new TransactionLedger.Query("' OR 1=1 --", null, null, null, null, null, 10, 0)));
        }
    }

    @Test
    void pagesHaveStableOrderEvenWhenTimestampsMatch() throws Exception {
        try (var ledger = new TransactionLedger(folder.resolve("ledger.db").toFile())) {
            List<TransactionEntry> entries = new ArrayList<>();
            for (int i = 0; i < 15; i++) entries.add(entry("market", "diamond", TransactionEntry.Type.PURCHASE, time));
            ledger.append(entries);
            var ordered = ledger.search(all());
            var first = ledger.search(new TransactionLedger.Query(null, null, null, null, null, null, 10, 0));
            var second = ledger.search(new TransactionLedger.Query(null, null, null, null, null, null, 10, 10));
            assertEquals(ordered.subList(0, 10), first);
            assertEquals(ordered.subList(10, 15), second);
        }
    }

    @Test
    void aFailedBatchCannotLeavePartialRecordsAndCanBeRetried() throws Exception {
        Path file = folder.resolve("ledger.db");
        try (var ledger = new TransactionLedger(file.toFile()); var connection = DriverManager.getConnection("jdbc:sqlite:" + file)) {
            var good = entry("market", "good", TransactionEntry.Type.SALE, time);
            var bad = entry("market", "bad", TransactionEntry.Type.SALE, time);
            try (var statement = connection.createStatement()) {
                statement.execute("CREATE TRIGGER reject_bad BEFORE INSERT ON transactions WHEN NEW.item = 'bad' BEGIN SELECT RAISE(ABORT, 'test'); END");
                assertThrows(java.sql.SQLException.class, () -> ledger.append(List.of(good, bad)));
                assertTrue(ledger.search(all()).isEmpty());
                statement.execute("DROP TRIGGER reject_bad");
            }
            ledger.append(List.of(good, bad));
            assertEquals(2, ledger.search(all()).size());
        }
    }

    @Test
    void concurrentRetriesDoNotDuplicateAnEntry() throws Exception {
        try (var ledger = new TransactionLedger(folder.resolve("ledger.db").toFile()); var executor = Executors.newFixedThreadPool(4)) {
            var entry = entry("market", "diamond", TransactionEntry.Type.SALE, time);
            var tasks = new ArrayList<java.util.concurrent.Callable<Void>>();
            for (int i = 0; i < 20; i++) tasks.add(() -> { ledger.append(List.of(entry)); return null; });
            for (var result : executor.invokeAll(tasks)) result.get();
            assertEquals(List.of(entry), ledger.search(all()));
        }
    }

    @Test
    void recordingComputesEffectivePerItemPriceAndGroupsBulkLines() throws Exception {
        try (var ledger = new TransactionLedger(folder.resolve("ledger.db").toFile())) {
            ShopPlugin plugin = mock(ShopPlugin.class, CALLS_REAL_METHODS);
            var field = ShopPlugin.class.getDeclaredField("transactionLedger");
            field.setAccessible(true);
            field.set(plugin, ledger);
            Player buyer = mock(Player.class);
            when(buyer.getUniqueId()).thenReturn(player);
            when(buyer.getName()).thenReturn("Alice");
            plugin.recordTransactions(buyer, TransactionEntry.Type.WAND_SALE, List.of(
                    new TransactionEntry.Line("market", "apple", 4, 1000),
                    new TransactionEntry.Line("blocks", "stone", 3, 210)));
            var entries = ledger.search(all());
            assertEquals(2, entries.size());
            assertEquals(1, entries.stream().map(TransactionEntry::operationId).distinct().count());
            assertEquals(2, entries.stream().map(TransactionEntry::id).distinct().count());
            assertEquals(1, entries.stream().map(TransactionEntry::timestamp).distinct().count());
            for (var entry : entries) {
                assertEquals(entry.total() / entry.quantity(), entry.unitPrice());
                assertEquals(player, entry.playerId());
                assertEquals("Alice", entry.playerName());
                assertEquals(TransactionEntry.Type.WAND_SALE, entry.type());
            }
            assertEquals(1210D, entries.stream().mapToDouble(TransactionEntry::total).sum());
        }
    }
}
