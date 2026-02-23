package me.dralle.shop.data;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.util.YamlUtil;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Base64;
import java.util.UUID;
import java.util.logging.Level;

public class DataManager {

    private final ShopPlugin plugin;
    private final File sqliteFile;
    private final File legacyYamlFile;
    private Connection connection;

    public DataManager(ShopPlugin plugin) {
        this.plugin = plugin;
        this.sqliteFile = new File(plugin.getDataFolder(), "data.db");
        this.legacyYamlFile = new File(plugin.getDataFolder(), "data.yml");
        load();
    }

    public synchronized void load() {
        close();
        try {
            Class.forName("org.sqlite.JDBC");
            this.connection = DriverManager.getConnection("jdbc:sqlite:" + sqliteFile.getAbsolutePath());
            try (PreparedStatement pragma = connection.prepareStatement("PRAGMA journal_mode=WAL")) {
                pragma.execute();
            }
            createSchema();
            migrateLegacyYamlIfNeeded();
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to initialize SQLite data store", e);
        }
    }

    private void createSchema() throws SQLException {
        executeUpdate("""
                CREATE TABLE IF NOT EXISTS player_counts (
                  uuid TEXT NOT NULL,
                  item_key TEXT NOT NULL,
                  count INTEGER NOT NULL DEFAULT 0,
                  PRIMARY KEY (uuid, item_key)
                )
                """);
        executeUpdate("""
                CREATE TABLE IF NOT EXISTS global_counts (
                  item_key TEXT PRIMARY KEY,
                  count INTEGER NOT NULL DEFAULT 0
                )
                """);
        executeUpdate("""
                CREATE TABLE IF NOT EXISTS stock_resets (
                  reset_id TEXT PRIMARY KEY,
                  last_run INTEGER NOT NULL DEFAULT 0
                )
                """);
    }

    private void migrateLegacyYamlIfNeeded() {
        if (!legacyYamlFile.exists()) return;
        if (hasAnyData()) {
            // Data already present in DB; do not re-migrate.
            return;
        }

        FileConfiguration yaml = YamlUtil.loadUtf8(legacyYamlFile);
        if (yaml == null) return;

        try {
            connection.setAutoCommit(false);

            ConfigurationSection players = yaml.getConfigurationSection("players");
            if (players != null) {
                for (String uuid : players.getKeys(false)) {
                    ConfigurationSection byItem = players.getConfigurationSection(uuid);
                    if (byItem == null) continue;
                    for (String itemKey : byItem.getKeys(false)) {
                        int count = byItem.getInt(itemKey, 0);
                        setPlayerCountRaw(uuid, itemKey, count);
                    }
                }
            }

            ConfigurationSection global = yaml.getConfigurationSection("global");
            if (global != null) {
                for (String itemKey : global.getKeys(false)) {
                    int count = global.getInt(itemKey, 0);
                    setGlobalCountRaw(itemKey, count);
                }
            }

            ConfigurationSection stock = yaml.getConfigurationSection("stock-resets.last-run");
            if (stock != null) {
                for (String resetKey : stock.getKeys(false)) {
                    long lastRun = stock.getLong(resetKey, 0L);
                    setLastStockResetRaw(resetKey, lastRun);
                }
            }

            connection.commit();
            connection.setAutoCommit(true);

            File backup = new File(plugin.getDataFolder(), "data.yml.migrated");
            boolean renamed = legacyYamlFile.renameTo(backup);
            if (renamed) {
                me.dralle.shop.util.ConsoleLog.info(plugin, "Migrated legacy data.yml to SQLite data.db (backup: data.yml.migrated)");
            } else {
                me.dralle.shop.util.ConsoleLog.warn(plugin, "Migrated data.yml to SQLite but could not rename legacy file.");
            }
        } catch (Exception e) {
            try {
                connection.rollback();
                connection.setAutoCommit(true);
            } catch (SQLException ignored) {
            }
            plugin.getLogger().log(Level.SEVERE, "Failed migrating data.yml to SQLite", e);
        }
    }

    private boolean hasAnyData() {
        try (PreparedStatement ps = connection.prepareStatement("""
                SELECT
                  (SELECT COUNT(*) FROM player_counts) +
                  (SELECT COUNT(*) FROM global_counts) +
                  (SELECT COUNT(*) FROM stock_resets)
                """);
             ResultSet rs = ps.executeQuery()) {
            return rs.next() && rs.getLong(1) > 0;
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed checking existing SQLite data", e);
            return false;
        }
    }

    public synchronized void save() {
        // SQLite writes are immediate. Keep method for compatibility with existing calls.
    }

    public synchronized int getPlayerCount(UUID uuid, String itemKey) {
        String sql = "SELECT count FROM player_counts WHERE uuid = ? AND item_key = ?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, uuid.toString());
            ps.setString(2, itemKey);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed to read player count", e);
            return 0;
        }
    }

    public synchronized void incrementPlayerCount(UUID uuid, String itemKey, int amount) {
        String sql = """
                INSERT INTO player_counts(uuid, item_key, count)
                VALUES (?, ?, ?)
                ON CONFLICT(uuid, item_key) DO UPDATE SET count = count + excluded.count
                """;
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, uuid.toString());
            ps.setString(2, itemKey);
            ps.setInt(3, amount);
            ps.executeUpdate();
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed to increment player count", e);
        }
    }

    public synchronized int getGlobalCount(String itemKey) {
        String sql = "SELECT count FROM global_counts WHERE item_key = ?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, itemKey);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed to read global count", e);
            return 0;
        }
    }

    public synchronized void incrementGlobalCount(String itemKey, int amount) {
        String sql = """
                INSERT INTO global_counts(item_key, count)
                VALUES (?, ?)
                ON CONFLICT(item_key) DO UPDATE SET count = count + excluded.count
                """;
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, itemKey);
            ps.setInt(2, amount);
            ps.executeUpdate();
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed to increment global count", e);
        }
    }

    public synchronized void setGlobalCount(String itemKey, int value, boolean saveNow) {
        try {
            setGlobalCountRaw(itemKey, Math.max(0, value));
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed to set global count", e);
        }
    }

    public synchronized void resetGlobalCount(String itemKey, boolean saveNow) {
        setGlobalCount(itemKey, 0, saveNow);
    }

    public synchronized long getLastStockReset(String resetId) {
        String key = encode(resetId);
        String sql = "SELECT last_run FROM stock_resets WHERE reset_id = ?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getLong(1) : 0L;
            }
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed to read last stock reset", e);
            return 0L;
        }
    }

    public synchronized void setLastStockReset(String resetId, long epochMillis, boolean saveNow) {
        try {
            setLastStockResetRaw(encode(resetId), epochMillis);
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed to set last stock reset", e);
        }
    }

    public synchronized void close() {
        if (connection != null) {
            try {
                connection.close();
            } catch (SQLException ignored) {
            }
            connection = null;
        }
    }

    private void executeUpdate(String sql) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.executeUpdate();
        }
    }

    private void setPlayerCountRaw(String uuid, String itemKey, int count) throws SQLException {
        String sql = """
                INSERT INTO player_counts(uuid, item_key, count)
                VALUES (?, ?, ?)
                ON CONFLICT(uuid, item_key) DO UPDATE SET count = excluded.count
                """;
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, uuid);
            ps.setString(2, itemKey);
            ps.setInt(3, Math.max(0, count));
            ps.executeUpdate();
        }
    }

    private void setGlobalCountRaw(String itemKey, long value) throws SQLException {
        String sql = """
                INSERT INTO global_counts(item_key, count)
                VALUES (?, ?)
                ON CONFLICT(item_key) DO UPDATE SET count = excluded.count
                """;
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, itemKey);
            ps.setLong(2, Math.max(0L, value));
            ps.executeUpdate();
        }
    }

    private void setLastStockResetRaw(String resetIdEncoded, long epochMillis) throws SQLException {
        String sql = """
                INSERT INTO stock_resets(reset_id, last_run)
                VALUES (?, ?)
                ON CONFLICT(reset_id) DO UPDATE SET last_run = excluded.last_run
                """;
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, resetIdEncoded);
            ps.setLong(2, Math.max(0L, epochMillis));
            ps.executeUpdate();
        }
    }

    private String encode(String raw) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }
}
