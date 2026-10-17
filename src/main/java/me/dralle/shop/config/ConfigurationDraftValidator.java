package me.dralle.shop.config;

import me.dralle.shop.ShopManager;
import me.dralle.shop.ShopPlugin;
import me.dralle.shop.commands.CustomCommandRepository;
import me.dralle.shop.items.CustomItemRepository;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.time.ZoneId;
import java.util.*;

/** Validates the proposed snapshot, never the currently loaded shop catalog. */
public final class ConfigurationDraftValidator {
    private final ShopPlugin plugin;

    public ConfigurationDraftValidator(ShopPlugin plugin) { this.plugin = plugin; }

    public List<String> validate(Map<String, String> files) {
        List<String> errors = new ArrayList<>();
        Map<String, YamlConfiguration> parsed = new TreeMap<>();
        files.forEach((name, content) -> {
            try {
                org.yaml.snakeyaml.LoaderOptions options = new org.yaml.snakeyaml.LoaderOptions();
                options.setAllowDuplicateKeys(false);
                new org.yaml.snakeyaml.Yaml(new org.yaml.snakeyaml.constructor.SafeConstructor(options)).load(content);
                YamlConfiguration yaml = new YamlConfiguration();
                yaml.loadFromString(content);
                parsed.put(name, yaml);
            } catch (Exception e) { errors.add(name + ": " + e.getMessage()); }
        });
        if (!errors.isEmpty()) return errors;
        YamlConfiguration config = parsed.get("config.yml");
        if (config != null) {
            if (config.contains("language") && !files.containsKey("languages/" + config.getString("language") + ".yml")) {
                errors.add("config.yml: configured language file is missing");
            }
            ConfigurationSection safety = config.getConfigurationSection("economy-safety");
            if (safety != null) for (String key : safety.getKeys(true)) {
                Object value = safety.get(key);
                if (value instanceof Number number && (!Double.isFinite(number.doubleValue()) || number.doubleValue() < 0)) {
                    errors.add("config.yml: economy-safety." + key + " must be finite and nonnegative");
                }
            }
        }
        Map<String, YamlConfiguration> shops = new TreeMap<>();
        parsed.forEach((name, yaml) -> {
            if (name.startsWith("shops/")) shops.put(name.substring(6, name.length() - 4), yaml);
        });
        Set<String> globalCampaigns = campaignKeys(parsed.get("campaigns.yml"), "campaigns.yml", errors);
        for (var entry : shops.entrySet()) {
            String path = "shops/" + entry.getKey() + ".yml";
            YamlConfiguration shop = entry.getValue();
            integer(shop.get("rows"), 1, 6, path + ".rows", errors);
            if (shop.contains("items") && !shop.isList("items")) errors.add(path + ": items must be a list");
            Set<String> campaigns = new HashSet<>(globalCampaigns);
            campaigns.addAll(campaignKeys(shop, path, errors));
            reference(shop.getString("campaign", ""), campaigns, path + ".campaign", "campaign", errors);
            for (Object item : shop.getList("items", List.of())) {
                if (item instanceof Map<?, ?> values) validateItem(values, path + ".items", campaigns, errors);
                else errors.add(path + ": items must contain mappings");
            }
        }
        for (var entry : parsed.entrySet()) {
            if (!entry.getKey().startsWith("menus/")) continue;
            YamlConfiguration menu = entry.getValue();
            integer(menu.get("rows"), 1, 6, entry.getKey() + ".rows", errors);
            if (entry.getKey().equals("menus/main-menu.yml")) {
                ConfigurationSection items = menu.getConfigurationSection("items");
                if (menu.get("items") != null && items == null) errors.add("main-menu.items must be a mapping");
                if (items != null) for (String key : items.getKeys(false)) {
                    String action = items.getString(key + ".action", "shop");
                    if (action.equalsIgnoreCase("shop") || action.equalsIgnoreCase("shop-key")) {
                        reference(items.getString(key + ".shop-key", ""), shops.keySet(), "main-menu.items." + key, "shop", errors);
                    }
                }
            }
        }
        if (parsed.containsKey("custom-items.yml")) {
            errors.addAll(CustomItemRepository.validateYaml(files.get("custom-items.yml")));
            ConfigurationSection items = parsed.get("custom-items.yml").getConfigurationSection("items");
            if (items != null) for (String key : items.getKeys(false)) {
                if (!items.getBoolean(key + ".enabled", true)) continue;
                ConfigurationSection actions = items.getConfigurationSection(key + ".actions");
                if (actions != null) for (String trigger : actions.getKeys(false)) {
                    reference(actions.getString(trigger + ".shop", ""), shops.keySet(), "custom-items." + key + "." + trigger, "shop", errors);
                }
            }
        }
        if (errors.isEmpty()) {
            try {
                ShopManager catalog = new ShopManager(plugin, shops, parsed.getOrDefault("campaigns.yml", new YamlConfiguration()));
                for (ValidationMessage message : catalog.getValidationMessages()) {
                    if (message.severity() == ValidationMessage.Severity.ERROR) errors.add(message.location() + ": " + message.message());
                }
                if (parsed.containsKey("commands.yml")) {
                    if (parsed.get("commands.yml").get("commands") != null && !parsed.get("commands.yml").isConfigurationSection("commands")) {
                        errors.add("commands.yml: commands must be a mapping");
                    }
                    errors.addAll(new CustomCommandRepository(plugin).parse(parsed.get("commands.yml"), catalog::getShop).getErrors());
                }
            } catch (Exception e) { errors.add("Configuration compilation failed: " + e.getMessage()); }
        }
        return errors;
    }

    private static void validateItem(Map<?, ?> item, String path, Set<String> campaigns, List<String> errors) {
        Object raw = item.get("material");
        Material material = raw == null ? null : Material.matchMaterial(String.valueOf(raw));
        if (!(item.get("variants") instanceof List<?> variants && !variants.isEmpty()) &&
                (material == null || material.isAir() || !material.isItem())) errors.add(path + ": invalid item material '" + raw + "'");
        integer(item.get("amount"), 1, Integer.MAX_VALUE, path + ".amount", errors);
        integer(item.get("slot"), 0, Integer.MAX_VALUE, path + ".slot", errors);
        for (String field : List.of("price", "sell-price", "min-price", "max-price", "price-change")) {
            Object value = item.get(field);
            if (value != null && (!(value instanceof Number n) || !Double.isFinite(n.doubleValue()) || n.doubleValue() < 0)) {
                errors.add(path + "." + field + " must be a finite nonnegative number");
            }
        }
        reference(Objects.toString(item.get("campaign"), ""), campaigns, path, "campaign", errors);
        if (item.get("variants") instanceof List<?> variants) for (Object variant : variants) {
            if (variant instanceof Map<?, ?> values) {
                Map<Object, Object> merged = new LinkedHashMap<>(item);
                merged.remove("variants");
                merged.putAll(values);
                validateItem(merged, path + ".variants", campaigns, errors);
            } else errors.add(path + ".variants must contain mappings");
        }
    }

    private static Set<String> campaignKeys(YamlConfiguration yaml, String path, List<String> errors) {
        Set<String> keys = new HashSet<>();
        if (yaml == null) return keys;
        if (yaml.contains("campaigns") && !yaml.isList("campaigns")) errors.add(path + ": campaigns must be a list");
        for (Map<?, ?> campaign : yaml.getMapList("campaigns")) {
            String key = Objects.toString(campaign.get("key"), "").trim();
            if (key.isEmpty() || !keys.add(key)) errors.add(path + ": campaign keys must be nonempty and unique");
            Object zone = campaign.get("timezone");
            try { if (zone != null && !zone.toString().isBlank() && !zone.toString().equalsIgnoreCase("server")) ZoneId.of(zone.toString()); }
            catch (Exception e) { errors.add(path + ": invalid campaign timezone '" + zone + "'"); }
            for (String field : List.of("buy-multiplier", "sell-multiplier")) {
                Object value = campaign.get(field);
                if (value != null && (!(value instanceof Number n) || !Double.isFinite(n.doubleValue()) || n.doubleValue() <= 0)) {
                    errors.add(path + ": " + field + " must be a finite positive number");
                }
            }
        }
        return keys;
    }

    private static void reference(String value, Set<String> keys, String path, String type, List<String> errors) {
        if (value != null && !value.isBlank() && !keys.contains(value.trim())) errors.add(path + ": missing " + type + " '" + value + "'");
    }

    private static void integer(Object value, int minimum, int maximum, String path, List<String> errors) {
        if (value != null && (!(value instanceof Number n) || !Double.isFinite(n.doubleValue()) ||
                n.doubleValue() != Math.floor(n.doubleValue()) || n.doubleValue() < minimum || n.doubleValue() > maximum)) {
            errors.add(path + " must be an integer between " + minimum + " and " + maximum);
        }
    }
}
