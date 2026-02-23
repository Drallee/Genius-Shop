package me.dralle.shop.util;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.lang.reflect.Method;
import java.util.UUID;

public class BedrockUtil {

    private static Boolean floodgatePresent = null;
    private static Method isFloodgatePlayerMethod = null;
    private static Object floodgateApiInstance = null;

    public static boolean isFloodgatePresent() {
        if (floodgatePresent == null) {
            floodgatePresent = Bukkit.getPluginManager().getPlugin("floodgate") != null;
            if (floodgatePresent) {
                setupReflection();
            }
        }
        return floodgatePresent;
    }

    private static void setupReflection() {
        try {
            Class<?> apiClass = Class.forName("org.geysermc.floodgate.api.FloodgateApi");
            Method getInstanceMethod = apiClass.getMethod("getInstance");
            floodgateApiInstance = getInstanceMethod.invoke(null);
            isFloodgatePlayerMethod = apiClass.getMethod("isFloodgatePlayer", UUID.class);
        } catch (Exception e) {
            floodgatePresent = false;
        }
    }

    /**
     * Checks if a player is a Bedrock player.
     */
    public static boolean isBedrockPlayer(UUID uuid) {
        if (!isFloodgatePresent() || isFloodgatePlayerMethod == null) {
            return false;
        }
        try {
            return (boolean) isFloodgatePlayerMethod.invoke(floodgateApiInstance, uuid);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Checks if a player is a Bedrock player.
     */
    public static boolean isBedrockPlayer(Player player) {
        if (player == null) return false;
        return isBedrockPlayer(player.getUniqueId());
    }

    /**
     * Gets the Floodgate prefix if present.
     */
    public static String getFloodgatePrefix() {
        if (!isFloodgatePresent()) {
            return "";
        }
        // Common defaults, could be expanded if needed
        return "."; 
    }

    /**
     * Formats an inventory title for the player.
     * Bedrock players have a 32-character limit for titles.
     */
    public static String formatTitle(Player player, String title) {
        if (title == null) return null;
        if (isBedrockPlayer(player) && title.length() > 32) {
            return title.substring(0, 32);
        }
        return title;
    }
}
