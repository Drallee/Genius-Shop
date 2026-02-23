package me.dralle.shop.model;

import me.dralle.shop.stock.StockResetRule;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
    private final Map<String, ShopCampaign> campaigns;
    private final String campaignKey;
    private final Map<String, ShopItem> itemsByUniqueKey;
    private final Map<Integer, ShopItem> itemsBySlot;

    public ShopData(String key, String guiName, int rows, String permission, List<ShopItem> items, List<String> availableTimes,
                    StockResetRule stockResetRule, boolean sellAddsToStock, boolean allowSellStockOverflow,
                    Map<String, ShopCampaign> campaigns, String campaignKey) {
        this.key = key;
        this.guiName = guiName;
        this.rows = rows;
        this.permission = permission;
        this.items = items;
        this.availableTimes = availableTimes;
        this.stockResetRule = stockResetRule;
        this.sellAddsToStock = sellAddsToStock;
        this.allowSellStockOverflow = allowSellStockOverflow;
        this.campaigns = campaigns;
        this.campaignKey = campaignKey != null ? campaignKey : "";
        this.itemsByUniqueKey = new LinkedHashMap<>();
        this.itemsBySlot = new LinkedHashMap<>();
        if (items != null) {
            for (ShopItem item : items) {
                if (item == null) continue;
                itemsByUniqueKey.put(item.getUniqueKey(), item);
                if (!item.isVariantMenuEnabled() && item.getSlot() != null) {
                    itemsBySlot.putIfAbsent(item.getSlot(), item);
                }
            }
        }
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

    public Map<String, ShopCampaign> getCampaigns() {
        return campaigns;
    }

    public String getCampaignKey() {
        return campaignKey;
    }

    public ShopItem getItemByUniqueKey(String uniqueKey) {
        if (uniqueKey == null || uniqueKey.isEmpty()) return null;
        return itemsByUniqueKey.get(uniqueKey);
    }

    public ShopItem getItemBySlot(int slot) {
        return itemsBySlot.get(slot);
    }
}
