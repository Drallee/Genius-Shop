package me.dralle.shop;

import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.stock.StockResetRule;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.ShopTimeUtil;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.ConfigurationSection;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Month;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class ShopManager {

    private final ShopPlugin plugin;
    private final Map<String, ShopData> shops = new LinkedHashMap<>();

    public ShopManager(ShopPlugin plugin) {
        this.plugin = plugin;
        ShopFileManager fileManager = plugin.getShopFileManager();

        if (fileManager.getShopKeys().isEmpty()) {
            me.dralle.shop.util.ConsoleLog.warn(plugin, "No shops found in shops/ folder!");
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
            List<String> invalidTimes = ShopTimeUtil.validateRestrictions(availableTimes);
            for (String invalid : invalidTimes) {
                me.dralle.shop.util.ConsoleLog.warn(plugin, "Invalid 'available-times' in shop '" + shopKey + "': " + invalid);
            }

            // ----------------------------------------------------------
            // Load shop items
            // ----------------------------------------------------------
            List<ShopItem> items = loadShopItems(shopConfig);

            StockResetRule shopResetRule = parseShopResetRule(shopKey, shopConfig);
            boolean shopSellAddsToStock = shopConfig.getBoolean("sell-adds-to-stock", false);
            boolean shopAllowSellStockOverflow = shopConfig.getBoolean("allow-sell-stock-overflow", false);

            shops.put(shopKey, new ShopData(
                    shopKey,
                    guiName,
                    rows,
                    permission,
                    items,
                    availableTimes,
                    shopResetRule,
                    shopSellAddsToStock,
                    shopAllowSellStockOverflow
            ));
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

            // Spawner type
            String spawnerType = (String) map.get("spawner-type");

            // Spawner item (for SmartSpawner item spawners)
            String spawnerItem = (String) map.get("spawner-item");

            // Potion type
            String potionType = (String) map.get("potion-type");

            // Potion level (0 = use base type, 1-255 = custom amplifier)
            int potionLevel = 0;
            Object potionLevelObj = map.get("potion-level");
            if (potionLevelObj instanceof Number) {
                potionLevel = Math.min(Math.max(((Number) potionLevelObj).intValue(), 0), 255);
            }

            // Player head data (optional)
            String headTexture = map.get("head-texture") != null ? String.valueOf(map.get("head-texture")) : null;
            String headOwner = map.get("head-owner") != null ? String.valueOf(map.get("head-owner")) : null;

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
                        enchantments.put(entry.getKey(), Integer.parseInt(String.valueOf(entry.getValue())));
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

            // -----------------------------------------------------
            // Player limit
            // -----------------------------------------------------
            int limit = 0;
            Object limitObj = map.get("limit");
            if (limitObj instanceof Number)
                limit = ((Number) limitObj).intValue();

            // -----------------------------------------------------
            // Global limit
            // -----------------------------------------------------
            int globalLimit = 0;
            Object globalLimitObj = map.get("global-limit");
            if (globalLimitObj instanceof Number)
                globalLimit = ((Number) globalLimitObj).intValue();

            // -----------------------------------------------------
            // Dynamic Pricing
            // -----------------------------------------------------
            boolean dynamicPricing = false;
            if (map.containsKey("dynamic-pricing"))
                dynamicPricing = Boolean.parseBoolean(String.valueOf(map.get("dynamic-pricing")));

            double minPrice = 0;
            Object minPriceObj = map.get("min-price");
            if (minPriceObj instanceof Number)
                minPrice = ((Number) minPriceObj).doubleValue();

            double maxPrice = 0;
            Object maxPriceObj = map.get("max-price");
            if (maxPriceObj instanceof Number)
                maxPrice = ((Number) maxPriceObj).doubleValue();

            double priceChange = 0;
            Object priceChangeObj = map.get("price-change");
            if (priceChangeObj instanceof Number)
                priceChange = ((Number) priceChangeObj).doubleValue();

            // Commands (optional)
            List<String> commands = new ArrayList<>();
            Object commandsObj = map.get("commands");
            if (commandsObj instanceof List) {
                for (Object cmd : (List<?>) commandsObj) {
                    if (cmd instanceof String) {
                        commands.add((String) cmd);
                    }
                }
            }

            boolean runCommandOnly = true;
            if (map.containsKey("run-command-only"))
                runCommandOnly = Boolean.parseBoolean(String.valueOf(map.get("run-command-only")));
            String runAs = stringVal(map.get("run-as"), "console").trim().toLowerCase(Locale.ROOT);
            if (!runAs.equals("player") && !runAs.equals("console")) {
                runAs = "console";
            }

            // Permission (optional)
            String itemPermission = (String) map.get("permission");
            if (itemPermission == null) itemPermission = "";

            // Available times (optional)
            List<String> itemAvailableTimes = new ArrayList<>();
            Object itemAvailableTimesObj = map.get("available-times");
            if (itemAvailableTimesObj instanceof List) {
                for (Object time : (List<?>) itemAvailableTimesObj) {
                    if (time != null) itemAvailableTimes.add(time.toString());
                }
            }

            // Stock reset (optional)
            StockResetRule itemResetRule = parseItemResetRule(map, matName);

            // Optional sell stock behavior override (falls back to shop-level when null)
            Boolean sellAddsToStock = map.containsKey("sell-adds-to-stock")
                    ? boolVal(map.get("sell-adds-to-stock"), false)
                    : null;
            Boolean allowSellStockOverflow = map.containsKey("allow-sell-stock-overflow")
                    ? boolVal(map.get("allow-sell-stock-overflow"), false)
                    : null;
            boolean showStock = map.containsKey("show-stock")
                    && boolVal(map.get("show-stock"), false);
            boolean showStockResetTimer = map.containsKey("show-stock-reset-timer")
                    && boolVal(map.get("show-stock-reset-timer"), false);

            // Slot (optional)
            Integer slot = null;
            Object slotObj = map.get("slot");
            if (slotObj instanceof Number)
                slot = ((Number) slotObj).intValue();

            // Create shop item
            items.add(new ShopItem(
                    mat,
                    buyPrice,
                    amount,
                    spawnerType,
                    spawnerItem,
                    potionType,
                    potionLevel,
                    headTexture,
                    headOwner,
                    name,
                    lore,
                    sellPrice,
                    enchantments,
                    hideAttributes,
                    hideAdditional,
                    requireName,
                    requireLore,
                    unstableTnt,
                    limit,
                    globalLimit,
                    dynamicPricing,
                    minPrice,
                    maxPrice,
                    priceChange,
                    commands,
                    runAs,
                    runCommandOnly,
                    itemPermission,
                    itemAvailableTimes,
                    itemResetRule,
                    sellAddsToStock,
                    allowSellStockOverflow,
                    showStock,
                    showStockResetTimer,
                    slot
            ));
        }

        // Assign slots to items that don't have them
        assignMissingSlots(items);

        return items;
    }

    private StockResetRule parseShopResetRule(String shopKey, FileConfiguration config) {
        ConfigurationSection sec = config.getConfigurationSection("stock-reset");
        if (sec == null) return null;
        return parseResetSection("shop '" + shopKey + "'", sec);
    }

    @SuppressWarnings("unchecked")
    private StockResetRule parseItemResetRule(Map<String, Object> map, String matName) {
        Object raw = map.get("stock-reset");
        if (raw == null) return null;

        if (raw instanceof String) {
            String type = (String) raw;
            return parseResetValues("item '" + matName + "'", type, "00:00", null, null, null, null, null, null, "server", true);
        }

        if (raw instanceof Map) {
            Map<String, Object> m = (Map<String, Object>) raw;
            String type = stringVal(m.get("type"), "none");
            String time = stringVal(m.get("time"), "00:00");
            String dayOfWeek = stringVal(m.get("day-of-week"), null);
            Integer dayOfMonth = intVal(m.get("day-of-month"), null);
            String month = stringVal(m.get("month"), null);
            Integer monthDay = intVal(m.get("month-day"), null);
            String date = stringVal(m.get("date"), null);
            Integer interval = intVal(m.get("interval"), null);
            String timezone = stringVal(m.get("timezone"), "server");
            boolean enabled = boolVal(m.get("enabled"), true);
            return parseResetValues("item '" + matName + "'", type, time, dayOfWeek, dayOfMonth, month, monthDay, date, interval, timezone, enabled);
        }

        me.dralle.shop.util.ConsoleLog.warn(plugin, "Invalid stock-reset format for item '" + matName + "'");
        return null;
    }

    private StockResetRule parseResetSection(String context, ConfigurationSection sec) {
        String type = sec.getString("type", "none");
        String time = sec.getString("time", "00:00");
        String dayOfWeek = sec.getString("day-of-week", null);
        Integer dayOfMonth = sec.contains("day-of-month") ? sec.getInt("day-of-month") : null;
        String month = sec.getString("month", null);
        Integer monthDay = sec.contains("month-day") ? sec.getInt("month-day") : null;
        String date = sec.getString("date", null);
        Integer interval = sec.contains("interval") ? sec.getInt("interval") : null;
        String timezone = sec.getString("timezone", "server");
        boolean enabled = sec.getBoolean("enabled", true);
        return parseResetValues(context, type, time, dayOfWeek, dayOfMonth, month, monthDay, date, interval, timezone, enabled);
    }

    private StockResetRule parseResetValues(
            String context,
            String typeRaw,
            String timeRaw,
            String dayOfWeekRaw,
            Integer dayOfMonthRaw,
            String monthRaw,
            Integer monthDayRaw,
            String dateRaw,
            Integer intervalRaw,
            String timezoneRaw,
            boolean enabled
    ) {
        StockResetRule.Type type;
        try {
            String normalizedType = typeRaw.toUpperCase(Locale.ROOT).replace('-', '_');
            type = StockResetRule.Type.valueOf(normalizedType);
        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.warn(plugin, "Invalid stock-reset.type for " + context + ": " + typeRaw);
            return null;
        }

        ZoneId zone = ZoneId.systemDefault();
        if (timezoneRaw != null && !timezoneRaw.equalsIgnoreCase("server")) {
            try {
                zone = ZoneId.of(timezoneRaw);
            } catch (Exception ignored) {
                me.dralle.shop.util.ConsoleLog.warn(plugin, "Invalid stock-reset.timezone for " + context + ": " + timezoneRaw);
            }
        }

        LocalTime time = LocalTime.MIDNIGHT;
        if (timeRaw != null && !timeRaw.isEmpty()) {
            try {
                time = LocalTime.parse(timeRaw, DateTimeFormatter.ofPattern("H:mm:ss"));
            } catch (Exception ignored) {
                try {
                    time = LocalTime.parse(timeRaw, DateTimeFormatter.ofPattern("H:mm"));
                } catch (Exception e) {
                    me.dralle.shop.util.ConsoleLog.warn(plugin, "Invalid stock-reset.time for " + context + ": " + timeRaw + " (expected HH:mm or HH:mm:ss)");
                }
            }
        }

        DayOfWeek dayOfWeek = null;
        if (dayOfWeekRaw != null && !dayOfWeekRaw.isEmpty()) {
            try {
                dayOfWeek = DayOfWeek.valueOf(dayOfWeekRaw.toUpperCase(Locale.ROOT));
            } catch (Exception e) {
                me.dralle.shop.util.ConsoleLog.warn(plugin, "Invalid stock-reset.day-of-week for " + context + ": " + dayOfWeekRaw);
            }
        }

        int dayOfMonth = dayOfMonthRaw != null ? Math.max(1, Math.min(31, dayOfMonthRaw)) : 1;

        Month month = null;
        if (monthRaw != null && !monthRaw.isEmpty()) {
            try {
                // Accept numeric month values from editor/config (1-12) as well as enum names.
                if (monthRaw.matches("\\d+")) {
                    int monthValue = Integer.parseInt(monthRaw);
                    month = Month.of(Math.max(1, Math.min(12, monthValue)));
                } else {
                    month = Month.valueOf(monthRaw.toUpperCase(Locale.ROOT));
                }
            } catch (Exception e) {
                me.dralle.shop.util.ConsoleLog.warn(plugin, "Invalid stock-reset.month for " + context + ": " + monthRaw);
            }
        }

        int monthDay = monthDayRaw != null ? Math.max(1, Math.min(31, monthDayRaw)) : 1;

        LocalDateTime onceAt = null;
        int interval = intervalRaw != null ? Math.max(1, intervalRaw) : 1;
        if (type == StockResetRule.Type.ONCE) {
            if (dateRaw == null || dateRaw.isEmpty()) {
                me.dralle.shop.util.ConsoleLog.warn(plugin, "Missing stock-reset.date for " + context + " (required for type ONCE)");
                return null;
            }
            onceAt = parseDateTime(dateRaw);
            if (onceAt == null) {
                me.dralle.shop.util.ConsoleLog.warn(plugin, "Invalid stock-reset.date for " + context + ": " + dateRaw + " (use yyyy-MM-dd HH:mm or yyyy-MM-dd'T'HH:mm)");
                return null;
            }
        }

        return new StockResetRule(enabled, type, zone, time, dayOfWeek, dayOfMonth, month, monthDay, onceAt, interval);
    }

    private LocalDateTime parseDateTime(String raw) {
        try {
            return LocalDateTime.parse(raw, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        } catch (Exception ignored) {}
        try {
            return LocalDateTime.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception ignored) {}
        return null;
    }

    private String stringVal(Object v, String def) {
        return v == null ? def : String.valueOf(v);
    }

    private Integer intVal(Object v, Integer def) {
        if (v == null) return def;
        if (v instanceof Number) return ((Number) v).intValue();
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (Exception e) {
            return def;
        }
    }

    private boolean boolVal(Object v, boolean def) {
        if (v == null) return def;
        if (v instanceof Boolean) return (Boolean) v;
        return Boolean.parseBoolean(String.valueOf(v));
    }

    private void assignMissingSlots(List<ShopItem> items) {
        Set<Integer> takenSlots = new HashSet<>();
        for (ShopItem item : items) {
            if (item.getSlot() != null) {
                takenSlots.add(item.getSlot());
            }
        }

        int nextSlot = 0;
        for (ShopItem item : items) {
            if (item.getSlot() == null) {
                while (takenSlots.contains(nextSlot)) {
                    nextSlot++;
                }
                item.setSlot(nextSlot);
                takenSlots.add(nextSlot);
                nextSlot++;
            }
        }
    }

    public ShopData getShop(String key) {
        return shops.get(key);
    }

    public Set<String> getShopKeys() {
        return shops.keySet();
    }

    public static class SellInfo {
        public final ShopItem item;
        public final String shopKey;

        public SellInfo(ShopItem item, String shopKey) {
            this.item = item;
            this.shopKey = shopKey;
        }
    }

    /**
     * Finds the best ShopItem (highest sell price) that matches the given ItemStack.
     */
    public SellInfo getBestSellInfo(org.bukkit.inventory.ItemStack stack) {
        return getBestSellInfo(null, stack);
    }

    /**
     * Finds the best ShopItem (highest sell price) that matches the given ItemStack,
     * considering the player's permissions and shop availability.
     */
    public SellInfo getBestSellInfo(Player player, org.bukkit.inventory.ItemStack stack) {
        ShopItem bestItem = null;
        String bestShopKey = null;
        double bestPrice = -1;

        for (Map.Entry<String, ShopData> entry : shops.entrySet()) {
            ShopData shop = entry.getValue();

            // Permission check
            if (player != null && shop.getPermission() != null && !shop.getPermission().isEmpty()) {
                if (!player.hasPermission(shop.getPermission())) continue;
            }

            // Time restriction check
            if (!ShopTimeUtil.isShopAvailable(shop.getAvailableTimes())) continue;

            for (ShopItem si : shop.getItems()) {
                if (si.getSellPrice() != null && si.getSellPrice() > 0) {
                    // Item-level permission check
                    if (player != null && si.getPermission() != null && !si.getPermission().isEmpty()) {
                        if (!player.hasPermission(si.getPermission())) continue;
                    }

                    // Item-level time restriction check
                    if (!ShopTimeUtil.isShopAvailable(si.getAvailableTimes())) continue;

                    if (ShopItemUtil.isSameItem(stack, si)) {
                        if (si.getSellPrice() > bestPrice) {
                            bestPrice = si.getSellPrice();
                            bestItem = si;
                            bestShopKey = entry.getKey();
                        }
                    }
                }
            }
        }
        return bestItem != null ? new SellInfo(bestItem, bestShopKey) : null;
    }

    /**
     * Finds the best ShopItem (highest sell price) that matches the given ItemStack.
     */
    public ShopItem getBestSellItem(org.bukkit.inventory.ItemStack stack) {
        SellInfo info = getBestSellInfo(null, stack);
        return info != null ? info.item : null;
    }

    /**
     * Finds the best ShopItem (highest sell price) that matches the given ItemStack,
     * considering the player's permissions and shop availability.
     */
    public ShopItem getBestSellItem(Player player, org.bukkit.inventory.ItemStack stack) {
        SellInfo info = getBestSellInfo(player, stack);
        return info != null ? info.item : null;
    }
}
