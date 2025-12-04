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

    public UpdateChecker(ShopPlugin plugin, String projectSlug) {
        this.plugin = plugin;
        this.projectSlug = projectSlug;
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

        getVersion(latestVersion -> {
            String currentVersion = plugin.getDescription().getVersion();
            
            // Simple string comparison (works if semantic versioning is strictly followed)
            if (currentVersion.equalsIgnoreCase(latestVersion)) return;

            // Notify Console with color
            String prefix = "&8&l| &cGENIUS-SHOP &8&l| ";
            Bukkit.getConsoleSender().sendMessage(ItemUtil.color(prefix + "&aThere is a new update available &7(&c" + currentVersion + " &7-> &a" + latestVersion + "&7)"));
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
            if (currentVersion.equalsIgnoreCase(latestVersion)) return;

            String msg = plugin.getMessages().getMessage("update-available")
                    .replace("%current%", currentVersion)
                    .replace("%new%", latestVersion);
            
            player.sendMessage(msg);
        });
    }
}
