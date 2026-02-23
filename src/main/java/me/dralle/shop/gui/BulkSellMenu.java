package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.ShopManager;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.api.events.ShopSellEvent;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;

import java.util.HashMap;
import java.util.List;

public class BulkSellMenu implements Listener {

    public static class BulkSellHolder implements InventoryHolder {
        @Override
        public Inventory getInventory() {
            return null;
        }
    }

    private final ShopPlugin plugin;

    public BulkSellMenu(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    public void open(Player player) {
        String title = ShopItemUtil.color(plugin.getMenuManager().getBulkSellMenuConfig().getString("title", "&8Bulk Sell"));
        int rows = plugin.getMenuManager().getBulkSellMenuConfig().getInt("rows", 6);
        Inventory inv = Bukkit.createInventory(new BulkSellHolder(), rows * 9, me.dralle.shop.util.BedrockUtil.formatTitle(player, title));

        // Add confirm button
        Material confirmMat = ShopItemUtil.getMaterial(plugin.getMenuManager().getBulkSellMenuConfig().getString("buttons.confirm.material"), Material.LIME_STAINED_GLASS);
        String confirmName = plugin.getMenuManager().getBulkSellMenuConfig().getString("buttons.confirm.name", "&aConfirm Sell");
        List<String> confirmLore = plugin.getMenuManager().getBulkSellMenuConfig().getStringList("buttons.confirm.lore");
        int confirmSlot = plugin.getMenuManager().getBulkSellMenuConfig().getInt("buttons.confirm.slot", 49);
        
        if (confirmSlot >= 0 && confirmSlot < inv.getSize()) {
            inv.setItem(confirmSlot, ShopItemUtil.create(confirmMat, 1, confirmName, confirmLore));
        }

        player.openInventory(inv);
    }

    @EventHandler
    public void onClick(InventoryClickEvent e) {
        if (!(e.getWhoClicked() instanceof Player player)) return;
        if (!(e.getInventory().getHolder() instanceof BulkSellHolder)) return;
        
        int confirmSlot = plugin.getMenuManager().getBulkSellMenuConfig().getInt("buttons.confirm.slot", 49);

        // Prevent taking the confirm button or interacting with its slot
        if (e.getClickedInventory() != null && e.getClickedInventory().equals(e.getView().getTopInventory())) {
            if (e.getSlot() == confirmSlot) {
                e.setCancelled(true);
                processSell(player, e.getView().getTopInventory());
                player.closeInventory();
            }
        }
        
        // Handle other interactions like hotbar swapping into the confirm slot
        if (e.getAction().name().contains("HOTBAR") && e.getRawSlot() == confirmSlot) {
            e.setCancelled(true);
        }
    }

    @EventHandler
    public void onClose(InventoryCloseEvent e) {
        if (!(e.getPlayer() instanceof Player player)) return;
        if (!(e.getInventory().getHolder() instanceof BulkSellHolder)) return;
        
        Inventory inv = e.getInventory();
        int confirmSlot = plugin.getMenuManager().getBulkSellMenuConfig().getInt("buttons.confirm.slot", 49);

        // Return items to player
        for (int i = 0; i < inv.getSize(); i++) {
            if (i == confirmSlot) continue;
            ItemStack item = inv.getItem(i);
            if (item != null && item.getType() != Material.AIR) {
                HashMap<Integer, ItemStack> leftovers = player.getInventory().addItem(item);
                for (ItemStack leftover : leftovers.values()) {
                    player.getWorld().dropItem(player.getLocation(), leftover);
                }
            }
        }
    }

    private void processSell(Player player, Inventory inv) {
        double totalEarned = 0;
        int totalItemsSold = 0;
        boolean stockLimitSkipped = false;
        
        int confirmSlot = plugin.getMenuManager().getBulkSellMenuConfig().getInt("buttons.confirm.slot", 49);

        for (int i = 0; i < inv.getSize(); i++) {
            if (i == confirmSlot) continue;
            ItemStack item = inv.getItem(i);
            if (item == null || item.getType() == Material.AIR) continue;

            ShopManager.SellInfo sellInfo = plugin.getShopManager().getBestSellInfo(player, item);
            if (sellInfo != null) {
                int amountToSell = item.getAmount();

                // Check player limit
                if (sellInfo.item.getLimit() > 0) {
                    int current = plugin.getDataManager().getPlayerCount(player.getUniqueId(), sellInfo.item.getUniqueKey());
                    if (current >= sellInfo.item.getLimit()) {
                        continue; // Already at limit
                    }
                    if (current + amountToSell > sellInfo.item.getLimit()) {
                        amountToSell = sellInfo.item.getLimit() - current;
                    }
                }

                // Note: We don't check globalLimit here because selling generally INCREASES the available global limit (replenishes stock).
                ShopData shopData = sellInfo.shopKey != null ? plugin.getShopManager().getShop(sellInfo.shopKey) : null;
                boolean sellAddsToStock = resolveSellAddsToStock(shopData, sellInfo.item);
                boolean allowSellStockOverflow = resolveAllowSellStockOverflow(shopData, sellInfo.item);
                if (sellAddsToStock && sellInfo.item.getGlobalLimit() > 0 && !allowSellStockOverflow) {
                    int current = plugin.getDataManager().getGlobalCount(sellInfo.item.getUniqueKey());
                    int maxCanReplenish = Math.max(0, current);
                    if (maxCanReplenish <= 0) {
                        stockLimitSkipped = true;
                        continue;
                    }
                    if (amountToSell > maxCanReplenish) {
                        amountToSell = maxCanReplenish;
                        stockLimitSkipped = true;
                    }
                }
                if (amountToSell <= 0) {
                    stockLimitSkipped = true;
                    continue;
                }

                double price = sellInfo.item.getSellPrice() * amountToSell;
                totalEarned += price;
                totalItemsSold += amountToSell;
                
                // Fire ShopSellEvent
                ShopSellEvent sellEvent = new ShopSellEvent(player, sellInfo.item, amountToSell, price, sellInfo.shopKey);
                Bukkit.getPluginManager().callEvent(sellEvent);

                // Update counts
                plugin.getDataManager().incrementPlayerCount(player.getUniqueId(), sellInfo.item.getUniqueKey(), amountToSell);
                boolean adjustForStock = sellInfo.item.getGlobalLimit() > 0 && sellAddsToStock;
                boolean adjustForDynamicPricingOnly = sellInfo.item.isDynamicPricing() && sellInfo.item.getGlobalLimit() <= 0;
                if (adjustForStock || adjustForDynamicPricingOnly) {
                    plugin.getDataManager().incrementGlobalCount(sellInfo.item.getUniqueKey(), -amountToSell);
                }
                
                if (amountToSell < item.getAmount()) {
                    item.setAmount(item.getAmount() - amountToSell);
                } else {
                    inv.setItem(i, null); // Clear from GUI so it's not returned on close
                }
            }
        }

        if (totalEarned > 0) {
            plugin.getEconomy().deposit(player, totalEarned);
            
            String msg = plugin.getMessages().getMessage("sell-all-success")
                    .replace("%amount%", String.valueOf(totalItemsSold))
                    .replace("%item%", "items")
                    .replace("%price%", plugin.formatCurrency(totalEarned));
            player.sendMessage(ShopItemUtil.color(msg));
            
            // Metrics
            plugin.itemsSold += totalItemsSold;
            
            // Discord webhook
            plugin.getDiscordWebhook().sendSellNotification(player.getName(), "Bulk Sell (" + totalItemsSold + " items)", totalItemsSold, totalEarned, plugin.getCurrencySymbol());
            if (stockLimitSkipped) {
                player.sendMessage(ShopItemUtil.color("&eSome items were not sold because stock was already full."));
            }
        } else {
            if (stockLimitSkipped) {
                player.sendMessage(ShopItemUtil.color("&cCould not sell items because stock is already full."));
            } else {
                player.sendMessage(plugin.getMessages().getMessage("no-items-to-sell").replace("%item%", "items"));
            }
        }
    }

    private boolean resolveSellAddsToStock(ShopData shop, ShopItem item) {
        if (item.getSellAddsToStock() != null) {
            return item.getSellAddsToStock();
        }
        return shop != null && shop.isSellAddsToStock();
    }

    private boolean resolveAllowSellStockOverflow(ShopData shop, ShopItem item) {
        if (item.getAllowSellStockOverflow() != null) {
            return item.getAllowSellStockOverflow();
        }
        return shop != null && shop.isAllowSellStockOverflow();
    }
}
