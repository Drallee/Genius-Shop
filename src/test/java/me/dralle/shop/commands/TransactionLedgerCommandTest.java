package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.data.TransactionEntry;
import org.bukkit.command.CommandSender;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TransactionLedgerCommandTest {
    @Test
    void parsesAllFiltersAndIncludesTheWholeToDate() {
        var query = TransactionLedgerCommand.parse(new String[]{"ledger", "player=Alice", "shop=market", "item=diamond",
                "type=wand_sale", "from=2026-10-12", "to=2026-10-12", "page=2"});
        assertEquals("Alice", query.player());
        assertEquals("market", query.shop());
        assertEquals("diamond", query.item());
        assertEquals(TransactionEntry.Type.WAND_SALE, query.type());
        assertEquals(Instant.parse("2026-10-12T00:00:00Z"), query.from());
        assertEquals(Instant.parse("2026-10-13T00:00:00Z"), query.to());
        assertEquals(10, query.offset());
        assertEquals(11, query.limit());
    }

    @Test
    void timestampsUseAnExclusiveUpperBoundWithoutAddingADay() {
        var query = TransactionLedgerCommand.parse(new String[]{"ledger", "from=2026-10-12T12:00:00Z", "to=2026-10-12T13:00:00Z"});
        assertEquals(Instant.parse("2026-10-12T12:00:00Z"), query.from());
        assertEquals(Instant.parse("2026-10-12T13:00:00Z"), query.to());
    }

    @ParameterizedTest
    @ValueSource(strings = {"page=0", "page=-1", "page=2147483647", "page=no", "type=unknown", "from=2026-02-30", "to=bad", "shop=", "unknown=x", "shop"})
    void invalidFiltersAreRejected(String filter) {
        assertThrows(IllegalArgumentException.class, () -> TransactionLedgerCommand.parse(new String[]{"ledger", filter}));
    }

    @Test
    void reversedRangesAndRepeatedFiltersAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> TransactionLedgerCommand.parse(new String[]{"ledger", "from=2026-10-13", "to=2026-10-11"}));
        assertThrows(IllegalArgumentException.class, () -> TransactionLedgerCommand.parse(new String[]{"ledger", "shop=a", "shop=b"}));
    }

    @Test
    void unauthorizedSendersCannotQueryOrScheduleDatabaseWork() {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        CommandSender sender = mock(CommandSender.class);
        when(plugin.getMessages().getMessage("no-permission")).thenReturn("denied");
        assertTrue(new TransactionLedgerCommand(plugin).execute(sender, new String[]{"ledger"}));
        verify(sender).sendMessage("denied");
        verify(plugin, never()).getServer();
        verify(plugin, never()).getTransactionLedger();
    }

    @ParameterizedTest
    @ValueSource(strings = {"geniusshop.ledger", "geniusshop.admin", "shop.admin", "op"})
    void authorizedSearchRunsOnSchedulerAndReturnsResults(String permission) throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        CommandSender sender = mock(CommandSender.class);
        if (permission.equals("op")) when(sender.isOp()).thenReturn(true);
        else when(sender.hasPermission(permission)).thenReturn(true);
        var scheduler = plugin.getServer().getScheduler();
        doAnswer(invocation -> {
            ((Runnable) invocation.getArgument(1)).run();
            return mock(org.bukkit.scheduler.BukkitTask.class);
        }).when(scheduler).runTaskAsynchronously(eq(plugin), any(Runnable.class));
        doAnswer(invocation -> {
            ((Runnable) invocation.getArgument(1)).run();
            return mock(org.bukkit.scheduler.BukkitTask.class);
        }).when(scheduler).runTask(eq(plugin), any(Runnable.class));
        when(plugin.getTransactionLedger().search(any())).thenReturn(java.util.List.of());

        assertTrue(new TransactionLedgerCommand(plugin).execute(sender, new String[]{"ledger", "shop=market", "page=2"}));

        verify(plugin.getTransactionLedger()).search(argThat(query -> query.shop().equals("market") && query.offset() == 10));
        verify(scheduler).runTaskAsynchronously(eq(plugin), any(Runnable.class));
        verify(scheduler).runTask(eq(plugin), any(Runnable.class));
        verify(sender).sendMessage("No matching transactions.");
    }
}
