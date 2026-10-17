package me.dralle.shop.data;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Read-only aggregates of completed ledger entries, in one SQLite snapshot. */
public final class SalesAnalytics {
    private SalesAnalytics() {}

    public record Filter(LocalDate from, LocalDate through, String shop, String item) {
        public Filter {
            Objects.requireNonNull(from);
            Objects.requireNonNull(through);
            long days = ChronoUnit.DAYS.between(from, through) + 1;
            if (from.isBefore(LocalDate.of(1970, 1, 1)) || days < 1 || days > 366
                    || through.isAfter(LocalDate.of(9999, 12, 30))) {
                throw new IllegalArgumentException("Choose a UTC date range of 1 to 366 days, from 1970 onward.");
            }
            if ((shop != null && shop.length() > 512) || (item != null && item.length() > 512)) {
                throw new IllegalArgumentException("Shop and item filters must be at most 512 characters.");
            }
        }

        public static Filter parse(String query, Clock clock) {
            Map<String, String> values = new HashMap<>();
            if (query != null && !query.isEmpty()) {
                for (String pair : query.split("&")) {
                    String[] parts = pair.split("=", 2);
                    String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
                    String value = URLDecoder.decode(parts.length == 2 ? parts[1] : "", StandardCharsets.UTF_8);
                    if (!Set.of("from", "through", "shop", "item").contains(key) || values.putIfAbsent(key, value) != null) {
                        throw new IllegalArgumentException("Unknown or duplicate analytics filter.");
                    }
                }
            }
            LocalDate today = LocalDate.now(clock.withZone(ZoneOffset.UTC));
            try {
                return new Filter(LocalDate.parse(values.getOrDefault("from", today.minusDays(29).toString())),
                        LocalDate.parse(values.getOrDefault("through", today.toString())), values.get("shop"), values.get("item"));
            } catch (DateTimeException failure) {
                throw new IllegalArgumentException("Dates must use YYYY-MM-DD.");
            }
        }
    }

    public record Totals(long operations, long lines, long quantity, double money) {}
    public record PopularItem(String shop, String item, long purchases, long sales, double turnover) {}
    public record Price(String day, String direction, long quantity, double average, double minimum, double maximum) {}
    public record Selection(String from, String through, String shop, String item) {}
    public record Report(Selection filter, String generatedAt, Map<String, Totals> totals,
                         double playerInflow, double playerOutflow, double netPlayerInflow,
                         List<String> shops, List<String> items, List<PopularItem> popular,
                         long matchingItems, int popularLimit, List<Price> prices) {}

    static Report read(Connection connection, Filter filter) throws SQLException {
        String where = " WHERE timestamp >= ? AND timestamp < ?";
        List<Object> parameters = new ArrayList<>(List.of(
                filter.from().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
                filter.through().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()));
        if (filter.shop() != null) { where += " AND shop = ?"; parameters.add(filter.shop()); }
        if (filter.item() != null) { where += " AND item = ?"; parameters.add(filter.item()); }
        Map<String, Totals> totals = new LinkedHashMap<>();
        for (var type : TransactionEntry.Type.values()) totals.put(type.name(), new Totals(0, 0, 0, 0));
        try (var statement = prepare(connection, "SELECT type, COUNT(DISTINCT operation_id), COUNT(*), SUM(quantity), SUM(total) FROM transactions" + where + " GROUP BY type", parameters);
             var rows = statement.executeQuery()) {
            while (rows.next()) totals.put(rows.getString(1), new Totals(rows.getLong(2), rows.getLong(3), rows.getLong(4), finite(rows.getDouble(5))));
        }
        List<PopularItem> popular = new ArrayList<>();
        long matchingItems;
        try (var statement = prepare(connection, "SELECT COUNT(*) FROM (SELECT shop,item FROM transactions" + where + " GROUP BY shop,item)", parameters);
             var rows = statement.executeQuery()) {
            matchingItems = rows.next() ? rows.getLong(1) : 0;
        }
        try (var statement = prepare(connection, """
                SELECT shop, item,
                SUM(CASE WHEN type = 'PURCHASE' THEN quantity ELSE 0 END) AS purchases,
                SUM(CASE WHEN type IN ('SALE','WAND_SALE') THEN quantity ELSE 0 END) AS sales,
                SUM(total) FROM transactions
                """ + where + " GROUP BY shop,item ORDER BY SUM(quantity) DESC, shop, item LIMIT 50", parameters);
             var rows = statement.executeQuery()) {
            while (rows.next()) popular.add(new PopularItem(rows.getString(1), rows.getString(2), rows.getLong(3), rows.getLong(4), finite(rows.getDouble(5))));
        }
        List<Price> prices = new ArrayList<>();
        if (filter.shop() != null && filter.item() != null) {
            try (var statement = prepare(connection, """
                    SELECT date(timestamp / 1000, 'unixepoch') AS day,
                    CASE WHEN type = 'PURCHASE' THEN 'BUY' ELSE 'SELL' END AS direction,
                    SUM(quantity), SUM(total) / SUM(quantity), MIN(unit_price), MAX(unit_price)
                    FROM transactions
                    """ + where + " GROUP BY day,direction ORDER BY day,direction", parameters);
                 var rows = statement.executeQuery()) {
                while (rows.next()) prices.add(new Price(rows.getString(1), rows.getString(2), rows.getLong(3),
                        finite(rows.getDouble(4)), finite(rows.getDouble(5)), finite(rows.getDouble(6))));
            }
        }
        List<String> shops = options(connection, "SELECT DISTINCT shop FROM transactions ORDER BY shop", List.of());
        List<String> items = filter.shop() == null
                ? options(connection, "SELECT DISTINCT item FROM transactions ORDER BY item", List.of())
                : options(connection, "SELECT DISTINCT item FROM transactions WHERE shop = ? ORDER BY item", List.of(filter.shop()));
        double inflow = finite(totals.get("SALE").money() + totals.get("WAND_SALE").money());
        double outflow = totals.get("PURCHASE").money();
        return new Report(new Selection(filter.from().toString(), filter.through().toString(), filter.shop(), filter.item()),
                Instant.now().toString(), totals, inflow, outflow, finite(inflow - outflow),
                shops, items, popular, matchingItems, 50, prices);
    }

    private static PreparedStatement prepare(Connection connection, String sql, List<Object> parameters) throws SQLException {
        PreparedStatement statement = connection.prepareStatement(sql);
        try {
            for (int i = 0; i < parameters.size(); i++) statement.setObject(i + 1, parameters.get(i));
            return statement;
        } catch (SQLException failure) {
            statement.close();
            throw failure;
        }
    }

    private static List<String> options(Connection connection, String sql, List<Object> parameters) throws SQLException {
        List<String> options = new ArrayList<>();
        try (var statement = prepare(connection, sql, parameters); var rows = statement.executeQuery()) {
            while (rows.next()) options.add(rows.getString(1));
        }
        return options;
    }

    private static double finite(double value) throws SQLException {
        if (!Double.isFinite(value)) throw new SQLException("Analytics aggregate exceeds numeric range");
        return value;
    }
}
