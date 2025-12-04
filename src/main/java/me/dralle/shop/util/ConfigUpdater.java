package me.dralle.shop.util;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
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
            plugin.saveResource(fileName, false);
            plugin.getLogger().info("Created default " + fileName);
            return;
        }

        // read global setting from config.yml
        boolean mergeMissingDefaults = true;
        try {
            File mainConfig = new File(plugin.getDataFolder(), "config.yml");
            if (mainConfig.exists()) {
                YamlConfiguration main = YamlConfiguration.loadConfiguration(mainConfig);
                mergeMissingDefaults = main.getBoolean("merge-missing-defaults", true);
            }
        } catch (Exception ex) {
            plugin.getLogger().warning("Could not read merge-missing-defaults from config.yml: " + ex.getMessage());
        }

        // load the default file from inside the jar
        try (InputStream in = plugin.getResource(fileName)) {
            if (in == null) {
                plugin.getLogger().warning("Default " + fileName + " not found in jar.");
                return;
            }

            YamlConfiguration defCfg = YamlConfiguration.loadConfiguration(
                    new InputStreamReader(in, StandardCharsets.UTF_8)
            );
            YamlConfiguration userCfg = YamlConfiguration.loadConfiguration(userFile);

            int defaultVersion = defCfg.getInt("config-version", 1);
            int userVersion = userCfg.getInt("config-version", -1); // -1 = missing

            // If user file has no version, treat as outdated
            if (userVersion == -1) {
                plugin.getLogger().info("[ConfigUpdater] " + fileName + " is missing config-version. Applying latest defaults.");
                if (mergeMissingDefaults) {
                    boolean changed = mergeSections(defCfg, userCfg, "", true);
                    userCfg.set("config-version", defaultVersion);
                    userCfg.save(userFile);
                    if (changed) {
                        plugin.getLogger().info("Updated " + fileName + " to version " + defaultVersion);
                    }
                } else {
                    plugin.getLogger().info("[ConfigUpdater] merge-missing-defaults is false — skipping update.");
                }
                return;
            }

            // If user's version is already up to date or newer → do nothing
            if (userVersion >= defaultVersion) {
                return;
            }

            // User version is older → update if allowed
            if (!mergeMissingDefaults) {
                plugin.getLogger().info("[ConfigUpdater] " + fileName + " has newer defaults (" + defaultVersion +
                        ") but merge-missing-defaults=false. Skipping merge.");
                return;
            }

            boolean changed = mergeSections(defCfg, userCfg, "", true);
            userCfg.set("config-version", defaultVersion);

            // save result
            userCfg.save(userFile);
            if (changed) {
                plugin.getLogger().info("Merged new defaults into " + fileName + " (updated to version " + defaultVersion + ").");
            } else {
                plugin.getLogger().info(fileName + " version bumped to " + defaultVersion);
            }

        } catch (Exception e) {
            plugin.getLogger().warning("Could not update " + fileName + ": " + e.getMessage());
            e.printStackTrace();
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
