package me.dralle.shop;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.*;

/**
 * Manages individual shop files in the shops/ folder.
 * Handles migration from the old monolithic shops.yml to separate files.
 */
public class ShopFileManager {

    private final ShopPlugin plugin;
    private final File shopsFolder;
    private final Map<String, FileConfiguration> shopConfigs = new LinkedHashMap<>();

    public ShopFileManager(ShopPlugin plugin) {
        this.plugin = plugin;
        this.shopsFolder = new File(plugin.getDataFolder(), "shops");

        // Ensure shops folder exists
        if (!shopsFolder.exists()) {
            if (!shopsFolder.mkdirs()) {
                plugin.getLogger().warning("Failed to create shops folder!");
            }
        }

        // Check if we need to migrate from old shops.yml
        migrateFromOldFormat();

        // Copy default shop files if shops folder is empty
        copyDefaultShopFiles();

        // Load all shop files
        loadAllShops();
    }

    /**
     * Migrates from the old shops.yml format to individual shop files.
     * Only runs if shops.yml exists and shops/ folder is empty.
     */
    private void migrateFromOldFormat() {
        File oldShopsFile = new File(plugin.getDataFolder(), "shops.yml");

        // Check if old format exists and if migration is needed
        if (!oldShopsFile.exists()) {
            plugin.getLogger().info("No shops.yml found, using individual shop files from shops/ folder.");
            return;
        }

        // Check if shops folder already has files (skip migration if it does)
        File[] existingFiles = shopsFolder.listFiles((dir, name) -> name.endsWith(".yml"));
        if (existingFiles != null && existingFiles.length > 0) {
            plugin.getLogger().info("Shop files already exist in shops/ folder. Skipping migration.");
            return;
        }

        plugin.getLogger().info("Migrating shops.yml to individual shop files...");

        FileConfiguration oldConfig = YamlConfiguration.loadConfiguration(oldShopsFile);
        ConfigurationSection shopsSection = oldConfig.getConfigurationSection("shops");

        if (shopsSection == null) {
            plugin.getLogger().warning("No shops section found in shops.yml. Nothing to migrate.");
            return;
        }

        int migratedCount = 0;
        for (String shopKey : shopsSection.getKeys(false)) {
            ConfigurationSection shopSection = shopsSection.getConfigurationSection(shopKey);
            if (shopSection == null) continue;

            // Create new YAML configuration for this shop
            YamlConfiguration newShopConfig = new YamlConfiguration();

            // Copy all data from the shop section
            newShopConfig.set("gui-name", shopSection.getString("gui-name", "&8Shop"));
            newShopConfig.set("rows", shopSection.getInt("rows", 4));
            newShopConfig.set("permission", shopSection.getString("permission", ""));

            // Copy available times if present
            if (shopSection.contains("available-times")) {
                newShopConfig.set("available-times", shopSection.getList("available-times"));
            }

            // Copy items
            if (shopSection.contains("items")) {
                newShopConfig.set("items", shopSection.getList("items"));
            }

            // Copy item-lore settings if present
            if (shopSection.contains("item-lore")) {
                ConfigurationSection itemLoreSection = shopSection.getConfigurationSection("item-lore");
                if (itemLoreSection != null) {
                    newShopConfig.createSection("item-lore", itemLoreSection.getValues(false));
                }
            }

            // Save to individual file
            File shopFile = new File(shopsFolder, shopKey + ".yml");
            try {
                newShopConfig.save(shopFile);
                migratedCount++;
                plugin.getLogger().info("Migrated shop: " + shopKey + " -> " + shopFile.getName());
            } catch (IOException e) {
                plugin.getLogger().warning("Failed to save shop file: " + shopKey + ".yml - " + e.getMessage());
            }
        }

        if (migratedCount > 0) {
            plugin.getLogger().info("Successfully migrated " + migratedCount + " shops to individual files.");

            // Create backup of old shops.yml
            File backupFile = new File(plugin.getDataFolder(), "shops.yml.backup");
            try {
                java.nio.file.Files.copy(oldShopsFile.toPath(), backupFile.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                plugin.getLogger().info("Created backup: shops.yml.backup");

                // Delete the old shops.yml file after successful backup
                if (oldShopsFile.delete()) {
                    plugin.getLogger().info("Deleted old shops.yml (backup saved as shops.yml.backup)");
                } else {
                    plugin.getLogger().warning("Failed to delete old shops.yml - you can manually delete it");
                }
            } catch (IOException e) {
                plugin.getLogger().warning("Failed to create backup of shops.yml: " + e.getMessage());
            }
        }
    }

    /**
     * Copies default shop files from resources if the shops/ folder is empty.
     */
    private void copyDefaultShopFiles() {
        // Check if config option is enabled
        if (!plugin.getConfig().getBoolean("create-default-shops", true)) {
            plugin.getLogger().info("Skipping default shop creation (create-default-shops: false)");
            return; // Config option disabled, don't create default files
        }

        // Check if shops folder already has files
        File[] existingFiles = shopsFolder.listFiles((dir, name) -> name.endsWith(".yml"));
        if (existingFiles != null && existingFiles.length > 0) {
            plugin.getLogger().info("shops folder already has " + existingFiles.length + " .yml file(s), skipping default shop creation");
            return; // Already has shop files, don't copy defaults
        }

        plugin.getLogger().info("No shop files found. Creating default shop files...");

        // List of default shop files to copy from resources
        String[] defaultShops = {"blocks", "spawners", "farming", "premium", "misc", "weekend_market"};

        int copiedCount = 0;
        for (String shopName : defaultShops) {
            String resourcePath = "shops/" + shopName + ".yml";
            File targetFile = new File(shopsFolder, shopName + ".yml");

            try {
                // Check if resource exists
                if (plugin.getResource(resourcePath) != null) {
                    plugin.saveResource(resourcePath, false);
                    copiedCount++;
                    plugin.getLogger().info("Created default shop: " + shopName + ".yml");
                } else {
                    plugin.getLogger().warning("Resource not found in JAR: " + resourcePath);
                }
            } catch (IllegalArgumentException e) {
                plugin.getLogger().severe("Failed to create default shop file: " + shopName + ".yml - " + e.getMessage());
                plugin.getLogger().severe("The resource '" + resourcePath + "' does not exist in the plugin JAR");
            } catch (Exception e) {
                plugin.getLogger().warning("Failed to create default shop file: " + shopName + ".yml - " + e.getMessage());
            }
        }

        if (copiedCount > 0) {
            plugin.getLogger().info("Successfully created " + copiedCount + " default shop files.");
        }
    }

    /**
     * Loads all shop files from the shops/ folder.
     */
    private void loadAllShops() {
        shopConfigs.clear();

        File[] shopFiles = shopsFolder.listFiles((dir, name) -> name.endsWith(".yml"));
        if (shopFiles == null || shopFiles.length == 0) {
            plugin.getLogger().warning("No shop files found in shops/ folder!");
            return;
        }

        for (File shopFile : shopFiles) {
            String shopKey = shopFile.getName().replace(".yml", "");
            FileConfiguration config = YamlConfiguration.loadConfiguration(shopFile);
            shopConfigs.put(shopKey, config);
            plugin.getLogger().info("Loaded shop: " + shopKey + " from " + shopFile.getName());
        }
    }

    /**
     * Gets the configuration for a specific shop.
     */
    public FileConfiguration getShopConfig(String shopKey) {
        return shopConfigs.get(shopKey);
    }

    /**
     * Gets all available shop keys.
     */
    public Set<String> getShopKeys() {
        return shopConfigs.keySet();
    }

    /**
     * Reloads all shop files from disk.
     */
    public void reload() {
        loadAllShops();
    }

    /**
     * Saves a specific shop configuration to disk.
     */
    public void saveShop(String shopKey) throws IOException {
        FileConfiguration config = shopConfigs.get(shopKey);
        if (config == null) {
            throw new IllegalArgumentException("Shop not found: " + shopKey);
        }

        File shopFile = new File(shopsFolder, shopKey + ".yml");
        config.save(shopFile);
    }

    /**
     * Creates a new shop file with default values.
     */
    public void createShop(String shopKey, String guiName, int rows, String permission) throws IOException {
        File shopFile = new File(shopsFolder, shopKey + ".yml");
        if (shopFile.exists()) {
            throw new IllegalArgumentException("Shop already exists: " + shopKey);
        }

        YamlConfiguration config = new YamlConfiguration();
        config.set("gui-name", guiName);
        config.set("rows", rows);
        config.set("permission", permission);
        config.set("items", new ArrayList<>());

        config.save(shopFile);
        shopConfigs.put(shopKey, config);
    }
}
