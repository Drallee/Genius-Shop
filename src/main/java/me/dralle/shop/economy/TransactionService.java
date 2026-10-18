package me.dralle.shop.economy;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.commands.SaleStorage;
import me.dralle.shop.data.TransactionEntry;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.CampaignUtil;
import me.dralle.shop.util.ItemConditionUtil;
import me.dralle.shop.util.PriceFormulaUtil;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.ShopTimeUtil;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

import static me.dralle.shop.economy.TransactionResult.FailureReason.*;
import static me.dralle.shop.economy.TransactionResult.Status.*;

/** Shared synchronous settlement. UI, notifications and events run after financial completion. */
public final class TransactionService {
    private static final Set<UUID> RUNNING = ConcurrentHashMap.newKeySet();
    private TransactionService() {}

    public record Context(String action, String shop, String item,
                          TransactionEntry.Type type, List<TransactionEntry.Line> lines) {
        public Context(String action, String shop, String item) {
            this(action, shop, item, null, List.of());
        }

        public Context {
            lines = List.copyOf(lines);
        }
    }
    private record Audit(Context context, UUID player, double money) {}
    public record Price(double unit, double base, double minimum, double maximum, boolean dynamic) {}

    public static Price price(ShopPlugin plugin, ShopData shop, ShopItem item, boolean buy,
                              boolean campaigns, double multiplier) {
        double base = buy ? item.getPrice() : item.getSellPrice() == null ? 0D : item.getSellPrice();
        double unit = buy ? PriceFormulaUtil.resolveBuyBasePrice(plugin, item)
                : item.getSellPrice() == null ? 0D : PriceFormulaUtil.resolveSellBasePrice(plugin, item);
        double campaign = 1D;
        if (campaigns) {
            campaign = buy ? CampaignUtil.getActiveBuyMultiplier(shop, item) : CampaignUtil.getActiveSellMultiplier(shop, item);
            unit = buy ? CampaignUtil.applyBuyCampaign(shop, item, unit) : CampaignUtil.applySellCampaign(shop, item, unit);
        }
        String formula = buy ? item.getBuyPriceFormula() : item.getSellPriceFormula();
        return new Price(unit * multiplier, base * multiplier,
                item.getMinPrice() > 0D ? item.getMinPrice() * campaign * multiplier : 0D,
                item.getMaxPrice() > 0D ? item.getMaxPrice() * campaign * multiplier : 0D,
                item.isDynamicPricing() || (formula != null && !formula.isBlank()));
    }

    public static double total(double unit, int quantity, boolean perItem, int bundle) {
        return perItem ? unit * quantity : unit * (quantity / (double) Math.max(1, bundle));
    }

    public static TransactionSafetyGuard.GuardResult eligibility(ShopPlugin plugin, Player player,
            ShopData shop, ShopItem item, String permission) {
        for (String required : Arrays.asList(permission, shop == null ? null : shop.getPermission(), item == null ? null : item.getPermission())) {
            if (player != null && required != null && !required.isEmpty() && !player.hasPermission(required)) {
                return TransactionSafetyGuard.GuardResult.fail(plugin.getMessages().getMessage("no-permission"));
            }
        }
        if (shop != null && !ShopTimeUtil.isShopAvailable(shop.getAvailableTimes())) {
            return unavailable(plugin, shop.getGuiName(), shop.getAvailableTimes());
        }
        if (item != null && !ShopTimeUtil.isShopAvailable(item.getAvailableTimes())) {
            return unavailable(plugin, item.getName() == null ? item.getMaterial().name() : item.getName(), item.getAvailableTimes());
        }
        if (player != null && item != null) {
            var condition = ItemConditionUtil.check(plugin, player, item);
            if (!condition.allowed()) return TransactionSafetyGuard.GuardResult.fail(condition.message());
        }
        return TransactionSafetyGuard.GuardResult.ok();
    }

    private static TransactionSafetyGuard.GuardResult unavailable(ShopPlugin plugin, String name, List<String> times) {
        return TransactionSafetyGuard.GuardResult.fail(plugin.getMessages().getMessage("shop-not-available")
                .replace("%shop%", ShopItemUtil.color(name))
                .replace("%available-times%", ShopTimeUtil.formatAvailableTimes(times, plugin)));
    }

    public static boolean sellAddsToStock(ShopData shop, ShopItem item) {
        return item != null && item.getSellAddsToStock() != null ? item.getSellAddsToStock() : shop != null && shop.isSellAddsToStock();
    }

    public static boolean allowSellOverflow(ShopData shop, ShopItem item) {
        return item != null && item.getAllowSellStockOverflow() != null ? item.getAllowSellStockOverflow() : shop != null && shop.isAllowSellStockOverflow();
    }

    public static int sellCapacity(ShopPlugin plugin, Player player, ShopData shop, ShopItem item, int requested, int planned) {
        long available = Math.max(0, requested);
        if (item.getLimit() > 0) available = Math.min(available,
                Math.max(0L, (long) item.getLimit() - plugin.getDataManager().getPlayerCount(player.getUniqueId(), item.getUniqueKey()) - planned));
        if (item.getGlobalLimit() > 0 && sellAddsToStock(shop, item) && !allowSellOverflow(shop, item)) {
            available = Math.min(available, Math.max(0L, (long) plugin.getDataManager().getGlobalCount(item.getUniqueKey()) - planned));
        }
        return (int) available;
    }

    public static TransactionSafetyGuard.GuardResult playerLimit(ShopPlugin plugin, Player player, String key,
            int quantity, int limit, boolean buy) {
        if (key == null || limit <= 0) return TransactionSafetyGuard.GuardResult.ok();
        return limit(plugin, plugin.getDataManager().getPlayerCount(player.getUniqueId(), key), quantity, limit,
                buy ? "purchase-limit-reached" : "sale-limit-reached");
    }

    public static TransactionSafetyGuard.GuardResult purchaseStock(ShopPlugin plugin, String key, int quantity, int limit) {
        if (key == null || limit <= 0) return TransactionSafetyGuard.GuardResult.ok();
        return limit(plugin, plugin.getDataManager().getGlobalCount(key), quantity, limit, "global-limit-reached");
    }

    private static TransactionSafetyGuard.GuardResult limit(ShopPlugin plugin, int current, int quantity, int limit, String message) {
        if ((long) current + quantity <= limit) return TransactionSafetyGuard.GuardResult.ok();
        return TransactionSafetyGuard.GuardResult.fail(plugin.getMessages().getMessage(message)
                .replace("%current%", String.valueOf(current)).replace("%limit%", String.valueOf(limit)));
    }

    public static void updateCounts(ShopPlugin plugin, Player player, String key, int quantity,
                                    boolean buy, boolean dynamic, int globalLimit, boolean sellAdds) {
        if (key == null) return;
        plugin.getDataManager().incrementPlayerCount(player.getUniqueId(), key, quantity);
        boolean global = buy ? dynamic || globalLimit > 0 : (globalLimit > 0 && sellAdds) || (dynamic && globalLimit <= 0);
        if (global) plugin.getDataManager().incrementGlobalCount(key, buy ? quantity : -quantity);
    }

    public static TransactionResult purchase(ShopPlugin plugin, Player player, Context context, double money,
            Runnable delivery, Runnable restoreDelivery, Runnable updateStock) {
        return execute(plugin, player, context, money, true, delivery, restoreDelivery, updateStock);
    }

    public static TransactionResult sale(ShopPlugin plugin, Player player, Context context, double money,
            SaleStorage storage, ItemStack[] expected, Map<Integer, Integer> quantities, Runnable updateStock) {
        // Copy both inputs so an approval listener cannot alter the pending removal request.
        ItemStack[] snapshot = snapshot(expected);
        Map<Integer, Integer> removals = Map.copyOf(quantities);
        return execute(plugin, player, context, money, false, () -> {
            try {
                if (!storage.approveSale(removals, money)) throw new RejectedRemoval("Sale approval was rejected");
            } catch (RuntimeException failure) {
                throw new RejectedRemoval("Sale approval failed: " + failure);
            }
            for (var removal : removals.entrySet()) {
                int slot = removal.getKey();
                if (slot < 0 || slot >= snapshot.length || snapshot[slot] == null || removal.getValue() <= 0
                        || removal.getValue() > snapshot[slot].getAmount()) throw new RejectedRemoval("Invalid sale quantity");
            }
            if (removals.isEmpty()) throw new RejectedRemoval("No sale quantities");
            if (!storage.removeItems(snapshot, removals)) throw new RejectedRemoval("Sale source changed before removal");
        }, () -> storage.restoreItems(snapshot), updateStock);
    }

    public static ItemStack[] snapshot(ItemStack[] contents) {
        return Arrays.stream(contents).map(stack -> stack == null ? null : stack.clone()).toArray(ItemStack[]::new);
    }

    private static TransactionResult execute(ShopPlugin plugin, Player player, Context context, double money,
            boolean buy, Runnable delivery, Runnable restore, Runnable stock) {
        UUID id = UUID.randomUUID();
        Audit audit = new Audit(context, player == null ? null : player.getUniqueId(), money);
        if (player == null || !Double.isFinite(money) || money <= 0D || money > 1_000_000_000_000D) return result(plugin, audit, id, REJECTED, INVALID_REQUEST, "Money must be finite, positive, and within the hard safety cap");
        if (!Bukkit.isPrimaryThread()) return result(plugin, audit, id, REJECTED, WRONG_THREAD, "Transactions require the server thread");
        if (!RUNNING.add(player.getUniqueId())) return result(plugin, audit, id, REJECTED, BUSY, "Player already has an active transaction");
        try {
            EconomyHook economy = plugin.getEconomy();
            if (economy == null || !economy.isReady()) return result(plugin, audit, id, REJECTED, PAYMENT_FAILED, "Economy provider is not ready");
            if (buy) {
                var payment = payment(economy, player, money, true);
                if (!payment.success()) return result(plugin, audit, id, REJECTED, PAYMENT_FAILED, payment.errorMessage());
            }
            try {
                delivery.run();
            } catch (RejectedRemoval rejected) {
                // False means no mutation: restoring here would overwrite an external source change.
                return result(plugin, audit, id, REJECTED, DELIVERY_FAILED, rejected.getMessage());
            } catch (RuntimeException failure) {
                return compensate(plugin, player, audit, id, money, buy, restore, DELIVERY_FAILED, failure.toString());
            }
            if (!buy) {
                var payment = payment(economy, player, money, false);
                if (!payment.success()) return compensate(plugin, player, audit, id, money, false, restore, PAYMENT_FAILED, payment.errorMessage());
            }
            if (context.type() != null) {
                plugin.recordTransactions(id, player, context.type(), context.lines());
            }
            try { stock.run(); }
            catch (RuntimeException failure) {
                // Money and items are settled. Retrying or refunding now could duplicate the trade.
                return result(plugin, audit, id, COMPLETED_WITH_ERRORS, STOCK_UPDATE_FAILED, failure.toString());
            }
            plugin.debug("Transaction " + id + " " + audit + " " + COMPLETED);
            return new TransactionResult(id, COMPLETED, NONE, null);
        } finally {
            RUNNING.remove(player.getUniqueId());
        }
    }

    private static TransactionResult compensate(ShopPlugin plugin, Player player, Audit context, UUID id,
            double money, boolean refund, Runnable restore, TransactionResult.FailureReason reason, String detail) {
        try { restore.run(); }
        catch (RuntimeException failure) {
            return result(plugin, context, id, COMPENSATION_FAILED, reason, detail + "; restore failed: " + failure);
        }
        if (refund) {
            var payment = payment(plugin.getEconomy(), player, money, false);
            if (!payment.success()) return result(plugin, context, id, COMPENSATION_FAILED, reason, detail + "; refund failed: " + payment.errorMessage());
        }
        return result(plugin, context, id, COMPENSATED, reason, detail);
    }

    private static TransactionResult result(ShopPlugin plugin, Audit context, UUID id, TransactionResult.Status status,
            TransactionResult.FailureReason reason, String detail) {
        Level level = status == COMPENSATION_FAILED || status == COMPLETED_WITH_ERRORS ? Level.SEVERE : Level.WARNING;
        plugin.getLogger().log(level, "Transaction " + id + " " + context + " " + status + " " + reason + ": " + detail);
        return new TransactionResult(id, status, reason, detail);
    }

    private static EconomyHook.EconomyOperationResult payment(EconomyHook economy, Player player, double money, boolean withdraw) {
        try {
            var response = withdraw ? economy.tryWithdraw(player, money) : economy.tryDeposit(player, money);
            return response == null ? new EconomyHook.EconomyOperationResult(false, "No economy response") : response;
        } catch (RuntimeException failure) {
            return new EconomyHook.EconomyOperationResult(false, failure.toString());
        }
    }

    private static final class RejectedRemoval extends RuntimeException {
        private RejectedRemoval(String message) { super(message); }
    }
}
