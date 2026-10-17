package me.dralle.shop.data;

import com.google.gson.Gson;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.*;
import java.util.*;

import static me.dralle.shop.data.TransactionEntry.Type.*;
import static org.junit.jupiter.api.Assertions.*;

class SalesAnalyticsTest {
    @TempDir Path folder;
    private final Instant noon = Instant.parse("2026-10-12T12:00:00Z");
    private final UUID player = UUID.randomUUID();

    private TransactionEntry entry(UUID operation, Instant at, TransactionEntry.Type type, String shop, String item, int quantity, double total) {
        return new TransactionEntry(UUID.randomUUID(), operation, at, player, "Alice", type, shop, item, quantity, total / quantity, total);
    }

    private SalesAnalytics.Filter filter(String shop, String item) {
        return new SalesAnalytics.Filter(LocalDate.parse("2026-10-12"), LocalDate.parse("2026-10-13"), shop, item);
    }

    @Test
    void persistentTotalsUseAllRowsNotASearchPageAndRetriesDoNotDoubleCount() throws Exception {
        Path file = folder.resolve("ledger.db");
        try (var ledger = new TransactionLedger(file.toFile())) {
            List<TransactionEntry> entries = new ArrayList<>();
            UUID bulk = UUID.randomUUID();
            for (int i = 0; i < 150; i++) entries.add(entry(bulk, noon, SALE, "market", "stone", 2, 6));
            entries.add(entry(UUID.randomUUID(), noon, PURCHASE, "market", "stone", 4, 40));
            entries.add(entry(UUID.randomUUID(), noon, WAND_SALE, "market", "stone", 3, 15));
            ledger.append(entries);
            ledger.append(entries);
        }
        try (var ledger = new TransactionLedger(file.toFile())) {
            var report = ledger.analytics(filter(null, null));
            assertEquals(new SalesAnalytics.Totals(1, 150, 300, 900), report.totals().get("SALE"));
            assertEquals(new SalesAnalytics.Totals(1, 1, 4, 40), report.totals().get("PURCHASE"));
            assertEquals(new SalesAnalytics.Totals(1, 1, 3, 15), report.totals().get("WAND_SALE"));
            assertEquals(915, report.playerInflow());
            assertEquals(40, report.playerOutflow());
            assertEquals(875, report.netPlayerInflow());
            assertEquals(303, report.popular().getFirst().sales());
            assertTrue(report.prices().isEmpty());
            assertDoesNotThrow(() -> new Gson().toJson(report));
        }
    }

    @Test
    void priceHistoryIsWeightedSeparatesBuySellAndUsesUtcBoundaries() throws Exception {
        try (var ledger = new TransactionLedger(folder.resolve("ledger.db").toFile())) {
            var start = Instant.parse("2026-10-12T00:00:00Z");
            var end = Instant.parse("2026-10-14T00:00:00Z");
            ledger.append(List.of(
                    entry(UUID.randomUUID(), start, PURCHASE, "market", "stone", 1, 10),
                    entry(UUID.randomUUID(), noon, PURCHASE, "market", "stone", 9, 180),
                    entry(UUID.randomUUID(), noon, SALE, "market", "stone", 3, 6),
                    entry(UUID.randomUUID(), noon, WAND_SALE, "market", "stone", 1, 10),
                    entry(UUID.randomUUID(), end.minusMillis(1), PURCHASE, "market", "stone", 1, 8),
                    entry(UUID.randomUUID(), start.minusMillis(1), PURCHASE, "market", "stone", 1, 999),
                    entry(UUID.randomUUID(), end, PURCHASE, "market", "stone", 1, 999)));
            var report = ledger.analytics(filter("market", "stone"));
            assertEquals(3, report.prices().size());
            assertEquals(new SalesAnalytics.Price("2026-10-12", "BUY", 10, 19, 10, 20), report.prices().get(0));
            assertEquals(new SalesAnalytics.Price("2026-10-12", "SELL", 4, 4, 2, 10), report.prices().get(1));
            assertEquals("2026-10-13", report.prices().get(2).day());
            assertEquals(198, report.playerOutflow());
        }
    }

    @Test
    void filtersAreExactAndSafeAndDeletedAndUnattributedItemsRemainAvailable() throws Exception {
        try (var ledger = new TransactionLedger(folder.resolve("ledger.db").toFile())) {
            ledger.append(List.of(
                    entry(UUID.randomUUID(), noon, SALE, "old", "stone", 2, 20),
                    entry(UUID.randomUUID(), noon, PURCHASE, "new", "stone", 3, 90),
                    entry(UUID.randomUUID(), noon, WAND_SALE, "", "", 1, 0),
                    entry(UUID.randomUUID(), noon, SALE, "' OR 1=1 --", "<script>", 4, 4)));
            var all = ledger.analytics(filter(null, null));
            assertEquals(4, all.matchingItems());
            assertTrue(all.shops().contains("old"));
            assertTrue(all.shops().contains(""));
            var old = ledger.analytics(filter("old", "stone"));
            assertEquals(20, old.playerInflow());
            assertEquals(0, old.playerOutflow());
            assertEquals(List.of("stone"), old.items());
            assertEquals(4, ledger.analytics(filter("' OR 1=1 --", "<script>")).playerInflow());
            assertEquals(0, ledger.analytics(filter("missing", null)).matchingItems());
            assertEquals(1, ledger.analytics(filter("", "")).matchingItems());
        }
    }

    @Test
    void rankingLimitDoesNotTruncateTotalsAndQuantitiesUseLongs() throws Exception {
        try (var ledger = new TransactionLedger(folder.resolve("ledger.db").toFile())) {
            List<TransactionEntry> entries = new ArrayList<>();
            for (int i = 0; i < 60; i++) entries.add(entry(UUID.randomUUID(), noon, PURCHASE, "shop", "item" + i, Integer.MAX_VALUE, 1));
            ledger.append(entries);
            var report = ledger.analytics(filter(null, null));
            assertEquals(60, report.matchingItems());
            assertEquals(50, report.popular().size());
            assertEquals(60L * Integer.MAX_VALUE, report.totals().get("PURCHASE").quantity());
            assertEquals(-60, report.netPlayerInflow());
        }
    }

    @Test
    void emptyLedgerAndFailedBatchesDoNotCreateCompletedMetrics() throws Exception {
        Path file = folder.resolve("ledger.db");
        try (var ledger = new TransactionLedger(file.toFile()); var connection = java.sql.DriverManager.getConnection("jdbc:sqlite:" + file)) {
            try (var statement = connection.createStatement()) {
                statement.execute("CREATE TRIGGER reject_all BEFORE INSERT ON transactions BEGIN SELECT RAISE(ABORT, 'test'); END");
            }
            assertThrows(java.sql.SQLException.class, () -> ledger.append(List.of(entry(UUID.randomUUID(), noon, PURCHASE, "shop", "stone", 1, 100))));
            var report = ledger.analytics(filter(null, null));
            assertEquals(0, report.playerInflow());
            assertEquals(0, report.playerOutflow());
            assertTrue(report.prices().isEmpty());
            assertTrue(report.popular().isEmpty());
        }
    }

    @Test
    void queryParsingValidatesRangesAndUsesUtcDefaults() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-18T00:30:00Z"), ZoneOffset.ofHours(-7));
        var defaults = SalesAnalytics.Filter.parse(null, clock);
        assertEquals(LocalDate.parse("2026-09-19"), defaults.from());
        assertEquals(LocalDate.parse("2026-10-18"), defaults.through());
        assertEquals("a&b", SalesAnalytics.Filter.parse("shop=a%26b&item=", clock).shop());
        assertEquals("", SalesAnalytics.Filter.parse("item=", clock).item());
        for (String query : List.of("from=bad", "from=2026-02-30", "from=2026-10-20&through=2026-10-19",
                "from=2020-01-01&through=2026-01-01", "from=1969-01-01", "from=2026-01-01&from=2026-01-02", "type=SALE", "shop=%ZZ")) {
            assertThrows(IllegalArgumentException.class, () -> SalesAnalytics.Filter.parse(query, clock), query);
        }
        assertDoesNotThrow(() -> SalesAnalytics.Filter.parse("from=2024-01-01&through=2024-12-31", clock));
    }
}
