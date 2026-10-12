package me.dralle.shop.data;

import java.io.File;
import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public final class TransactionLedger implements AutoCloseable {
    private final Connection connection;

    public TransactionLedger(File file) throws SQLException {
        connection = DriverManager.getConnection("jdbc:sqlite:" + file.getAbsolutePath());
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA busy_timeout=5000");
            statement.execute("PRAGMA journal_mode=WAL");
            statement.execute("PRAGMA synchronous=FULL");
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS transactions (
                        id TEXT PRIMARY KEY,
                        operation_id TEXT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        player_uuid TEXT NOT NULL,
                        player_name TEXT NOT NULL,
                        type TEXT NOT NULL,
                        shop TEXT NOT NULL,
                        item TEXT NOT NULL,
                        quantity INTEGER NOT NULL CHECK(quantity > 0),
                        unit_price REAL NOT NULL CHECK(unit_price >= 0),
                        total REAL NOT NULL CHECK(total >= 0)
                    )
                    """);
            statement.execute("CREATE INDEX IF NOT EXISTS transactions_date ON transactions(timestamp DESC, id DESC)");
            statement.execute("CREATE INDEX IF NOT EXISTS transactions_player ON transactions(player_uuid, timestamp DESC)");
            statement.execute("CREATE INDEX IF NOT EXISTS transactions_name ON transactions(player_name COLLATE NOCASE, timestamp DESC)");
            statement.execute("CREATE INDEX IF NOT EXISTS transactions_shop ON transactions(shop, timestamp DESC)");
            statement.execute("CREATE INDEX IF NOT EXISTS transactions_item ON transactions(item, timestamp DESC)");
            statement.execute("CREATE INDEX IF NOT EXISTS transactions_type ON transactions(type, timestamp DESC)");
        } catch (SQLException failure) {
            connection.close();
            throw failure;
        }
    }

    public synchronized void append(List<TransactionEntry> entries) throws SQLException {
        connection.setAutoCommit(false);
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO transactions(id, operation_id, timestamp, player_uuid, player_name,
                                         type, shop, item, quantity, unit_price, total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """)) {
            for (TransactionEntry entry : entries) {
                statement.setString(1, entry.id().toString());
                statement.setString(2, entry.operationId().toString());
                statement.setLong(3, entry.timestamp().toEpochMilli());
                statement.setString(4, entry.playerId().toString());
                statement.setString(5, entry.playerName());
                statement.setString(6, entry.type().name());
                statement.setString(7, entry.shop());
                statement.setString(8, entry.item());
                statement.setInt(9, entry.quantity());
                statement.setDouble(10, entry.unitPrice());
                statement.setDouble(11, entry.total());
                statement.addBatch();
            }
            statement.executeBatch();
            connection.commit();
        } catch (SQLException | RuntimeException failure) {
            connection.rollback();
            throw failure;
        } finally {
            connection.setAutoCommit(true);
        }
    }

    public synchronized List<TransactionEntry> search(Query query) throws SQLException {
        StringBuilder sql = new StringBuilder("SELECT * FROM transactions WHERE 1=1");
        List<Object> parameters = new ArrayList<>();
        if (query.player() != null) {
            sql.append(" AND (player_uuid = ? OR player_name = ? COLLATE NOCASE)");
            parameters.add(query.player());
            parameters.add(query.player());
        }
        if (query.shop() != null) { sql.append(" AND shop = ?"); parameters.add(query.shop()); }
        if (query.item() != null) { sql.append(" AND item = ?"); parameters.add(query.item()); }
        if (query.type() != null) { sql.append(" AND type = ?"); parameters.add(query.type().name()); }
        if (query.from() != null) { sql.append(" AND timestamp >= ?"); parameters.add(query.from().toEpochMilli()); }
        if (query.to() != null) { sql.append(" AND timestamp < ?"); parameters.add(query.to().toEpochMilli()); }
        sql.append(" ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?");
        parameters.add(query.limit());
        parameters.add(query.offset());
        try (PreparedStatement statement = connection.prepareStatement(sql.toString())) {
            for (int i = 0; i < parameters.size(); i++) statement.setObject(i + 1, parameters.get(i));
            try (ResultSet rows = statement.executeQuery()) {
                List<TransactionEntry> result = new ArrayList<>();
                while (rows.next()) result.add(new TransactionEntry(
                        UUID.fromString(rows.getString("id")), UUID.fromString(rows.getString("operation_id")),
                        Instant.ofEpochMilli(rows.getLong("timestamp")), UUID.fromString(rows.getString("player_uuid")),
                        rows.getString("player_name"), TransactionEntry.Type.valueOf(rows.getString("type")),
                        rows.getString("shop"), rows.getString("item"), rows.getInt("quantity"),
                        rows.getDouble("unit_price"), rows.getDouble("total")));
                return List.copyOf(result);
            }
        }
    }

    @Override
    public synchronized void close() throws SQLException {
        connection.close();
    }

    public record Query(String player, String shop, String item, TransactionEntry.Type type,
                        Instant from, Instant to, int limit, int offset) {
        public Query {
            if (limit < 1 || limit > 100 || offset < 0 || (from != null && to != null && !from.isBefore(to))) {
                throw new IllegalArgumentException("Invalid ledger date range or pagination");
            }
        }
    }
}
