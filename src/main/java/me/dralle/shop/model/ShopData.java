package me.dralle.shop.model;

import me.dralle.shop.stock.StockResetRule;

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
    private final StockResetRule stockResetRule;
    private final boolean sellAddsToStock;
    private final boolean allowSellStockOverflow;

    public ShopData(String key, String guiName, int rows, String permission, List<ShopItem> items, List<String> availableTimes,
                    StockResetRule stockResetRule, boolean sellAddsToStock, boolean allowSellStockOverflow) {
        this.key = key;
        this.guiName = guiName;
        this.rows = rows;
        this.permission = permission;
        this.items = items;
        this.availableTimes = availableTimes;
        this.stockResetRule = stockResetRule;
        this.sellAddsToStock = sellAddsToStock;
        this.allowSellStockOverflow = allowSellStockOverflow;
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

    public StockResetRule getStockResetRule() {
        return stockResetRule;
    }

    public boolean isSellAddsToStock() {
        return sellAddsToStock;
    }

    public boolean isAllowSellStockOverflow() {
        return allowSellStockOverflow;
    }
}
