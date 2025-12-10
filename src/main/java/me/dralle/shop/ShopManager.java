package me.dralle.shop;

import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;

import java.util.*;

public class ShopManager {

    private final ShopPlugin plugin;
    private final Map<String, ShopData> shops = new LinkedHashMap<>();

    public ShopManager(ShopPlugin plugin) {
        this.plugin = plugin;
        ShopFileManager fileManager = plugin.getShopFileManager();

        if (fileManager.getShopKeys().isEmpty()) {
            plugin.getLogger().warning("No shops found in shops/ folder!");
            return;
        }

        for (String shopKey : fileManager.getShopKeys()) {
            FileConfiguration shopConfig = fileManager.getShopConfig(shopKey);
            if (shopConfig == null) continue;

            String guiName = shopConfig.getString("gui-name", "&8Shop");
            int rows = Math.max(1, shopConfig.getInt("rows", 4));

            String permission = shopConfig.getString("permission", "");
            if (permission.equalsIgnoreCase("null")) permission = "";

            // ----------------------------------------------------------
            // Load time restrictions (optional)
            // ----------------------------------------------------------
            List<String> availableTimes = shopConfig.getStringList("available-times");

            // ----------------------------------------------------------
            // Load shop items
            // ----------------------------------------------------------
            List<ShopItem> items = loadShopItems(shopConfig);

            shops.put(shopKey, new ShopData(shopKey, guiName, rows, permission, items, availableTimes));
        }
    }

    /**
     * Loads shop items from a configuration section.
     */
    private List<ShopItem> loadShopItems(FileConfiguration config) {
        List<ShopItem> items = new ArrayList<>();

        List<?> raw = config.getList("items");
        if (raw == null) return items;

        for (Object obj : raw) {
            if (!(obj instanceof Map)) continue;

            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) obj;

            // Material
            String matName = (String) map.get("material");
            if (matName == null) continue;

            Material mat = Material.matchMaterial(matName);
            if (mat == null) continue;

            // Buy price
            double buyPrice = 0;
            Object priceObj = map.get("price");
            if (priceObj instanceof Number)
                buyPrice = ((Number) priceObj).doubleValue();

            // Sell price
            Double sellPrice = null;
            Object sellObj = map.get("sell-price");
            if (sellObj instanceof Number)
                sellPrice = ((Number) sellObj).doubleValue();

            // Amount
            int amount = 1;
            Object amountObj = map.get("amount");
            if (amountObj instanceof Number)
                amount = ((Number) amountObj).intValue();

            // Name
            String name = (String) map.get("name");
            if (name == null)
                name = mat.name();

            // Spawner type
            String spawnerType = (String) map.get("spawner-type");

            // Potion type
            String potionType = (String) map.get("potion-type");

            // Potion level (0 = use base type, 1-255 = custom amplifier)
            int potionLevel = 0;
            Object potionLevelObj = map.get("potion-level");
            if (potionLevelObj instanceof Number) {
                potionLevel = Math.min(Math.max(((Number) potionLevelObj).intValue(), 0), 255);
            }

            // Lore
            List<String> lore = new ArrayList<>();
            Object loreObj = map.get("lore");
            if (loreObj instanceof List) {
                for (Object l : (List<?>) loreObj)
                    lore.add(l == null ? "" : l.toString());
            }

            // Enchantments
            Map<String, Integer> enchantments = new HashMap<>();
            Object enchObj = map.get("enchantments");
            if (enchObj instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> enchMap = (Map<String, Object>) enchObj;
                for (Map.Entry<String, Object> entry : enchMap.entrySet()) {
                    try {
                        enchantments.put(entry.getKey().toUpperCase(), Integer.parseInt(String.valueOf(entry.getValue())));
                    } catch (NumberFormatException ignored) {}
                }
            }

            // -----------------------------------------------------
            // Tooltip flags
            // -----------------------------------------------------
            boolean hideAttributes = false;
            if (map.containsKey("hide-attributes"))
                hideAttributes = Boolean.parseBoolean(String.valueOf(map.get("hide-attributes")));

            boolean hideAdditional = false;
            if (map.containsKey("hide-additional"))
                hideAdditional = Boolean.parseBoolean(String.valueOf(map.get("hide-additional")));

            // -----------------------------------------------------
            // Require flags (for both buying and selling)
            // -----------------------------------------------------
            boolean requireName = false;
            if (map.containsKey("require-name"))
                requireName = Boolean.parseBoolean(String.valueOf(map.get("require-name")));

            boolean requireLore = false;
            if (map.containsKey("require-lore"))
                requireLore = Boolean.parseBoolean(String.valueOf(map.get("require-lore")));

            // -----------------------------------------------------
            // Unstable TNT flag
            // -----------------------------------------------------
            boolean unstableTnt = false;
            if (map.containsKey("unstable-tnt"))
                unstableTnt = Boolean.parseBoolean(String.valueOf(map.get("unstable-tnt")));

            // Create shop item
            items.add(new ShopItem(
                    mat,
                    buyPrice,
                    amount,
                    spawnerType,
                    potionType,
                    potionLevel,
                    name,
                    lore,
                    sellPrice,
                    enchantments,
                    hideAttributes,
                    hideAdditional,
                    requireName,
                    requireLore,
                    unstableTnt
            ));
        }

        return items;
    }

    public ShopData getShop(String key) {
        return shops.get(key);
    }

    public Set<String> getShopKeys() {
        return shops.keySet();
    }
}
