package me.dralle.shop.util;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import me.dralle.shop.ShopPlugin;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Utility class for sending Discord webhooks for shop transactions.
 * Supports both plain text and embed messages with customizable templates.
 */
public class DiscordWebhook {

    private final ShopPlugin plugin;

    public DiscordWebhook(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Checks if Discord webhooks are enabled and configured.
     */
    public boolean isEnabled() {
        FileConfiguration config = plugin.getDiscordConfig();
        boolean enabled = config.getBoolean("enabled", false);
        String webhookUrl = config.getString("webhook-url", "");

        return enabled && webhookUrl != null && !webhookUrl.isEmpty() && !webhookUrl.equals("WEBHOOK_URL_HERE");
    }

    /**
     * Sends a purchase notification to Discord.
     */
    public void sendPurchaseNotification(String playerName, String itemName, int amount, double totalPrice, String currencySymbol) {
        FileConfiguration config = plugin.getDiscordConfig();

        if (!isEnabled() || !config.getBoolean("purchase.enabled", true)) {
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                JsonObject payload = buildMessage("purchase", playerName, itemName, amount, totalPrice, currencySymbol);
                sendWebhook(payload);
            } catch (Exception e) {
                plugin.getLogger().warning("Failed to send purchase webhook to Discord: " + e.getMessage());
                if (plugin.getConfig().getBoolean("debug", false)) {
                    e.printStackTrace();
                }
            }
        });
    }

    /**
     * Sends a sell notification to Discord.
     */
    public void sendSellNotification(String playerName, String itemName, int amount, double totalPrice, String currencySymbol) {
        FileConfiguration config = plugin.getDiscordConfig();

        if (!isEnabled() || !config.getBoolean("sell.enabled", true)) {
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                JsonObject payload = buildMessage("sell", playerName, itemName, amount, totalPrice, currencySymbol);
                sendWebhook(payload);
            } catch (Exception e) {
                plugin.getLogger().warning("Failed to send sell webhook to Discord: " + e.getMessage());
                if (plugin.getConfig().getBoolean("debug", false)) {
                    e.printStackTrace();
                }
            }
        });
    }

    /**
     * Builds a Discord message payload based on configuration.
     */
    private JsonObject buildMessage(String type, String playerName, String itemName, int amount, double totalPrice, String currencySymbol) {
        FileConfiguration config = plugin.getDiscordConfig();
        String messageType = config.getString(type + ".type", "embed");

        // Clean color codes from item name
        String cleanItemName = stripColorCodes(itemName);

        if (messageType.equalsIgnoreCase("plain")) {
            return buildPlainMessage(type, playerName, cleanItemName, amount, totalPrice, currencySymbol);
        } else {
            return buildEmbedMessage(type, playerName, cleanItemName, amount, totalPrice, currencySymbol);
        }
    }

    /**
     * Builds a plain text message.
     */
    private JsonObject buildPlainMessage(String type, String playerName, String itemName, int amount, double totalPrice, String currencySymbol) {
        FileConfiguration config = plugin.getDiscordConfig();
        String template = config.getString(type + ".plain-message", "**%player%** transacted **%amount%x %item%** for **%currency%%price%**");

        // Replace placeholders
        String message = replacePlaceholders(template, playerName, itemName, amount, totalPrice, currencySymbol);

        JsonObject payload = new JsonObject();
        payload.addProperty("content", message);
        return payload;
    }

    /**
     * Builds an embed message.
     */
    private JsonObject buildEmbedMessage(String type, String playerName, String itemName, int amount, double totalPrice, String currencySymbol) {
        FileConfiguration config = plugin.getDiscordConfig();
        ConfigurationSection embedSection = config.getConfigurationSection(type + ".embed");

        if (embedSection == null) {
            plugin.getLogger().warning("No embed configuration found for " + type + " in discord.yml");
            return buildPlainMessage(type, playerName, itemName, amount, totalPrice, currencySymbol);
        }
        JsonObject embed = new JsonObject();

        // Title
        String title = embedSection.getString("title", "Transaction");
        embed.addProperty("title", replacePlaceholders(title, playerName, itemName, amount, totalPrice, currencySymbol));

        // Description
        String description = embedSection.getString("description", "");
        if (!description.isEmpty()) {
            embed.addProperty("description", replacePlaceholders(description, playerName, itemName, amount, totalPrice, currencySymbol));
        }

        // Color
        int color = embedSection.getInt("color", 3066993);
        embed.addProperty("color", color);

        // Fields
        List<?> fieldsList = embedSection.getList("fields");
        if (fieldsList != null && !fieldsList.isEmpty()) {
            JsonArray fields = new JsonArray();

            for (Object fieldObj : fieldsList) {
                if (fieldObj instanceof ConfigurationSection) {
                    ConfigurationSection fieldSection = (ConfigurationSection) fieldObj;
                    JsonObject field = new JsonObject();

                    String fieldName = fieldSection.getString("name", "");
                    String fieldValue = fieldSection.getString("value", "");
                    boolean inline = fieldSection.getBoolean("inline", false);

                    field.addProperty("name", replacePlaceholders(fieldName, playerName, itemName, amount, totalPrice, currencySymbol));
                    field.addProperty("value", replacePlaceholders(fieldValue, playerName, itemName, amount, totalPrice, currencySymbol));
                    field.addProperty("inline", inline);

                    fields.add(field);
                } else if (fieldObj instanceof java.util.Map) {
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> fieldMap = (java.util.Map<String, Object>) fieldObj;
                    JsonObject field = new JsonObject();

                    String fieldName = String.valueOf(fieldMap.getOrDefault("name", ""));
                    String fieldValue = String.valueOf(fieldMap.getOrDefault("value", ""));
                    boolean inline = Boolean.parseBoolean(String.valueOf(fieldMap.getOrDefault("inline", false)));

                    field.addProperty("name", replacePlaceholders(fieldName, playerName, itemName, amount, totalPrice, currencySymbol));
                    field.addProperty("value", replacePlaceholders(fieldValue, playerName, itemName, amount, totalPrice, currencySymbol));
                    field.addProperty("inline", inline);

                    fields.add(field);
                }
            }

            embed.add("fields", fields);
        }

        // Footer
        String footerText = embedSection.getString("footer", "");
        if (!footerText.isEmpty()) {
            JsonObject footer = new JsonObject();
            footer.addProperty("text", replacePlaceholders(footerText, playerName, itemName, amount, totalPrice, currencySymbol));
            embed.add("footer", footer);
        }

        // Timestamp
        boolean showTimestamp = embedSection.getBoolean("timestamp", true);
        if (showTimestamp) {
            embed.addProperty("timestamp", Instant.now().toString());
        }

        JsonArray embeds = new JsonArray();
        embeds.add(embed);

        JsonObject payload = new JsonObject();
        payload.add("embeds", embeds);

        return payload;
    }

    /**
     * Replaces placeholders in a template string.
     */
    private String replacePlaceholders(String template, String playerName, String itemName, int amount, double totalPrice, String currencySymbol) {
        return template
                .replace("%player%", playerName)
                .replace("%item%", itemName)
                .replace("%amount%", String.valueOf(amount))
                .replace("%price%", String.format("%.2f", totalPrice))
                .replace("%currency%", currencySymbol)
                .replace("%timestamp%", Instant.now().toString());
    }

    /**
     * Sends the webhook payload to Discord.
     */
    private void sendWebhook(JsonObject payload) throws Exception {
        FileConfiguration config = plugin.getDiscordConfig();
        String webhookUrl = config.getString("webhook-url", "");

        if (webhookUrl.isEmpty() || webhookUrl.equals("WEBHOOK_URL_HERE")) {
            plugin.getLogger().warning("Discord webhook URL not configured!");
            return;
        }

        URI uri = new URI(webhookUrl);
        HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("User-Agent", "Genius-Shop/1.0");
        connection.setDoOutput(true);

        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = payload.toString().getBytes(StandardCharsets.UTF_8);
            os.write(input, 0, input.length);
        }

        int responseCode = connection.getResponseCode();
        if (responseCode < 200 || responseCode >= 300) {
            plugin.getLogger().warning("Discord webhook returned non-success code: " + responseCode);
        } else {
            plugin.debug("Discord webhook sent successfully (code: " + responseCode + ")");
        }

        connection.disconnect();
    }

    /**
     * Strips Minecraft color codes from a string.
     */
    private String stripColorCodes(String text) {
        if (text == null) return "";
        return text.replaceAll("[&§][0-9a-fk-or]", "");
    }
}
