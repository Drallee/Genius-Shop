package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.util.YamlUtil;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

public class CustomCommandRepository {
    private static final String COMMAND_PATTERN = "^[a-z0-9][a-z0-9_-]{0,31}$";
    private static final Set<String> PROTECTED_COMMANDS = Set.of("shop", "geniusshop", "minecraft", "bukkit", "spigot", "paper", "reload", "plugins", "pl", "version", "ver");

    private final ShopPlugin plugin;
    private final File file;

    public CustomCommandRepository(ShopPlugin plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "commands.yml");
    }

    public void ensureDefaultFile() {
        if (!file.exists()) {
            plugin.saveResource("commands.yml", false);
        }
    }

    public CustomCommandLoadResult load() {
        ensureDefaultFile();
        YamlConfiguration config = YamlUtil.loadUtf8(file);
        return parse(config, true);
    }

    public CustomCommandLoadResult parse(YamlConfiguration config) {
        return parse(config, true);
    }

    private CustomCommandLoadResult parse(YamlConfiguration config, boolean runtimeValidation) {
        List<CustomCommandDefinition> commands = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        int disabled = 0;
        Set<String> namesAndAliases = new HashSet<>();

        ConfigurationSection root = config.getConfigurationSection("commands");
        if (root == null) {
            return new CustomCommandLoadResult(commands, List.of(), 0);
        }

        for (String rawName : root.getKeys(false)) {
            String name = normalize(rawName);
            List<String> commandErrors = new ArrayList<>();
            ConfigurationSection section = root.getConfigurationSection(rawName);
            if (section == null) {
                errors.add("Command '" + rawName + "' must be a section.");
                continue;
            }

            boolean enabled = section.getBoolean("enabled", true);
            if (!enabled) {
                disabled++;
            }

            validateCommandToken(name, "command", commandErrors);
            if (runtimeValidation && enabled) {
                if (PROTECTED_COMMANDS.contains(name)) {
                    commandErrors.add("Command '" + name + "' conflicts with a protected command.");
                }
                if (!namesAndAliases.add(name)) {
                    commandErrors.add("Duplicate command or alias '" + name + "'.");
                }
            }

            List<String> aliases = new ArrayList<>();
            for (String rawAlias : section.getStringList("aliases")) {
                String alias = normalize(rawAlias);
                validateCommandToken(alias, "alias for " + name, commandErrors);
                if (runtimeValidation && enabled) {
                    if (PROTECTED_COMMANDS.contains(alias)) {
                        commandErrors.add("Alias '" + alias + "' for command '" + name + "' conflicts with a protected command.");
                    }
                    if (!namesAndAliases.add(alias)) {
                        commandErrors.add("Duplicate command or alias '" + alias + "'.");
                    }
                }
                aliases.add(alias);
            }

            CustomCommandAction action = parseAction(name, section.getConfigurationSection("action"), runtimeValidation && enabled, commandErrors);
            errors.addAll(commandErrors);
            if (!runtimeValidation || !enabled || commandErrors.isEmpty()) {
                commands.add(new CustomCommandDefinition(
                        name,
                        enabled,
                        aliases,
                        section.getString("description", "Custom shop command"),
                        section.getString("usage", "/" + name),
                        section.getString("permission", ""),
                        section.getString("no-permission-message", ""),
                        section.getString("shop-bypass-permission", ""),
                        action
                ));
            }
        }

        return new CustomCommandLoadResult(commands, errors, disabled);
    }

    public List<String> validateYaml(String content) {
        YamlConfiguration config = new YamlConfiguration();
        try {
            config.loadFromString(content);
        } catch (Exception e) {
            return List.of("Invalid YAML syntax: " + e.getMessage());
        }
        return parse(config).getErrors();
    }

    public List<String> validateYamlForSave(String content) {
        YamlConfiguration config = new YamlConfiguration();
        try {
            config.loadFromString(content);
        } catch (Exception e) {
            return List.of("Invalid YAML syntax: " + e.getMessage());
        }
        return parse(config, false).getErrors();
    }

    public void saveValidated(String content) throws IOException {
        List<String> errors = validateYamlForSave(content);
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException(String.join("; ", errors));
        }
        File parent = file.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }
        File tmp = new File(parent, "commands.yml.tmp");
        Files.writeString(tmp.toPath(), content, StandardCharsets.UTF_8);
        try {
            Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException atomicFailure) {
            Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private CustomCommandAction parseAction(String commandName, ConfigurationSection section, boolean validateReferences, List<String> errors) {
        if (section == null) {
            errors.add("Command '" + commandName + "' is missing action section.");
            return null;
        }

        CustomCommandActionType type = parseEnum(CustomCommandActionType.class, section.getString("type", ""));
        if (type == null) {
            errors.add("Command '" + commandName + "' has invalid action type '" + section.getString("type", "") + "'.");
            return null;
        }

        String shopKey = trim(section.getString("shop", ""));
        String itemKey = trim(section.getString("item", ""));
        CustomCommandMenuMode mode = parseEnum(CustomCommandMenuMode.class, section.getString("menu", "BOTH"));

        if ((type == CustomCommandActionType.OPEN_SHOP || type == CustomCommandActionType.OPEN_ITEM) && shopKey.isEmpty()) {
            errors.add("Command '" + commandName + "' action " + type + " requires action.shop.");
        }
        if (type == CustomCommandActionType.OPEN_ITEM) {
            if (itemKey.isEmpty()) {
                errors.add("Command '" + commandName + "' action OPEN_ITEM requires action.item.");
            }
            if (mode == null) {
                errors.add("Command '" + commandName + "' has invalid OPEN_ITEM menu mode.");
            }
        }

        if (validateReferences && !shopKey.isEmpty()) {
            ShopData shop = plugin.getShopManager() != null ? plugin.getShopManager().getShop(shopKey) : null;
            if (shop == null) {
                errors.add("Command '" + commandName + "' references missing shop '" + shopKey + "'.");
            } else if (type == CustomCommandActionType.OPEN_ITEM && shop.getItemByUniqueKey(itemKey) == null) {
                errors.add("Command '" + commandName + "' references missing item '" + itemKey + "' in shop '" + shopKey + "'.");
            }
        }

        return new CustomCommandAction(type, shopKey, itemKey, mode != null ? mode : CustomCommandMenuMode.BOTH);
    }

    private void validateCommandToken(String value, String label, List<String> errors) {
        if (value == null || value.isEmpty()) {
            errors.add("Empty " + label + " name.");
        } else if (!value.matches(COMMAND_PATTERN)) {
            errors.add("Invalid " + label + " name '" + value + "'. Use lowercase letters, numbers, underscores, and hyphens.");
        }
    }

    private <T extends Enum<T>> T parseEnum(Class<T> type, String raw) {
        if (raw == null) return null;
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT).replace('-', '_'));
        } catch (Exception ignored) {
            return null;
        }
    }

    private String normalize(String value) {
        return trim(value).toLowerCase(Locale.ROOT);
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    public File getFile() {
        return file;
    }
}
