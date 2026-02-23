package me.dralle.shop.economy;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.util.ConsoleLog;
import me.dralle.shop.util.ShopItemUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class TransactionSafetyGuard {

    public static final String ACTION_BUY = "buy";
    public static final String ACTION_SELL = "sell";
    public static final String ACTION_BULK_SELL = "bulk-sell";

    private static final double HARD_MAX_MONEY = 1_000_000_000_000D;
    private static final Map<String, Long> COOLDOWNS = new ConcurrentHashMap<>();
    private static final Map<String, Double> LAST_UNIT_PRICE = new ConcurrentHashMap<>();
    private static final Map<UUID, PendingLargePurchase> PENDING_LARGE_PURCHASES = new ConcurrentHashMap<>();
    private static volatile long LAST_ADMIN_ALERT_AT = 0L;

    private TransactionSafetyGuard() {}

    public record GuardResult(boolean allowed, String message) {
        public static GuardResult ok() {
            return new GuardResult(true, null);
        }

        public static GuardResult fail(String message) {
            return new GuardResult(false, message);
        }
    }

    private record PendingLargePurchase(String fingerprint, long expiresAtMillis, double total) {}

    public static GuardResult validateTransaction(
            ShopPlugin plugin,
            Player player,
            String action,
            String shopKey,
            String itemKey,
            Material material,
            int quantity,
            double unitPrice,
            double baseUnitPrice,
            double total,
            boolean dynamicPricing,
            double minPrice,
            double maxPrice
    ) {
        if (quantity <= 0) {
            return reject(plugin, player, action, shopKey, itemKey, material, total, "Quantity must be > 0.");
        }
        if (!isValidMoney(unitPrice) || !isValidMoney(total)) {
            return reject(plugin, player, action, shopKey, itemKey, material, total, "Invalid money value (NaN/Infinity/negative).");
        }
        if (unitPrice > HARD_MAX_MONEY || total > HARD_MAX_MONEY) {
            return reject(plugin, player, action, shopKey, itemKey, material, total, "Money value exceeds hard safety cap.");
        }

        // These checks must always run, even when optional safety toggles are disabled.
        if ((minPrice > 0D && unitPrice + 1.0E-9D < minPrice) || (maxPrice > 0D && unitPrice - 1.0E-9D > maxPrice)) {
            return reject(plugin, player, action, shopKey, itemKey, material, total, "Unit price violates configured floor/ceiling.");
        }

        if (!plugin.getConfig().getBoolean("economy-safety.enabled", true)) {
            return GuardResult.ok();
        }

        double maxTransactionValue = plugin.getConfig().getDouble("economy-safety.max-transaction-value", 0D);
        if (maxTransactionValue > 0D && total > maxTransactionValue) {
            return reject(plugin, player, action, shopKey, itemKey, material, total, "Transaction exceeds max-transaction-value.");
        }

        double maxUnitPrice = plugin.getConfig().getDouble("economy-safety.max-unit-price", 0D);
        if (maxUnitPrice > 0D && unitPrice > maxUnitPrice) {
            return reject(plugin, player, action, shopKey, itemKey, material, total, "Unit price exceeds max-unit-price.");
        }

        if (dynamicPricing) {
            if (minPrice > 0D && unitPrice + 1.0E-9D < minPrice) {
                return reject(plugin, player, action, shopKey, itemKey, material, total, "Dynamic price below configured min-price.");
            }
            if (maxPrice > 0D && unitPrice - 1.0E-9D > maxPrice) {
                return reject(plugin, player, action, shopKey, itemKey, material, total, "Dynamic price above configured max-price.");
            }
        }

        if (plugin.getConfig().getBoolean("economy-safety.anti-spike.enabled", true)) {
            double maxBaseMultiplier = plugin.getConfig().getDouble("economy-safety.anti-spike.max-base-multiplier", 10.0D);
            double minBaseMultiplier = plugin.getConfig().getDouble("economy-safety.anti-spike.min-base-multiplier", 0.0D);
            if (baseUnitPrice > 0D) {
                if (maxBaseMultiplier > 0D && unitPrice > baseUnitPrice * maxBaseMultiplier) {
                    return reject(plugin, player, action, shopKey, itemKey, material, total, "Anti-spike: unit price above base multiplier.");
                }
                if (minBaseMultiplier > 0D && unitPrice < baseUnitPrice * minBaseMultiplier) {
                    return reject(plugin, player, action, shopKey, itemKey, material, total, "Anti-spike: unit price below base multiplier.");
                }
            }

            if (itemKey != null && !itemKey.isEmpty()) {
                String priceKey = action + ":" + itemKey;
                Double previous = LAST_UNIT_PRICE.get(priceKey);
                double maxStepChangeRatio = plugin.getConfig().getDouble("economy-safety.anti-spike.max-step-change-ratio", 5.0D);
                if (previous != null && previous > 0D && maxStepChangeRatio >= 0D) {
                    double step = Math.abs(unitPrice - previous) / previous;
                    if (step > maxStepChangeRatio) {
                        return reject(plugin, player, action, shopKey, itemKey, material, total, "Anti-spike: unit price step-change too large.");
                    }
                }
            }
        }

        return GuardResult.ok();
    }

    public static GuardResult checkCooldown(ShopPlugin plugin, Player player, String action) {
        if (!plugin.getConfig().getBoolean("economy-safety.enabled", true)) {
            return GuardResult.ok();
        }
        if (!plugin.getConfig().getBoolean("economy-safety.cooldowns.enabled", true)) {
            return GuardResult.ok();
        }

        long cooldownMs = switch (action) {
            case ACTION_BUY -> plugin.getConfig().getLong("economy-safety.cooldowns.buy-ms", 0L);
            case ACTION_SELL -> plugin.getConfig().getLong("economy-safety.cooldowns.sell-ms", 0L);
            case ACTION_BULK_SELL -> plugin.getConfig().getLong("economy-safety.cooldowns.bulk-sell-ms", 0L);
            default -> 0L;
        };
        if (cooldownMs <= 0L) return GuardResult.ok();

        long now = System.currentTimeMillis();
        String key = player.getUniqueId() + ":" + action;
        long last = COOLDOWNS.getOrDefault(key, 0L);
        long delta = now - last;
        if (delta < cooldownMs) {
            long remaining = Math.max(1L, (cooldownMs - delta + 999L) / 1000L);
            return GuardResult.fail(
                    plugin.getMessages().getMessage("safety-cooldown")
                            .replace("%seconds%", String.valueOf(remaining))
                            .replace("%action%", action)
            );
        }
        COOLDOWNS.put(key, now);
        return GuardResult.ok();
    }

    public static GuardResult requireLargePurchaseConfirmation(
            ShopPlugin plugin,
            Player player,
            String itemKey,
            Material material,
            int amount,
            double total
    ) {
        if (!plugin.getConfig().getBoolean("economy-safety.enabled", true)) {
            return GuardResult.ok();
        }
        if (!plugin.getConfig().getBoolean("economy-safety.large-purchase-confirmation.enabled", false)) {
            return GuardResult.ok();
        }

        double threshold = plugin.getConfig().getDouble("economy-safety.large-purchase-confirmation.threshold", 0D);
        if (threshold <= 0D || total < threshold) {
            PENDING_LARGE_PURCHASES.remove(player.getUniqueId());
            return GuardResult.ok();
        }

        long timeoutSeconds = Math.max(1L, plugin.getConfig().getLong("economy-safety.large-purchase-confirmation.timeout-seconds", 10L));
        long now = System.currentTimeMillis();
        String fingerprint = buildFingerprint(itemKey, material, amount, total);
        PendingLargePurchase pending = PENDING_LARGE_PURCHASES.get(player.getUniqueId());
        if (pending != null && pending.expiresAtMillis() >= now && pending.fingerprint().equals(fingerprint)) {
            PENDING_LARGE_PURCHASES.remove(player.getUniqueId());
            return GuardResult.ok();
        }

        long expiresAt = now + (timeoutSeconds * 1000L);
        PENDING_LARGE_PURCHASES.put(player.getUniqueId(), new PendingLargePurchase(fingerprint, expiresAt, total));
        return GuardResult.fail(
                plugin.getMessages().getMessage("safety-large-purchase-confirm")
                        .replace("%total%", plugin.formatCurrency(total))
                        .replace("%seconds%", String.valueOf(timeoutSeconds))
        );
    }

    public static void rememberSuccessfulUnitPrice(String action, String itemKey, double unitPrice) {
        if (itemKey == null || itemKey.isEmpty()) return;
        if (!isValidMoney(unitPrice)) return;
        LAST_UNIT_PRICE.put(action + ":" + itemKey, unitPrice);
    }

    private static GuardResult reject(
            ShopPlugin plugin,
            Player player,
            String action,
            String shopKey,
            String itemKey,
            Material material,
            double total,
            String reason
    ) {
        String materialName = material != null ? material.name() : "UNKNOWN";
        String shop = shopKey != null && !shopKey.isEmpty() ? shopKey : "n/a";
        String key = itemKey != null ? itemKey : "n/a";
        try {
            ConsoleLog.warn(plugin,
                    "Economy safety blocked " + action + " for " + player.getName()
                            + " [shop=" + shop + ", itemKey=" + key + ", material=" + materialName + ", total=" + total + "]: " + reason);
        } catch (Throwable ignored) {
            // Safe no-op in non-Bukkit test contexts.
        }
        notifyAdmins(plugin, "blocked", player.getName(), shop, key, materialName, total, reason);
        return GuardResult.fail(plugin.getMessages().getMessage("safety-transaction-blocked"));
    }

    public static void auditEconomyFailure(
            ShopPlugin plugin,
            Player player,
            String action,
            String shopKey,
            String itemKey,
            Material material,
            double total,
            String reason
    ) {
        String materialName = material != null ? material.name() : "UNKNOWN";
        String shop = shopKey != null && !shopKey.isEmpty() ? shopKey : "n/a";
        String key = itemKey != null && !itemKey.isEmpty() ? itemKey : "n/a";
        try {
            ConsoleLog.warn(
                    plugin,
                    "Economy operation failed (" + action + ") for " + player.getName()
                            + " [shop=" + shop + ", itemKey=" + key + ", material=" + materialName + ", total=" + total + "]: " + reason
            );
        } catch (Throwable ignored) {
            // Safe no-op in non-Bukkit test contexts.
        }
        notifyAdmins(plugin, action, player.getName(), shop, key, materialName, total, reason);
    }

    private static void notifyAdmins(
            ShopPlugin plugin,
            String action,
            String playerName,
            String shop,
            String itemKey,
            String materialName,
            double total,
            String reason
    ) {
        if (!plugin.getConfig().getBoolean("economy-safety.admin-alerts.enabled", false)) return;

        long rateLimitMs = Math.max(0L, plugin.getConfig().getLong("economy-safety.admin-alerts.rate-limit-ms", 3000L));
        long now = System.currentTimeMillis();
        if (rateLimitMs > 0L && now - LAST_ADMIN_ALERT_AT < rateLimitMs) return;
        LAST_ADMIN_ALERT_AT = now;

        String permission = plugin.getConfig().getString("economy-safety.admin-alerts.notify-permission", "geniusshop.admin");
        String msg = ShopItemUtil.color(
                "&c[Shop Safety] &7" + action
                        + " &fplayer=&e" + playerName
                        + " &fshop=&e" + shop
                        + " &fitem=&e" + itemKey
                        + " &fmaterial=&e" + materialName
                        + " &ftotal=&e" + plugin.formatCurrency(total)
                        + " &freason=&e" + reason
        );

        try {
            Bukkit.getOnlinePlayers().forEach(p -> {
                if (permission == null || permission.isEmpty() || p.hasPermission(permission) || p.isOp()) {
                    p.sendMessage(msg);
                }
            });
        } catch (Throwable ignored) {
            // Safe no-op in non-Bukkit test contexts.
        }
    }

    private static boolean isValidMoney(double value) {
        return Double.isFinite(value) && value >= 0D;
    }

    private static String buildFingerprint(String itemKey, Material material, int amount, double total) {
        long cents = Math.round(total * 100D);
        String k = itemKey != null && !itemKey.isEmpty() ? itemKey : (material != null ? material.name() : "UNKNOWN");
        return k + "|" + amount + "|" + cents;
    }
}
