package me.dralle.shop;

import org.bukkit.ChatColor;
import org.bukkit.configuration.file.FileConfiguration;

import java.util.ArrayList;
import java.util.List;

public class MessageManager {

    private final ShopPlugin plugin;

    public MessageManager(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    // ===================================================
    // Basic Message Fetching
    // ===================================================

    public String getMessage(String path) {
        FileConfiguration cfg = plugin.getMessagesConfig();
        String msg = cfg.getString("messages." + path);

        if (msg == null) return "";

        msg = msg.replace("%prefix%", getRaw("prefix"));
        return color(msg);
    }

    private String getRaw(String path) {
        return plugin.getMessagesConfig().getString("messages." + path, "");
    }

    // ===================================================
    // GUI Text (comes from gui.yml)
    // ===================================================

    public String getGuiString(String path, String def) {
        return color(plugin.getMenuManager().getGuiSettingsConfig().getString("gui." + path, def));
    }

    public List<String> getGuiStringList(String path) {
        List<String> raw = plugin.getMenuManager().getGuiSettingsConfig().getStringList("gui." + path);
        List<String> out = new ArrayList<>();

        for (String line : raw) {
            if (line == null) continue;
            line = line.replace("%prefix%", getRaw("prefix"));
            out.add(color(line));
        }

        return out;
    }

    // ===================================================
    // Item Lore Formatting Helpers
    // ===================================================
    // These are used for:
    //  - Buy lines (%price% already formatted)
    //  - Sell lines
    //  - Tooltip customizations
    // ===================================================

    /**
     * Formats lore text by replacing %price% or %amount% etc.
     * Caller already provides formatted price (e.g. "£50").
     */
    public List<String> formatLore(List<String> input, String formattedPrice, int amount) {
        List<String> out = new ArrayList<>();
        if (input == null) return out;

        for (String line : input) {
            if (line == null) continue;

            line = line.replace("%price%", formattedPrice);
            line = line.replace("%amount%", String.valueOf(amount));
            line = line.replace("%prefix%", getRaw("prefix"));

            out.add(color(line));
        }

        return out;
    }

    // ===================================================
    // Color Utility
    // ===================================================

    public String color(String text) {
        if (text == null) return "";
        return ChatColor.translateAlternateColorCodes('&', text);
    }
}
