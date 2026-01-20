package me.dralle.shop.model;

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
    private final String potionType;
    private final int potionLevel;  // 0 = use base potion, 1-255 = custom level
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

    // NEW: dynamic pricing
    private final boolean dynamicPricing;
    private final double minPrice;
    private final double maxPrice;
    private final double priceChange;
    private Integer slot;

    public ShopItem(
            Material material,
            double price,
            int amount,
            String spawnerType,
            String potionType,
            int potionLevel,
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
            boolean dynamicPricing,
            double minPrice,
            double maxPrice,
            double priceChange,
            Integer slot
    ) {
        this.material = material;
        this.price = price;
        this.amount = amount;
        this.spawnerType = spawnerType;
        this.potionType = potionType;
        this.potionLevel = potionLevel;
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
        this.dynamicPricing = dynamicPricing;
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.priceChange = priceChange;
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

    public String getName() {
        return name;
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
                spawnerType != null &&
                !spawnerType.isEmpty();
    }

    public boolean isPotion() {
        return (material == Material.POTION ||
                material == Material.SPLASH_POTION ||
                material == Material.LINGERING_POTION ||
                material == Material.TIPPED_ARROW) &&
                potionType != null &&
                !potionType.isEmpty();
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

    public Integer getSlot() {
        return slot;
    }

    public void setSlot(Integer slot) {
        this.slot = slot;
    }

    public String getUniqueKey() {
        StringBuilder sb = new StringBuilder(material.name());
        if (spawnerType != null) sb.append("_").append(spawnerType);
        if (potionType != null) sb.append("_").append(potionType).append("_").append(potionLevel);
        if (name != null) sb.append("_").append(name.hashCode());
        return sb.toString();
    }
}
