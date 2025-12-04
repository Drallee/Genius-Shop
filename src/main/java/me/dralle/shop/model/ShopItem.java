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
    private final String name;
    private final List<String> lore;
    private final Double sellPrice;
    private final Map<String, Integer> enchantments;

    // NEW: hide flags
    private final boolean hideAttributes;
    private final boolean hideAdditional;

    public ShopItem(
            Material material,
            double price,
            int amount,
            String spawnerType,
            String potionType,
            String name,
            List<String> lore,
            Double sellPrice,
            Map<String, Integer> enchantments,
            boolean hideAttributes,
            boolean hideAdditional
    ) {
        this.material = material;
        this.price = price;
        this.amount = amount;
        this.spawnerType = spawnerType;
        this.potionType = potionType;
        this.name = name;
        this.lore = lore;
        this.sellPrice = sellPrice;
        this.enchantments = enchantments;
        this.hideAttributes = hideAttributes;
        this.hideAdditional = hideAdditional;
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
}
