package me.dralle.shop.discovery;

import com.google.gson.Gson;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Shop-scoped identity; prices and access rules may change without losing a bookmark. */
public record ItemReference(String shopKey, String fingerprint, int slot) {
    private static final Gson JSON = new Gson();
    private static final Map<ShopItem, String> FINGERPRINTS = Collections.synchronizedMap(new WeakHashMap<>());

    public ItemReference {
        if (shopKey == null || shopKey.isBlank() || fingerprint == null || !fingerprint.matches("[a-f0-9]{64}") || slot < 0) {
            throw new IllegalArgumentException("Invalid item reference");
        }
    }

    public static ItemReference of(String shopKey, ShopItem item) {
        return new ItemReference(shopKey, fingerprint(item), Objects.requireNonNull(item.getSlot()));
    }

    public static String fingerprint(ShopItem item) {
        return FINGERPRINTS.computeIfAbsent(item, ItemReference::calculateFingerprint);
    }

    private static String calculateFingerprint(ShopItem item) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("material", item.getMaterial().name());
        values.put("name", item.getName());
        values.put("amount", item.getAmount());
        values.put("lore", item.getLore());
        values.put("spawnerType", item.getSpawnerType());
        values.put("spawnerItem", item.getSpawnerItem());
        values.put("potionType", item.getPotionType());
        values.put("potionLevel", item.getPotionLevel());
        values.put("headTexture", item.getHeadTexture());
        values.put("headOwner", item.getHeadOwner());
        values.put("itemStack", item.getItemStackData());
        values.put("enchantments", item.getEnchantments() == null ? null : new TreeMap<>(item.getEnchantments()));
        values.put("variant", item.getVariantKey());
        values.put("variantGroup", item.getVariantGroupKey());
        values.put("commands", item.getCommands());
        values.put("runAs", item.getRunAs());
        values.put("commandOnly", item.isRunCommandOnly());
        values.put("buyPerItem", item.isBuyPricePerItem());
        values.put("sellPerItem", item.isSellPricePerItem());
        values.put("requireName", item.requiresName());
        values.put("requireLore", item.requiresLore());
        values.put("unstableTnt", item.isUnstableTnt());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(JSON.toJson(values).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    public ShopItem resolve(ShopData shop) {
        if (shop == null || !shopKey.equals(shop.getKey())) return null;
        ShopItem moved = null;
        ShopItem sameSlot = null;
        int slotMatches = 0;
        int matches = 0;
        for (ShopItem item : shop.getItems()) {
            if (item.getSlot() == null || !fingerprint.equals(fingerprint(item))) continue;
            if (slot == item.getSlot()) { sameSlot = item; slotMatches++; }
            moved = item;
            matches++;
        }
        if (slotMatches > 0) return slotMatches == 1 ? sameSlot : null;
        return matches == 1 ? moved : null;
    }
}
