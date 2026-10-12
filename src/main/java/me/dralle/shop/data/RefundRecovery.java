package me.dralle.shop.data;

import me.dralle.shop.economy.EconomyHook;
import org.bukkit.entity.Player;

import java.io.File;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public final class RefundRecovery implements AutoCloseable {
    public enum Status { PENDING, REFUNDING, REVIEW, RECOVERED }
    public record Case(UUID transactionId, UUID playerId, double amount, String reason, Status status,
                       long created, long updated, int attempts, String attemptedBy,
                       Long completed, String completedBy, String reviewNote) {}
    private final Connection connection;

    public RefundRecovery(File file) throws SQLException {
        connection = DriverManager.getConnection("jdbc:sqlite:" + file.getAbsolutePath());
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA busy_timeout=5000");
            statement.execute("PRAGMA journal_mode=WAL");
            statement.execute("PRAGMA synchronous=FULL");
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS refunds (
                        transaction_id TEXT PRIMARY KEY,
                        player_uuid TEXT NOT NULL,
                        amount REAL NOT NULL CHECK(amount > 0),
                        reason TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created INTEGER NOT NULL,
                        updated INTEGER NOT NULL,
                        attempts INTEGER NOT NULL DEFAULT 0,
                        attempted_by TEXT,
                        completed INTEGER,
                        completed_by TEXT,
                        review_note TEXT
                    )
                    """);
            // An interrupted payment may already have reached the economy provider.
            statement.executeUpdate("UPDATE refunds SET status='REVIEW', reason=reason || '; interrupted refund attempt requires provider review', updated="
                    + System.currentTimeMillis() + " WHERE status='REFUNDING'");
        } catch (SQLException failure) {
            connection.close();
            throw failure;
        }
    }

    public synchronized boolean enqueue(UUID id, UUID player, double amount, String reason) throws SQLException {
        if (!Double.isFinite(amount) || amount <= 0) throw new IllegalArgumentException("Invalid refund amount");
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO refunds(transaction_id, player_uuid, amount, reason, status, created, updated)
                VALUES (?, ?, ?, ?, 'PENDING', ?, ?) ON CONFLICT(transaction_id) DO NOTHING
                """)) {
            statement.setString(1, id.toString());
            statement.setString(2, player.toString());
            statement.setDouble(3, amount);
            statement.setString(4, reason);
            long now = System.currentTimeMillis();
            statement.setLong(5, now);
            statement.setLong(6, now);
            return statement.executeUpdate() == 1;
        }
    }

    public EconomyHook.EconomyOperationResult automatic(UUID id, Player player, double amount, String reason, EconomyHook economy) throws SQLException {
        if (!enqueue(id, player.getUniqueId(), amount, reason)) {
            return new EconomyHook.EconomyOperationResult(false, "Refund case already exists; inspect " + id, true);
        }
        return retry(id, player, "automatic", economy);
    }

    public EconomyHook.EconomyOperationResult retry(UUID id, Player player, String actor, EconomyHook economy) throws SQLException {
        Case original = get(id);
        if (original == null || !original.playerId().equals(player.getUniqueId())) {
            return new EconomyHook.EconomyOperationResult(false, "Refund or matching player not found");
        }
        if (!claim(id, actor)) return new EconomyHook.EconomyOperationResult(false, "Refund is not pending; inspect its status");
        EconomyHook.EconomyOperationResult result;
        try {
            result = economy.tryDeposit(player, original.amount());
            if (result == null) result = new EconomyHook.EconomyOperationResult(false, "Refund returned no result", true);
            if (result.success() && result.ambiguous()) {
                result = new EconomyHook.EconomyOperationResult(false, "Provider reported an unexpected deposit amount; review required", true);
            }
        } catch (RuntimeException failure) {
            result = new EconomyHook.EconomyOperationResult(false, failure.toString(), true);
        }
        // If this durable completion fails, REFUNDING remains and blocks another payment.
        try {
            finish(id, result.success() ? Status.RECOVERED : result.ambiguous() ? Status.REVIEW : Status.PENDING,
                    result.errorMessage(), actor);
        } catch (SQLException failure) {
            try {
                finish(id, Status.REVIEW, "Could not persist payment completion; verify provider history", actor);
            } catch (SQLException reviewFailure) {
                failure.addSuppressed(reviewFailure);
            }
            throw failure;
        }
        return result;
    }

    public synchronized boolean claim(UUID id, String actor) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                UPDATE refunds SET status='REFUNDING', attempts=attempts+1, updated=?, attempted_by=?
                WHERE transaction_id=? AND status='PENDING'
                """)) {
            statement.setLong(1, System.currentTimeMillis());
            statement.setString(2, actor);
            statement.setString(3, id.toString());
            return statement.executeUpdate() == 1;
        }
    }

    private synchronized void finish(UUID id, Status status, String error, String actor) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                UPDATE refunds SET status=?, reason=CASE WHEN ? IS NULL THEN reason ELSE reason || '; refund: ' || ? END,
                    updated=?, completed=?, completed_by=? WHERE transaction_id=? AND status='REFUNDING'
                """)) {
            long now = System.currentTimeMillis();
            statement.setString(1, status.name());
            statement.setString(2, error);
            statement.setString(3, error);
            statement.setLong(4, now);
            if (status == Status.RECOVERED) statement.setLong(5, now); else statement.setNull(5, Types.BIGINT);
            statement.setString(6, status == Status.RECOVERED ? actor : null);
            statement.setString(7, id.toString());
            if (statement.executeUpdate() != 1) throw new SQLException("Refund state changed during payment: " + id);
        }
    }

    public synchronized boolean review(UUID id, boolean alreadyPaid, String actor, String note) throws SQLException {
        if (note == null || note.isBlank()) throw new IllegalArgumentException("A provider review note is required");
        try (PreparedStatement statement = connection.prepareStatement("""
                UPDATE refunds SET status=?, updated=?, completed=?, completed_by=?, review_note=?
                WHERE transaction_id=? AND status='REVIEW'
                """)) {
            long now = System.currentTimeMillis();
            statement.setString(1, alreadyPaid ? "RECOVERED" : "PENDING");
            statement.setLong(2, now);
            if (alreadyPaid) statement.setLong(3, now); else statement.setNull(3, Types.BIGINT);
            statement.setString(4, alreadyPaid ? actor : null);
            statement.setString(5, actor + " at " + now + ": " + note);
            statement.setString(6, id.toString());
            return statement.executeUpdate() == 1;
        }
    }

    public synchronized Case get(UUID id) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT * FROM refunds WHERE transaction_id=?")) {
            statement.setString(1, id.toString());
            try (ResultSet rows = statement.executeQuery()) { return rows.next() ? read(rows) : null; }
        }
    }

    public synchronized List<Case> list(int page) throws SQLException {
        if (page < 1 || page > 1000000) throw new IllegalArgumentException("Invalid page");
        try (PreparedStatement statement = connection.prepareStatement("SELECT * FROM refunds WHERE status != 'RECOVERED' ORDER BY created, transaction_id LIMIT 10 OFFSET ?")) {
            statement.setInt(1, (page - 1) * 10);
            try (ResultSet rows = statement.executeQuery()) {
                List<Case> result = new ArrayList<>();
                while (rows.next()) result.add(read(rows));
                return List.copyOf(result);
            }
        }
    }

    private Case read(ResultSet rows) throws SQLException {
        long completed = rows.getLong("completed");
        Long completedAt = rows.wasNull() ? null : completed;
        return new Case(UUID.fromString(rows.getString("transaction_id")), UUID.fromString(rows.getString("player_uuid")),
                rows.getDouble("amount"), rows.getString("reason"), Status.valueOf(rows.getString("status")),
                rows.getLong("created"), rows.getLong("updated"), rows.getInt("attempts"), rows.getString("attempted_by"),
                completedAt, rows.getString("completed_by"), rows.getString("review_note"));
    }

    @Override public synchronized void close() throws SQLException { connection.close(); }
}
