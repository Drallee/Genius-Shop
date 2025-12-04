package me.dralle.shop;

import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

/**
 * Manages loading and migration of menu configuration files
 */
public class MenuManager {
    private final ShopPlugin plugin;
    private FileConfiguration mainMenuConfig;
    private FileConfiguration purchaseMenuConfig;
    private FileConfiguration sellMenuConfig;
    private FileConfiguration guiSettingsConfig;

    public MenuManager(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Initialize menu configurations
     * Handles migration from old gui.yml to new menu files
     */
    public void load() {
        File menusDir = new File(plugin.getDataFolder(), "menus");
        File oldGuiFile = new File(plugin.getDataFolder(), "gui.yml");

        // Check if we need to migrate from gui.yml
        if (oldGuiFile.exists() && !menusDir.exists()) {
            plugin.getLogger().info("Detected old gui.yml format. Migrating to new menu structure...");
            migrateFromGuiYml(oldGuiFile, menusDir);
        }

        // Create menus directory if it doesn't exist
        if (!menusDir.exists()) {
            menusDir.mkdirs();
        }

        // Save default menu files if they don't exist
        saveDefaultMenuFile("main-menu.yml");
        saveDefaultMenuFile("purchase-menu.yml");
        saveDefaultMenuFile("sell-menu.yml");
        saveDefaultMenuFile("gui-settings.yml");

        // Load menu configurations
        mainMenuConfig = YamlConfiguration.loadConfiguration(new File(menusDir, "main-menu.yml"));
        purchaseMenuConfig = YamlConfiguration.loadConfiguration(new File(menusDir, "purchase-menu.yml"));
        sellMenuConfig = YamlConfiguration.loadConfiguration(new File(menusDir, "sell-menu.yml"));
        guiSettingsConfig = YamlConfiguration.loadConfiguration(new File(menusDir, "gui-settings.yml"));

        plugin.getLogger().info("Menu configurations loaded successfully");
    }

    /**
     * Migrate from old gui.yml to new menu structure
     */
    private void migrateFromGuiYml(File oldGuiFile, File menusDir) {
        try {
            // Create backup
            File backupFile = new File(plugin.getDataFolder(), "gui.yml.backup");
            Files.copy(oldGuiFile.toPath(), backupFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            plugin.getLogger().info("Created backup: gui.yml.backup");

            // Load old gui.yml
            FileConfiguration oldConfig = YamlConfiguration.loadConfiguration(oldGuiFile);

            // Create menus directory
            menusDir.mkdirs();

            // Split into new files
            migrateMainMenu(oldConfig, menusDir);
            migratePurchaseMenu(oldConfig, menusDir);
            migrateSellMenu(oldConfig, menusDir);

            // Don't migrate gui-settings - always use defaults from resources
            // Old gui.yml rarely has these settings, so extract fresh defaults
            plugin.getLogger().info("Using default gui-settings.yml from resources");

            plugin.getLogger().info("Migration completed successfully!");

            // Delete the old gui.yml file after successful backup
            if (oldGuiFile.delete()) {
                plugin.getLogger().info("Deleted old gui.yml (backup saved as gui.yml.backup)");
            } else {
                plugin.getLogger().warning("Failed to delete old gui.yml - you can manually delete it");
            }

        } catch (IOException e) {
            plugin.getLogger().severe("Failed to migrate gui.yml: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void migrateMainMenu(FileConfiguration oldConfig, File menusDir) throws IOException {
        File mainMenuFile = new File(menusDir, "main-menu.yml");
        FileConfiguration newConfig = new YamlConfiguration();

        // Copy main menu settings
        newConfig.set("title", oldConfig.getString("gui.main.title", "&8Shop Menu"));
        newConfig.set("rows", oldConfig.getInt("gui.main.rows", 3));

        // Copy items
        if (oldConfig.contains("gui.main.items")) {
            newConfig.set("items", oldConfig.getConfigurationSection("gui.main.items"));
        }

        newConfig.save(mainMenuFile);
        plugin.getLogger().info("Created main-menu.yml");
    }

    private void migratePurchaseMenu(FileConfiguration oldConfig, File menusDir) throws IOException {
        File purchaseMenuFile = new File(menusDir, "purchase-menu.yml");
        FileConfiguration newConfig = new YamlConfiguration();

        // Copy purchase settings
        newConfig.set("title-prefix", oldConfig.getString("gui.purchase.title-prefix", "&8Buying "));
        newConfig.set("display-material", "BOOK");
        newConfig.set("display-slot", oldConfig.getInt("gui.purchase.display-slot", 22));
        newConfig.set("max-amount", oldConfig.getInt("gui.purchase.max-amount", 2304));

        // Copy lore settings
        newConfig.set("lore.amount", oldConfig.getString("gui.purchase.amount", "&eAmount: &7"));
        newConfig.set("lore.total", oldConfig.getString("gui.purchase.total", "&eTotal: &7"));
        newConfig.set("lore.spawner", oldConfig.getString("gui.purchase.spawner", "&7Spawner: &e"));

        // Copy buttons
        if (oldConfig.contains("gui.purchase.confirm")) {
            newConfig.set("buttons.confirm", oldConfig.getConfigurationSection("gui.purchase.confirm"));
        }
        if (oldConfig.contains("gui.purchase.cancel")) {
            newConfig.set("buttons.cancel", oldConfig.getConfigurationSection("gui.purchase.cancel"));
        }
        if (oldConfig.contains("gui.purchase.back")) {
            newConfig.set("buttons.back", oldConfig.getConfigurationSection("gui.purchase.back"));
        }
        if (oldConfig.contains("gui.purchase.add")) {
            // Copy add buttons, but need to restructure them
            var addSection = oldConfig.getConfigurationSection("gui.purchase.add");
            if (addSection != null) {
                String material = addSection.getString("material", "LIME_STAINED_GLASS_PANE");
                for (String key : addSection.getKeys(false)) {
                    if (!key.equals("material") && addSection.isConfigurationSection(key)) {
                        var buttonSection = addSection.getConfigurationSection(key);
                        newConfig.set("buttons.add." + key + ".material", material);
                        newConfig.set("buttons.add." + key + ".name", buttonSection.getString("name"));
                        newConfig.set("buttons.add." + key + ".slot", buttonSection.getInt("slot"));
                    }
                }
            }
        }
        if (oldConfig.contains("gui.purchase.remove")) {
            var removeSection = oldConfig.getConfigurationSection("gui.purchase.remove");
            if (removeSection != null) {
                String material = removeSection.getString("material", "RED_STAINED_GLASS_PANE");
                for (String key : removeSection.getKeys(false)) {
                    if (!key.equals("material") && removeSection.isConfigurationSection(key)) {
                        var buttonSection = removeSection.getConfigurationSection(key);
                        newConfig.set("buttons.remove." + key + ".material", material);
                        newConfig.set("buttons.remove." + key + ".name", buttonSection.getString("name"));
                        newConfig.set("buttons.remove." + key + ".slot", buttonSection.getInt("slot"));
                    }
                }
            }
        }
        if (oldConfig.contains("gui.purchase.set")) {
            var setSection = oldConfig.getConfigurationSection("gui.purchase.set");
            if (setSection != null) {
                String material = setSection.getString("material", "YELLOW_STAINED_GLASS_PANE");
                for (String key : setSection.getKeys(false)) {
                    if (!key.equals("material") && setSection.isConfigurationSection(key)) {
                        var buttonSection = setSection.getConfigurationSection(key);
                        newConfig.set("buttons.set." + key + ".material", material);
                        newConfig.set("buttons.set." + key + ".name", buttonSection.getString("name"));
                        newConfig.set("buttons.set." + key + ".slot", buttonSection.getInt("slot"));
                    }
                }
            }
        }

        newConfig.save(purchaseMenuFile);
        plugin.getLogger().info("Created purchase-menu.yml");
    }

    private void migrateSellMenu(FileConfiguration oldConfig, File menusDir) throws IOException {
        File sellMenuFile = new File(menusDir, "sell-menu.yml");
        FileConfiguration newConfig = new YamlConfiguration();

        // Copy sell settings
        newConfig.set("title-prefix", oldConfig.getString("gui.sell.title-prefix", "&8Selling "));
        newConfig.set("display-material", "BOOK");
        newConfig.set("display-slot", oldConfig.getInt("gui.sell.display-slot", 22));
        newConfig.set("max-amount", oldConfig.getInt("gui.sell.max-amount", 2304));

        // Copy lore settings
        newConfig.set("lore.selected-amount", oldConfig.getString("gui.sell.selected-amount", "&eSelected amount: &7"));
        newConfig.set("lore.sell-price", oldConfig.getString("gui.sell.sell-price", "&eSell price: &7"));
        newConfig.set("lore.you-own", oldConfig.getString("gui.sell.you-own", "&eYou own: &7"));
        newConfig.set("lore.spawner", oldConfig.getString("gui.sell.spawner", "&7Spawner: &e"));

        // Copy buttons (same structure as purchase)
        if (oldConfig.contains("gui.sell.confirm")) {
            newConfig.set("buttons.confirm", oldConfig.getConfigurationSection("gui.sell.confirm"));
        }
        if (oldConfig.contains("gui.sell.sell-all")) {
            newConfig.set("buttons.sell-all", oldConfig.getConfigurationSection("gui.sell.sell-all"));
        }
        if (oldConfig.contains("gui.sell.cancel")) {
            newConfig.set("buttons.cancel", oldConfig.getConfigurationSection("gui.sell.cancel"));
        }
        if (oldConfig.contains("gui.sell.back")) {
            newConfig.set("buttons.back", oldConfig.getConfigurationSection("gui.sell.back"));
        }
        if (oldConfig.contains("gui.sell.add")) {
            var addSection = oldConfig.getConfigurationSection("gui.sell.add");
            if (addSection != null) {
                String material = addSection.getString("material", "LIME_STAINED_GLASS_PANE");
                for (String key : addSection.getKeys(false)) {
                    if (!key.equals("material") && addSection.isConfigurationSection(key)) {
                        var buttonSection = addSection.getConfigurationSection(key);
                        newConfig.set("buttons.add." + key + ".material", material);
                        newConfig.set("buttons.add." + key + ".name", buttonSection.getString("name"));
                        newConfig.set("buttons.add." + key + ".slot", buttonSection.getInt("slot"));
                    }
                }
            }
        }
        if (oldConfig.contains("gui.sell.remove")) {
            var removeSection = oldConfig.getConfigurationSection("gui.sell.remove");
            if (removeSection != null) {
                String material = removeSection.getString("material", "RED_STAINED_GLASS_PANE");
                for (String key : removeSection.getKeys(false)) {
                    if (!key.equals("material") && removeSection.isConfigurationSection(key)) {
                        var buttonSection = removeSection.getConfigurationSection(key);
                        newConfig.set("buttons.remove." + key + ".material", material);
                        newConfig.set("buttons.remove." + key + ".name", buttonSection.getString("name"));
                        newConfig.set("buttons.remove." + key + ".slot", buttonSection.getInt("slot"));
                    }
                }
            }
        }
        if (oldConfig.contains("gui.sell.set")) {
            var setSection = oldConfig.getConfigurationSection("gui.sell.set");
            if (setSection != null) {
                String material = setSection.getString("material", "YELLOW_STAINED_GLASS_PANE");
                for (String key : setSection.getKeys(false)) {
                    if (!key.equals("material") && setSection.isConfigurationSection(key)) {
                        var buttonSection = setSection.getConfigurationSection(key);
                        newConfig.set("buttons.set." + key + ".material", material);
                        newConfig.set("buttons.set." + key + ".name", buttonSection.getString("name"));
                        newConfig.set("buttons.set." + key + ".slot", buttonSection.getInt("slot"));
                    }
                }
            }
        }

        newConfig.save(sellMenuFile);
        plugin.getLogger().info("Created sell-menu.yml");
    }


    private void saveDefaultMenuFile(String fileName) {
        File file = new File(plugin.getDataFolder(), "menus/" + fileName);
        if (!file.exists()) {
            try {
                plugin.saveResource("menus/" + fileName, false);
                plugin.getLogger().info("Created default menu file: " + fileName);
            } catch (IllegalArgumentException e) {
                plugin.getLogger().severe("Failed to create menu file " + fileName + ": " + e.getMessage());
                plugin.getLogger().severe("The resource 'menus/" + fileName + "' does not exist in the plugin JAR");
            }
        }
    }

    // Getters
    public FileConfiguration getMainMenuConfig() {
        return mainMenuConfig;
    }

    public FileConfiguration getPurchaseMenuConfig() {
        return purchaseMenuConfig;
    }

    public FileConfiguration getSellMenuConfig() {
        return sellMenuConfig;
    }

    public FileConfiguration getGuiSettingsConfig() {
        return guiSettingsConfig;
    }

    /**
     * Reload all menu configurations
     */
    public void reload() {
        File menusDir = new File(plugin.getDataFolder(), "menus");
        mainMenuConfig = YamlConfiguration.loadConfiguration(new File(menusDir, "main-menu.yml"));
        purchaseMenuConfig = YamlConfiguration.loadConfiguration(new File(menusDir, "purchase-menu.yml"));
        sellMenuConfig = YamlConfiguration.loadConfiguration(new File(menusDir, "sell-menu.yml"));
        guiSettingsConfig = YamlConfiguration.loadConfiguration(new File(menusDir, "gui-settings.yml"));
    }
}
