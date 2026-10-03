package me.dralle.shop;

import me.dralle.shop.util.ShopItemUtil;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.configuration.file.FileConfiguration;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.UnaryOperator;

public class MessageManager {

    private final ShopPlugin plugin;
    private final Set<String> warnedMissingPaths = new HashSet<>();
    private FileConfiguration fallbackMessagesConfig;

    public MessageManager(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    // ===================================================
    // Basic Message Fetching
    // ===================================================

    public String getMessage(String path) {
        FileConfiguration cfg = plugin.getMessagesConfig();
        String msg = readLanguageString(cfg, "messages." + path);
        if (msg == null) {
            msg = getFallbackMessagesConfig().getString("messages." + path);
            warnMissingPath("messages." + path);
        }

        if (msg == null) return "";

        msg = msg.replace("%prefix%", getRaw("prefix"));
        return color(msg);
    }

    private String getRaw(String path) {
        String raw = readLanguageString(plugin.getMessagesConfig(), "messages." + path);
        if (raw != null) return raw;
        return getFallbackMessagesConfig().getString("messages." + path, "");
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
            out.addAll(ShopItemUtil.splitAndColor(line));
        }

        return out;
    }

    public String resolveConfigString(ConfigurationSection cfg, String path, String def) {
        String raw = cfg != null ? cfg.getString(path, def) : def;
        return resolveConfiguredString(raw, def);
    }

    public List<String> resolveConfigStringList(ConfigurationSection cfg, String path) {
        return resolveConfigStringList(cfg, path, UnaryOperator.identity());
    }

    public List<String> resolveConfigStringList(ConfigurationSection cfg, String path, UnaryOperator<String> placeholders) {
        Object raw = cfg != null ? cfg.get(path) : null;
        if (raw instanceof List<?> list) {
            List<String> values = new ArrayList<>();
            for (Object entry : list) {
                if (entry != null) values.add(String.valueOf(entry));
            }
            return resolveConfiguredStringList(values, placeholders);
        }
        if (raw instanceof String value) {
            return resolveConfiguredStringList(List.of(value), placeholders);
        }
        return new ArrayList<>();
    }

    public String resolveConfiguredString(String raw, String def) {
        String value = raw == null ? def : raw;
        String resolved = getTranslationString(value);
        if (resolved != null) {
            value = resolved;
        } else if (looksLikeTranslationPath(value)) {
            warnMissingPath("messages." + normalizeTranslationPath(value));
        }

        value = value.replace("%prefix%", getRaw("prefix"));
        return color(value);
    }

    public List<String> resolveConfiguredStringList(List<String> raw) {
        return resolveConfiguredStringList(raw, UnaryOperator.identity());
    }

    public List<String> resolveConfiguredStringList(List<String> raw, UnaryOperator<String> placeholders) {
        List<String> out = new ArrayList<>();
        if (raw == null || raw.isEmpty()) return out;

        if (raw.size() == 1) {
            List<String> translatedList = getTranslationStringList(raw.get(0));
            if (translatedList != null) {
                raw = translatedList;
            } else if (looksLikeTranslationPath(raw.get(0))) {
                warnMissingPath("messages." + normalizeTranslationPath(raw.get(0)));
            }
        }

        for (String line : raw) {
            if (line == null) continue;
            String value = line;
            String translated = getTranslationString(value);
            if (translated != null) {
                value = translated;
            } else if (looksLikeTranslationPath(value)) {
                warnMissingPath("messages." + normalizeTranslationPath(value));
            }

            value = value.replace("%prefix%", getRaw("prefix"));
            out.addAll(ShopItemUtil.splitAndColor(placeholders.apply(value)));
        }
        return out;
    }

    private String getTranslationString(String rawPath) {
        String path = normalizeTranslationPath(rawPath);
        if (path == null) return null;

        String fullPath = "messages." + path;
        String value = readLanguageString(plugin.getMessagesConfig(), fullPath);
        if (value != null) return value;
        value = getFallbackMessagesConfig().getString(fullPath);
        if (value != null) {
            warnMissingPath(fullPath);
        }
        return value;
    }

    private String readLanguageString(FileConfiguration config, String path) {
        String value = config.getString(path);
        // YAML 1.1 converted the old unquoted "on" key into the string key "true".
        if (value == null && path.equals("messages.on")) value = config.getString("messages.true");
        return value;
    }

    private List<String> getTranslationStringList(String rawPath) {
        String path = normalizeTranslationPath(rawPath);
        if (path == null) return null;

        String fullPath = "messages." + path;
        if (plugin.getMessagesConfig().isList(fullPath)) {
            return plugin.getMessagesConfig().getStringList(fullPath);
        }
        if (getFallbackMessagesConfig().isList(fullPath)) {
            warnMissingPath(fullPath);
            return getFallbackMessagesConfig().getStringList(fullPath);
        }
        return null;
    }

    private String normalizeTranslationPath(String rawPath) {
        if (rawPath == null) return null;
        String path = rawPath.trim();
        if (path.startsWith("messages.")) {
            path = path.substring("messages.".length());
        }
        return path.isEmpty() ? null : path;
    }

    private boolean looksLikeTranslationPath(String value) {
        String path = normalizeTranslationPath(value);
        return path != null && (path.startsWith("menus.") || path.startsWith("messages.menus."));
    }

    private FileConfiguration getFallbackMessagesConfig() {
        if (fallbackMessagesConfig != null) return fallbackMessagesConfig;
        try (InputStream in = plugin.getResource("languages/en_US.yml")) {
            if (in != null) {
                fallbackMessagesConfig = YamlConfiguration.loadConfiguration(new InputStreamReader(in, StandardCharsets.UTF_8));
                return fallbackMessagesConfig;
            }
        } catch (Exception ex) {
            me.dralle.shop.util.ConsoleLog.warn(plugin, "Could not load en_US language fallback: " + ex.getMessage());
        }
        fallbackMessagesConfig = new YamlConfiguration();
        return fallbackMessagesConfig;
    }

    private void warnMissingPath(String path) {
        if (path == null || !warnedMissingPaths.add(path)) return;
        me.dralle.shop.util.ConsoleLog.warn(plugin, "Missing language path '" + path + "' in configured language; using fallback/default text when available.");
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

            out.addAll(ShopItemUtil.splitAndColor(line));
        }

        return out;
    }

    // ===================================================
    // Color Utility
    // ===================================================

    public String color(String text) {
        return ShopItemUtil.color(text);
    }
}
