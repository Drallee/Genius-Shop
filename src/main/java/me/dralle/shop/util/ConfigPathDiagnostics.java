package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;

import java.io.File;

/**
 * Reports configured filesystem paths that point at missing files.
 */
public final class ConfigPathDiagnostics {

    private ConfigPathDiagnostics() {
    }

    public static void logMissingConfiguredPaths(ShopPlugin plugin) {
        if (plugin == null || !plugin.getConfig().getBoolean("debug", false)) {
            return;
        }

        String lang = plugin.getConfig().getString("language", "en_US");
        String langPath = "languages/" + (lang == null || lang.isBlank() ? "en_US" : lang.trim()) + ".yml";
        logMissingFile(plugin, "language", langPath, new File(plugin.getDataFolder(), langPath));

        if (plugin.getConfig().getBoolean("api.enabled", false)
                && plugin.getConfig().getBoolean("api.ssl.enabled", false)) {
            String keyStorePath = plugin.getConfig().getString("api.ssl.keystore", "");
            if (keyStorePath == null || keyStorePath.isBlank()) {
                logMissingPath(plugin, "api.ssl.keystore", "(empty)", null);
            } else {
                File keyStoreFile = resolveFromDataFolder(plugin, keyStorePath.trim());
                logMissingFile(plugin, "api.ssl.keystore", keyStorePath.trim(), keyStoreFile);
            }
        }
    }

    private static File resolveFromDataFolder(ShopPlugin plugin, String configuredPath) {
        File file = new File(configuredPath);
        if (file.isAbsolute()) {
            return file;
        }
        return new File(plugin.getDataFolder(), configuredPath);
    }

    private static void logMissingFile(ShopPlugin plugin, String configKey, String configuredPath, File resolvedFile) {
        if (resolvedFile == null || !resolvedFile.isFile()) {
            logMissingPath(plugin, configKey, configuredPath, resolvedFile);
        }
    }

    private static void logMissingPath(ShopPlugin plugin, String configKey, String configuredPath, File resolvedFile) {
        String resolved = resolvedFile == null ? "(not resolved)" : resolvedFile.getPath();
        String message = "Missing configured path '" + configKey + "': " + configuredPath + " (resolved: " + resolved + ")";
        ConsoleLog.warn(plugin, message);
        if (plugin.getErrorFileLogger() != null) {
            plugin.getErrorFileLogger().logDiagnostic("CONFIG_PATH", message);
        }
    }
}
