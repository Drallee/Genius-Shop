package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.stock.StockResetRule;
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
import java.util.List;
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

    private final ShopPlugin plugin;
    private int refreshTaskId = -1;

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
            addPriceLines(lore, si, currency);

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
            addHintLines(lore, si, currency);
        } else {
            for (String line : format) {
                switch (line) {
                    case "%price-line%":
                        addPriceLines(lore, si, currency);
                        break;
                    case "%buy-price-line%":
                        addPriceLine(lore, si, currency, true);
                        break;
                    case "%sell-price-line%":
                        addPriceLine(lore, si, currency, false);
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
                        addHintLines(lore, si, currency);
                        break;
                    case "%buy-hint-line%":
                        addHintLine(lore, si, currency, true);
                        break;
                    case "%sell-hint-line%":
                        addHintLine(lore, si, currency, false);
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

        ItemStack item;
        if (si.isSpawner()) {
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

        // Calculate total pages based on both item count and explicit slots
        int maxSlot = allItems.size() - 1;
        for (ShopItem si : allItems) {
            if (si.getSlot() != null && si.getSlot() > maxSlot) {
                maxSlot = si.getSlot();
            }
        }
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

        for (ShopItem si : allItems) {
            // Item-level permission check (hide if no permission)
            if (si.getPermission() != null && !si.getPermission().isEmpty()) {
                if (!player.hasPermission(si.getPermission())) continue;
            }

            if (si.getSlot() != null && si.getSlot() >= start && si.getSlot() < end) {
                inv.setItem(si.getSlot() - start, createGuiItem(player, si, shopKey, availableTimesStr, currency, shop));
            }
        }

        // Navigation slots
        int nav = totalSlots - 9;
        int prev = nav + 3;
        int back = nav + 4;
        int next = nav + 5;

        String backName = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.back-button.name", "&9Back");
        List<String> backLore = plugin.getMenuManager().getGuiSettingsConfig().getStringList("gui.back-button.lore");

        inv.setItem(back, ShopItemUtil.create(Material.ENDER_CHEST, 1, backName, backLore));

        if (page > 1) {
            String prevName = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.prev-button.name", "&e<- Previous");
            List<String> prevLore = plugin.getMenuManager().getGuiSettingsConfig().getStringList("gui.prev-button.lore");
            inv.setItem(prev, ShopItemUtil.create(Material.ARROW, 1, prevName, prevLore));
        }

        if (page < totalPages) {
            String nextName = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.next-button.name", "&eNext ->");
            List<String> nextLore = plugin.getMenuManager().getGuiSettingsConfig().getStringList("gui.next-button.lore");
            inv.setItem(next, ShopItemUtil.create(Material.ARROW, 1, nextName, nextLore));
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
        if (!(e.getInventory().getHolder() instanceof GenericShopHolder holder)) return;

        String shopKey = holder.getShopKey();
        int page = holder.getPage();

        ShopData shop = plugin.getShopManager().getShop(shopKey);
        if (shop == null) return;

        e.setCancelled(true);

        ItemStack clicked = e.getCurrentItem();
        if (clicked == null || clicked.getType() == Material.AIR) return;

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

        // Calculate total pages consistently with openShop
        int maxSlot = 0;
        for (ShopItem si : shop.getItems()) {
            if (si.getSlot() != null && si.getSlot() > maxSlot) {
                maxSlot = si.getSlot();
            }
        }
        int totalPages = (int) Math.ceil((double) (maxSlot + 1) / (double) usableSlots);
        if (totalPages < 1) totalPages = 1;

        // BACK
        if (slot == back && clicked.getType() == Material.ENDER_CHEST) {
            Bukkit.getScheduler().runTask(plugin, () -> MainMenu.open(player));
            return;
        }

        // PREVIOUS PAGE
        if (slot == prev && clicked.getType() == Material.ARROW && page > 1) {
            Bukkit.getScheduler().runTask(plugin, () -> openShop(player, shopKey, page - 1));
            return;
        }

        // NEXT PAGE
        if (slot == next && clicked.getType() == Material.ARROW && page < totalPages) {
            Bukkit.getScheduler().runTask(plugin, () -> openShop(player, shopKey, page + 1));
            return;
        }

        // Clicked in navigation row → ignore
        if (slot >= nav) return;

        // Find the clicked shop item by its slot
        int absoluteSlot = (page - 1) * usableSlots + slot;
        ShopItem item = null;
        for (ShopItem si : shop.getItems()) {
            if (si.getSlot() != null && si.getSlot() == absoluteSlot) {
                item = si;
                break;
            }
        }

        if (item == null) return;
        final ShopItem finalItem = item;

        // Item-level permission check
        if (item.getPermission() != null && !item.getPermission().isEmpty()) {
            if (!player.hasPermission(item.getPermission())) {
                player.sendMessage(plugin.getMessages().getMessage("no-permission"));
                return;
            }
        }

        // Item-level time restriction check
        if (!ShopTimeUtil.isShopAvailable(item.getAvailableTimes())) {
            String available = ShopTimeUtil.formatAvailableTimes(item.getAvailableTimes(), plugin);
            player.sendMessage(plugin.getMessages().getMessage("shop-not-available")
                    .replace("%shop%", item.getName() != null ? ShopItemUtil.color(item.getName()) : item.getMaterial().name())
                    .replace("%available-times%", available));
            return;
        }

        // RIGHT-CLICK = SELL
        if (e.getClick() == ClickType.RIGHT && finalItem.getSellPrice() != null && finalItem.getSellPrice() > 0) {
            Bukkit.getScheduler().runTask(plugin, () -> SellMenu.open(player, finalItem, shopKey, page));
            return;
        }

        // LEFT-CLICK = BUY
        if (e.getClick() == ClickType.LEFT && finalItem.getPrice() > 0) {
            Bukkit.getScheduler().runTask(plugin, () -> PurchaseMenu.open(player, finalItem, shopKey, page));
        }
    }

    private void addPriceLines(List<String> lore, ShopItem si, String currency) {
        addPriceLine(lore, si, currency, true);
        addPriceLine(lore, si, currency, false);
    }

    private void addPriceLine(List<String> lore, ShopItem si, String currency, boolean buy) {
        if (buy) {
            double currentBuy = getCurrentBuyPrice(si);
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-buy-price", true) && currentBuy > 0) {
                String buyPriceLine = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.buy-price-line", "&6Buy Price: &a%price%");
                String processed = buyPriceLine.replace("%price%", plugin.formatCurrency(currentBuy));
                lore.addAll(ShopItemUtil.splitAndColor(processed));
            }
        } else {
            Double currentSell = getCurrentSellPrice(si);
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-sell-price", true) && currentSell != null && currentSell > 0) {
                String sellPriceLine = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.sell-price-line", "&cSell Price: &a%sell-price%");
                String processed = sellPriceLine.replace("%sell-price%", plugin.formatCurrency(currentSell));
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
        refreshTaskId = Bukkit.getScheduler().scheduleSyncRepeatingTask(plugin, this::refreshOpenShopInventories, 20L, 20L);
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

            for (int slot = 0; slot < usableSlots; slot++) {
                top.setItem(slot, null);
            }

            for (ShopItem si : shop.getItems()) {
                if (si.getPermission() != null && !si.getPermission().isEmpty() && !player.hasPermission(si.getPermission())) {
                    continue;
                }
                if (si.getSlot() != null && si.getSlot() >= start && si.getSlot() < end) {
                    top.setItem(si.getSlot() - start, createGuiItem(player, si, holder.getShopKey(), availableTimesStr, currency, shop));
                }
            }
        }
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
        addHintLine(lore, si, currency, true);
        addHintLine(lore, si, currency, false);
    }

    private void addHintLine(List<String> lore, ShopItem si, String currency, boolean buy) {
        if (buy) {
            double currentBuy = getCurrentBuyPrice(si);
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-buy-hint", true) && currentBuy > 0) {
                String buyHint = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.buy-hint-line", "&aLeft-click to buy");
                String processed = buyHint.replace("%price%", plugin.formatCurrency(currentBuy));
                lore.addAll(ShopItemUtil.splitAndColor(processed));
            }
        } else {
            Double currentSell = getCurrentSellPrice(si);
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-sell-hint", true) && currentSell != null) {
                String sellHint = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.sell-hint-line", "&eRight-click to sell");
                String processed = sellHint.replace("%sell-price%", plugin.formatCurrency(currentSell));
                lore.addAll(ShopItemUtil.splitAndColor(processed));
            }
        }
    }

    private double getCurrentBuyPrice(ShopItem si) {
        if (!si.isDynamicPricing()) return si.getPrice();
        int globalCount = plugin.getDataManager().getGlobalCount(si.getUniqueKey());
        double currentPrice = si.getPrice() + (globalCount * si.getPriceChange());
        if (si.getMinPrice() > 0 && currentPrice < si.getMinPrice()) currentPrice = si.getMinPrice();
        if (si.getMaxPrice() > 0 && currentPrice > si.getMaxPrice()) currentPrice = si.getMaxPrice();
        return currentPrice;
    }

    private Double getCurrentSellPrice(ShopItem si) {
        if (si.getSellPrice() == null) return null;
        if (!si.isDynamicPricing()) return si.getSellPrice();
        int globalCount = plugin.getDataManager().getGlobalCount(si.getUniqueKey());
        double currentPrice = si.getSellPrice() + (globalCount * si.getPriceChange());
        if (si.getMinPrice() > 0 && currentPrice < si.getMinPrice()) currentPrice = si.getMinPrice();
        if (si.getMaxPrice() > 0 && currentPrice > si.getMaxPrice()) currentPrice = si.getMaxPrice();
        if (currentPrice < 0.01) currentPrice = 0.01;
        return currentPrice;
    }
}
