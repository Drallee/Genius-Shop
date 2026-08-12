package me.dralle.shop.commands;

import java.util.List;

public class CustomCommandDefinition {
    private final String name;
    private final boolean enabled;
    private final List<String> aliases;
    private final String description;
    private final String usage;
    private final String permission;
    private final String noPermissionMessage;
    private final String shopBypassPermission;
    private final CustomCommandAction action;

    public CustomCommandDefinition(
            String name,
            boolean enabled,
            List<String> aliases,
            String description,
            String usage,
            String permission,
            String noPermissionMessage,
            String shopBypassPermission,
            CustomCommandAction action
    ) {
        this.name = name;
        this.enabled = enabled;
        this.aliases = aliases != null ? List.copyOf(aliases) : List.of();
        this.description = description != null ? description : "";
        this.usage = usage != null ? usage : "";
        this.permission = permission != null ? permission : "";
        this.noPermissionMessage = noPermissionMessage != null ? noPermissionMessage : "";
        this.shopBypassPermission = shopBypassPermission != null ? shopBypassPermission : "";
        this.action = action;
    }

    public String getName() { return name; }
    public boolean isEnabled() { return enabled; }
    public List<String> getAliases() { return aliases; }
    public String getDescription() { return description; }
    public String getUsage() { return usage; }
    public String getPermission() { return permission; }
    public String getNoPermissionMessage() { return noPermissionMessage; }
    public String getShopBypassPermission() { return shopBypassPermission; }
    public CustomCommandAction getAction() { return action; }
}
