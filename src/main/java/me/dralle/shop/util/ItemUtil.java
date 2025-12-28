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
     * Splits a string by \n and applies colors while inheriting colors from previous lines.
     */
    public static List<String> splitAndColor(String text) {
        List<String> result = new ArrayList<>();
        if (text == null) return result;

        String[] lines = text.split("\n", -1); // -1 to keep trailing empty strings if any
        String lastColors = "";
        for (String line : lines) {
            String coloredLine = lastColors + color(line);
            result.add(coloredLine);
            lastColors = ChatColor.getLastColors(coloredLine);
        }
        return result;
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
                if (line == null) continue;
                formatted.addAll(splitAndColor(line));
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
        applyPotionType(item, potionTypeName, 0);
    }

    /**
     * Apply potion type with custom level to an ItemStack if it's a potion or tipped arrow.
     * @param item The ItemStack (must be POTION, SPLASH_POTION, LINGERING_POTION, or TIPPED_ARROW)
     * @param potionTypeName The potion type name (e.g., "SPEED", "STRENGTH", "REGENERATION")
     * @param level The potion level (0 = use base type, 1+ = custom amplifier, max 255)
     */
    public static void applyPotionType(ItemStack item, String potionTypeName, int level) {
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

            // If level is 0 or not specified, use the base potion type
            if (level <= 0) {
                potionMeta.setBasePotionType(potionType);
            } else {
                // For custom levels, we need to use custom effects
                // Set base to WATER to clear default effects, then add custom effect
                potionMeta.setBasePotionType(PotionType.WATER);

                // Get the effect type from potion type
                org.bukkit.potion.PotionEffectType effectType = getPotionEffectType(potionType);
                if (effectType != null) {
                    // Clamp level between 1 and 255 (Minecraft limit)
                    int amplifier = Math.min(Math.max(level - 1, 0), 254); // level 1 = amplifier 0

                    // Duration depends on potion type (in ticks: 20 ticks = 1 second)
                    int duration = getDefaultDuration(potionType);

                    org.bukkit.potion.PotionEffect effect = new org.bukkit.potion.PotionEffect(
                        effectType,
                        duration,
                        amplifier,
                        false,  // ambient
                        true,   // particles
                        true    // icon
                    );
                    potionMeta.addCustomEffect(effect, true);
                }
            }

            item.setItemMeta(potionMeta);
        } catch (IllegalArgumentException e) {
            // Invalid potion type - log warning but don't crash
            ShopPlugin.getInstance().getLogger().warning(
                "Invalid potion type: " + potionTypeName + ". Valid types: SPEED, STRENGTH, REGENERATION, etc."
            );
        }
    }

    /**
     * Get the PotionEffectType from a PotionType
     */
    private static org.bukkit.potion.PotionEffectType getPotionEffectType(PotionType potionType) {
        // Map potion types to their effect types
        String name = potionType.name().toUpperCase();

        // Handle renamed types in newer versions
        if (name.contains("SWIFTNESS")) return org.bukkit.potion.PotionEffectType.SPEED;
        if (name.contains("HEALING")) return org.bukkit.potion.PotionEffectType.INSTANT_HEALTH;
        if (name.contains("HARMING")) return org.bukkit.potion.PotionEffectType.INSTANT_DAMAGE;
        if (name.contains("LEAPING")) return org.bukkit.potion.PotionEffectType.JUMP_BOOST;

        // Try direct name matching
        switch (potionType) {
            case SLOWNESS: return org.bukkit.potion.PotionEffectType.SLOWNESS;
            case STRENGTH: return org.bukkit.potion.PotionEffectType.STRENGTH;
            case REGENERATION: return org.bukkit.potion.PotionEffectType.REGENERATION;
            case FIRE_RESISTANCE: return org.bukkit.potion.PotionEffectType.FIRE_RESISTANCE;
            case WATER_BREATHING: return org.bukkit.potion.PotionEffectType.WATER_BREATHING;
            case INVISIBILITY: return org.bukkit.potion.PotionEffectType.INVISIBILITY;
            case NIGHT_VISION: return org.bukkit.potion.PotionEffectType.NIGHT_VISION;
            case WEAKNESS: return org.bukkit.potion.PotionEffectType.WEAKNESS;
            case POISON: return org.bukkit.potion.PotionEffectType.POISON;
            case LUCK: return org.bukkit.potion.PotionEffectType.LUCK;
            case TURTLE_MASTER: return org.bukkit.potion.PotionEffectType.SLOWNESS;
            case SLOW_FALLING: return org.bukkit.potion.PotionEffectType.SLOW_FALLING;
            default:
                // Try to get by name as fallback
                try {
                    return org.bukkit.potion.PotionEffectType.getByName(name);
                } catch (Exception e) {
                    return null;
                }
        }
    }

    /**
     * Get default duration for a potion type (in ticks)
     */
    private static int getDefaultDuration(PotionType potionType) {
        // Use string matching for version compatibility
        String name = potionType.name().toUpperCase();

        // Instant effects
        if (name.contains("HEALING") || name.contains("HARMING") || name.equals("INSTANT_HEAL") || name.equals("INSTANT_DAMAGE")) {
            return 1;
        }

        // 1:30 duration (90 seconds = 1800 ticks)
        if (name.equals("STRENGTH") || name.equals("REGENERATION") ||
            name.equals("POISON") || name.equals("WEAKNESS")) {
            return 1800;
        }

        // 3:00 duration (180 seconds = 3600 ticks)
        if (name.contains("SWIFTNESS") || name.equals("SPEED") || name.equals("SLOWNESS") ||
            name.contains("LEAPING") || name.equals("JUMP_BOOST") ||
            name.equals("FIRE_RESISTANCE") || name.equals("WATER_BREATHING") ||
            name.equals("INVISIBILITY") || name.equals("NIGHT_VISION") ||
            name.equals("LUCK") || name.equals("SLOW_FALLING")) {
            return 3600;
        }

        // Turtle Master: 20 seconds
        if (name.equals("TURTLE_MASTER")) {
            return 400;
        }

        // Default: 3 minutes
        return 3600;
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
