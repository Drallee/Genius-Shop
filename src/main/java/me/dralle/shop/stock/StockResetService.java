package me.dralle.shop.stock;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import org.bukkit.Bukkit;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class StockResetService {

    private final ShopPlugin plugin;
    private int taskId = -1;

    public StockResetService(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    public void start() {
        stop();
        long periodTicks = 20L * Math.max(1, plugin.getConfig().getInt("stock-reset-check-interval-seconds", 60));
        taskId = Bukkit.getScheduler().scheduleSyncRepeatingTask(plugin, this::runCheck, periodTicks, periodTicks);
        plugin.debug("StockResetService started (interval " + (periodTicks / 20L) + "s)");
    }

    public void stop() {
        if (taskId != -1) {
            Bukkit.getScheduler().cancelTask(taskId);
            taskId = -1;
        }
    }

    public void runCheck() {
        Instant now = Instant.now();
        List<ShopSnapshot> snapshots = new ArrayList<>();
        for (String shopKey : plugin.getShopManager().getShopKeys()) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop != null) {
                snapshots.add(new ShopSnapshot(shopKey, shop));
            }
        }

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> evaluateAndApplyResets(now, snapshots));
    }

    public int resetAllShopsManual() {
        int total = 0;
        for (String shopKey : plugin.getShopManager().getShopKeys()) {
            total += resetShopStock(shopKey, false);
        }
        plugin.getDataManager().save();
        plugin.getGenericShopGui().requestRefresh();
        return total;
    }

    public int resetShopManual(String shopKey) {
        int count = resetShopStock(shopKey, false);
        plugin.getDataManager().save();
        plugin.getGenericShopGui().requestRefresh();
        return count;
    }

    public boolean resetItemManual(String shopKey, int slot) {
        ShopData shop = plugin.getShopManager().getShop(shopKey);
        if (shop == null) return false;

        for (ShopItem item : shop.getItems()) {
            if (item.getSlot() != null && item.getSlot() == slot) {
                plugin.getDataManager().resetGlobalCount(item.getUniqueKey(), false);
                plugin.getDataManager().save();
                plugin.getGenericShopGui().requestRefresh();
                return true;
            }
        }
        return false;
    }

    private int resetShopStock(String shopKey, boolean saveNow) {
        ShopData shop = plugin.getShopManager().getShop(shopKey);
        if (shop == null) return 0;

        int count = 0;
        for (ShopItem item : shop.getItems()) {
            plugin.getDataManager().resetGlobalCount(item.getUniqueKey(), false);
            count++;
        }
        if (saveNow) plugin.getDataManager().save();
        return count;
    }

    private void evaluateAndApplyResets(Instant now, List<ShopSnapshot> snapshots) {
        List<ResetAction> due = new ArrayList<>();

        for (ShopSnapshot snapshot : snapshots) {
            String shopKey = snapshot.shopKey();
            ShopData shop = snapshot.shop();

            StockResetRule shopRule = shop.getStockResetRule();
            if (shopRule != null && shopRule.isEnabled()) {
                String resetId = "shop:" + shopKey;
                long lastRun = plugin.getDataManager().getLastStockReset(resetId);
                if (shopRule.shouldReset(lastRun, now)) {
                    due.add(ResetAction.shop(shopKey, resetId));
                }
            }

            for (ShopItem item : shop.getItems()) {
                StockResetRule itemRule = item.getStockResetRule();
                if (itemRule == null || !itemRule.isEnabled()) continue;

                String resetId = getItemResetId(shopKey, item);
                long lastRun = plugin.getDataManager().getLastStockReset(resetId);
                if (itemRule.shouldReset(lastRun, now)) {
                    due.add(ResetAction.item(shopKey, item.getUniqueKey(), resetId, safeSlot(item)));
                }
            }
        }

        if (due.isEmpty()) return;

        Bukkit.getScheduler().runTask(plugin, () -> applyResetActions(now, due));
    }

    private void applyResetActions(Instant now, List<ResetAction> actions) {
        for (ResetAction action : actions) {
            if (action.shopReset()) {
                int resetCount = resetShopStock(action.shopKey(), false);
                plugin.getDataManager().setLastStockReset(action.resetId(), now.toEpochMilli(), false);
                me.dralle.shop.util.ConsoleLog.info(plugin, "[StockReset] Auto-reset shop '" + action.shopKey() + "' (" + resetCount + " item stock entries)");
            } else {
                plugin.getDataManager().resetGlobalCount(action.itemKey(), false);
                plugin.getDataManager().setLastStockReset(action.resetId(), now.toEpochMilli(), false);
                me.dralle.shop.util.ConsoleLog.info(plugin, "[StockReset] Auto-reset item stock in '" + action.shopKey() + "' slot " + action.slot());
            }
        }

        plugin.getDataManager().save();
        plugin.getGenericShopGui().requestRefresh();
    }

    private String getItemResetId(String shopKey, ShopItem item) {
        return "item:" + shopKey + ":" + safeSlot(item) + ":" + item.getUniqueKey();
    }

    private int safeSlot(ShopItem item) {
        return item.getSlot() != null ? item.getSlot() : -1;
    }

    private record ShopSnapshot(String shopKey, ShopData shop) {}

    private record ResetAction(boolean shopReset, String shopKey, String itemKey, String resetId, int slot) {
        private static ResetAction shop(String shopKey, String resetId) {
            return new ResetAction(true, shopKey, null, resetId, -1);
        }

        private static ResetAction item(String shopKey, String itemKey, String resetId, int slot) {
            return new ResetAction(false, shopKey, itemKey, resetId, slot);
        }
    }
}
