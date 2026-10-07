package me.dralle.shop.items;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.util.YamlUtil;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.util.*;

public final class CustomItemRepository {
    private final ShopPlugin plugin;

    public CustomItemRepository(ShopPlugin plugin) { this.plugin = plugin; }

    public Map<String, CustomItemDefinition> load() {
        File file = new File(plugin.getDataFolder(), "custom-items.yml");
        if (!file.exists()) plugin.saveResource("custom-items.yml", false);
        return parse(YamlUtil.loadUtf8(file));
    }

    public static List<String> validateYaml(String source) {
        try {
            YamlConfiguration config = new YamlConfiguration();
            config.loadFromString(source);
            parse(config);
            return List.of();
        } catch (Exception ex) {
            return List.of(ex.getMessage() == null ? "Invalid custom items" : ex.getMessage());
        }
    }

    public static Map<String, CustomItemDefinition> parse(YamlConfiguration config) {
        Map<String, CustomItemDefinition> definitions = new LinkedHashMap<>();
        ConfigurationSection root = config.getConfigurationSection("items");
        if (root == null) throw new IllegalArgumentException("items must be a mapping");
        for (String id : root.getKeys(false)) {
            if (!id.matches("[a-z0-9][a-z0-9_-]{0,63}")) throw invalid(id, "invalid item ID");
            ConfigurationSection row = root.getConfigurationSection(id);
            if (row == null) throw invalid(id, "must be a mapping");
            Material material = Material.matchMaterial(row.getString("material", "BLAZE_ROD"));
            if (material == null || !material.isItem() || material.isAir()) throw invalid(id, "invalid material");
            double cooldown = number(row, "cooldown-seconds", 0D);
            if (cooldown < 0D || cooldown > 86400D) throw invalid(id, "cooldown-seconds must be between 0 and 86400");
            double uses = number(row, "max-uses", 0D);
            if (uses < 0D || uses > Integer.MAX_VALUE || uses != Math.floor(uses)) throw invalid(id, "max-uses must be a nonnegative integer");
            Map<String, Integer> enchants = new LinkedHashMap<>();
            ConfigurationSection enchantments = row.getConfigurationSection("enchantments");
            if (enchantments != null) for (String key : enchantments.getKeys(false)) {
                double level = number(enchantments, key, 1D);
                if (level < 1D || level > 255D || level != Math.floor(level)) throw invalid(id, "invalid enchantment level");
                enchants.put(key, (int) level);
            }
            Map<String, CustomItemDefinition.ItemAction> actions = new LinkedHashMap<>();
            ConfigurationSection triggers = row.getConfigurationSection("actions");
            if (triggers == null || triggers.getKeys(false).isEmpty()) throw invalid(id, "actions must contain at least one trigger");
            for (String trigger : triggers.getKeys(false)) {
                if (!Set.of("right-click-air", "right-click-block", "right-click-container").contains(trigger)) {
                    throw invalid(id, "unsupported trigger " + trigger);
                }
                ConfigurationSection action = triggers.getConfigurationSection(trigger);
                if (action == null) throw invalid(id, "action must be a mapping");
                CustomItemDefinition.ActionType type;
                try {
                    type = CustomItemDefinition.ActionType.valueOf(action.getString("type", "").toUpperCase(Locale.ROOT));
                } catch (IllegalArgumentException ex) { throw invalid(id, "unsupported action type"); }
                if (type == CustomItemDefinition.ActionType.SELL_CONTAINER && !trigger.equals("right-click-container")) {
                    throw invalid(id, "SELL_CONTAINER requires right-click-container");
                }
                double multiplier = number(action, "multiplier", 1D);
                if (multiplier <= 0D) throw invalid(id, "multiplier must be finite and greater than zero");
                String shop = action.getString("shop", "").trim();
                if (type == CustomItemDefinition.ActionType.OPEN_SHOP && shop.isEmpty()) throw invalid(id, "OPEN_SHOP requires shop");
                List<String> commands = new ArrayList<>(action.getStringList("commands"));
                if (action.isString("command")) commands.add(action.getString("command"));
                if (type == CustomItemDefinition.ActionType.COMMAND && (commands.isEmpty() || commands.stream().anyMatch(String::isBlank))) {
                    throw invalid(id, "COMMAND requires nonempty commands");
                }
                String runAs = action.getString("run-as", "player");
                if (!Set.of("player", "console").contains(runAs)) throw invalid(id, "run-as must be player or console");
                actions.put(trigger, new CustomItemDefinition.ItemAction(type, shop, multiplier,
                        bool(action, "use-campaigns", true), List.copyOf(commands), runAs.equals("console")));
            }
            definitions.put(id, new CustomItemDefinition(id, bool(row, "enabled", true), material,
                    row.getString("name", id), List.copyOf(row.getStringList("lore")), Map.copyOf(enchants),
                    row.getString("permission", ""), Math.round(cooldown * 1000D), (int) uses, Map.copyOf(actions)));
        }
        return Map.copyOf(definitions);
    }

    private static double number(ConfigurationSection section, String key, double fallback) {
        Object value = section.get(key);
        if (value == null) return fallback;
        if (!(value instanceof Number n) || !Double.isFinite(n.doubleValue())) {
            throw new IllegalArgumentException(section.getCurrentPath() + "." + key + " must be a finite number");
        }
        return n.doubleValue();
    }

    private static boolean bool(ConfigurationSection section, String key, boolean fallback) {
        Object value = section.get(key);
        if (value == null) return fallback;
        if (!(value instanceof Boolean result)) throw new IllegalArgumentException(section.getCurrentPath() + "." + key + " must be true or false");
        return result;
    }

    private static IllegalArgumentException invalid(String id, String message) {
        return new IllegalArgumentException("Custom item '" + id + "': " + message);
    }
}
