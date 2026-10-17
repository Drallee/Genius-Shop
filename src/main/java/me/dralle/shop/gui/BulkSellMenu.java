package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.ShopManager;
import me.dralle.shop.economy.TransactionService;
import me.dralle.shop.commands.SaleStorage;
import me.dralle.shop.economy.TransactionSafetyGuard;
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
import org.bukkit.inventory.ItemStack;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.List;

public class BulkSellMenu implements Listener {

    public static class BulkSellHolder extends MenuInventoryHolder {
    }

    private final ShopPlugin plugin;

    public BulkSellMenu(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    public void open(Player player) {
        String title = plugin.getMessages().resolveConfigString(plugin.getMenuManager().getBulkSellMenuConfig(), "title", "&8Bulk Sell");
        int rows = plugin.getMenuManager().getBulkSellMenuConfig().getInt("rows", 6);
Inventory inv = new BulkSellHolder().createInventory(rows * 9, me.dralle.shop.util.BedrockUtil.formatTitle(player, title));

        // Add confirm button
        Material confirmMat = ShopItemUtil.getMaterial(plugin.getMenuManager().getBulkSellMenuConfig().getString("buttons.confirm.material"), Material.LIME_STAINED_GLASS);
        String confirmName = plugin.getMessages().resolveConfigString(plugin.getMenuManager().getBulkSellMenuConfig(), "buttons.confirm.name", "&aConfirm Sell");
        List<String> confirmLore = plugin.getMessages().resolveConfigStringList(plugin.getMenuManager().getBulkSellMenuConfig(), "buttons.confirm.lore");
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
        class SalePlan {
            final int slot;
            final int soldAmount;
            final double earned;
            final double unitPrice;
            final ShopManager.SellInfo sellInfo;

            SalePlan(int slot, int soldAmount, double earned, double unitPrice, ShopManager.SellInfo sellInfo) {
                this.slot = slot;
                this.soldAmount = soldAmount;
                this.earned = earned;
                this.unitPrice = unitPrice;
                this.sellInfo = sellInfo;
            }
        }

        double totalEarned = 0;
        int totalItemsSold = 0;
        boolean stockLimitSkipped = false;
        boolean safetySkipped = false;
        List<SalePlan> plans = new ArrayList<>();
        Map<String, Integer> planned = new java.util.HashMap<>();
        ItemStack[] snapshot = TransactionService.snapshot(inv.getStorageContents());

        int confirmSlot = plugin.getMenuManager().getBulkSellMenuConfig().getInt("buttons.confirm.slot", 49);
        TransactionSafetyGuard.GuardResult cooldownGuard = TransactionSafetyGuard.checkCooldown(plugin, player, TransactionSafetyGuard.ACTION_BULK_SELL);
        if (!cooldownGuard.allowed()) {
            player.sendMessage(cooldownGuard.message());
            return;
        }

        for (int i = 0; i < inv.getSize(); i++) {
            if (i == confirmSlot) continue;
            ItemStack item = inv.getItem(i);
            if (item == null || item.getType() == Material.AIR) continue;

            ShopManager.SellInfo sellInfo = plugin.getShopManager().getBestSellInfo(player, item);
            if (sellInfo != null) {
                int amountToSell = item.getAmount();

                ShopData shopData = sellInfo.shopKey == null ? null : plugin.getShopManager().getShop(sellInfo.shopKey);
                if (!TransactionService.eligibility(plugin, player, shopData, sellInfo.item, null).allowed()) continue;
                int capacity = TransactionService.sellCapacity(plugin, player, shopData, sellInfo.item,
                        amountToSell, planned.getOrDefault(sellInfo.item.getUniqueKey(), 0));
                if (capacity < amountToSell && resolveSellAddsToStock(shopData, sellInfo.item)
                        && sellInfo.item.getGlobalLimit() > 0 && !resolveAllowSellStockOverflow(shopData, sellInfo.item)) stockLimitSkipped = true;
                amountToSell = Math.min(capacity, Integer.MAX_VALUE - totalItemsSold);
                if (amountToSell <= 0) continue;


                var quote = TransactionService.price(plugin, shopData, sellInfo.item, false, true, 1D);
                double effectiveUnitPrice = quote.unit();
                double price = sellInfo.item.calculateSellTotal(effectiveUnitPrice, amountToSell);
                double effectiveMinPrice = quote.minimum();
                double effectiveMaxPrice = quote.maximum();
                boolean effectiveDynamicPricing = quote.dynamic();

                TransactionSafetyGuard.GuardResult perItemGuard = TransactionSafetyGuard.validateTransaction(
                        plugin,
                        player,
                        TransactionSafetyGuard.ACTION_SELL,
                        sellInfo.shopKey,
                        sellInfo.item.getUniqueKey(),
                        sellInfo.item.getMaterial(),
                        amountToSell,
                        effectiveUnitPrice,
                        sellInfo.item.getSellPrice(),
                        price,
                        effectiveDynamicPricing,
                        effectiveMinPrice,
                        effectiveMaxPrice
                );
                if (!perItemGuard.allowed()) {
                    safetySkipped = true;
                    continue;
                }

                totalEarned += price;
                totalItemsSold += amountToSell;
                plans.add(new SalePlan(i, amountToSell, price, effectiveUnitPrice, sellInfo));
                planned.merge(sellInfo.item.getUniqueKey(), amountToSell, Integer::sum);
            }
        }

        if (totalEarned > 0) {
            TransactionSafetyGuard.GuardResult bulkGuard = TransactionSafetyGuard.validateTransaction(
                    plugin,
                    player,
                    TransactionSafetyGuard.ACTION_BULK_SELL,
                    null,
                    null,
                    Material.AIR,
                    1,
                    totalEarned,
                    totalEarned,
                    totalEarned,
                    false,
                    0D,
                    0D
            );
            if (!bulkGuard.allowed()) {
                player.sendMessage(bulkGuard.message());
                return;
            }

            Map<Integer, Integer> quantities = new java.util.LinkedHashMap<>();
            for (SalePlan plan : plans) quantities.merge(plan.slot, plan.soldAmount, Integer::sum);
            var result = TransactionService.sale(plugin, player,
                    new TransactionService.Context("bulk-sell", null, null), totalEarned,
                    SaleStorage.inventory(inv), snapshot, quantities, () -> {
                        for (SalePlan plan : plans) {
                            ShopItem item = plan.sellInfo.item;
                            ShopData shop = plugin.getShopManager().getShop(plan.sellInfo.shopKey);
                            TransactionService.updateCounts(plugin, player, item.getUniqueKey(), plan.soldAmount, false,
                                    item.isDynamicPricing(), item.getGlobalLimit(), TransactionService.sellAddsToStock(shop, item));
                        }
                    });
            if (!result.completed()) {
                player.sendMessage(plugin.getMessages().getMessage("economy-error-bulk-sell"));
                return;
            }
            for (SalePlan plan : plans) {
                TransactionSafetyGuard.rememberSuccessfulUnitPrice(TransactionSafetyGuard.ACTION_SELL,
                        plan.sellInfo.item.getUniqueKey(), plan.unitPrice);
                Bukkit.getPluginManager().callEvent(new ShopSellEvent(player, plan.sellInfo.item,
                        plan.soldAmount, plan.earned, plan.sellInfo.shopKey));
            }
            
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
                player.sendMessage(plugin.getMessages().getMessage("bulk-sell-stock-skipped"));
            }
            if (safetySkipped) {
                player.sendMessage(plugin.getMessages().getMessage("bulk-sell-safety-skipped"));
            }
        } else {
            if (stockLimitSkipped) {
                player.sendMessage(plugin.getMessages().getMessage("bulk-sell-stock-full"));
            } else if (safetySkipped) {
                player.sendMessage(plugin.getMessages().getMessage("bulk-sell-safety-none"));
            } else {
                player.sendMessage(plugin.getMessages().getMessage("no-items-to-sell").replace("%item%", "items"));
            }
        }
    }

    private boolean resolveSellAddsToStock(ShopData shop, ShopItem item) {
        return TransactionService.sellAddsToStock(shop, item);
    }

    private boolean resolveAllowSellStockOverflow(ShopData shop, ShopItem item) {
        return TransactionService.allowSellOverflow(shop, item);
    }

}
