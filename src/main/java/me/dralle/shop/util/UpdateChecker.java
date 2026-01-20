package me.dralle.shop.util;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import me.dralle.shop.ShopPlugin;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.function.Consumer;

public class UpdateChecker implements Listener {

    private final ShopPlugin plugin;
    private final String projectSlug; // Modrinth project slug (e.g., "genius-shop")
    private String latestVersion = null;
    private boolean updateAvailable = false;

    public UpdateChecker(ShopPlugin plugin, String projectSlug) {
        this.plugin = plugin;
        this.projectSlug = projectSlug;
    }

    public boolean isUpdateAvailable() {
        return updateAvailable;
    }

    public String getLatestVersion() {
        return latestVersion;
    }

    public void getVersion(final Consumer<String> consumer) {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                // Modrinth API: Get all versions for this project
                URL url = new URL("https://api.modrinth.com/v2/project/" + this.projectSlug + "/version");
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setRequestProperty("User-Agent", "dralle/Genius-Shop/" + plugin.getDescription().getVersion() + " (contact@dralle.me)");

                if (connection.getResponseCode() != 200) {
                    plugin.getLogger().warning("Modrinth API returned code: " + connection.getResponseCode());
                    return;
                }

                try (InputStream inputStream = connection.getInputStream();
                     InputStreamReader reader = new InputStreamReader(inputStream)) {

                    JsonElement root = new JsonParser().parse(reader);
                    if (root.isJsonArray()) {
                        JsonArray versions = root.getAsJsonArray();
                        if (versions.size() > 0) {
                            // The API returns versions sorted by date (newest first) by default
                            // We take the first one as the latest version
                            String latestVersionNumber = versions.get(0).getAsJsonObject()
                                    .get("version_number").getAsString();
                            consumer.accept(latestVersionNumber);
                        }
                    }
                }
            } catch (IOException exception) {
                plugin.getLogger().warning("Unable to check for updates: " + exception.getMessage());
            }
        });
    }

    public void checkForUpdates() {
        if (!plugin.getConfig().getBoolean("check-updates", true)) return;

        getVersion(latestVersionStr -> {
            String currentVersion = plugin.getDescription().getVersion();
            this.latestVersion = latestVersionStr;

            // Use smarter version comparison
            if (!isVersionNewer(currentVersion, latestVersionStr)) {
                this.updateAvailable = false;
                return;
            }

            this.updateAvailable = true;

            // Notify Console with color
            String prefix = "&8&l| &cGENIUS-SHOP &8&l| ";
            Bukkit.getConsoleSender().sendMessage(ItemUtil.color(prefix + "&aThere is a new update available &7(&c" + currentVersion + " &7-> &a" + latestVersionStr + "&7)"));
            Bukkit.getConsoleSender().sendMessage(ItemUtil.color(prefix + "&aDownload it here: &ehttps://modrinth.com/plugin/" + projectSlug));
        });
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        if (!plugin.getConfig().getBoolean("check-updates", true)) return;
        
        // NEW: Check if ingame messages are enabled
        if (!plugin.getConfig().getBoolean("send-update-message-ingame", true)) return;
        
        Player player = event.getPlayer();
        if (!player.hasPermission("geniusshop.admin") && !player.isOp()) return;

        getVersion(latestVersion -> {
            String currentVersion = plugin.getDescription().getVersion();
            if (!isVersionNewer(currentVersion, latestVersion)) return;

            String msg = plugin.getMessages().getMessage("update-available")
                    .replace("%current%", currentVersion)
                    .replace("%new%", latestVersion);
            
            player.sendMessage(msg);
        });
    }

    /**
     * Compares two version strings to see if the latest is newer than the current.
     * Supports semantic versioning (1.4.0 < 1.4.1) and pre-release tags (1.4.0-BETA < 1.4.0).
     */
    public static boolean isVersionNewer(String current, String latest) {
        if (current == null || latest == null) return false;
        if (current.equalsIgnoreCase(latest)) return false;

        // Clean versions (remove leading 'v' or spaces and convert to lowercase)
        String cVersion = current.toLowerCase().trim();
        if (cVersion.startsWith("v")) cVersion = cVersion.substring(1);
        String lVersion = latest.toLowerCase().trim();
        if (lVersion.startsWith("v")) lVersion = lVersion.substring(1);

        // Split by dots, dashes and underscores
        String[] currentParts = cVersion.split("[\\.\\-\\_]");
        String[] latestParts = lVersion.split("[\\.\\-\\_]");

        int length = Math.max(currentParts.length, latestParts.length);
        for (int i = 0; i < length; i++) {
            if (i < currentParts.length && i < latestParts.length) {
                String cP = currentParts[i];
                String lP = latestParts[i];

                if (cP.equalsIgnoreCase(lP)) continue;

                boolean cIsNum = cP.matches("\\d+");
                boolean lIsNum = lP.matches("\\d+");

                if (cIsNum && lIsNum) {
                    int cN = Integer.parseInt(cP);
                    int lN = Integer.parseInt(lP);
                    if (lN > cN) return true;
                    if (cN > lN) return false;
                } else if (lIsNum) {
                    // latest is a number, current is a string (e.g., 1.4.0 vs 1.4.0-BETA)
                    // Release version is newer than pre-release if all previous parts match
                    return true;
                } else if (cIsNum) {
                    // current is a number, latest is a string (e.g., 1.4.0-BETA vs 1.4.0)
                    return false;
                } else {
                    // Both are strings (e.g., BETA vs ALPHA)
                    return lP.compareToIgnoreCase(cP) > 0;
                }
            } else if (i < latestParts.length) {
                // latest has more parts (e.g., 1.4 vs 1.4.1)
                String lP = latestParts[i];
                // 1.4.1 is newer than 1.4, but 1.4-BETA is older than 1.4
                return lP.matches("\\d+");
            } else {
                // current has more parts (e.g., 1.4.1 vs 1.4)
                String cP = currentParts[i];
                // 1.4.1 is newer than 1.4, but 1.4-BETA is older than 1.4
                return !cP.matches("\\d+");
            }
        }
        return false;
    }
}
