package me.dralle.shop.util;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import me.dralle.shop.util.YamlUtil;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;

/**
 * Smart configuration updater with version checking.
 *
 * Features:
 *  - Never overwrites user edits
 *  - Merges missing defaults if version is older or missing
 *  - Controlled by "merge-missing-defaults" in config.yml
 *  - Updates config-version when merging
 */
public class ConfigUpdater {

    /**
     * Update a single YML file in the plugin's data folder
     * using the same file from inside the jar as the source of defaults.
     */
    public static void update(JavaPlugin plugin, String fileName) {
        File userFile = new File(plugin.getDataFolder(), fileName);
        if (!userFile.exists()) {
            // if user doesn't have this file, just copy the default
            try {
                plugin.saveResource(fileName, false);
                me.dralle.shop.util.ConsoleLog.info(plugin, "Created default " + fileName);
            } catch (Exception e) {
                // If the specific file isn't in the JAR, try saving en_US as a fallback if it's a language file
                if (fileName.startsWith("languages/")) {
                    try (InputStream enIn = plugin.getResource("languages/en_US.yml")) {
                        if (enIn != null) {
                            YamlConfiguration fallback = YamlConfiguration.loadConfiguration(new InputStreamReader(enIn, StandardCharsets.UTF_8));
                            YamlUtil.saveUtf8(fallback, userFile);
                            me.dralle.shop.util.ConsoleLog.info(plugin, "Created " + fileName + " from en_US.yml fallback.");
                        }
                    } catch (Exception ex) {
                        me.dralle.shop.util.ConsoleLog.warn(plugin, "Could not create " + fileName + " from en_US fallback: " + ex.getMessage());
                    }
                } else {
                    me.dralle.shop.util.ConsoleLog.warn(plugin, "Could not create " + fileName + ": " + e.getMessage());
                }
            }
            return;
        }

        // Check if the file is broken (exists but no keys can be read)
        YamlConfiguration userCfg = YamlUtil.loadUtf8(userFile);
        boolean isBroken = userCfg.getKeys(false).isEmpty() && userFile.length() > 0;

        if (fileName.startsWith("menus/") && !isBroken) {
            // Special handling for menu files: if it exists and is not broken, 
            // we NEVER want to merge missing defaults as it pollutes custom menus.
            return;
        }

        if (isBroken) {
            me.dralle.shop.util.ConsoleLog.warn(plugin, fileName + " appears to be broken or has invalid syntax. Creating backup and resetting to defaults.");
            backupFile(userFile, plugin);
            try {
                plugin.saveResource(fileName, true);
            } catch (Exception e) {
                me.dralle.shop.util.ConsoleLog.error(plugin, "Failed to reset broken " + fileName + ": " + e.getMessage());
            }
            return;
        }

        // read global setting from config.yml
        boolean mergeMissingDefaults = true;
        try {
            File mainConfig = new File(plugin.getDataFolder(), "config.yml");
            if (mainConfig.exists()) {
                YamlConfiguration main = YamlUtil.loadUtf8(mainConfig);
                mergeMissingDefaults = main.getBoolean("merge-missing-defaults", true);
            }
        } catch (Exception ex) {
            me.dralle.shop.util.ConsoleLog.warn(plugin, "Could not read merge-missing-defaults from config.yml: " + ex.getMessage());
        }

        if (!mergeMissingDefaults) {
            return;
        }

        try {
            int userVersion = userCfg.getInt("config-version", -1);
            boolean changed = false;
            int maxDefaultVersion = 0;

            // Migrate renamed/relocated keys in config.yml while preserving user values.
            if ("config.yml".equals(fileName)) {
                if (migrateLegacyConfigKeys(userCfg)) {
                    changed = true;
                }
            }

            // 1. Load specific default from JAR
            YamlConfiguration defCfg = null;
            try (InputStream in = plugin.getResource(fileName)) {
                if (in != null) {
                    defCfg = YamlConfiguration.loadConfiguration(new InputStreamReader(in, StandardCharsets.UTF_8));
                    maxDefaultVersion = Math.max(maxDefaultVersion, defCfg.getInt("config-version", 1));
                }
            }

            // 2. Load en_US as fallback if it's a language file
            YamlConfiguration enCfg = null;
            if (fileName.startsWith("languages/")) {
                try (InputStream enIn = plugin.getResource("languages/en_US.yml")) {
                    if (enIn != null) {
                        enCfg = YamlConfiguration.loadConfiguration(new InputStreamReader(enIn, StandardCharsets.UTF_8));
                        maxDefaultVersion = Math.max(maxDefaultVersion, enCfg.getInt("config-version", 1));
                    }
                }
            }

            // If we have no default at all, we can't update
            if (defCfg == null && enCfg == null) {
                return;
            }

            if (userVersion < maxDefaultVersion) {
                // Perform merges
                // First, merge from the specific default file (e.g. fr_FR.yml in JAR)
                if (defCfg != null) {
                    if (mergeSections(defCfg, userCfg, "", true)) {
                        changed = true;
                    }
                }

                // Second, merge from en_US as fallback for anything still missing
                if (enCfg != null) {
                    if (mergeSections(enCfg, userCfg, "", true)) {
                        changed = true;
                    }
                }

            }

            if (changed || userVersion < maxDefaultVersion) {
                backupFile(userFile, plugin);
                if (userVersion < maxDefaultVersion) {
                    userCfg.set("config-version", maxDefaultVersion);
                }
                YamlUtil.saveUtf8(userCfg, userFile);
                if (changed && userVersion < maxDefaultVersion) {
                    me.dralle.shop.util.ConsoleLog.info(plugin, "Updated " + fileName + " with missing features (version " + maxDefaultVersion + ").");
                } else if (changed) {
                    me.dralle.shop.util.ConsoleLog.info(plugin, "Migrated legacy keys in " + fileName + ".");
                } else if (userVersion < maxDefaultVersion) {
                    me.dralle.shop.util.ConsoleLog.info(plugin, fileName + " version bumped to " + maxDefaultVersion);
                }
            }

        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.warn(plugin, "Could not update " + fileName + ": " + e.getMessage());
        }
    }

    private static boolean migrateLegacyConfigKeys(YamlConfiguration userCfg) {
        boolean changed = false;

        // Legacy root key -> new nested location
        if (userCfg.contains("send-update-message-ingame")) {
            boolean legacyValue = userCfg.getBoolean("send-update-message-ingame", true);
            userCfg.set("updates.send-update-message-ingame", legacyValue);
            userCfg.set("send-update-message-ingame", null);
            changed = true;
        }

        // Also support older root check-updates key migration if present.
        if (userCfg.contains("check-updates")) {
            boolean legacyValue = userCfg.getBoolean("check-updates", true);
            userCfg.set("updates.check-updates", legacyValue);
            userCfg.set("check-updates", null);
            changed = true;
        }

        // Legacy root section -> new nested location
        if (userCfg.isConfigurationSection("update-message-sound")) {
            ConfigurationSection legacySection = userCfg.getConfigurationSection("update-message-sound");
            if (legacySection != null) {
                userCfg.set("updates.message-sound", null);
                for (Map.Entry<String, Object> entry : legacySection.getValues(true).entrySet()) {
                    userCfg.set("updates.message-sound." + entry.getKey(), entry.getValue());
                }
                userCfg.set("update-message-sound", null);
                changed = true;
            }
        }

        // Legacy compact.enabled toggle -> mode
        if (userCfg.contains("price-format.compact.enabled")) {
            boolean compactEnabled = userCfg.getBoolean("price-format.compact.enabled", false);
            if (compactEnabled) {
                userCfg.set("price-format.mode", "compact");
            }
            userCfg.set("price-format.compact.enabled", null);
            changed = true;
        }

        return changed;
    }

    private static void backupFile(File file, JavaPlugin plugin) {
        if (!file.exists()) return;
        File backup = new File(file.getParent(), file.getName() + ".bak");
        try {
            Files.copy(file.toPath(), backup.toPath(), StandardCopyOption.REPLACE_EXISTING);
            if (plugin != null) {
                me.dralle.shop.util.ConsoleLog.info(plugin, "Created backup of " + file.getName() + " as " + backup.getName());
            }
        } catch (Exception e) {
            if (plugin != null) {
                me.dralle.shop.util.ConsoleLog.warn(plugin, "Failed to create backup of " + file.getName() + ": " + e.getMessage());
            }
        }
    }

    /**
     * Recursively merges missing keys and sections from defaults to user configs.
     *
     * @param def      defaults (in jar)
     * @param user     user config
     * @param path     current section path
     * @param allowAdd if missing sections should be added
     * @return true if any changes were made
     */
    private static boolean mergeSections(ConfigurationSection def,
                                         ConfigurationSection user,
                                         String path,
                                         boolean allowAdd) {
        boolean changed = false;
        Set<String> keys = def.getKeys(false);

        for (String key : keys) {
            String fullPath = path.isEmpty() ? key : path + "." + key;

            if (!user.contains(key)) {
                if (allowAdd) {
                    user.set(key, def.get(key));
                    changed = true;
                }
                continue;
            }

            // dive into subsections
            if (def.isConfigurationSection(key)) {
                ConfigurationSection defChild = def.getConfigurationSection(key);
                ConfigurationSection userChild = user.getConfigurationSection(key);
                if (defChild != null && userChild != null) {
                    if (mergeSections(defChild, userChild, fullPath, allowAdd)) {
                        changed = true;
                    }
                }
            }
        }
        return changed;
    }
}
