package me.dralle.shop.model;

import java.util.List;

/**
 * Represents a single shop category (e.g. "blocks", "spawners").
 * Loaded directly from shops.yml.
 */
public class ShopData {

    private final String key;           // e.g. "blocks"
    private final String guiName;       // GUI title
    private final int rows;             // 1-5 usable rows (plus nav row)
    private final String permission;    // permission required to open, "" = public
    private final List<ShopItem> items; // items in this shop
    private final List<String> availableTimes; // time restrictions (optional)

    public ShopData(String key, String guiName, int rows, String permission, List<ShopItem> items, List<String> availableTimes) {
        this.key = key;
        this.guiName = guiName;
        this.rows = rows;
        this.permission = permission;
        this.items = items;
        this.availableTimes = availableTimes;
    }

    public String getKey() {
        return key;
    }

    public String getGuiName() {
        return guiName;
    }

    public int getRows() {
        return rows;
    }

    public String getPermission() {
        return permission;
    }

    public List<ShopItem> getItems() {
        return items;
    }

    public List<String> getAvailableTimes() {
        return availableTimes;
    }
}
