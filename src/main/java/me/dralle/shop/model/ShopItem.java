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
    private final String itemStackData;
    private final String name;
    private final List<String> lore;
    private final Double sellPrice;
    private final boolean buyPricePerItem;
    private final boolean sellPricePerItem;
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
    private final String buyPriceFormula;
    private final String sellPriceFormula;
    private final List<String> commands;
    private final String runAs;
    private final boolean runCommandOnly;
    private final String permission;
    private final boolean campaignEnabled;
    private final String campaignKey;
    private final String campaignName;
    private final String campaignStart;
    private final String campaignEnd;
    private final String campaignTimezone;
    private final double campaignBuyMultiplier;
    private final double campaignSellMultiplier;
    private final int minPlayerLevel;
    private final int maxPlayerLevel;
    private final String requiredGamemode;
    private final List<String> allowedWorlds;
    private final List<String> deniedWorlds;
    private final List<String> availableTimes;
    private final StockResetRule stockResetRule;
    private final Boolean sellAddsToStock;
    private final Boolean allowSellStockOverflow;
    private final boolean showStock;
    private final boolean showStockResetTimer;
    private final String variantKey;
    private final String variantGroupKey;
    private final boolean variantMenuEnabled;
    private final Integer variantGroupSlot;
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
            String itemStackData,
            String name,
            List<String> lore,
            Double sellPrice,
            boolean buyPricePerItem,
            boolean sellPricePerItem,
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
            String buyPriceFormula,
            String sellPriceFormula,
            List<String> commands,
            String runAs,
            boolean runCommandOnly,
            String permission,
            boolean campaignEnabled,
            String campaignKey,
            String campaignName,
            String campaignStart,
            String campaignEnd,
            String campaignTimezone,
            double campaignBuyMultiplier,
            double campaignSellMultiplier,
            int minPlayerLevel,
            int maxPlayerLevel,
            String requiredGamemode,
            List<String> allowedWorlds,
            List<String> deniedWorlds,
            List<String> availableTimes,
            StockResetRule stockResetRule,
            Boolean sellAddsToStock,
            Boolean allowSellStockOverflow,
            boolean showStock,
            boolean showStockResetTimer,
            String variantKey,
            String variantGroupKey,
            boolean variantMenuEnabled,
            Integer variantGroupSlot,
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
        this.itemStackData = itemStackData != null ? itemStackData : "";
        this.name = name;
        this.lore = lore;
        this.sellPrice = sellPrice;
        this.buyPricePerItem = buyPricePerItem;
        this.sellPricePerItem = sellPricePerItem;
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
        this.buyPriceFormula = buyPriceFormula != null ? buyPriceFormula : "";
        this.sellPriceFormula = sellPriceFormula != null ? sellPriceFormula : "";
        this.commands = commands != null ? commands : new java.util.ArrayList<>();
        this.runAs = runAs != null ? runAs : "console";
        this.runCommandOnly = runCommandOnly;
        this.permission = permission;
        this.campaignEnabled = campaignEnabled;
        this.campaignKey = campaignKey != null ? campaignKey : "";
        this.campaignName = campaignName != null ? campaignName : "";
        this.campaignStart = campaignStart != null ? campaignStart : "";
        this.campaignEnd = campaignEnd != null ? campaignEnd : "";
        this.campaignTimezone = campaignTimezone != null ? campaignTimezone : "";
        this.campaignBuyMultiplier = campaignBuyMultiplier;
        this.campaignSellMultiplier = campaignSellMultiplier;
        this.minPlayerLevel = minPlayerLevel;
        this.maxPlayerLevel = maxPlayerLevel;
        this.requiredGamemode = requiredGamemode != null ? requiredGamemode : "";
        this.allowedWorlds = allowedWorlds != null ? allowedWorlds : new java.util.ArrayList<>();
        this.deniedWorlds = deniedWorlds != null ? deniedWorlds : new java.util.ArrayList<>();
        this.availableTimes = availableTimes != null ? availableTimes : new java.util.ArrayList<>();
        this.stockResetRule = stockResetRule;
        this.sellAddsToStock = sellAddsToStock;
        this.allowSellStockOverflow = allowSellStockOverflow;
        this.showStock = showStock;
        this.showStockResetTimer = showStockResetTimer;
        this.variantKey = variantKey != null ? variantKey.trim() : "";
        this.variantGroupKey = variantGroupKey != null ? variantGroupKey.trim() : "";
        this.variantMenuEnabled = variantMenuEnabled;
        this.variantGroupSlot = variantGroupSlot;
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

    public String getItemStackData() {
        return itemStackData;
    }

    public List<String> getLore() {
        return lore;
    }

    public Double getSellPrice() {
        return sellPrice;
    }

    public boolean isBuyPricePerItem() {
        return buyPricePerItem;
    }

    public boolean isSellPricePerItem() {
        return sellPricePerItem;
    }

    public double calculateBuyTotal(double currentPrice, int quantity) {
        int unitAmount = Math.max(1, amount);
        return buyPricePerItem ? currentPrice * quantity : currentPrice * (quantity / (double) unitAmount);
    }

    public double calculateSellTotal(double currentSellPrice, int quantity) {
        int unitAmount = Math.max(1, amount);
        return sellPricePerItem ? currentSellPrice * quantity : currentSellPrice * (quantity / (double) unitAmount);
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

    public String getBuyPriceFormula() {
        return buyPriceFormula;
    }

    public String getSellPriceFormula() {
        return sellPriceFormula;
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

    public boolean isCampaignEnabled() {
        return campaignEnabled;
    }

    public String getCampaignName() {
        return campaignName;
    }

    public String getCampaignKey() {
        return campaignKey;
    }

    public String getCampaignStart() {
        return campaignStart;
    }

    public String getCampaignEnd() {
        return campaignEnd;
    }

    public String getCampaignTimezone() {
        return campaignTimezone;
    }

    public double getCampaignBuyMultiplier() {
        return campaignBuyMultiplier;
    }

    public double getCampaignSellMultiplier() {
        return campaignSellMultiplier;
    }

    public int getMinPlayerLevel() {
        return minPlayerLevel;
    }

    public int getMaxPlayerLevel() {
        return maxPlayerLevel;
    }

    public String getRequiredGamemode() {
        return requiredGamemode;
    }

    public List<String> getAllowedWorlds() {
        return allowedWorlds;
    }

    public List<String> getDeniedWorlds() {
        return deniedWorlds;
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

    public String getVariantKey() {
        return variantKey;
    }

    public String getVariantGroupKey() {
        return variantGroupKey;
    }

    public boolean isVariantMenuEnabled() {
        return variantMenuEnabled;
    }

    public Integer getVariantGroupSlot() {
        return variantGroupSlot;
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
        if (variantKey != null && !variantKey.isEmpty()) sb.append("_VARIANT_").append(variantKey);
        return sb.toString();
    }
}
