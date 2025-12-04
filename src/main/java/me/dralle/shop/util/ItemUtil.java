package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;
import org.bukkit.ChatColor;
import org.bukkit.Material;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.PotionMeta;
import org.bukkit.potion.PotionData;
import org.bukkit.potion.PotionType;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ItemUtil {

    /**
     * Apply color codes (& → §)
     */
    public static String color(String text) {
        if (text == null) return "";
        return ChatColor.translateAlternateColorCodes('&', text);
    }

    /**
     * Create an ItemStack with custom name, lore, and optional item flags.
     *
     * Now respects item-level config:
     *  - hide-attributes: true/false
     *  - hide-additional: true/false
     */
    public static ItemStack create(Material material, int amount, String name, List<String> lore) {
        if (material == null) material = Material.BARRIER;
        if (amount <= 0) amount = 1;

        ItemStack item = new ItemStack(material, amount);
        ItemMeta meta = item.getItemMeta();
        if (meta == null) return item;

        // Apply display name
        if (name != null && !name.isEmpty())
            meta.setDisplayName(color(name));

        // Apply lore
        if (lore != null && !lore.isEmpty()) {
            List<String> formatted = new ArrayList<>();
            for (String line : lore) {
                formatted.add(color(line));
            }
            meta.setLore(formatted);
        }

        // ==========================================================
        // Apply item flags based on config (shops.yml item settings)
        // ==========================================================
        boolean hideAttributes = ShopPlugin.getInstance()
                .getShopsConfig()
                .getBoolean("global.hide-attributes", false);

        boolean hideExtra = ShopPlugin.getInstance()
                .getShopsConfig()
                .getBoolean("global.hide-additional", false);

        // Add flags if enabled globally
        if (hideAttributes) {
            meta.addItemFlags(
                    ItemFlag.HIDE_ATTRIBUTES,
                    ItemFlag.HIDE_STORED_ENCHANTS,
                    ItemFlag.HIDE_UNBREAKABLE
            );
        }

        if (hideExtra) {
            // Deprecated, but still works in Bukkit
            try {
                meta.addItemFlags(ItemFlag.valueOf("HIDE_ADDITIONAL_TOOLTIP"));
            } catch (Exception ignored) {
                // Some versions don't support this flag
            }
        }

        item.setItemMeta(meta);
        return item;
    }

    /**
     * Apply potion type to an ItemStack if it's a potion or tipped arrow.
     * @param item The ItemStack (must be POTION, SPLASH_POTION, LINGERING_POTION, or TIPPED_ARROW)
     * @param potionTypeName The potion type name (e.g., "SPEED", "STRENGTH", "REGENERATION")
     */
    public static void applyPotionType(ItemStack item, String potionTypeName) {
        if (item == null || potionTypeName == null || potionTypeName.isEmpty()) return;

        Material mat = item.getType();
        if (mat != Material.POTION && mat != Material.SPLASH_POTION &&
            mat != Material.LINGERING_POTION && mat != Material.TIPPED_ARROW) {
            return;
        }

        ItemMeta meta = item.getItemMeta();
        if (!(meta instanceof PotionMeta)) return;

        PotionMeta potionMeta = (PotionMeta) meta;

        try {
            PotionType potionType = PotionType.valueOf(potionTypeName.toUpperCase());
            potionMeta.setBasePotionType(potionType);
            item.setItemMeta(potionMeta);
        } catch (IllegalArgumentException e) {
            // Invalid potion type - log warning but don't crash
            ShopPlugin.getInstance().getLogger().warning(
                "Invalid potion type: " + potionTypeName + ". Valid types: SPEED, STRENGTH, REGENERATION, etc."
            );
        }
    }

    /**
     * Apply enchantments to an ItemStack.
     * @param item The ItemStack to enchant
     * @param enchantments Map of enchantment names to levels
     */
    public static void applyEnchantments(ItemStack item, Map<String, Integer> enchantments) {
        if (item == null || enchantments == null || enchantments.isEmpty()) return;

        for (Map.Entry<String, Integer> entry : enchantments.entrySet()) {
            try {
                Enchantment enchantment = Enchantment.getByName(entry.getKey().toUpperCase());
                if (enchantment != null) {
                    item.addUnsafeEnchantment(enchantment, entry.getValue());
                } else {
                    ShopPlugin.getInstance().getLogger().warning(
                        "Invalid enchantment: " + entry.getKey()
                    );
                }
            } catch (Exception e) {
                ShopPlugin.getInstance().getLogger().warning(
                    "Failed to apply enchantment " + entry.getKey() + ": " + e.getMessage()
                );
            }
        }
    }
}
