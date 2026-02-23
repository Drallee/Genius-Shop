package me.dralle.shop.util;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import me.dralle.shop.ShopPlugin;
import org.bukkit.Bukkit;
import org.bukkit.Sound;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

public class UpdateChecker implements Listener {

    private final ShopPlugin plugin;
    private final String projectSlug; // Modrinth project slug (e.g., "genius-shop")
    private String latestVersion = null;
    private volatile List<String> latestReleaseHighlights = Collections.emptyList();
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

    public List<String> getLatestReleaseHighlights() {
        return new ArrayList<>(latestReleaseHighlights);
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
                    me.dralle.shop.util.ConsoleLog.warn(plugin, "Modrinth API returned code: " + connection.getResponseCode());
                    return;
                }

                try (InputStream inputStream = connection.getInputStream();
                     InputStreamReader reader = new InputStreamReader(inputStream, StandardCharsets.UTF_8)) {

                    JsonElement root = new JsonParser().parse(reader);
                    if (root.isJsonArray()) {
                        JsonArray versions = root.getAsJsonArray();
                        if (versions.size() > 0) {
                            JsonObject latest = versions.get(0).getAsJsonObject();
                            // The API returns versions sorted by date (newest first) by default
                            // We take the first one as the latest version
                            String latestVersionNumber = latest.get("version_number").getAsString();

                            String changelog = "";
                            if (latest.has("changelog") && !latest.get("changelog").isJsonNull()) {
                                changelog = latest.get("changelog").getAsString();
                            }
                            latestReleaseHighlights = extractHighlights(changelog, 4);

                            consumer.accept(latestVersionNumber);
                        }
                    }
                }
            } catch (IOException exception) {
                me.dralle.shop.util.ConsoleLog.warn(plugin, "Unable to check for updates: " + exception.getMessage());
            }
        });
    }

    public void checkForUpdates() {
        if (!isUpdateCheckEnabled()) return;

        getVersion(latestVersionStr -> {
            String currentVersion = plugin.getDescription().getVersion();
            this.latestVersion = latestVersionStr;

            // Use smarter version comparison
            if (!isVersionNewer(currentVersion, latestVersionStr)) {
                this.updateAvailable = false;
                me.dralle.shop.util.ConsoleLog.success(plugin, "You are running the latest version (" + currentVersion + ").");
                return;
            }

            this.updateAvailable = true;
            sendStyledConsoleUpdateMessage(currentVersion, latestVersionStr);
        });
    }

    private void sendStyledConsoleUpdateMessage(String currentVersion, String latestVersionStr) {
        String projectUrl = "https://modrinth.com/plugin/" + projectSlug;
        String versionUrl = projectUrl + "/version/" + latestVersionStr;

        Bukkit.getConsoleSender().sendMessage(ShopItemUtil.color("&8&m--------------------------------------------------------------"));
        Bukkit.getConsoleSender().sendMessage(ShopItemUtil.color("&b&l[GeniusShop] &a&lUPDATE AVAILABLE"));
        Bukkit.getConsoleSender().sendMessage(ShopItemUtil.color("&7Current version: &e" + currentVersion));
        Bukkit.getConsoleSender().sendMessage(ShopItemUtil.color("&7Latest version:  &a" + latestVersionStr));
        Bukkit.getConsoleSender().sendMessage(ShopItemUtil.color("&7Download latest: &d" + versionUrl));
        Bukkit.getConsoleSender().sendMessage(ShopItemUtil.color("&7Project page:    &d" + projectUrl));
        Bukkit.getConsoleSender().sendMessage(ShopItemUtil.color("&8&m--------------------------------------------------------------"));
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        if (!isUpdateCheckEnabled()) return;

        if (!isIngameUpdateMessageEnabled()) return;

        Player player = event.getPlayer();
        if (!player.hasPermission("geniusshop.admin") && !player.isOp()) return;

        getVersion(latestVersionStr -> {
            String currentVersion = plugin.getDescription().getVersion();
            if (!isVersionNewer(currentVersion, latestVersionStr)) return;

            // Always send player messages on the main server thread.
            Bukkit.getScheduler().runTask(plugin, () -> {
                sendStyledUpdateMessage(player, currentVersion, latestVersionStr);
                playUpdateSound(player);
            });
        });
    }

    private void sendStyledUpdateMessage(Player player, String currentVersion, String latestVersionStr) {
        String downloadUrl = "https://modrinth.com/plugin/" + projectSlug;

        player.sendMessage(ShopItemUtil.color("&8&m---------------------------------------------"));
        player.sendMessage(ShopItemUtil.color("&9&l-------- &d&lGENIUSSHOP UPDATE &9&l--------"));
        player.sendMessage("");
        player.sendMessage(ShopItemUtil.color("&a&l>> &aNEW UPDATE AVAILABLE!"));
        player.sendMessage(ShopItemUtil.color("&7>> CURRENT: &e" + currentVersion + " &7* LATEST: &a" + latestVersionStr));
        player.sendMessage(ShopItemUtil.color("&5&l>> &d&l[DOWNLOAD] &7" + downloadUrl));

        player.sendMessage("");
        player.sendMessage(ShopItemUtil.color("&8&m---------------------------------------------"));
    }

    private void playUpdateSound(Player player) {
        if (!isUpdateSoundEnabled()) return;

        String soundName = plugin.getConfig().getString("updates.message-sound.type",
                plugin.getConfig().getString("update-message-sound.type", "BLOCK_NOTE_BLOCK_PLING"));
        float volume = (float) plugin.getConfig().getDouble("updates.message-sound.volume",
                plugin.getConfig().getDouble("update-message-sound.volume", 1.0D));
        float pitch = (float) plugin.getConfig().getDouble("updates.message-sound.pitch",
                plugin.getConfig().getDouble("update-message-sound.pitch", 1.2D));

        try {
            Sound sound = Sound.valueOf(soundName.toUpperCase(java.util.Locale.ROOT));
            player.playSound(player.getLocation(), sound, volume, pitch);
        } catch (IllegalArgumentException ex) {
            me.dralle.shop.util.ConsoleLog.warn(plugin, "Invalid update sound in config: " + soundName);
        }
    }

    private boolean isUpdateCheckEnabled() {
        return plugin.getConfig().getBoolean("updates.check-updates",
                plugin.getConfig().getBoolean("check-updates", true));
    }

    private boolean isIngameUpdateMessageEnabled() {
        return plugin.getConfig().getBoolean("updates.send-update-message-ingame",
                plugin.getConfig().getBoolean("send-update-message-ingame", true));
    }

    private boolean isUpdateSoundEnabled() {
        return plugin.getConfig().getBoolean("updates.message-sound.enabled",
                plugin.getConfig().getBoolean("update-message-sound.enabled", true));
    }

    private List<String> extractHighlights(String changelog, int maxLines) {
        if (changelog == null || changelog.trim().isEmpty()) return Collections.emptyList();

        List<String> out = new ArrayList<>();
        String[] lines = changelog.split("\\r?\\n");

        for (String raw : lines) {
            if (out.size() >= maxLines) break;
            if (raw == null) continue;

            String line = raw.trim();
            if (line.isEmpty()) continue;
            if (line.startsWith("#")) continue;

            if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("+ ")) {
                line = line.substring(2).trim();
            } else if (line.matches("^\\d+\\.\\s+.*")) {
                int idx = line.indexOf('.');
                if (idx >= 0 && idx + 1 < line.length()) {
                    line = line.substring(idx + 1).trim();
                }
            } else {
                continue;
            }

            line = line.replace("`", "").replace("**", "").replace("__", "").trim();
            if (line.isEmpty()) continue;

            out.add(line);
        }

        if (!out.isEmpty()) return out;

        // Fallback: take first non-empty non-header lines if changelog has no bullet points.
        for (String raw : lines) {
            if (out.size() >= maxLines) break;
            if (raw == null) continue;
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            line = line.replace("`", "").replace("**", "").replace("__", "").trim();
            if (!line.isEmpty()) {
                out.add(line);
            }
        }

        return out;
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
