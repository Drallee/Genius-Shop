package me.dralle.shop.commands;

public class CustomCommandAction {
    private final CustomCommandActionType type;
    private final String shopKey;
    private final String itemKey;
    private final CustomCommandMenuMode menuMode;

    public CustomCommandAction(CustomCommandActionType type, String shopKey, String itemKey, CustomCommandMenuMode menuMode) {
        this.type = type;
        this.shopKey = shopKey;
        this.itemKey = itemKey;
        this.menuMode = menuMode;
    }

    public CustomCommandActionType getType() {
        return type;
    }

    public String getShopKey() {
        return shopKey;
    }

    public String getItemKey() {
        return itemKey;
    }

    public CustomCommandMenuMode getMenuMode() {
        return menuMode;
    }
}
