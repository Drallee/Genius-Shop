package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.ShopManager;
import me.dralle.shop.economy.EconomyHook;
import me.dralle.shop.economy.TransactionSafetyGuard;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.CampaignUtil;
import me.dralle.shop.util.ConsoleLog;
import me.dralle.shop.util.PriceFormulaUtil;
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

import java.util.ArrayList;
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
        class SalePlan {
            final int slot;
            final int soldAmount;
            final double earned;
            final ShopManager.SellInfo sellInfo;

            SalePlan(int slot, int soldAmount, double earned, ShopManager.SellInfo sellInfo) {
                this.slot = slot;
                this.soldAmount = soldAmount;
                this.earned = earned;
                this.sellInfo = sellInfo;
            }
        }

        double totalEarned = 0;
        int totalItemsSold = 0;
        boolean stockLimitSkipped = false;
        boolean safetySkipped = false;
        List<SalePlan> plans = new ArrayList<>();

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

                int sellUnitAmount = Math.max(1, sellInfo.item.getAmount());
                ShopData priceShop = sellInfo.shopKey != null ? plugin.getShopManager().getShop(sellInfo.shopKey) : null;
                double effectiveUnitPrice = calculateCurrentSellPrice(priceShop, sellInfo.item);
                double price = sellInfo.item.isSellPricePerItem()
                        ? effectiveUnitPrice * amountToSell
                        : effectiveUnitPrice * (amountToSell / (double) sellUnitAmount);
                double effectiveMinPrice = sellInfo.item.getMinPrice();
                double effectiveMaxPrice = sellInfo.item.getMaxPrice();
                double campaignMultiplier = CampaignUtil.getActiveSellMultiplier(priceShop, sellInfo.item);
                if (effectiveMinPrice > 0D) effectiveMinPrice *= campaignMultiplier;
                if (effectiveMaxPrice > 0D) effectiveMaxPrice *= campaignMultiplier;

                boolean effectiveDynamicPricing = sellInfo.item.isDynamicPricing()
                        || (sellInfo.item.getSellPriceFormula() != null && !sellInfo.item.getSellPriceFormula().trim().isEmpty());
                TransactionSafetyGuard.GuardResult perItemGuard = TransactionSafetyGuard.validateTransaction(
                        plugin,
                        player,
                        TransactionSafetyGuard.ACTION_SELL,
                        sellInfo.shopKey,
                        sellInfo.item.getUniqueKey(),
                        sellInfo.item.getMaterial(),
                        amountToSell,
                        effectiveUnitPrice,
                        PriceFormulaUtil.resolveSellBasePrice(plugin, sellInfo.item),
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
                plans.add(new SalePlan(i, amountToSell, price, sellInfo));
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

            EconomyHook.EconomyOperationResult depositResult = plugin.getEconomy().tryDeposit(player, totalEarned);
            if (!depositResult.success()) {
                TransactionSafetyGuard.auditEconomyFailure(
                        plugin,
                        player,
                        "bulk-deposit",
                        null,
                        null,
                        Material.AIR,
                        totalEarned,
                        depositResult.errorMessage()
                );
                player.sendMessage(plugin.getMessages().getMessage("economy-error-bulk-sell"));
                return;
            }

            for (SalePlan plan : plans) {
                // Fire ShopSellEvent
                ShopSellEvent sellEvent = new ShopSellEvent(player, plan.sellInfo.item, plan.soldAmount, plan.earned, plan.sellInfo.shopKey);
                Bukkit.getPluginManager().callEvent(sellEvent);

                // Update counts
                plugin.getDataManager().incrementPlayerCount(player.getUniqueId(), plan.sellInfo.item.getUniqueKey(), plan.soldAmount);
                ShopData shopData = plan.sellInfo.shopKey != null ? plugin.getShopManager().getShop(plan.sellInfo.shopKey) : null;
                boolean sellAddsToStock = resolveSellAddsToStock(shopData, plan.sellInfo.item);
                boolean adjustForStock = plan.sellInfo.item.getGlobalLimit() > 0 && sellAddsToStock;
                boolean adjustForDynamicPricingOnly = plan.sellInfo.item.isDynamicPricing() && plan.sellInfo.item.getGlobalLimit() <= 0;
                if (adjustForStock || adjustForDynamicPricingOnly) {
                    plugin.getDataManager().incrementGlobalCount(plan.sellInfo.item.getUniqueKey(), -plan.soldAmount);
                }
                TransactionSafetyGuard.rememberSuccessfulUnitPrice(
                        TransactionSafetyGuard.ACTION_SELL,
                        plan.sellInfo.item.getUniqueKey(),
                        plan.sellInfo.item.isDynamicPricing()
                                ? calculateCurrentSellPrice(
                                        plan.sellInfo.shopKey != null ? plugin.getShopManager().getShop(plan.sellInfo.shopKey) : null,
                                        plan.sellInfo.item
                                )
                                : CampaignUtil.applySellCampaign(
                                        plan.sellInfo.shopKey != null ? plugin.getShopManager().getShop(plan.sellInfo.shopKey) : null,
                                        plan.sellInfo.item,
                                        plan.sellInfo.item.getSellPrice()
                                )
                );

                ItemStack original = inv.getItem(plan.slot);
                if (original == null || original.getType() == Material.AIR) continue;
                if (plan.soldAmount < original.getAmount()) {
                    original.setAmount(original.getAmount() - plan.soldAmount);
                } else {
                    inv.setItem(plan.slot, null); // Clear from GUI so it's not returned on close
                }
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

    private double calculateCurrentSellPrice(ShopData shop, ShopItem item) {
        if (item.getSellPrice() == null) {
            return item.getSellPrice() != null ? item.getSellPrice() : 0D;
        }
        double currentPrice = PriceFormulaUtil.resolveSellBasePrice(plugin, item);
        return CampaignUtil.applySellCampaign(shop, item, currentPrice);
    }
}
