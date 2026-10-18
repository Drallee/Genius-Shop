package me.dralle.shop.commands;

import me.dralle.shop.ShopManager;
import me.dralle.shop.ShopPlugin;
import me.dralle.shop.api.events.ShopSellEvent;
import me.dralle.shop.economy.TransactionService;
import me.dralle.shop.economy.TransactionSafetyGuard;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;

import java.util.*;

public class CustomSellAllService {
    private final ShopPlugin plugin;
    private final Set<UUID> running = new HashSet<>();

    public CustomSellAllService(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    public void sellAll(Player player, String shopKey) {
        if (player == null) return;
        if (!Bukkit.isPrimaryThread()) {
            Bukkit.getScheduler().runTask(plugin, () -> sellAll(player, shopKey));
            return;
        }
        if (!running.add(player.getUniqueId())) {
            return;
        }
        try {
            SellAllResult result = planAndExecute(player, SaleStorage.inventory(player.getInventory()),
                    shopKey == null || shopKey.isBlank() ? null : shopKey, 1D, true, null);
            sendSummary(player, result);
        } finally {
            running.remove(player.getUniqueId());
        }
    }

    public boolean sellContainer(Player player, Inventory inventory, String shopKey,
                                 double multiplier, boolean useCampaigns, String itemId) {
        return sellStorage(player, SaleStorage.inventory(inventory), shopKey, multiplier, useCampaigns, itemId);
    }

    public boolean sellStorage(Player player, SaleStorage inventory, String shopKey,
                               double multiplier, boolean useCampaigns, String itemId) {
        if (!Bukkit.isPrimaryThread() || !Double.isFinite(multiplier) || multiplier <= 0D
                || !running.add(player.getUniqueId())) return false;
        try {
            SellAllResult result = planAndExecute(player, inventory,
                    shopKey == null || shopKey.isBlank() ? null : shopKey, multiplier, useCampaigns, itemId);
            sendSummary(player, result);
            return result.itemsSold > 0;
        } finally {
            running.remove(player.getUniqueId());
        }
    }

    private SellAllResult planAndExecute(Player player, SaleStorage inventory, String shopKey,
                                        double multiplier, boolean useCampaigns, String itemId) {
        if (shopKey != null && plugin.getShopManager().getShop(shopKey) == null) {
            player.sendMessage(plugin.getMessages().getMessage("custom-command-shop-not-found").replace("%shop%", shopKey));
            return SellAllResult.empty();
        }

        TransactionSafetyGuard.GuardResult cooldownGuard = TransactionSafetyGuard.checkCooldown(plugin, player, TransactionSafetyGuard.ACTION_BULK_SELL);
        if (!cooldownGuard.allowed()) {
            player.sendMessage(cooldownGuard.message());
            return SellAllResult.empty();
        }

        List<SalePlan> plans = new ArrayList<>();
        Map<String, Integer> plannedByItem = new HashMap<>();
        boolean partial = false;
        double totalEarned = 0D;
        int totalItems = 0;

        ItemStack[] contents = inventory.getStorageContents();
        ItemStack[] snapshot = java.util.Arrays.stream(contents)
                .map(stack -> stack == null ? null : stack.clone()).toArray(ItemStack[]::new);
        for (int slot = 0; slot < contents.length; slot++) {
            ItemStack stack = contents[slot];
            if (stack == null || stack.getType() == Material.AIR || stack.getAmount() <= 0) continue;
            if (itemId != null && plugin.getCustomItemManager().isCustomItem(stack)) continue;

            List<ShopManager.SellInfo> candidates = new ArrayList<>(plugin.getShopManager().getSellInfos(player, stack, shopKey));
            if (itemId != null) {
                candidates.sort(java.util.Comparator.comparingDouble((ShopManager.SellInfo info) ->
                        info.item.calculateSellTotal(calculateCurrentSellPrice(
                                plugin.getShopManager().getShop(info.shopKey), info.item, useCampaigns), 1)).reversed());
            }
            if (candidates.isEmpty()) continue;

            int remainingStackAmount = stack.getAmount();
            for (ShopManager.SellInfo sellInfo : candidates) {
                if (sellInfo == null || sellInfo.item == null || remainingStackAmount <= 0) continue;
                int available = Math.min(remainingStackAmount, Integer.MAX_VALUE - totalItems);
                if (available <= 0) { partial = true; break; }

                SalePlan plan = createPlan(player, slot, available, sellInfo, plannedByItem,
                        multiplier, useCampaigns, itemId);
                if (plan == null) {
                    partial = true;
                    continue;
                }

                plans.add(plan);
                String itemKey = sellInfo.item.getUniqueKey();
                plannedByItem.put(itemKey, plannedByItem.getOrDefault(itemKey, 0) + plan.amount);
                totalEarned += plan.earned;
                totalItems += plan.amount;
                remainingStackAmount -= plan.amount;
            }

            if (remainingStackAmount > 0 && remainingStackAmount < stack.getAmount()) {
                partial = true;
            }
        }

        if (plans.isEmpty() || totalEarned <= 0D) {
            return SellAllResult.empty();
        }

        TransactionSafetyGuard.GuardResult bulkGuard = TransactionSafetyGuard.validateTransaction(
                plugin,
                player,
                TransactionSafetyGuard.ACTION_BULK_SELL,
                shopKey,
                null,
                Material.AIR,
                totalItems,
                totalEarned,
                totalEarned,
                totalEarned,
                false,
                0D,
                0D
        );
        if (!bulkGuard.allowed()) {
            player.sendMessage(bulkGuard.message());
            return SellAllResult.empty();
        }

        Map<Integer, Integer> quantities = new HashMap<>();
        for (SalePlan plan : plans) quantities.merge(plan.slot, plan.amount, Integer::sum);
        var result = TransactionService.sale(plugin, player, new TransactionService.Context(saleAction(itemId), shopKey, itemId,
                        itemId == null ? me.dralle.shop.data.TransactionEntry.Type.SALE : me.dralle.shop.data.TransactionEntry.Type.WAND_SALE,
                        plans.stream().map(plan -> new me.dralle.shop.data.TransactionEntry.Line(
                                plan.sellInfo.shopKey, plan.sellInfo.item.getUniqueKey(), plan.amount, plan.earned)).toList()),
                totalEarned, inventory, snapshot, quantities, () -> {
                    for (SalePlan plan : plans) {
                        ShopItem item = plan.sellInfo.item;
                        ShopData shop = plugin.getShopManager().getShop(plan.sellInfo.shopKey);
                        TransactionService.updateCounts(plugin, player, item.getUniqueKey(), plan.amount, false,
                                item.isDynamicPricing(), item.getGlobalLimit(), TransactionService.sellAddsToStock(shop, item));
                        TransactionSafetyGuard.rememberSuccessfulUnitPrice(saleAction(itemId), saleKey(itemId, item.getUniqueKey()), plan.unitPrice);
                    }
                });
        if (!result.completed()) {
            player.sendMessage(plugin.getMessages().getMessage("custom-command-economy-failure"));
            return SellAllResult.empty();
        }

        for (SalePlan plan : plans) {
            ShopItem item = plan.sellInfo.item;
            Bukkit.getPluginManager().callEvent(new ShopSellEvent(player, item, plan.amount, plan.earned, plan.sellInfo.shopKey));
        }

        plugin.itemsSold += totalItems;
        plugin.getGenericShopGui().requestRefresh();
        plugin.getDiscordWebhook().sendSellNotification(player.getName(),
                (itemId == null ? "Command Sell All" : "Sell Wand " + itemId) + " (" + totalItems + " items)",
                totalItems, totalEarned, plugin.getCurrencySymbol());
        return new SellAllResult(totalItems, totalEarned, partial);
    }

    private SalePlan createPlan(
            Player player,
            int slot,
            int maxAmount,
            ShopManager.SellInfo sellInfo,
            Map<String, Integer> plannedByItem,
            double multiplier, boolean useCampaigns, String itemId
    ) {
        String itemKey = sellInfo.item.getUniqueKey();
        ShopData shopData = plugin.getShopManager().getShop(sellInfo.shopKey);
        if (!TransactionService.eligibility(plugin, player, shopData, sellInfo.item, null).allowed()) return null;
        int amountToSell = TransactionService.sellCapacity(plugin, player, shopData, sellInfo.item,
                maxAmount, plannedByItem.getOrDefault(itemKey, 0));


        if (amountToSell <= 0) return null;
        var quote = TransactionService.price(plugin, shopData, sellInfo.item, false, useCampaigns, multiplier);
        double unitPrice = quote.unit();
        double earned = sellInfo.item.calculateSellTotal(unitPrice, amountToSell);
        if (!Double.isFinite(earned) || earned <= 0D) return null;
        boolean dynamic = quote.dynamic();
        double min = quote.minimum();
        double max = quote.maximum();

        TransactionSafetyGuard.GuardResult guard = TransactionSafetyGuard.validateTransaction(
                plugin,
                player,
                saleAction(itemId),
                sellInfo.shopKey,
                saleKey(itemId, itemKey),
                sellInfo.item.getMaterial(),
                amountToSell,
                unitPrice,
                sellInfo.item.getSellPrice() * multiplier,
                earned,
                dynamic,
                min,
                max
        );
        if (!guard.allowed()) return null;

        return new SalePlan(slot, amountToSell, earned, unitPrice, sellInfo);
    }

    private void sendSummary(Player player, SellAllResult result) {
        if (result.itemsSold <= 0) {
            player.sendMessage(plugin.getMessages().getMessage("custom-command-nothing-to-sell"));
            return;
        }
        String key = result.partial ? "custom-command-sellall-partial-success" : "custom-command-sellall-success";
        player.sendMessage(plugin.getMessages().getMessage(key)
                .replace("%amount%", String.valueOf(result.itemsSold))
                .replace("%items%", String.valueOf(result.itemsSold))
                .replace("%price%", plugin.formatCurrency(result.earned)));
    }

    private double calculateCurrentSellPrice(ShopData shop, ShopItem item, boolean useCampaigns) {
        return TransactionService.price(plugin, shop, item, false, useCampaigns, 1D).unit();
    }

    private String saleAction(String itemId) {
        return itemId == null ? TransactionSafetyGuard.ACTION_SELL : "custom-item-sell";
    }

    private String saleKey(String itemId, String itemKey) {
        return itemId == null ? itemKey : itemId + ":" + itemKey;
    }

    private record SalePlan(int slot, int amount, double earned, double unitPrice, ShopManager.SellInfo sellInfo) {}

    private record SellAllResult(int itemsSold, double earned, boolean partial) {
        static SellAllResult empty() {
            return new SellAllResult(0, 0D, false);
        }
    }
}
