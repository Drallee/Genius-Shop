package me.dralle.shop.api;

import me.dralle.shop.config.ConfigurationDraftStore;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.util.Collection;
import java.util.Map;

/** A fresh capability snapshot is taken for each authenticated request, never stored in a session. */
public record EditorPermissions(boolean admin, boolean analytics, boolean drafts, boolean publish,
                                boolean commands, boolean database, Map<String, SectionAccess> sections) {
    public record SectionAccess(boolean view, boolean edit) {}

    public static EditorPermissions of(CommandSender sender) {
        boolean admin = sender != null && (sender.isOp() || sender.hasPermission("geniusshop.admin")
                || sender.hasPermission("shop.admin"));
        boolean drafts = granted(sender, admin, "drafts");
        boolean publish = granted(sender, admin, "publish");
        boolean commands = drafts || granted(sender, admin, "commands") || granted(sender, admin, "commands.drafts");
        boolean database = granted(sender, admin, "database");
        Map<String, SectionAccess> sections = new java.util.LinkedHashMap<>();
        for (String section : java.util.List.of("mainmenu", "shop", "purchase", "sell", "campaigns", "customitems", "guisettings", "commands")) {
            boolean edit = admin || (section.equals("commands") ? commands : drafts || granted(sender, false, section + ".drafts"));
            boolean view = publish || edit || granted(sender, admin, section) || granted(sender, admin, section + ".view");
            sections.put(section, new SectionAccess(view, edit));
        }
        boolean analytics = granted(sender, admin, "analytics") || publish;
        sections.put("analytics", new SectionAccess(analytics, false));
        sections.put("database", new SectionAccess(database || publish || granted(sender, admin, "database.view"), database));
        return new EditorPermissions(admin, analytics, drafts, publish, commands, database, Map.copyOf(sections));
    }

    private static boolean granted(CommandSender sender, boolean admin, String operation) {
        return admin || sender != null && sender.hasPermission("geniusshop.editor." + operation);
    }

    public boolean access() { return sections.values().stream().anyMatch(SectionAccess::view); }
    public boolean workspace() { return sections.entrySet().stream().anyMatch(entry -> !entry.getKey().equals("analytics") && !entry.getKey().equals("database") && entry.getValue().view()); }

    public boolean canReadFile(String file) {
        if (!ConfigurationDraftStore.allowed(file)) return false;
        if (admin) return true;
        SectionAccess section = sections.get(section(file));
        return section != null && section.view();
    }

    private static String section(String file) {
        if (file.startsWith("shops/")) return "shop";
        return switch (file) {
            case "menus/main-menu.yml" -> "mainmenu";
            case "menus/purchase-menu.yml" -> "purchase";
            case "menus/sell-menu.yml", "menus/bulk-sell-menu.yml" -> "sell";
            case "menus/gui-settings.yml" -> "guisettings";
            case "campaigns.yml" -> "campaigns";
            case "commands.yml" -> "commands";
            case "custom-items.yml" -> "customitems";
            default -> "";
        };
    }

    public boolean canWriteFile(String file) {
        if (!ConfigurationDraftStore.allowed(file)) return false;
        if (admin) return true;
        SectionAccess section = sections.get(section(file));
        return section != null && section.edit();
    }

    public boolean canWriteContent(String file, String before, String after) {
        return canWriteFile(file) && (commands || !containsCommands(before) && !containsCommands(after));
    }

    // Lock the entire file when it contains command behavior, including embedded custom-item actions.
    // This deliberately favors explicit delegation over trying to compare every command-bearing YAML shape.
    static boolean containsCommands(String source) {
        if (source == null) return false;
        try {
            YamlConfiguration yaml = new YamlConfiguration();
            yaml.loadFromString(source);
            return containsCommands(yaml);
        } catch (Exception e) { return true; }
    }

    private static boolean containsCommands(Object value) {
        if (value instanceof ConfigurationSection section) return containsCommands(section.getValues(false));
        if (value instanceof Map<?, ?> map) {
            for (var entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey()).toLowerCase(java.util.Locale.ROOT);
                Object child = entry.getValue();
                if ((key.equals("command") || key.equals("commands")) && nonempty(child)) return true;
                if (key.equals("action") && String.valueOf(child).toLowerCase(java.util.Locale.ROOT).contains("command")) return true;
                if (containsCommands(child)) return true;
            }
        } else if (value instanceof Collection<?> values) {
            for (Object child : values) if (containsCommands(child)) return true;
        }
        return false;
    }

    private static boolean nonempty(Object value) {
        if (value instanceof ConfigurationSection section) return !section.getKeys(false).isEmpty();
        if (value instanceof Collection<?> values) return values.stream().anyMatch(EditorPermissions::nonempty);
        if (value instanceof Map<?, ?> map) return !map.isEmpty();
        return value != null && !value.toString().isBlank();
    }

    public boolean allows(String path, String method) {
        if (path.equals("/api/files") || path.equals("/api/permissions")) return method.equals("GET") && access();
        if (path.startsWith("/api/file/")) {
            String file = path.substring("/api/file/".length());
            return method.equals("GET") ? canReadFile(file) : canWriteFile(file);
        }
        return switch (path) {
            case "/api/stock-analytics", "/api/sales-analytics" -> analytics;
            case "/api/database" -> method.equals("GET") ? sections.get("database").view() : database;
            case "/api/draft/review" -> workspace();
            case "/api/draft/discard" -> sections.entrySet().stream().anyMatch(entry -> !entry.getKey().equals("database") && entry.getValue().edit());
            case "/api/draft/publish" -> publish;
            case "/api/economy-safety", "/api/activity-log", "/api/activity-log/rollback", "/api/activity-log/clear" -> admin;
            case "/api/telemetry" -> method.equals("POST") ? access() : admin;
            default -> false;
        };
    }
}
