package me.dralle.shop.util;

import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

public final class ConsoleLog {

    private ConsoleLog() {
    }

    private static String color(String text) {
        return ShopItemUtil.color(text);
    }

    private static void send(String message) {
        Bukkit.getConsoleSender().sendMessage(color(message));
    }

    public static void info(JavaPlugin plugin, String message) {
        if (plugin != null && !plugin.getConfig().getBoolean("debug", false)) {
            return;
        }
        send("&8[&bGeniusShop&8] &7" + message);
    }

    public static void success(JavaPlugin plugin, String message) {
        send("&8[&bGeniusShop&8] &a" + message);
    }

    public static void warn(JavaPlugin plugin, String message) {
        send("&8[&bGeniusShop&8] &e" + message);
    }

    public static void error(JavaPlugin plugin, String message) {
        send("&8[&bGeniusShop&8] &c" + message);
    }

    public static void apiInfo(JavaPlugin plugin, String message) {
        send("&8[&bGeniusShop&8] &3[API] &7" + message);
    }

    public static void apiSuccess(JavaPlugin plugin, String message) {
        send("&8[&bGeniusShop&8] &3[API] &a" + message);
    }

    public static void apiWarn(JavaPlugin plugin, String message) {
        send("&8[&bGeniusShop&8] &3[API] &e" + message);
    }

    public static void apiError(JavaPlugin plugin, String message) {
        send("&8[&bGeniusShop&8] &3[API] &c" + message);
    }
}
