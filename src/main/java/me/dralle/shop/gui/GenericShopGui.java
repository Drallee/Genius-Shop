package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ItemUtil;
import me.dralle.shop.util.TimeRestrictionUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.metadata.FixedMetadataValue;

import java.util.Map;

import java.util.ArrayList;
import java.util.List;

public class GenericShopGui implements Listener {

    private final ShopPlugin plugin;

    public GenericShopGui(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Open a shop page for a player.
     */
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

        // Permission check
        if (shop.getPermission() != null && !shop.getPermission().isEmpty()) {
            if (!player.hasPermission(shop.getPermission())) {
                plugin.debug("Player " + player.getName() + " lacks permission: " + shop.getPermission());
                player.sendMessage(
                        plugin.getMessages()
                                .getMessage("shop-no-permission")
                                .replace("%shop%", ItemUtil.color(shop.getGuiName()))
                );
                return;
            }
            plugin.debug("Player " + player.getName() + " has permission: " + shop.getPermission());
        }

        // Time restriction check
        if (!TimeRestrictionUtil.isShopAvailable(shop.getAvailableTimes())) {
            String availableTimes = TimeRestrictionUtil.formatAvailableTimes(shop.getAvailableTimes(), plugin);
            plugin.debug("Shop " + shopKey + " not available. Restrictions: " + shop.getAvailableTimes());
            player.sendMessage(
                    plugin.getMessages()
                            .getMessage("shop-not-available")
                            .replace("%shop%", ItemUtil.color(shop.getGuiName()))
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
            player.sendMessage("§cThis shop is empty.");
            return;
        }

        int totalPages = (int) Math.ceil((double) allItems.size() / (double) usableSlots);
        if (totalPages < 1) totalPages = 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        String title = ItemUtil.color(shop.getGuiName() + " &7(" + page + "/" + totalPages + ")");
        Inventory inv = Bukkit.createInventory(player, totalSlots, title);

        String currency = plugin.getCurrencySymbol();

        // Fill items
        int start = (page - 1) * usableSlots;
        int end = Math.min(start + usableSlots, allItems.size());
        int slot = 0;

        String availableTimesStr = TimeRestrictionUtil.formatAvailableTimes(shop.getAvailableTimes(), plugin);

        for (int i = start; i < end; i++) {
            ShopItem si = allItems.get(i);

            List<String> lore = new ArrayList<>();

            // Configurable price display lines
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-buy-price", true) && si.getPrice() > 0) {
                String buyPriceLine = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.buy-price-line", "&6Buy Price: &a%price%");
                String processed = buyPriceLine.replace("%price%", currency + si.getPrice());
                lore.addAll(ItemUtil.splitAndColor(processed));
            }

            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-sell-price", true) && si.getSellPrice() != null && si.getSellPrice() > 0) {
                String sellPriceLine = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.sell-price-line", "&cSell Price: &a%sell-price%");
                String processed = sellPriceLine.replace("%sell-price%", currency + si.getSellPrice());
                lore.addAll(ItemUtil.splitAndColor(processed));
            }

            // Check if item has special properties (spawner, potion, enchantments, or custom lore)
            boolean hasSpecialProperties = si.getSpawnerType() != null ||
                                          si.getPotionType() != null ||
                                          (si.getEnchantments() != null && !si.getEnchantments().isEmpty()) ||
                                          (si.getLore() != null && !si.getLore().isEmpty());

            // Add empty line before special properties if they exist
            if (hasSpecialProperties) {
                lore.add("");
            }

            // Add custom item lore from shop config
            if (si.getLore() != null && !si.getLore().isEmpty()) {
                for (String loreLine : si.getLore()) {
                    String processed = loreLine.replace("%available-times%", availableTimesStr);
                    lore.addAll(ItemUtil.splitAndColor(processed));
                }
            }

            if (si.getSpawnerType() != null)
                lore.add(ItemUtil.color("&7Spawner Type: &e" + si.getSpawnerType()));

            if (si.getPotionType() != null)
                lore.add(ItemUtil.color("&7Potion Type: &d" + si.getPotionType()));

            // Add empty line after special properties if they exist
            if (hasSpecialProperties) {
                lore.add("");
            }

            // Configurable hint lines
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-buy-hint", true) && si.getPrice() > 0) {
                String buyHint = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.buy-hint-line", "&aLeft-click to buy");
                String processed = buyHint.replace("%price%", currency + si.getPrice());
                lore.addAll(ItemUtil.splitAndColor(processed));
            }
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.show-sell-hint", true) && si.getSellPrice() != null) {
                String sellHint = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.sell-hint-line", "&eRight-click to sell");
                String processed = sellHint.replace("%sell-price%", currency + si.getSellPrice());
                lore.addAll(ItemUtil.splitAndColor(processed));
            }

            // Time restriction display
            if (plugin.getMenuManager().getGuiSettingsConfig().getBoolean("gui.item-lore.time-restriction.show-on-items", false)) {
                if (shop.getAvailableTimes() != null && !shop.getAvailableTimes().isEmpty()) {
                    String format = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.time-restriction.format", "&7Available: &e%available-times%");
                    String processed = format.replace("%available-times%", availableTimesStr);
                    lore.add("");
                    lore.addAll(ItemUtil.splitAndColor(processed));
                }
            }

            ItemStack item = ItemUtil.create(si.getMaterial(), si.getAmount(), si.getName(), lore);

            // Apply potion type if this is a potion or tipped arrow
            if (si.isPotion()) {
                ItemUtil.applyPotionType(item, si.getPotionType(), si.getPotionLevel());
            }

            // Apply enchantments
            if (si.getEnchantments() != null && !si.getEnchantments().isEmpty()) {
                ItemUtil.applyEnchantments(item, si.getEnchantments());
            }

            ItemMeta meta = item.getItemMeta();
            if (si.shouldHideAttributes()) meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
            if (si.shouldHideAdditional()) meta.addItemFlags(ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
            item.setItemMeta(meta);

            inv.setItem(slot, item);
            slot++;
        }

        // Navigation slots
        int nav = totalSlots - 9;
        int prev = nav + 3;
        int back = nav + 4;
        int next = nav + 5;

        String backName = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.back-button.name", "&9Back");
        List<String> backLore = plugin.getMenuManager().getGuiSettingsConfig().getStringList("gui.back-button.lore");

        inv.setItem(back, ItemUtil.create(Material.ENDER_CHEST, 1, backName, backLore));

        if (page > 1) {
            String prevName = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.prev-button.name", "&e<- Previous");
            List<String> prevLore = plugin.getMenuManager().getGuiSettingsConfig().getStringList("gui.prev-button.lore");
            inv.setItem(prev, ItemUtil.create(Material.ARROW, 1, prevName, prevLore));
        }

        if (page < totalPages) {
            String nextName = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.next-button.name", "&eNext ->");
            List<String> nextLore = plugin.getMenuManager().getGuiSettingsConfig().getStringList("gui.next-button.lore");
            inv.setItem(next, ItemUtil.create(Material.ARROW, 1, nextName, nextLore));
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
        if (!player.hasMetadata("shop.current")) return;
        if (!player.hasMetadata("shop.page")) return;

        String shopKey = player.getMetadata("shop.current").getFirst().asString();
        ShopData shop = plugin.getShopManager().getShop(shopKey);
        if (shop == null) return;

        // Make sure the click occurs in a matching shop GUI
        String expected = ItemUtil.color(shop.getGuiName());
        if (!ItemUtil.color(e.getView().getTitle()).contains(expected)) return;

        e.setCancelled(true);

        ItemStack clicked = e.getCurrentItem();
        if (clicked == null || clicked.getType() == Material.AIR) return;

        int page = player.getMetadata("shop.page").getFirst().asInt();

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

        // BACK
        if (slot == back && clicked.getType() == Material.ENDER_CHEST) {
            MainMenu.open(player);
            return;
        }

        // PREVIOUS PAGE
        int totalPages = (int) Math.ceil(shop.getItems().size() / (double) usableSlots);
        if (slot == prev && clicked.getType() == Material.ARROW && page > 1) {
            openShop(player, shopKey, page - 1);
            return;
        }

        // NEXT PAGE
        if (slot == next && clicked.getType() == Material.ARROW && page < totalPages) {
            openShop(player, shopKey, page + 1);
            return;
        }

        // Clicked in navigation row → ignore
        if (slot >= nav) return;

        // Find the clicked shop item
        int index = (page - 1) * usableSlots + slot;
        if (index >= shop.getItems().size()) return;

        ShopItem item = shop.getItems().get(index);

        // RIGHT-CLICK = SELL
        if (e.getClick() == ClickType.RIGHT && item.getSellPrice() != null && item.getSellPrice() > 0) {
            SellMenu.open(player, item, shopKey, page);
            return;
        }

        // LEFT-CLICK = BUY
        if (e.getClick() == ClickType.LEFT && item.getPrice() > 0) {
            PurchaseMenu.open(player, item, shopKey, page);
        }
    }
}
