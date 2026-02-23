package me.dralle.shop.stock;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import org.bukkit.Bukkit;

import java.time.Instant;

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

        for (String shopKey : plugin.getShopManager().getShopKeys()) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop == null) continue;

            StockResetRule shopRule = shop.getStockResetRule();
            if (shopRule != null && shopRule.isEnabled()) {
                String resetId = "shop:" + shopKey;
                long lastRun = plugin.getDataManager().getLastStockReset(resetId);
                if (shopRule.shouldReset(lastRun, now)) {
                    int resetCount = resetShopStock(shopKey, false);
                    plugin.getDataManager().setLastStockReset(resetId, now.toEpochMilli(), false);
                    me.dralle.shop.util.ConsoleLog.info(plugin, "[StockReset] Auto-reset shop '" + shopKey + "' (" + resetCount + " item stock entries)");
                }
            }

            for (ShopItem item : shop.getItems()) {
                StockResetRule itemRule = item.getStockResetRule();
                if (itemRule == null || !itemRule.isEnabled()) continue;

                String resetId = getItemResetId(shopKey, item);
                long lastRun = plugin.getDataManager().getLastStockReset(resetId);
                if (itemRule.shouldReset(lastRun, now)) {
                    plugin.getDataManager().resetGlobalCount(item.getUniqueKey(), false);
                    plugin.getDataManager().setLastStockReset(resetId, now.toEpochMilli(), false);
                    me.dralle.shop.util.ConsoleLog.info(plugin, "[StockReset] Auto-reset item stock in '" + shopKey + "' slot " + safeSlot(item));
                }
            }
        }

        plugin.getDataManager().save();
    }

    public int resetAllShopsManual() {
        int total = 0;
        for (String shopKey : plugin.getShopManager().getShopKeys()) {
            total += resetShopStock(shopKey, false);
        }
        plugin.getDataManager().save();
        return total;
    }

    public int resetShopManual(String shopKey) {
        int count = resetShopStock(shopKey, false);
        plugin.getDataManager().save();
        return count;
    }

    public boolean resetItemManual(String shopKey, int slot) {
        ShopData shop = plugin.getShopManager().getShop(shopKey);
        if (shop == null) return false;

        for (ShopItem item : shop.getItems()) {
            if (item.getSlot() != null && item.getSlot() == slot) {
                plugin.getDataManager().resetGlobalCount(item.getUniqueKey(), false);
                plugin.getDataManager().save();
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

    private String getItemResetId(String shopKey, ShopItem item) {
        return "item:" + shopKey + ":" + safeSlot(item) + ":" + item.getUniqueKey();
    }

    private int safeSlot(ShopItem item) {
        return item.getSlot() != null ? item.getSlot() : -1;
    }
}
