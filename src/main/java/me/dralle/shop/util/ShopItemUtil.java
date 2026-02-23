package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;
import org.bukkit.ChatColor;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.block.BlockState;
import org.bukkit.block.CreatureSpawner;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.EntityType;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.BlockStateMeta;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.PotionMeta;
import org.bukkit.inventory.meta.SkullMeta;
import org.bukkit.potion.PotionType;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ShopItemUtil {

    private static final Pattern HEX_PATTERN = Pattern.compile("&#([A-Fa-f0-9]{6})");
    private static final Pattern GRADIENT_PATTERN = Pattern.compile("(?is)<gradient:((?:#?[A-F0-9]{6}:)*#?[A-F0-9]{6})>(.*?)</gradient>");
    private static final Pattern PREFIX_STYLE_GRADIENT_PATTERN = Pattern.compile("(?is)((?:[&\u00A7][K-OR])+)(<gradient:(?:#?[A-F0-9]{6}:)*#?[A-F0-9]{6}>.*?</gradient>)");

    /**
     * Apply color codes (& -> section sign) and HEX support (&#RRGGBB -> section hex sequence).
     */
    public static String color(String text) {
        if (text == null) return "";

        text = normalizeBrokenSectionSigns(text);
        text = movePrefixStylesIntoGradient(text);
        text = applyGradientTags(text);

        Matcher matcher = HEX_PATTERN.matcher(text);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            matcher.appendReplacement(buffer, toSectionHex(matcher.group(1)));
        }
        matcher.appendTail(buffer);
        text = buffer.toString();

        return ChatColor.translateAlternateColorCodes('&', text);
    }

    private static String movePrefixStylesIntoGradient(String input) {
        Matcher matcher = PREFIX_STYLE_GRADIENT_PATTERN.matcher(input);
        StringBuffer out = new StringBuffer();
        while (matcher.find()) {
            String stylePrefix = matcher.group(1);
            String gradientTag = matcher.group(2);
            int openEnd = gradientTag.indexOf('>');
            if (openEnd < 0) {
                matcher.appendReplacement(out, Matcher.quoteReplacement(matcher.group(0)));
                continue;
            }
            String rebuilt = gradientTag.substring(0, openEnd + 1) + stylePrefix + gradientTag.substring(openEnd + 1);
            matcher.appendReplacement(out, Matcher.quoteReplacement(rebuilt));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private static String toSectionHex(String hex) {
        String clean = hex == null ? "" : hex.trim();
        if (clean.length() != 6) return "";
        StringBuilder out = new StringBuilder("\u00A7x");
        for (char c : clean.toCharArray()) {
            out.append('\u00A7').append(c);
        }
        return out.toString();
    }

    private static String normalizeBrokenSectionSigns(String input) {
        return input
                .replace("Ãƒâ€šÃ‚Â§", "§")
                .replace("Ã‚Â§", "§")
                .replace("Â§", "§");
    }

    private static String applyGradientTags(String input) {
        Matcher matcher = GRADIENT_PATTERN.matcher(input);
        StringBuffer out = new StringBuffer();

        while (matcher.find()) {
            String colorSpec = matcher.group(1);
            String content = matcher.group(2);
            List<String> stops = parseGradientStops(colorSpec);
            String gradient = applyGradient(content, stops);
            matcher.appendReplacement(out, Matcher.quoteReplacement(gradient));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private static List<String> parseGradientStops(String colorSpec) {
        List<String> stops = new ArrayList<>();
        if (colorSpec == null || colorSpec.isEmpty()) return stops;

        String[] parts = colorSpec.split(":");
        for (String part : parts) {
            if (part == null) continue;
            String clean = part.trim();
            if (clean.startsWith("#")) {
                clean = clean.substring(1);
            }
            if (clean.length() == 6) {
                stops.add(clean.toUpperCase());
            }
        }
        return stops;
    }

    private static String applyGradient(String content, List<String> stops) {
        if (content == null || content.isEmpty()) return "";
        if (stops == null || stops.isEmpty()) return content;

        List<int[]> rgbStops = new ArrayList<>();
        for (String stop : stops) {
            rgbStops.add(hexToRgb(stop));
        }
        if (rgbStops.size() == 1) {
            rgbStops.add(rgbStops.get(0));
        }
        List<String> visibleChars = new ArrayList<>();
        List<String> stylePrefixes = new ArrayList<>();

        StringBuilder activeStyles = new StringBuilder();
        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            if ((c == '&' || c == '\u00A7') && i + 1 < content.length()) {
                char code = Character.toLowerCase(content.charAt(i + 1));
                if (isColorCode(code)) {
                    activeStyles.setLength(0); // Color codes reset formatting in MC.
                    i++;
                    continue;
                }
                if (code == 'r') {
                    activeStyles.setLength(0);
                    i++;
                    continue;
                }
                if (isStyleCode(code)) {
                    String style = "\u00A7" + code;
                    if (activeStyles.indexOf(style) < 0) {
                        activeStyles.append(style);
                    }
                    i++;
                    continue;
                }
            }

            visibleChars.add(String.valueOf(c));
            stylePrefixes.add(activeStyles.toString());
        }

        int chars = visibleChars.size();
        if (chars <= 0) return "";

        StringBuilder out = new StringBuilder();
        for (int index = 0; index < chars; index++) {
            float ratio = chars == 1 ? 0.0F : index / (float) (chars - 1);
            float scaled = ratio * (rgbStops.size() - 1);
            int segment = Math.min((int) Math.floor(scaled), rgbStops.size() - 2);
            float localRatio = scaled - segment;
            int[] from = rgbStops.get(segment);
            int[] to = rgbStops.get(segment + 1);

            int r = Math.round(from[0] + (to[0] - from[0]) * localRatio);
            int g = Math.round(from[1] + (to[1] - from[1]) * localRatio);
            int b = Math.round(from[2] + (to[2] - from[2]) * localRatio);

            out.append(toSectionHex(String.format("%02X%02X%02X", r, g, b)));
            out.append(stylePrefixes.get(index));
            out.append(visibleChars.get(index));
        }
        return out.toString();
    }

    private static boolean isColorCode(char code) {
        return (code >= '0' && code <= '9') || (code >= 'a' && code <= 'f');
    }

    private static boolean isStyleCode(char code) {
        return code == 'k' || code == 'l' || code == 'm' || code == 'n' || code == 'o';
    }

    private static int[] hexToRgb(String hex) {
        String clean = hex == null ? "000000" : hex.trim();
        return new int[] {
                Integer.parseInt(clean.substring(0, 2), 16),
                Integer.parseInt(clean.substring(2, 4), 16),
                Integer.parseInt(clean.substring(4, 6), 16)
        };
    }

    public static Material getMaterial(String name, Material def) {
        if (name == null || name.isEmpty()) return def;
        Material mat = Material.matchMaterial(name);
        if (mat == null) {
            try {
                mat = Material.valueOf(name.toUpperCase());
            } catch (IllegalArgumentException e) {
                return def;
            }
        }
        return mat;
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

        applyGlobalFlags(meta);

        item.setItemMeta(meta);
        return item;
    }

    /**
     * Overload that uses an existing ItemStack as base.
     */
    public static ItemStack create(ItemStack item, String name, List<String> lore) {
        if (item == null) return null;
        ItemMeta meta = item.getItemMeta();
        if (meta == null) return item;

        if (name != null && !name.isEmpty())
            meta.setDisplayName(color(name));

        if (lore != null && !lore.isEmpty()) {
            List<String> formatted = new ArrayList<>();
            for (String line : lore) {
                if (line == null) continue;
                formatted.addAll(splitAndColor(line));
            }
            meta.setLore(formatted);
        }

        applyGlobalFlags(meta);

        item.setItemMeta(meta);
        return item;
    }

    private static void applyGlobalFlags(ItemMeta meta) {
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
            me.dralle.shop.util.ConsoleLog.warn(ShopPlugin.getInstance(), 
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
     * Get an Enchantment by its key or name.
     * Supports NamespacedKey (namespace:key) and legacy Bukkit names.
     */
    public static Enchantment getEnchantment(String key) {
        if (key == null) return null;

        Enchantment enchantment = null;

        // Try NamespacedKey (modern way, e.g. "minecraft:sharpness" or "custom:my_enchant")
        if (key.contains(":")) {
            enchantment = Enchantment.getByKey(NamespacedKey.fromString(key.toLowerCase()));
        } else {
            // Try as minecraft namespace first
            try {
                enchantment = Enchantment.getByKey(NamespacedKey.minecraft(key.toLowerCase()));
            } catch (IllegalArgumentException ignored) {
                // Not a valid NamespacedKey name
            }
        }

        // Fallback to legacy Bukkit name (e.g. "DAMAGE_ALL")
        if (enchantment == null) {
            enchantment = Enchantment.getByName(key.toUpperCase());
        }

        return enchantment;
    }

    /**
     * Apply enchantments to an ItemStack.
     * @param item The ItemStack to enchant
     * @param enchantments Map of enchantment names to levels
     */
    public static void applyEnchantments(ItemStack item, Map<String, Integer> enchantments) {
        if (item == null || enchantments == null || enchantments.isEmpty()) return;

        for (Map.Entry<String, Integer> entry : enchantments.entrySet()) {
            String key = entry.getKey();
            int level = entry.getValue();
            try {
                Enchantment enchantment = getEnchantment(key);

                if (enchantment != null) {
                    item.addUnsafeEnchantment(enchantment, level);
                } else {
                    me.dralle.shop.util.ConsoleLog.warn(ShopPlugin.getInstance(), 
                        "Invalid enchantment: " + key
                    );
                }
            } catch (Exception e) {
                me.dralle.shop.util.ConsoleLog.warn(ShopPlugin.getInstance(), 
                    "Failed to apply enchantment " + key + ": " + e.getMessage()
                );
            }
        }
    }

    public static boolean spawnerMatches(ItemStack it, String type) {
        String spawnerType = getSpawnerType(it);
        return spawnerType != null && spawnerType.equalsIgnoreCase(type);
    }

    public static ItemStack getSpawnerItem(EntityType type, int amount) {
        ItemStack item = new ItemStack(Material.SPAWNER, amount);
        ItemMeta meta = item.getItemMeta();
        if (meta instanceof BlockStateMeta bsm) {
            BlockState bs = bsm.getBlockState();
            if (bs instanceof CreatureSpawner cs) {
                cs.setSpawnedType(type);
                bsm.setBlockState(bs);
            }
            item.setItemMeta(bsm);
        }
        return item;
    }

    public static ItemStack getSpawnerItem(String identifier, int amount, boolean isItemSpawner) {
        ItemStack item = new ItemStack(Material.SPAWNER, amount);
        if (!isItemSpawner) {
            try {
                EntityType type = EntityType.valueOf(identifier.toUpperCase());
                return getSpawnerItem(type, amount);
            } catch (Exception ignored) {}
        }
        return item;
    }

    public static String getSpawnerType(ItemStack item) {
        if (item == null || item.getType() != Material.SPAWNER || !item.hasItemMeta()) return null;

        ItemMeta meta = item.getItemMeta();
        if (meta instanceof BlockStateMeta bsm) {
            BlockState bs = bsm.getBlockState();
            if (bs instanceof CreatureSpawner cs) {
                EntityType et = cs.getSpawnedType();
                return et != null ? et.name() : null;
            }
        }
        return null;
    }

    public static boolean potionMatches(ItemStack it, String type) {
        if (!(it.getItemMeta() instanceof org.bukkit.inventory.meta.PotionMeta)) return false;
        org.bukkit.inventory.meta.PotionMeta meta = (org.bukkit.inventory.meta.PotionMeta) it.getItemMeta();
        org.bukkit.potion.PotionType potionType = meta.getBasePotionType();
        return potionType != null && potionType.name().equalsIgnoreCase(type);
    }

    public static boolean enchantmentsMatch(ItemStack it, Map<String, Integer> requiredEnchants) {
        if (!it.hasItemMeta() || requiredEnchants == null || requiredEnchants.isEmpty()) return false;

        ItemMeta meta = it.getItemMeta();
        if (!meta.hasEnchants()) return false;

        // Check each required enchantment
        for (Map.Entry<String, Integer> entry : requiredEnchants.entrySet()) {
            String enchantName = entry.getKey();
            int requiredLevel = entry.getValue();

            org.bukkit.enchantments.Enchantment enchant = ShopItemUtil.getEnchantment(enchantName);
            if (enchant == null) continue;

            int itemLevel = meta.getEnchantLevel(enchant);
            if (itemLevel != requiredLevel) return false;
        }

        return true;
    }

    public static boolean nameMatches(ItemStack it, String requiredName) {
        if (!it.hasItemMeta()) return false;
        ItemMeta meta = it.getItemMeta();
        if (!meta.hasDisplayName()) return false;
        String itemName = meta.getDisplayName();
        String coloredRequiredName = ShopItemUtil.color(requiredName);
        return itemName.equals(coloredRequiredName);
    }

    public static boolean loreMatches(ItemStack it, List<String> requiredLore) {
        if (!it.hasItemMeta()) return false;
        ItemMeta meta = it.getItemMeta();
        if (!meta.hasLore()) return false;
        List<String> itemLore = meta.getLore();
        if (itemLore == null || itemLore.size() != requiredLore.size()) return false;

        // Check each lore line matches
        for (int i = 0; i < requiredLore.size(); i++) {
            String coloredRequired = ShopItemUtil.color(requiredLore.get(i));
            if (!itemLore.get(i).equals(coloredRequired)) return false;
        }

        return true;
    }

    public static boolean isSameItem(ItemStack stack, me.dralle.shop.model.ShopItem shopItem) {
        if (stack == null || shopItem == null) return false;
        if (stack.getType() != shopItem.getMaterial()) return false;

        if (shopItem.isSpawner()) {
            if (shopItem.getSpawnerItem() != null && !shopItem.getSpawnerItem().isEmpty()) {
                if (!spawnerMatches(stack, "ITEM:" + shopItem.getSpawnerItem())) return false;
            } else {
                if (!spawnerMatches(stack, shopItem.getSpawnerType())) return false;
            }
        }

        if (shopItem.isPotion()) {
            if (!potionMatches(stack, shopItem.getPotionType())) return false;
        }

        if (shopItem.getEnchantments() != null && !shopItem.getEnchantments().isEmpty()) {
            if (!enchantmentsMatch(stack, shopItem.getEnchantments())) return false;
        }

        if (shopItem.requiresName()) {
            if (!nameMatches(stack, shopItem.getName())) return false;
        }

        if (shopItem.requiresLore()) {
            if (!loreMatches(stack, shopItem.getLore())) return false;
        }

        return true;
    }

    /**
     * Applies custom owner/texture data to a PLAYER_HEAD.
     * Supports:
     *  - head-owner: player name
     *  - head-texture: base64, full textures URL, or raw texture id
     */
    public static void applyHeadTexture(ItemStack item, String headTexture, String headOwner) {
        if (item == null || item.getType() != Material.PLAYER_HEAD) return;
        ItemMeta meta = item.getItemMeta();
        if (!(meta instanceof SkullMeta)) return;

        SkullMeta skullMeta = (SkullMeta) meta;
        boolean changed = false;

        if (headOwner != null && !headOwner.trim().isEmpty()) {
            try {
                skullMeta.setOwningPlayer(Bukkit.getOfflinePlayer(headOwner.trim()));
                changed = true;
            } catch (Throwable ignored) {
                // Ignore owner failures and continue with texture application
            }
        }

        if (headTexture != null && !headTexture.trim().isEmpty()) {
            String normalized = normalizeHeadTexture(headTexture.trim());
            if (!normalized.isEmpty()) {
                if (applyTextureViaReflection(skullMeta, normalized)) {
                    changed = true;
                }
            }
        }

        if (changed) {
            item.setItemMeta(skullMeta);
        }
    }

    private static String normalizeHeadTexture(String texture) {
        if (texture == null || texture.isEmpty()) return "";

        if (texture.startsWith("http://") || texture.startsWith("https://")) {
            return encodeTextureUrl(texture);
        }

        if (texture.contains("textures.minecraft.net/texture/")) {
            String url = texture.startsWith("http") ? texture : "https://" + texture;
            return encodeTextureUrl(url);
        }

        // Raw texture id used by textures.minecraft.net
        if (texture.matches("^[A-Za-z0-9_-]{20,}$")) {
            return encodeTextureUrl("https://textures.minecraft.net/texture/" + texture);
        }

        // Raw JSON payload
        if (texture.startsWith("{")) {
            return Base64.getEncoder().encodeToString(texture.getBytes(StandardCharsets.UTF_8));
        }

        // Assume already base64
        return texture;
    }

    private static String encodeTextureUrl(String url) {
        String safeUrl = url.replace("\"", "");
        String json = "{\"textures\":{\"SKIN\":{\"url\":\"" + safeUrl + "\"}}}";
        return Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }

    private static boolean applyTextureViaReflection(SkullMeta skullMeta, String base64Texture) {
        try {
            Class<?> gameProfileClass = Class.forName("com.mojang.authlib.GameProfile");
            Class<?> propertyClass = Class.forName("com.mojang.authlib.properties.Property");

            Constructor<?> profileCtor = gameProfileClass.getConstructor(UUID.class, String.class);
            Object profile = profileCtor.newInstance(UUID.nameUUIDFromBytes(base64Texture.getBytes(StandardCharsets.UTF_8)), "ShopHead");

            Method getProperties = gameProfileClass.getMethod("getProperties");
            Object propertyMap = getProperties.invoke(profile);
            Constructor<?> propertyCtor = propertyClass.getConstructor(String.class, String.class);
            Object property = propertyCtor.newInstance("textures", base64Texture);

            Method putMethod = propertyMap.getClass().getMethod("put", Object.class, Object.class);
            putMethod.invoke(propertyMap, "textures", property);

            // Try setProfile(GameProfile) first
            try {
                Method setProfile = skullMeta.getClass().getDeclaredMethod("setProfile", gameProfileClass);
                setProfile.setAccessible(true);
                setProfile.invoke(skullMeta, profile);
                return true;
            } catch (NoSuchMethodException ignored) {
                // Fall back to direct profile field below
            }

            Field profileField = findField(skullMeta.getClass(), "profile");
            if (profileField != null) {
                profileField.setAccessible(true);
                profileField.set(skullMeta, profile);
                return true;
            }
        } catch (Throwable ignored) {
            // Reflection may vary across server versions.
        }
        return false;
    }

    private static Field findField(Class<?> type, String name) {
        Class<?> current = type;
        while (current != null) {
            try {
                return current.getDeclaredField(name);
            } catch (NoSuchFieldException ignored) {
                current = current.getSuperclass();
            }
        }
        return null;
    }
}
