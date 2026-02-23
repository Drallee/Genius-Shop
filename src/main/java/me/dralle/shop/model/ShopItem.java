package me.dralle.shop.model;

import me.dralle.shop.stock.StockResetRule;
import org.bukkit.Material;

import java.util.List;
import java.util.Map;

/**
 * Represents a single shop item entry loaded from shops.yml.
 * Immutable data container for GUI rendering and buy/sell logic.
 */
public class ShopItem {

    private final Material material;
    private final double price;
    private final int amount;
    private final String spawnerType;
    private final String spawnerItem;
    private final String potionType;
    private final int potionLevel;  // 0 = use base potion, 1-255 = custom level
    private final String headTexture;
    private final String headOwner;
    private final String name;
    private final List<String> lore;
    private final Double sellPrice;
    private final Map<String, Integer> enchantments;

    // NEW: hide flags
    private final boolean hideAttributes;
    private final boolean hideAdditional;

    // NEW: require flags (for both buying and selling)
    private final boolean requireName;
    private final boolean requireLore;

    // NEW: unstable TNT flag
    private final boolean unstableTnt;

    // NEW: player limit
    private final int limit;

    // NEW: global limit
    private final int globalLimit;

    // NEW: dynamic pricing
    private final boolean dynamicPricing;
    private final double minPrice;
    private final double maxPrice;
    private final double priceChange;
    private final List<String> commands;
    private final String runAs;
    private final boolean runCommandOnly;
    private final String permission;
    private final List<String> availableTimes;
    private final StockResetRule stockResetRule;
    private final Boolean sellAddsToStock;
    private final Boolean allowSellStockOverflow;
    private final boolean showStock;
    private final boolean showStockResetTimer;
    private Integer slot;

    public ShopItem(
            Material material,
            double price,
            int amount,
            String spawnerType,
            String spawnerItem,
            String potionType,
            int potionLevel,
            String headTexture,
            String headOwner,
            String name,
            List<String> lore,
            Double sellPrice,
            Map<String, Integer> enchantments,
            boolean hideAttributes,
            boolean hideAdditional,
            boolean requireName,
            boolean requireLore,
            boolean unstableTnt,
            int limit,
            int globalLimit,
            boolean dynamicPricing,
            double minPrice,
            double maxPrice,
            double priceChange,
            List<String> commands,
            String runAs,
            boolean runCommandOnly,
            String permission,
            List<String> availableTimes,
            StockResetRule stockResetRule,
            Boolean sellAddsToStock,
            Boolean allowSellStockOverflow,
            boolean showStock,
            boolean showStockResetTimer,
            Integer slot
    ) {
        this.material = material;
        this.price = price;
        this.amount = amount;
        this.spawnerType = spawnerType;
        this.spawnerItem = spawnerItem;
        this.potionType = potionType;
        this.potionLevel = potionLevel;
        this.headTexture = headTexture;
        this.headOwner = headOwner;
        this.name = name;
        this.lore = lore;
        this.sellPrice = sellPrice;
        this.enchantments = enchantments;
        this.hideAttributes = hideAttributes;
        this.hideAdditional = hideAdditional;
        this.requireName = requireName;
        this.requireLore = requireLore;
        this.unstableTnt = unstableTnt;
        this.limit = limit;
        this.globalLimit = globalLimit;
        this.dynamicPricing = dynamicPricing;
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.priceChange = priceChange;
        this.commands = commands != null ? commands : new java.util.ArrayList<>();
        this.runAs = runAs != null ? runAs : "console";
        this.runCommandOnly = runCommandOnly;
        this.permission = permission;
        this.availableTimes = availableTimes != null ? availableTimes : new java.util.ArrayList<>();
        this.stockResetRule = stockResetRule;
        this.sellAddsToStock = sellAddsToStock;
        this.allowSellStockOverflow = allowSellStockOverflow;
        this.showStock = showStock;
        this.showStockResetTimer = showStockResetTimer;
        this.slot = slot;
    }

    public Material getMaterial() {
        return material;
    }

    public double getPrice() {
        return price;
    }

    public int getAmount() {
        return amount;
    }

    public String getSpawnerType() {
        return spawnerType;
    }

    public String getSpawnerItem() {
        return spawnerItem;
    }

    public String getName() {
        return name;
    }

    public String getHeadTexture() {
        return headTexture;
    }

    public String getHeadOwner() {
        return headOwner;
    }

    public List<String> getLore() {
        return lore;
    }

    public Double getSellPrice() {
        return sellPrice;
    }

    public String getPotionType() {
        return potionType;
    }

    public int getPotionLevel() {
        return potionLevel;
    }

    public boolean isSpawner() {
        return material == Material.SPAWNER &&
                ((spawnerType != null && !spawnerType.isEmpty()) ||
                 (spawnerItem != null && !spawnerItem.isEmpty()));
    }

    public boolean isPotion() {
        return (material == Material.POTION ||
                material == Material.SPLASH_POTION ||
                material == Material.LINGERING_POTION ||
                material == Material.TIPPED_ARROW) &&
                potionType != null &&
                !potionType.isEmpty();
    }

    public boolean isPlayerHead() {
        return material == Material.PLAYER_HEAD;
    }

    public Map<String, Integer> getEnchantments() {
        return enchantments;
    }

    public boolean shouldHideAttributes() {
        return hideAttributes;
    }

    public boolean shouldHideAdditional() {
        return hideAdditional;
    }

    public boolean requiresName() {
        return requireName;
    }

    public boolean requiresLore() {
        return requireLore;
    }

    public boolean isUnstableTnt() {
        return unstableTnt;
    }

    public int getLimit() {
        return limit;
    }

    public int getGlobalLimit() {
        return globalLimit;
    }

    public boolean isDynamicPricing() {
        return dynamicPricing;
    }

    public double getMinPrice() {
        return minPrice;
    }

    public double getMaxPrice() {
        return maxPrice;
    }

    public double getPriceChange() {
        return priceChange;
    }

    public List<String> getCommands() {
        return commands;
    }

    public String getRunAs() {
        return runAs;
    }

    public boolean isRunCommandOnly() {
        return runCommandOnly;
    }

    public String getPermission() {
        return permission;
    }

    public List<String> getAvailableTimes() {
        return availableTimes;
    }

    public StockResetRule getStockResetRule() {
        return stockResetRule;
    }

    public Boolean getSellAddsToStock() {
        return sellAddsToStock;
    }

    public Boolean getAllowSellStockOverflow() {
        return allowSellStockOverflow;
    }

    public boolean isShowStock() {
        return showStock;
    }

    public boolean isShowStockResetTimer() {
        return showStockResetTimer;
    }

    public Integer getSlot() {
        return slot;
    }

    public void setSlot(Integer slot) {
        this.slot = slot;
    }

    public String getUniqueKey() {
        StringBuilder sb = new StringBuilder(material.name());
        if (spawnerType != null) sb.append("_").append(spawnerType);
        if (spawnerItem != null) sb.append("_ITEM_").append(spawnerItem);
        if (potionType != null) sb.append("_").append(potionType).append("_").append(potionLevel);
        if (headOwner != null && !headOwner.isEmpty()) sb.append("_OWNER_").append(headOwner);
        if (headTexture != null && !headTexture.isEmpty()) sb.append("_HEAD_").append(headTexture.hashCode());
        if (name != null) sb.append("_").append(name.hashCode());
        return sb.toString();
    }
}
