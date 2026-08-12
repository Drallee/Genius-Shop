package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.util.ConsoleLog;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandMap;
import org.bukkit.command.SimpleCommandMap;
import org.bukkit.entity.Player;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class CustomCommandRegistry {
    private final ShopPlugin plugin;
    private final CustomSellAllService sellAllService;
    private final List<String> registeredLabels = new ArrayList<>();

    public CustomCommandRegistry(ShopPlugin plugin, CustomSellAllService sellAllService) {
        this.plugin = plugin;
        this.sellAllService = sellAllService;
    }

    public int reload(List<CustomCommandDefinition> definitions) {
        unregisterAll();
        int registered = 0;
        CommandMap commandMap = getCommandMap();
        if (commandMap == null) {
            ConsoleLog.warn(plugin, "Custom commands could not be registered: server command map is unavailable.");
            return 0;
        }

        for (CustomCommandDefinition definition : definitions) {
            if (!definition.isEnabled() || definition.getAction() == null) continue;
            CustomCommandExecutor executor = new CustomCommandExecutor(plugin, definition, sellAllService);
            DynamicPluginCommand command = new DynamicPluginCommand(
                    definition.getName(),
                    plugin,
                    executor,
                    definition.getDescription(),
                    definition.getUsage().isBlank() ? "/" + definition.getName() : definition.getUsage(),
                    definition.getAliases()
            );
            command.setPermission(definition.getPermission().isBlank() ? null : definition.getPermission());
            boolean success = commandMap.register(plugin.getName().toLowerCase(Locale.ROOT), command);
            if (!success) {
                ConsoleLog.warn(plugin, "Custom command '" + definition.getName() + "' could not be registered; command map rejected it.");
                continue;
            }
            registeredLabels.add(definition.getName().toLowerCase(Locale.ROOT));
            for (String alias : definition.getAliases()) {
                registeredLabels.add(alias.toLowerCase(Locale.ROOT));
            }
            registered++;
        }
        refreshOnlinePlayerCommands();
        return registered;
    }

    public void unregisterAll() {
        CommandMap commandMap = getCommandMap();
        if (commandMap == null || registeredLabels.isEmpty()) {
            registeredLabels.clear();
            return;
        }
        try {
            Field knownCommandsField = SimpleCommandMap.class.getDeclaredField("knownCommands");
            knownCommandsField.setAccessible(true);
            @SuppressWarnings("unchecked")
            Map<String, Command> knownCommands = (Map<String, Command>) knownCommandsField.get(commandMap);
            for (String label : registeredLabels) {
                Command command = knownCommands.remove(label);
                knownCommands.remove(plugin.getName().toLowerCase(Locale.ROOT) + ":" + label);
                if (command != null) {
                    command.unregister(commandMap);
                }
            }
        } catch (Exception e) {
            ConsoleLog.warn(plugin, "Custom command unregister failed; changed commands may require a restart on this server: " + e.getMessage());
        } finally {
            registeredLabels.clear();
            refreshOnlinePlayerCommands();
        }
    }

    private CommandMap getCommandMap() {
        try {
            Method method = Bukkit.getServer().getClass().getMethod("getCommandMap");
            Object value = method.invoke(Bukkit.getServer());
            if (value instanceof CommandMap commandMap) {
                return commandMap;
            }
        } catch (Exception ignored) {
            // Fall back to field access for older Spigot implementations.
        }
        try {
            Class<?> type = Bukkit.getServer().getClass();
            while (type != null) {
                try {
                    Field commandMapField = type.getDeclaredField("commandMap");
                    commandMapField.setAccessible(true);
                    return (CommandMap) commandMapField.get(Bukkit.getServer());
                } catch (NoSuchFieldException ignored) {
                    type = type.getSuperclass();
                }
            }
        } catch (Exception e) {
            ConsoleLog.warn(plugin, "Could not access server command map: " + e.getMessage());
        }
        return null;
    }

    private void refreshOnlinePlayerCommands() {
        try {
            for (Player player : Bukkit.getOnlinePlayers()) {
                player.updateCommands();
            }
        } catch (Throwable ignored) {
            // Older server versions may not expose Brigadier command tree refresh.
        }
    }
}
