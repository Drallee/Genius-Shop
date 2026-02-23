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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;
import java.util.Set;
import java.util.Base64;
import java.util.UUID;
import java.util.logging.Level;

public class DataManager implements ShopStateRepository {

    private final ShopPlugin plugin;
    private final File sqliteFile;
    private final File legacyYamlFile;
    private Connection connection;
    private final Map<String, Integer> playerCounts = new LinkedHashMap<>();
    private final Map<String, Integer> globalCounts = new LinkedHashMap<>();
    private final Map<String, Long> stockResets = new LinkedHashMap<>();
    private final Set<String> dirtyPlayerKeys = new HashSet<>();
    private final Set<String> dirtyGlobalKeys = new HashSet<>();
    private final Set<String> dirtyStockKeys = new HashSet<>();

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
            try (PreparedStatement pragma = connection.prepareStatement("PRAGMA synchronous=NORMAL")) {
                pragma.execute();
            }
            createSchema();
            migrateLegacyYamlIfNeeded();
            loadCachesFromDatabase();
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

    private void loadCachesFromDatabase() {
        playerCounts.clear();
        globalCounts.clear();
        stockResets.clear();
        dirtyPlayerKeys.clear();
        dirtyGlobalKeys.clear();
        dirtyStockKeys.clear();

        try (PreparedStatement ps = connection.prepareStatement("SELECT uuid, item_key, count FROM player_counts");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String key = playerKey(rs.getString("uuid"), rs.getString("item_key"));
                playerCounts.put(key, Math.max(0, rs.getInt("count")));
            }
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed loading player_counts cache", e);
        }

        try (PreparedStatement ps = connection.prepareStatement("SELECT item_key, count FROM global_counts");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String itemKey = rs.getString("item_key");
                globalCounts.put(itemKey, Math.max(0, rs.getInt("count")));
            }
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed loading global_counts cache", e);
        }

        try (PreparedStatement ps = connection.prepareStatement("SELECT reset_id, last_run FROM stock_resets");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                stockResets.put(rs.getString("reset_id"), Math.max(0L, rs.getLong("last_run")));
            }
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed loading stock_resets cache", e);
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
        flushDirtyData();
    }

    public synchronized int getPlayerCount(UUID uuid, String itemKey) {
        return playerCounts.getOrDefault(playerKey(uuid, itemKey), 0);
    }

    public synchronized void incrementPlayerCount(UUID uuid, String itemKey, int amount) {
        String key = playerKey(uuid, itemKey);
        int next = Math.max(0, playerCounts.getOrDefault(key, 0) + amount);
        playerCounts.put(key, next);
        dirtyPlayerKeys.add(key);
    }

    public synchronized int getGlobalCount(String itemKey) {
        return globalCounts.getOrDefault(itemKey, 0);
    }

    public synchronized void incrementGlobalCount(String itemKey, int amount) {
        int next = Math.max(0, globalCounts.getOrDefault(itemKey, 0) + amount);
        globalCounts.put(itemKey, next);
        dirtyGlobalKeys.add(itemKey);
    }

    public synchronized Map<String, Integer> getAllGlobalCounts() {
        return new LinkedHashMap<>(globalCounts);
    }

    public synchronized List<PlayerCountEntry> getAllPlayerCountEntries() {
        List<PlayerCountEntry> rows = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : playerCounts.entrySet()) {
            ParsedPlayerKey parsed = parsePlayerKey(entry.getKey());
            if (parsed == null) continue;
            rows.add(new PlayerCountEntry(parsed.uuid(), parsed.itemKey(), Math.max(0, entry.getValue())));
        }
        rows.sort(java.util.Comparator
                .comparing(PlayerCountEntry::uuid, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(PlayerCountEntry::itemKey, String.CASE_INSENSITIVE_ORDER));
        return rows;
    }

    public synchronized List<GlobalCountEntry> getAllGlobalCountEntries() {
        List<GlobalCountEntry> rows = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : globalCounts.entrySet()) {
            rows.add(new GlobalCountEntry(entry.getKey(), Math.max(0, entry.getValue())));
        }
        rows.sort(java.util.Comparator.comparing(GlobalCountEntry::itemKey, String.CASE_INSENSITIVE_ORDER));
        return rows;
    }

    public synchronized List<StockResetEntry> getAllStockResetEntries() {
        List<StockResetEntry> rows = new ArrayList<>();
        for (Map.Entry<String, Long> entry : stockResets.entrySet()) {
            String storedKey = entry.getKey();
            rows.add(new StockResetEntry(
                    storedKey,
                    decodeBase64UrlOrOriginal(storedKey),
                    Math.max(0L, entry.getValue())
            ));
        }
        rows.sort(java.util.Comparator.comparing(StockResetEntry::resetId, String.CASE_INSENSITIVE_ORDER));
        return rows;
    }

    public synchronized void setPlayerCount(String uuid, String itemKey, int value, boolean saveNow) {
        if (uuid == null || uuid.isBlank() || itemKey == null || itemKey.isBlank()) return;
        String key = playerKey(uuid.trim(), itemKey.trim());
        playerCounts.put(key, Math.max(0, value));
        dirtyPlayerKeys.add(key);
        if (saveNow) save();
    }

    public synchronized void setGlobalCount(String itemKey, int value, boolean saveNow) {
        if (itemKey == null || itemKey.isBlank()) return;
        itemKey = itemKey.trim();
        globalCounts.put(itemKey, Math.max(0, value));
        dirtyGlobalKeys.add(itemKey);
        if (saveNow) save();
    }

    public synchronized void resetGlobalCount(String itemKey, boolean saveNow) {
        setGlobalCount(itemKey, 0, saveNow);
    }

    public synchronized long getLastStockReset(String resetId) {
        return stockResets.getOrDefault(encode(resetId), 0L);
    }

    public synchronized void setLastStockResetStored(String storedResetId, long epochMillis, boolean saveNow) {
        if (storedResetId == null || storedResetId.isBlank()) return;
        String key = storedResetId.trim();
        stockResets.put(key, Math.max(0L, epochMillis));
        dirtyStockKeys.add(key);
        if (saveNow) save();
    }

    public synchronized void setLastStockReset(String resetId, long epochMillis, boolean saveNow) {
        String key = encode(resetId);
        stockResets.put(key, Math.max(0L, epochMillis));
        dirtyStockKeys.add(key);
        if (saveNow) save();
    }

    public synchronized void removePlayerCount(String uuid, String itemKey) {
        if (uuid == null || uuid.isBlank() || itemKey == null || itemKey.isBlank()) return;
        String cleanUuid = uuid.trim();
        String cleanItemKey = itemKey.trim();
        playerCounts.remove(playerKey(cleanUuid, cleanItemKey));
        dirtyPlayerKeys.remove(playerKey(cleanUuid, cleanItemKey));
        if (connection == null) return;
        try (PreparedStatement ps = connection.prepareStatement(
                "DELETE FROM player_counts WHERE uuid = ? AND item_key = ?")) {
            ps.setString(1, cleanUuid);
            ps.setString(2, cleanItemKey);
            ps.executeUpdate();
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed deleting player count row", e);
        }
    }

    public synchronized void removeGlobalCount(String itemKey) {
        if (itemKey == null || itemKey.isBlank()) return;
        String cleanItemKey = itemKey.trim();
        globalCounts.remove(cleanItemKey);
        dirtyGlobalKeys.remove(cleanItemKey);
        if (connection == null) return;
        try (PreparedStatement ps = connection.prepareStatement(
                "DELETE FROM global_counts WHERE item_key = ?")) {
            ps.setString(1, cleanItemKey);
            ps.executeUpdate();
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed deleting global count row", e);
        }
    }

    public synchronized void removeStockReset(String storedResetId) {
        if (storedResetId == null || storedResetId.isBlank()) return;
        String key = storedResetId.trim();
        stockResets.remove(key);
        dirtyStockKeys.remove(key);
        if (connection == null) return;
        try (PreparedStatement ps = connection.prepareStatement(
                "DELETE FROM stock_resets WHERE reset_id = ?")) {
            ps.setString(1, key);
            ps.executeUpdate();
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Failed deleting stock reset row", e);
        }
    }

    public synchronized void close() {
        flushDirtyData();
        if (connection != null) {
            try {
                connection.close();
            } catch (SQLException ignored) {
            }
            connection = null;
        }
    }

    private void flushDirtyData() {
        if (connection == null) return;
        if (dirtyPlayerKeys.isEmpty() && dirtyGlobalKeys.isEmpty() && dirtyStockKeys.isEmpty()) return;

        List<String> playerKeys = new ArrayList<>(dirtyPlayerKeys);
        List<String> globalKeys = new ArrayList<>(dirtyGlobalKeys);
        List<String> stockKeys = new ArrayList<>(dirtyStockKeys);
        dirtyPlayerKeys.clear();
        dirtyGlobalKeys.clear();
        dirtyStockKeys.clear();

        try {
            connection.setAutoCommit(false);

            try (PreparedStatement playerPs = connection.prepareStatement("""
                    INSERT INTO player_counts(uuid, item_key, count)
                    VALUES (?, ?, ?)
                    ON CONFLICT(uuid, item_key) DO UPDATE SET count = excluded.count
                    """)) {
                for (String key : playerKeys) {
                    ParsedPlayerKey parsed = parsePlayerKey(key);
                    if (parsed == null) continue;
                    int value = Math.max(0, playerCounts.getOrDefault(key, 0));
                    playerPs.setString(1, parsed.uuid());
                    playerPs.setString(2, parsed.itemKey());
                    playerPs.setInt(3, value);
                    playerPs.addBatch();
                }
                playerPs.executeBatch();
            }

            try (PreparedStatement globalPs = connection.prepareStatement("""
                    INSERT INTO global_counts(item_key, count)
                    VALUES (?, ?)
                    ON CONFLICT(item_key) DO UPDATE SET count = excluded.count
                    """)) {
                for (String itemKey : globalKeys) {
                    int value = Math.max(0, globalCounts.getOrDefault(itemKey, 0));
                    globalPs.setString(1, itemKey);
                    globalPs.setInt(2, value);
                    globalPs.addBatch();
                }
                globalPs.executeBatch();
            }

            try (PreparedStatement stockPs = connection.prepareStatement("""
                    INSERT INTO stock_resets(reset_id, last_run)
                    VALUES (?, ?)
                    ON CONFLICT(reset_id) DO UPDATE SET last_run = excluded.last_run
                    """)) {
                for (String resetKey : stockKeys) {
                    long value = Math.max(0L, stockResets.getOrDefault(resetKey, 0L));
                    stockPs.setString(1, resetKey);
                    stockPs.setLong(2, value);
                    stockPs.addBatch();
                }
                stockPs.executeBatch();
            }

            connection.commit();
            connection.setAutoCommit(true);
        } catch (SQLException e) {
            try {
                connection.rollback();
                connection.setAutoCommit(true);
            } catch (SQLException ignored) {
            }
            dirtyPlayerKeys.addAll(playerKeys);
            dirtyGlobalKeys.addAll(globalKeys);
            dirtyStockKeys.addAll(stockKeys);
            plugin.getLogger().log(Level.WARNING, "Failed flushing cached data to SQLite", e);
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

    private String decodeBase64UrlOrOriginal(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String value = raw.trim();
        try {
            int mod = value.length() % 4;
            if (mod == 2) value += "==";
            else if (mod == 3) value += "=";
            else if (mod == 1) return raw;
            byte[] decoded = Base64.getUrlDecoder().decode(value);
            String out = new String(decoded, StandardCharsets.UTF_8);
            return out.isEmpty() ? raw : out;
        } catch (IllegalArgumentException ignored) {
            return raw;
        }
    }

    private String playerKey(UUID uuid, String itemKey) {
        return playerKey(uuid.toString(), itemKey);
    }

    private String playerKey(String uuid, String itemKey) {
        return uuid + "|" + itemKey;
    }

    private ParsedPlayerKey parsePlayerKey(String key) {
        int idx = key.indexOf('|');
        if (idx <= 0 || idx >= key.length() - 1) return null;
        return new ParsedPlayerKey(key.substring(0, idx), key.substring(idx + 1));
    }

    private record ParsedPlayerKey(String uuid, String itemKey) {}

    public record PlayerCountEntry(String uuid, String itemKey, int count) {}
    public record GlobalCountEntry(String itemKey, int count) {}
    public record StockResetEntry(String storedResetId, String resetId, long lastRun) {}
}
