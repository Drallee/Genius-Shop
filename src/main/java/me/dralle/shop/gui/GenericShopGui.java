package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.stock.StockResetRule;
import me.dralle.shop.util.CampaignUtil;
import me.dralle.shop.util.ItemConditionUtil;
import me.dralle.shop.util.PriceFormulaUtil;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.ShopTimeUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.metadata.FixedMetadataValue;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.Instant;
import java.time.Duration;

public class GenericShopGui implements Listener {

    public static class GenericShopHolder implements InventoryHolder {
        private final String shopKey;
        private final int page;

        public GenericShopHolder(String shopKey, int page) {
            this.shopKey = shopKey;
            this.page = page;
        }

        public String getShopKey() { return shopKey; }
        public int getPage() { return page; }

        @Override
        public Inventory getInventory() { return null; }
    }

    public static class VariantHolder implements InventoryHolder {
        private final String shopKey;
        private final int returnPage;
        private final List<ShopItem> variants;

        public VariantHolder(String shopKey, int returnPage, List<ShopItem> variants) {
            this.shopKey = shopKey;
            this.returnPage = returnPage;
            this.variants = variants;
        }

        public String getShopKey() { return shopKey; }
        public int getReturnPage() { return returnPage; }
        public List<ShopItem> getVariants() { return variants; }

        @Override
        public Inventory getInventory() { return null; }
    }

    private final ShopPlugin plugin;
    private int refreshTaskId = -1;
    private volatile boolean refreshDirty = true;
    private volatile long lastRefreshAtMillis = 0L;

    public GenericShopGui(ShopPlugin plugin) {
        this.plugin = plugin;
        startLiveRefreshTask();
    }

    /**
     * Open a shop page for a player.
     */
    private ItemStack createGuiItem(Player viewer, ShopItem si, String shopKey, String availableTimesStr, String currency, ShopData shop) {
        List<String> lore = new ArrayList<>();
        List<String> format = plugin.getMenuManager().getGuiSettingsConfig().getStringList("gui.item-lore.lore-format");

        if (format == null || format.isEmpty()) {
            // Default legacy behavior
            addPriceLines(lore, si, currency, shop);

            // Check if item has special properties (spawner, potion, enchantments, or custom lore)
            boolean hasSpecialProperties = si.getSpawnerType() != null ||
                    si.getSpawnerItem() != null ||
                    si.getPotionType() != null ||
                    (si.getEnchantments() != null && !si.getEnchantments().isEmpty()) ||
                    (si.getLore() != null && !si.getLore().isEmpty());

            // Add empty line before special properties if they exist
            if (hasSpecialProperties) {
                lore.add("");
            }

            // Add custom item lore from shop config
            addCustomLore(lore, viewer, si, availableTimesStr);

            addSpawnerTypeLine(lore, si);
            addSpawnerItemLine(lore, si);
            addPotionTypeLine(lore, si);

            // Add empty line after special properties if they exist
            if (hasSpecialProperties) {
                lore.add("");
            }

            // Configurable hint lines
            addHintLines(lore, si, currency, shop);
        } else {
            for (String line : format) {
                switch (line) {
                    case "%price-line%":
                        addPriceLines(lore, si, currency, shop);
                        break;
                    case "%buy-price-line%":
                        addPriceLine(lore, si, currency, true, shop);
                        break;
                    case "%sell-price-line%":
                        addPriceLine(lore, si, currency, false, shop);
                        break;
                    case "%custom-lore%":
                        addCustomLore(lore, viewer, si, availableTimesStr);
                        break;
                    case "%spawner-type-line%":
                        addSpawnerTypeLine(lore, si);
                        break;
                    case "%spawner-item-line%":
                        addSpawnerItemLine(lore, si);
                        break;
                    case "%potion-type-line%":
                        addPotionTypeLine(lore, si);
                        break;
                    case "%stock-reset-timer-line%":
                    case "%stock-reset-timer%":
                        addStockResetTimerLine(lore, si, shopKey);
                        break;
                    case "%global-limit%":
                    case "%global-limit-line%":
                        addGlobalLimitLine(lore, si);
                        break;
                    case "%player-limit%":
                    case "%player-limit-line%":
                        addPlayerLimitLine(lore, viewer, si);
                        break;
                    case "%hint-line%":
                        addHintLines(lore, si, currency, shop);
                        break;
                    case "%buy-hint-line%":
                        addHintLine(lore, si, currency, true, shop);
                        break;
                    case "%sell-hint-line%":
                        addHintLine(lore, si, currency, false, shop);
                        break;
                    default:
                        if (line.isEmpty()) {
                            lore.add("");
                        } else {
                            lore.add(ShopItemUtil.color(line));
                        }
                        break;
                }
            }
        }

        ItemStack item = ShopItemUtil.deserializeItemStack(si.getItemStackData());
        if (item != null) {
            item = item.clone();
            item.setAmount(Math.max(1, Math.min(si.getAmount(), item.getMaxStackSize())));
            item = ShopItemUtil.create(item, si.getName(), lore);
        } else if (si.isSpawner()) {
            if (si.getSpawnerItem() != null && !si.getSpawnerItem().isEmpty()) {
                item = ShopItemUtil.getSpawnerItem(si.getSpawnerItem(), si.getAmount(), true);
            } else if (si.getSpawnerType() != null && !si.getSpawnerType().isEmpty()) {
                item = ShopItemUtil.getSpawnerItem(si.getSpawnerType(), si.getAmount(), false);
            } else {
                item = new ItemStack(si.getMaterial(), si.getAmount());
            }
            item = ShopItemUtil.create(item, si.getName(), lore);
        } else {
            item = ShopItemUtil.create(si.getMaterial(), si.getAmount(), si.getName(), lore);
        }

        // Apply potion type if this is a potion or tipped arrow
        if (si.isPotion()) {
            ShopItemUtil.applyPotionType(item, si.getPotionType(), si.getPotionLevel());
        }

        if (si.isPlayerHead()) {
            ShopItemUtil.applyHeadTexture(item, si.getHeadTexture(), si.getHeadOwner());
        }

        // Apply enchantments
        if (si.getEnchantments() != null && !si.getEnchantments().isEmpty()) {
            ShopItemUtil.applyEnchantments(item, si.getEnchantments());
        }

        ItemMeta meta = item.getItemMeta();
        if (meta != null) {
            if (si.shouldHideAttributes()) meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
            if (si.shouldHideAdditional()) meta.addItemFlags(ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
            item.setItemMeta(meta);
        }

        return item;
    }

    private static class VariantGroupData {
        private final String key;
        private final int slot;
        private final List<ShopItem> options = new ArrayList<>();

        private VariantGroupData(String key, int slot) {
            this.key = key;
            this.slot = slot;
        }
    }

    private Map<Integer, VariantGroupData> buildVariantGroups(ShopData shop, Player viewer, int start, int end) {
        Map<String, VariantGroupData> byKey = new LinkedHashMap<>();
        for (ShopItem si : shop.getItems()) {
            if (!si.isVariantMenuEnabled()) continue;
            String groupKey = si.getVariantGroupKey();
            if (groupKey == null || groupKey.isEmpty()) continue;

            if (si.getPermission() != null && !si.getPermission().isEmpty() && !viewer.hasPermission(si.getPermission())) {
                continue;
            }
            ItemConditionUtil.ConditionResult condition = ItemConditionUtil.check(plugin, viewer, si);
            if (!condition.allowed()) continue;

            int groupSlot = si.getVariantGroupSlot() != null
                    ? si.getVariantGroupSlot()
                    : (si.getSlot() != null ? si.getSlot() : -1);
            if (groupSlot < start || groupSlot >= end) continue;

            VariantGroupData group = byKey.computeIfAbsent(groupKey, k -> new VariantGroupData(groupKey, groupSlot));
            group.options.add(si);
        }

        Map<Integer, VariantGroupData> bySlot = new LinkedHashMap<>();
        for (VariantGroupData group : byKey.values()) {
            if (!group.options.isEmpty()) {
                bySlot.put(group.slot, group);
            }
        }
        return bySlot;
    }

    private ItemStack createVariantGroupIcon(Player viewer, ShopData shop, String shopKey, String availableTimesStr, String currency, VariantGroupData group) {
        ShopItem first = group.options.get(0);
        ItemStack icon = createGuiItem(viewer, first, shopKey, availableTimesStr, currency, shop);
        ItemMeta meta = icon.getItemMeta();
        if (meta == null) return icon;

        List<String> lore = meta.hasLore() ? new ArrayList<>(meta.getLore()) : new ArrayList<>();
        if (!lore.isEmpty()) lore.add("");
        lore.add(ShopItemUtil.color("&bVariants: &f" + group.options.size()));
        lore.add(ShopItemUtil.color("&7Left/Right click to choose variant"));
        meta.setLore(lore);
        icon.setItemMeta(meta);
        return icon;
    }

    private void openVariantSelector(Player player, ShopData shop, String shopKey, int returnPage, VariantGroupData group) {
        int variantCount = group.options.size();
        int rows = Math.max(2, Math.min(6, ((variantCount + 8) / 9) + 1));
        int totalSlots = rows * 9;
        int nav = totalSlots - 9;
        int backSlot = nav + 4;

        String title = me.dralle.shop.util.BedrockUtil.formatTitle(player, ShopItemUtil.color("&8Choose Variant"));
        Inventory inv = Bukkit.createInventory(new VariantHolder(shopKey, returnPage, new ArrayList<>(group.options)), totalSlots, title);
        String currency = plugin.getCurrencySymbol();
        String availableTimesStr = ShopTimeUtil.formatAvailableTimes(shop.getAvailableTimes(), plugin);

        for (int i = 0; i < variantCount && i < nav; i++) {
            ShopItem variant = group.options.get(i);
            inv.setItem(i, createGuiItem(player, variant, shopKey, availableTimesStr, currency, shop));
        }

        String backName = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.back-button.name", "&9Back");
        List<String> backLore = plugin.getMenuManager().getGuiSettingsConfig().getStringList("gui.back-button.lore");
        inv.setItem(backSlot, ShopItemUtil.create(Material.ENDER_CHEST, 1, backName, backLore));

        player.openInventory(inv);
    }

    private void handleShopItemAction(Player player, ShopItem item, String shopKey, int page, ClickType clickType) {
        if (item.getPermission() != null && !item.getPermission().isEmpty()) {
            if (!player.hasPermission(item.getPermission())) {
                player.sendMessage(plugin.getMessages().getMessage("no-permission"));
                return;
            }
        }

        if (!ShopTimeUtil.isShopAvailable(item.getAvailableTimes())) {
            String available = ShopTimeUtil.formatAvailableTimes(item.getAvailableTimes(), plugin);
            player.sendMessage(plugin.getMessages().getMessage("shop-not-available")
                    .replace("%shop%", item.getName() != null ? ShopItemUtil.color(item.getName()) : item.getMaterial().name())
                    .replace("%available-times%", available));
            return;
        }

        ItemConditionUtil.ConditionResult condition = ItemConditionUtil.check(plugin, player, item);
        if (!condition.allowed()) {
            player.sendMessage(condition.message());
            return;
        }

        if (clickType == ClickType.RIGHT && item.getSellPrice() != null && item.getSellPrice() > 0) {
            Bukkit.getScheduler().runTask(plugin, () -> SellMenu.open(player, item, shopKey, page));
            return;
        }
        if (clickType == ClickType.LEFT && item.getPrice() > 0) {
            Bukkit.getScheduler().runTask(plugin, () -> PurchaseMenu.open(player, item, shopKey, page));
        }
    }

    public void openShop(Player player, String shopKey, int page) {
        plugin.debug("Player " + player.getName() + " attempting to open shop: " + shopKey + " (page " + page + ")");
        
        ShopData shop = plugin.getShopManager().getShop(shopKey);

        if (shop == null) {
            plugin.debug("Shop not found: " + shopKey);
            player.sendMessage(plugin.getMessages()
                    .getMessage("shop-not-found")
                    .replace("%shop%", shopKey));
            return;
        }

        // Fire ShopOpenEvent
        me.dralle.shop.api.events.ShopOpenEvent openEvent = new me.dralle.shop.api.events.ShopOpenEvent(player, shop);
        Bukkit.getPluginManager().callEvent(openEvent);
        if (openEvent.isCancelled()) {
            plugin.debug("Shop open cancelled for " + player.getName() + " by another plugin.");
            return;
        }

        // Permission check
        if (shop.getPermission() != null && !shop.getPermission().isEmpty()) {
            if (!player.hasPermission(shop.getPermission())) {
                plugin.debug("Player " + player.getName() + " lacks permission: " + shop.getPermission());
                player.sendMessage(
                        plugin.getMessages()
                                .getMessage("shop-no-permission")
                                .replace("%shop%", ShopItemUtil.color(shop.getGuiName()))
                );
                return;
            }
            plugin.debug("Player " + player.getName() + " has permission: " + shop.getPermission());
        }

        // Time restriction check
        if (!ShopTimeUtil.isShopAvailable(shop.getAvailableTimes())) {
            String availableTimes = ShopTimeUtil.formatAvailableTimes(shop.getAvailableTimes(), plugin);
            plugin.debug("Shop " + shopKey + " not available. Restrictions: " + shop.getAvailableTimes());
            player.sendMessage(
                    plugin.getMessages()
                            .getMessage("shop-not-available")
                            .replace("%shop%", ShopItemUtil.color(shop.getGuiName()))
                            .replace("%available-times%", availableTimes)
            );
            return;
        }
        
        if (shop.getAvailableTimes() != null && !shop.getAvailableTimes().isEmpty()) {
            plugin.debug("Shop " + shopKey + " is available (restrictions passed)");
        }

        plugin.shopsOpened++;
        plugin.incrementShopPopularity(shopKey);

        int configuredRows = shop.getRows();
        int usableRows = Math.max(configuredRows, 1);
        int totalRows = usableRows + 1;
        if (totalRows > 6) totalRows = 6;

        int totalSlots = totalRows * 9;
        int usableSlots = Math.min(usableRows * 9, 45);

        List<ShopItem> allItems = shop.getItems();
        if (allItems == null || allItems.isEmpty()) {
            player.sendMessage(ShopItemUtil.color("&cThis shop is empty."));
            return;
        }

        int maxSlot = getDisplayMaxSlot(shop);
        int totalPages = (int) Math.ceil((double) (maxSlot + 1) / (double) usableSlots);
        if (totalPages < 1) totalPages = 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        String title = me.dralle.shop.util.BedrockUtil.formatTitle(player, ShopItemUtil.color(shop.getGuiName() + " &7(" + page + "/" + totalPages + ")"));
        Inventory inv = Bukkit.createInventory(new GenericShopHolder(shopKey, page), totalSlots, title);

        String currency = plugin.getCurrencySymbol();
        String availableTimesStr = ShopTimeUtil.formatAvailableTimes(shop.getAvailableTimes(), plugin);

        // Fill items
        int start = (page - 1) * usableSlots;
        int end = start + usableSlots;
        Map<Integer, VariantGroupData> variantGroupsBySlot = buildVariantGroups(shop, player, start, end);

        for (int absoluteSlot = start; absoluteSlot < end; absoluteSlot++) {
            ShopItem si = shop.getItemBySlot(absoluteSlot);
            if (si == null) continue;

            if (si.getPermission() != null && !si.getPermission().isEmpty() && !player.hasPermission(si.getPermission())) {
                continue;
            }
            ItemConditionUtil.ConditionResult condition = ItemConditionUtil.check(plugin, player, si);
            if (!condition.allowed()) continue;

            inv.setItem(absoluteSlot - start, createGuiItem(player, si, shopKey, availableTimesStr, currency, shop));
        }

        for (VariantGroupData group : variantGroupsBySlot.values()) {
            inv.setItem(group.slot - start, createVariantGroupIcon(player, shop, shopKey, availableTimesStr, currency, group));
        }

        // Navigation slots
        int nav = totalSlots - 9;
        int prev = nav + 3;
        int back = nav + 4;
        int next = nav + 5;    

Config guiConfig = plugin.getMenuManager().getGuiSettingsConfig();

// Botón Back
String backMaterialStr = guiConfig.getString("gui.back-button.material", "ENDER_CHEST");
String backName = guiConfig.getString("gui.back-button.name", "&9Back");
List<String> backLore = guiConfig.getStringList("gui.back-button.lore");

Material backMaterial = Material.matchMaterial(backMaterialStr.toUpperCase());
if (backMaterial == null) backMaterial = Material.ENDER_CHEST;

inv.setItem(back, ShopItemUtil.create(backMaterial, 1, backName, backLore));

if (page > 1) {
    String prevMaterialStr = guiConfig.getString("gui.prev-button.material", "ARROW");
    String prevName = guiConfig.getString("gui.prev-button.name", "&e<- Previous");
    List<String> prevLore = guiConfig.getStringList("gui.prev-button.lore");

    Material prevMaterial = Material.matchMaterial(prevMaterialStr.toUpperCase());
    if (prevMaterial == null) prevMaterial = Material.ARROW;

    inv.setItem(prev, ShopItemUtil.create(prevMaterial, 1, prevName, prevLore));
}

if (page < totalPages) {
    String nextMaterialStr = guiConfig.getString("gui.next-button.material", "ARROW");
    String nextName = guiConfig.getString("gui.next-button.name", "&eNext ->");
    List<String> nextLore = guiConfig.getStringList("gui.next-button.lore");

    Material nextMaterial = Material.matchMaterial(nextMaterialStr.toUpperCase());
    if (nextMaterial == null) nextMaterial = Material.ARROW;

    inv.setItem(next, ShopItemUtil.create(nextMaterial, 1, nextName, nextLore));
}

        player.openInventory(inv);

        // Store page info
        player.setMetadata("shop.current", new FixedMetadataValue(plugin, shopKey));
        player.setMetadata("shop.page", new FixedMetadataValue(plugin, page));
    }

    /* ================================================================
     * CLICK HANDLER
     * ================================================================ */
    @EventHandler
    public void onClick(InventoryClickEvent e) {
        if (!(e.getWhoClicked() instanceof Player player)) return;
        InventoryHolder inventoryHolder = e.getInventory().getHolder();
        if (!(inventoryHolder instanceof GenericShopHolder) && !(inventoryHolder instanceof VariantHolder)) return;

        e.setCancelled(true);

        ItemStack clicked = e.getCurrentItem();
        if (clicked == null || clicked.getType() == Material.AIR) return;

        if (inventoryHolder instanceof VariantHolder variantHolder) {
            handleVariantMenuClick(player, variantHolder, e.getSlot(), e.getClick(), clicked);
            return;
        }

        GenericShopHolder holder = (GenericShopHolder) inventoryHolder;
        String shopKey = holder.getShopKey();
        int page = holder.getPage();
        ShopData shop = plugin.getShopManager().getShop(shopKey);
        if (shop == null) return;

        int configuredRows = shop.getRows();
        int usableRows = Math.max(configuredRows, 1);
        int totalRows = Math.min(usableRows + 1, 6);
        int totalSlots = totalRows * 9;
        int usableSlots = Math.min(usableRows * 9, 45);

        int nav = totalSlots - 9;
        int prev = nav + 3;
        int back = nav + 4;
        int next = nav + 5;
        int slot = e.getSlot();

        int maxSlot = getDisplayMaxSlot(shop);
        int totalPages = (int) Math.ceil((double) (maxSlot + 1) / (double) usableSlots);
        if (totalPages < 1) totalPages = 1;

        if (slot == back && clicked.getType() == Material.ENDER_CHEST) {
            Bukkit.getScheduler().runTask(plugin, () -> MainMenu.open(player));
            return;
        }
        if (slot == prev && clicked.getType() == Material.ARROW && page > 1) {
            Bukkit.getScheduler().runTask(plugin, () -> openShop(player, shopKey, page - 1));
            return;
        }
        if (slot == next && clicked.getType() == Material.ARROW && page < totalPages) {
            Bukkit.getScheduler().runTask(plugin, () -> openShop(player, shopKey, page + 1));
            return;
        }
        if (slot >= nav) return;

        int start = (page - 1) * usableSlots;
        int end = start + usableSlots;
        int absoluteSlot = start + slot;

        Map<Integer, VariantGroupData> groupsBySlot = buildVariantGroups(shop, player, start, end);
        VariantGroupData group = groupsBySlot.get(absoluteSlot);
        if (group != null && !group.options.isEmpty()) {
            Bukkit.getScheduler().runTask(plugin, () -> openVariantSelector(player, shop, shopKey, page, group));
            return;
        }

        ShopItem item = shop.getItemBySlot(absoluteSlot);
        if (item != null && item.isVariantMenuEnabled()) item = null;
        if (item == null) return;

        handleShopItemAction(player, item, shopKey, page, e.getClick());
    }

    private void handleVariantMenuClick(Player player, VariantHolder holder, int slot, ClickType clickType, ItemStack clicked) {
        String shopKey = holder.getShopKey();
        int returnPage = holder.getReturnPage();
        ShopData shop = plugin.getShopManager().getShop(shopKey);
        if (shop == null) return;

        int rows = Math.max(2, Math.min(6, ((holder.getVariants().size() + 8) / 9) + 1));
        int nav = (rows * 9) - 9;
        int backSlot = nav + 4;

        if (slot == backSlot && clicked.getType() == Material.ENDER_CHEST) {
            Bukkit.getScheduler().runTask(plugin, () -> openShop(player, shopKey, returnPage));
            return;
        }
        if (slot < 0 || slot >= nav) return;
        if (slot >= holder.getVariants().size()) return;

        ShopItem selected = holder.getVariants().get(slot);
        handleShopItemAction(player, selected, shopKey, returnPage, clickType);
    }
    private void addPriceLines(List<String> lore, ShopItem si, String currency) {
        ShopData shop = null;
        addPriceLine(lore, si, currency, true, shop);
        addPriceLine(lore, si, currency, false, shop);
    }

    private void addPriceLines(List<String> lore, ShopItem si, String currency, ShopData shop) {
        addPriceLine(lore, si, currency, true, shop);
        addPriceLine(lore, si, currency, false, shop);
    }

    private void addPriceLine(List<String> lore, ShopItem si, String currency, boolean buy, ShopData shop) {
        if (buy) {
            double displayBuy = getDisplayBuyPriceForAmount(shop, si);
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-buy-price", true) && displayBuy > 0) {
                String buyPriceLine = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.buy-price-line", "&6Buy Price: &a%price%");
                double baseBuy = getBaseBuyPriceForAmount(si);
                String displayText = formatCampaignPrice(baseBuy, displayBuy);
                String processed = buyPriceLine.replace("%price%", displayText);
                lore.addAll(ShopItemUtil.splitAndColor(processed));
            }
        } else {
            Double displaySell = getDisplaySellPriceForAmount(shop, si);
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-sell-price", true) && displaySell != null && displaySell > 0) {
                String sellPriceLine = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.sell-price-line", "&cSell Price: &a%sell-price%");
                Double baseSell = getBaseSellPriceForAmount(si);
                String displayText = formatCampaignPrice(baseSell != null ? baseSell : displaySell, displaySell);
                String processed = sellPriceLine.replace("%sell-price%", displayText);
                lore.addAll(ShopItemUtil.splitAndColor(processed));
            }
        }
    }

    private void addCustomLore(List<String> lore, Player viewer, ShopItem si, String shopAvailableTimesStr) {
        if (si.getLore() != null && !si.getLore().isEmpty()) {
            String itemAvailableTimesStr = shopAvailableTimesStr;
            if (si.getAvailableTimes() != null && !si.getAvailableTimes().isEmpty()) {
                itemAvailableTimesStr = ShopTimeUtil.formatAvailableTimes(si.getAvailableTimes(), plugin);
            }

            String globalLimitStr = si.getGlobalLimit() > 0 ? formatGlobalLimitValue(si) : "";
            String playerLimitStr = si.getLimit() > 0 ? formatPlayerLimitValue(viewer, si) : "";

            for (String loreLine : si.getLore()) {
                String processed = loreLine
                        .replace("%available-times%", itemAvailableTimesStr)
                        .replace("%global-limit%", globalLimitStr)
                        .replace("%player-limit%", playerLimitStr)
                        .replace("%limit%", si.getLimit() > 0 ? String.valueOf(si.getLimit()) : "")
                        .replace("%stock-reset-timer%", "");
                lore.addAll(ShopItemUtil.splitAndColor(processed));
            }
        }
    }

    private String getStockResetTimerText(ShopItem item, String shopKey) {
        if (!item.isShowStockResetTimer()) return "";
        StockResetRule rule = item.getStockResetRule();
        if (rule == null || !rule.isEnabled()) return "";

        String resetId = "item:" + shopKey + ":" + (item.getSlot() != null ? item.getSlot() : -1) + ":" + item.getUniqueKey();
        long lastRun = plugin.getDataManager().getLastStockReset(resetId);
        Instant now = Instant.now();
        Instant next = rule.getNextResetInstant(now, lastRun);
        if (next == null) return "";

        String countdown = formatCountdownLocalized(now, next);
        String valueTemplate = plugin.getMenuManager().getGuiSettingsConfig()
                .getString("gui.item-lore.stock-reset-timer-value-format", "Stock resets in %time%");
        return valueTemplate.replace("%time%", countdown);
    }

    private String formatCountdownLocalized(Instant now, Instant target) {
        long seconds = Math.max(0, Duration.between(now, target).getSeconds());
        long value;
        String unitKey;
        String fallbackSingular;
        String fallbackPlural;

        if (seconds < 60) {
            value = seconds;
            unitKey = "second";
            fallbackSingular = "second";
            fallbackPlural = "seconds";
        } else if (seconds < 3600) {
            value = seconds / 60;
            unitKey = "minute";
            fallbackSingular = "minute";
            fallbackPlural = "minutes";
        } else if (seconds < 86400) {
            value = seconds / 3600;
            unitKey = "hour";
            fallbackSingular = "hour";
            fallbackPlural = "hours";
        } else if (seconds < 2592000) {
            value = seconds / 86400;
            unitKey = "day";
            fallbackSingular = "day";
            fallbackPlural = "days";
        } else if (seconds < 31104000) {
            value = seconds / 2592000;
            unitKey = "month";
            fallbackSingular = "month";
            fallbackPlural = "months";
        } else {
            value = seconds / 31104000;
            unitKey = "year";
            fallbackSingular = "year";
            fallbackPlural = "years";
        }

        String basePath = "messages.stock-reset-timer.units." + unitKey + ".";
        String singular = plugin.getMessagesConfig().getString(basePath + "singular", fallbackSingular);
        String plural = plugin.getMessagesConfig().getString(basePath + "plural", fallbackPlural);
        String unit = (value == 1) ? singular : plural;
        String valueFormat = plugin.getMessagesConfig().getString("messages.stock-reset-timer.value-format", "%value% %unit%");

        return valueFormat
                .replace("%value%", String.valueOf(value))
                .replace("%unit%", unit);
    }

    private void addStockResetTimerLine(List<String> lore, ShopItem item, String shopKey) {
        if (!item.isShowStockResetTimer()) return;
        String timerText = getStockResetTimerText(item, shopKey);
        if (timerText == null || timerText.isEmpty()) return;

        String template = plugin.getMenuManager().getGuiSettingsConfig()
                .getString("gui.item-lore.stock-reset-timer-line", "&7%stock-reset-timer%");
        String processed = template.replace("%stock-reset-timer%", timerText);
        lore.addAll(ShopItemUtil.splitAndColor(processed));
    }

    private void addGlobalLimitLine(List<String> lore, ShopItem item) {
        if (!item.isShowStock()) return;
        if (item.getGlobalLimit() <= 0) return;

        String value = formatGlobalLimitValue(item);
        String template = plugin.getMenuManager().getGuiSettingsConfig()
                .getString("gui.item-lore.global-limit-line", "&7Stock: &e%global-limit%");
        lore.addAll(ShopItemUtil.splitAndColor(template.replace("%global-limit%", value)));
    }

    private void addPlayerLimitLine(List<String> lore, Player viewer, ShopItem item) {
        if (item.getLimit() <= 0) return;
        String value = formatPlayerLimitValue(viewer, item);
        String template = plugin.getMenuManager().getGuiSettingsConfig()
                .getString("gui.item-lore.player-limit-line", "&7Your limit: &e%player-limit%");
        lore.addAll(ShopItemUtil.splitAndColor(template.replace("%player-limit%", value)));
    }

    private String formatGlobalLimitValue(ShopItem item) {
        int current = plugin.getDataManager().getGlobalCount(item.getUniqueKey());
        int limit = item.getGlobalLimit();
        String valueTemplate = plugin.getMenuManager().getGuiSettingsConfig()
                .getString("gui.item-lore.global-limit-value-format", "%current%/%limit%");
        return valueTemplate
                .replace("%current%", String.valueOf(current))
                .replace("%limit%", String.valueOf(limit));
    }

    private String formatPlayerLimitValue(Player viewer, ShopItem item) {
        int current = plugin.getDataManager().getPlayerCount(viewer.getUniqueId(), item.getUniqueKey());
        int limit = item.getLimit();
        String valueTemplate = plugin.getMenuManager().getGuiSettingsConfig()
                .getString("gui.item-lore.player-limit-value-format", "%current%/%limit%");
        return valueTemplate
                .replace("%current%", String.valueOf(current))
                .replace("%limit%", String.valueOf(limit));
    }

    private void startLiveRefreshTask() {
        if (refreshTaskId != -1) {
            Bukkit.getScheduler().cancelTask(refreshTaskId);
        }
        refreshTaskId = Bukkit.getScheduler().scheduleSyncRepeatingTask(plugin, this::maybeRefreshOpenShopInventories, 20L, 20L);
    }

    public void requestRefresh() {
        refreshDirty = true;
    }

    private void maybeRefreshOpenShopInventories() {
        long now = System.currentTimeMillis();
        long fallbackMs = Math.max(1L, plugin.getConfig().getLong("gui.live-refresh-fallback-seconds", 5L)) * 1000L;
        if (!refreshDirty && (now - lastRefreshAtMillis) < fallbackMs) {
            return;
        }
        refreshOpenShopInventories();
        refreshDirty = false;
        lastRefreshAtMillis = now;
    }

    private void refreshOpenShopInventories() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            Inventory top = player.getOpenInventory().getTopInventory();
            if (!(top.getHolder() instanceof GenericShopHolder holder)) continue;

            ShopData shop = plugin.getShopManager().getShop(holder.getShopKey());
            if (shop == null) continue;

            int configuredRows = shop.getRows();
            int usableRows = Math.max(configuredRows, 1);
            int totalRows = Math.min(usableRows + 1, 6);
            int usableSlots = Math.min(usableRows * 9, 45);
            int start = (holder.getPage() - 1) * usableSlots;
            int end = start + usableSlots;
            String currency = plugin.getCurrencySymbol();
            String availableTimesStr = ShopTimeUtil.formatAvailableTimes(shop.getAvailableTimes(), plugin);
            Map<Integer, VariantGroupData> variantGroupsBySlot = buildVariantGroups(shop, player, start, end);

            for (int slot = 0; slot < usableSlots; slot++) {
                top.setItem(slot, null);
            }

            for (int absoluteSlot = start; absoluteSlot < end; absoluteSlot++) {
                ShopItem si = shop.getItemBySlot(absoluteSlot);
                if (si == null) continue;
                if (si.getPermission() != null && !si.getPermission().isEmpty() && !player.hasPermission(si.getPermission())) {
                    continue;
                }
                ItemConditionUtil.ConditionResult condition = ItemConditionUtil.check(plugin, player, si);
                if (!condition.allowed()) continue;
                top.setItem(absoluteSlot - start, createGuiItem(player, si, holder.getShopKey(), availableTimesStr, currency, shop));
            }

            for (VariantGroupData group : variantGroupsBySlot.values()) {
                top.setItem(group.slot - start, createVariantGroupIcon(player, shop, holder.getShopKey(), availableTimesStr, currency, group));
            }
        }
    }

    private int getDisplayMaxSlot(ShopData shop) {
        int maxSlot = 0;
        Map<String, Integer> variantGroupSlots = new LinkedHashMap<>();
        for (ShopItem si : shop.getItems()) {
            if (si.isVariantMenuEnabled()) {
                String groupKey = si.getVariantGroupKey();
                if (groupKey == null || groupKey.isEmpty()) continue;
                int groupSlot = si.getVariantGroupSlot() != null
                        ? si.getVariantGroupSlot()
                        : (si.getSlot() != null ? si.getSlot() : -1);
                if (groupSlot >= 0) {
                    variantGroupSlots.putIfAbsent(groupKey, groupSlot);
                }
                continue;
            }
            if (si.getSlot() != null && si.getSlot() > maxSlot) {
                maxSlot = si.getSlot();
            }
        }
        for (Integer groupSlot : variantGroupSlots.values()) {
            if (groupSlot != null && groupSlot > maxSlot) {
                maxSlot = groupSlot;
            }
        }
        return maxSlot;
    }

    private void addSpawnerTypeLine(List<String> lore, ShopItem si) {
        if (si.getSpawnerType() != null) {
            String template = plugin.getMenuManager().getGuiSettingsConfig()
                    .getString("gui.item-lore.spawner-type-line", "&7Spawner Type: &e%type%");
            String processed = template.replace("%type%", si.getSpawnerType());
            lore.addAll(ShopItemUtil.splitAndColor(processed));
        }
    }

    private void addSpawnerItemLine(List<String> lore, ShopItem si) {
        if (si.getSpawnerItem() != null) {
            String template = plugin.getMenuManager().getGuiSettingsConfig()
                    .getString("gui.item-lore.spawner-item-line", "&7Spawner Item: &e%item%");
            String processed = template.replace("%item%", si.getSpawnerItem());
            lore.addAll(ShopItemUtil.splitAndColor(processed));
        }
    }

    private void addPotionTypeLine(List<String> lore, ShopItem si) {
        if (si.getPotionType() != null) {
            String template = plugin.getMenuManager().getGuiSettingsConfig()
                    .getString("gui.item-lore.potion-type-line", "&7Potion Type: &d%type%");
            String processed = template.replace("%type%", si.getPotionType());
            lore.addAll(ShopItemUtil.splitAndColor(processed));
        }
    }

    private void addHintLines(List<String> lore, ShopItem si, String currency) {
        addHintLine(lore, si, currency, true, null);
        addHintLine(lore, si, currency, false, null);
    }

    private void addHintLines(List<String> lore, ShopItem si, String currency, ShopData shop) {
        addHintLine(lore, si, currency, true, shop);
        addHintLine(lore, si, currency, false, shop);
    }

    private void addHintLine(List<String> lore, ShopItem si, String currency, boolean buy, ShopData shop) {
        if (buy) {
            double displayBuy = getDisplayBuyPriceForAmount(shop, si);
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-buy-hint", true) && displayBuy > 0) {
                String buyHint = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.buy-hint-line", "&aLeft-click to buy");
                String processed = buyHint.replace("%price%", plugin.formatCurrency(displayBuy));
                lore.addAll(ShopItemUtil.splitAndColor(processed));
            }
        } else {
            Double displaySell = getDisplaySellPriceForAmount(shop, si);
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-sell-hint", true) && displaySell != null) {
                String sellHint = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.sell-hint-line", "&eRight-click to sell");
                String processed = sellHint.replace("%sell-price%", plugin.formatCurrency(displaySell));
                lore.addAll(ShopItemUtil.splitAndColor(processed));
            }
        }
    }

    private double getDisplayBuyPriceForAmount(ShopData shop, ShopItem si) {
        double currentBuyUnitPrice = getCurrentBuyPrice(shop, si);
        return si.calculateBuyTotal(currentBuyUnitPrice, Math.max(1, si.getAmount()));
    }

    private Double getDisplaySellPriceForAmount(ShopData shop, ShopItem si) {
        Double currentSellUnitPrice = getCurrentSellPrice(shop, si);
        if (currentSellUnitPrice == null) return null;
        return si.calculateSellTotal(currentSellUnitPrice, Math.max(1, si.getAmount()));
    }

    private double getBaseBuyPriceForAmount(ShopItem si) {
        double currentPrice = PriceFormulaUtil.resolveBuyBasePrice(plugin, si);
        return si.calculateBuyTotal(currentPrice, Math.max(1, si.getAmount()));
    }

    private Double getBaseSellPriceForAmount(ShopItem si) {
        if (si.getSellPrice() == null) return null;
        double currentPrice = PriceFormulaUtil.resolveSellBasePrice(plugin, si);
        return si.calculateSellTotal(currentPrice, Math.max(1, si.getAmount()));
    }

    private String formatCampaignPrice(double basePrice, double adjustedPrice) {
        if (Math.abs(basePrice - adjustedPrice) < 0.0000001D) {
            return plugin.formatCurrency(adjustedPrice);
        }
        return "&m" + plugin.formatCurrency(basePrice) + "&r &a" + plugin.formatCurrency(adjustedPrice);
    }

    private double getCurrentBuyPrice(ShopData shop, ShopItem si) {
        double currentPrice = PriceFormulaUtil.resolveBuyBasePrice(plugin, si);
        return CampaignUtil.applyBuyCampaign(shop, si, currentPrice);
    }

    private Double getCurrentSellPrice(ShopData shop, ShopItem si) {
        if (si.getSellPrice() == null) return null;
        double currentPrice = PriceFormulaUtil.resolveSellBasePrice(plugin, si);
        return CampaignUtil.applySellCampaign(shop, si, currentPrice);
    }
}
