package me.dralle.shop.economy;

import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.stock.StockResetRule;
import me.dralle.shop.util.CampaignUtil;
import me.dralle.shop.util.PriceFormulaUtil;
import me.dralle.shop.util.ShopTimeUtil;

import java.time.Instant;
import java.time.ZoneId;
import java.util.*;

/** Pure simulation: all transaction counters are copied before each scenario. */
public final class PriceSimulation {
    public enum Mode { BATCH, SEQUENTIAL }
    public record Offer(ShopData shop, ShopItem item) {}
    public record Route(Offer buy, Offer sell) {
        public String key() { return buy.shop().getKey() + ":" + buy.item().getUniqueKey() + "->" + sell.shop().getKey() + ":" + sell.item().getUniqueKey(); }
    }
    public record Result(Route route, int quantity, Instant at, Mode mode, int buyStock, int sellStock,
                         double cost, double revenue) {
        public double profit() { return revenue - cost; }
    }
    public record Reset(StockResetRule rule, Set<String> keys) {}
    public record Safety(boolean enabled, double maxUnit, double maxTotal, boolean antiSpike,
                         double maxBaseRatio, double minBaseRatio, double maxStepRatio,
                         long buyDelay, long sellDelay) {}

    public static Result simulate(Route route, int quantity, Instant at, Mode mode, int buyStock, int sellStock,
                                  Map<String, Integer> playerCounts, List<Reset> resets, Safety safety) {
        if (quantity < 1 || quantity > 1024 || buyStock < 0 || sellStock < 0) throw new IllegalArgumentException("Invalid simulation quantities or stock");
        Map<String, Integer> stock = new HashMap<>();
        String buyKey = route.buy().item().getUniqueKey(), sellKey = route.sell().item().getUniqueKey();
        stock.put(buyKey, buyStock);
        stock.putIfAbsent(sellKey, sellStock);
        Map<String, Integer> counts = new HashMap<>(playerCounts);
        Map<Reset, Long> resetTimes = new HashMap<>();
        Map<String, Double> previousPrices = new HashMap<>();
        for (Reset reset : resets) resetTimes.put(reset, at.toEpochMilli());
        int steps = mode == Mode.BATCH ? 1 : quantity;
        int stepQuantity = mode == Mode.BATCH ? quantity : 1;
        double cost = 0, revenue = 0;
        Instant now = at;
        for (int side = 0; side < 2; side++) {
            Offer offer = side == 0 ? route.buy() : route.sell();
            ShopItem item = offer.item();
            String key = item.getUniqueKey();
            for (int step = 0; step < steps; step++) {
                for (Reset reset : resets) {
                    if (reset.rule().shouldReset(resetTimes.get(reset), now)) {
                        for (String resetKey : reset.keys()) if (stock.containsKey(resetKey)) stock.put(resetKey, 0);
                        resetTimes.put(reset, now.toEpochMilli());
                    }
                }
                var localTime = now.atZone(ZoneId.systemDefault());
                if (!ShopTimeUtil.isShopAvailable(offer.shop().getAvailableTimes(), localTime)
                        || !ShopTimeUtil.isShopAvailable(item.getAvailableTimes(), localTime)) return null;
                int used = stock.getOrDefault(key, 0), playerUsed = counts.getOrDefault(key, 0);
                if (item.getLimit() > 0 && (long) playerUsed + stepQuantity > item.getLimit()) return null;
                if (side == 0 && item.getGlobalLimit() > 0 && (long) used + stepQuantity > item.getGlobalLimit()) return null;
                boolean replenish = item.getSellAddsToStock() != null ? item.getSellAddsToStock() : offer.shop().isSellAddsToStock();
                boolean overflow = item.getAllowSellStockOverflow() != null ? item.getAllowSellStockOverflow() : offer.shop().isAllowSellStockOverflow();
                if (side == 1 && replenish && item.getGlobalLimit() > 0 && !overflow && stepQuantity > used) return null;
                double price = side == 0 ? PriceFormulaUtil.resolveBuyBasePrice(item, used) : PriceFormulaUtil.resolveSellBasePrice(item, used);
                var campaign = CampaignUtil.resolveCampaign(offer.shop(), item, now);
                double campaignMultiplier = 1;
                if (campaign != null) {
                    double multiplier = side == 0 ? campaign.getBuyMultiplier() : campaign.getSellMultiplier();
                    if (multiplier > 0) { campaignMultiplier = multiplier; price *= multiplier; }
                }
                if ((item.getMinPrice() > 0 && price + 1e-9 < item.getMinPrice() * campaignMultiplier)
                        || (item.getMaxPrice() > 0 && price - 1e-9 > item.getMaxPrice() * campaignMultiplier)) return null;
                double total = side == 0 ? item.calculateBuyTotal(price, stepQuantity) : item.calculateSellTotal(price, stepQuantity);
                double base = side == 0 ? item.getPrice() : item.getSellPrice() == null ? 0 : item.getSellPrice();
                String actionKey = side + ":" + key;
                if (!allowed(price, total, base, previousPrices.get(actionKey), safety)) return null;
                previousPrices.put(actionKey, price);
                if (side == 0) cost += total; else revenue += total;
                if ((long) playerUsed + stepQuantity > Integer.MAX_VALUE) return null;
                counts.put(key, playerUsed + stepQuantity);
                boolean dynamic = item.isDynamicPricing() || !(side == 0 ? clean(item.getBuyPriceFormula()) : clean(item.getSellPriceFormula())).isEmpty();
                if (side == 0 && (dynamic || item.getGlobalLimit() > 0)) {
                    if ((long) used + stepQuantity > Integer.MAX_VALUE) return null;
                    stock.put(key, used + stepQuantity);
                } else if (side == 1 && ((replenish && item.getGlobalLimit() > 0) || (dynamic && item.getGlobalLimit() <= 0))) {
                    stock.put(key, Math.max(0, used - stepQuantity));
                }
                if (step + 1 < steps) now = now.plusMillis(side == 0 ? safety.buyDelay() : safety.sellDelay());
            }
        }
        return new Result(route, quantity, at, mode, buyStock, sellStock, cost, revenue);
    }

    private static boolean allowed(double price, double total, double base, Double previous, Safety safety) {
        if (!Double.isFinite(price) || !Double.isFinite(total) || price <= 0 || total <= 0 || price > 1e12 || total > 1e12) return false;
        if (!safety.enabled()) return true;
        if (safety.maxUnit() > 0 && price > safety.maxUnit()) return false;
        if (safety.maxTotal() > 0 && total > safety.maxTotal()) return false;
        if (safety.antiSpike() && base > 0) {
            if (safety.maxBaseRatio() > 0 && price > base * safety.maxBaseRatio()) return false;
            if (safety.minBaseRatio() > 0 && price < base * safety.minBaseRatio()) return false;
        }
        return !safety.antiSpike() || previous == null || safety.maxStepRatio() < 0
                || Math.abs(price - previous) / previous <= safety.maxStepRatio();
    }

    public static boolean compatibleConditions(ShopItem a, ShopItem b) {
        int minimum = Math.max(a.getMinPlayerLevel(), b.getMinPlayerLevel());
        int maximum = Math.min(a.getMaxPlayerLevel() > 0 ? a.getMaxPlayerLevel() : Integer.MAX_VALUE,
                b.getMaxPlayerLevel() > 0 ? b.getMaxPlayerLevel() : Integer.MAX_VALUE);
        if (minimum > maximum) return false;
        String first = gameMode(a.getRequiredGamemode()), second = gameMode(b.getRequiredGamemode());
        if (!first.isEmpty() && !second.isEmpty() && !first.equals(second)) return false;
        Set<String> allowed = new HashSet<>(worlds(a.getAllowedWorlds()));
        Set<String> other = worlds(b.getAllowedWorlds());
        if (allowed.isEmpty()) allowed.addAll(other); else if (!other.isEmpty()) {
            allowed.retainAll(other);
            if (allowed.isEmpty()) return false;
        }
        if (!allowed.isEmpty()) {
            allowed.removeAll(worlds(a.getDeniedWorlds()));
            allowed.removeAll(worlds(b.getDeniedWorlds()));
            if (allowed.isEmpty()) return false;
        }
        return true;
    }

    public static String conditions(Route route) {
        List<String> conditions = new ArrayList<>();
        for (Offer offer : List.of(route.buy(), route.sell())) {
            ShopItem item = offer.item();
            if (!clean(offer.shop().getPermission()).isEmpty()) conditions.add("permission=" + offer.shop().getPermission());
            if (!clean(item.getPermission()).isEmpty()) conditions.add("permission=" + item.getPermission());
            conditions.add("shop=" + offer.shop().getKey() + ": level=" + item.getMinPlayerLevel() + ".." + (item.getMaxPlayerLevel() > 0 ? item.getMaxPlayerLevel() : "any")
                    + ", mode=" + gameMode(item.getRequiredGamemode()) + ", worlds=" + worlds(item.getAllowedWorlds()) + ", denied=" + worlds(item.getDeniedWorlds()));
        }
        return String.join("; ", conditions);
    }

    private static String gameMode(String value) {
        try { return org.bukkit.GameMode.valueOf(clean(value).toUpperCase(Locale.ROOT)).name(); }
        catch (IllegalArgumentException ignored) { return ""; }
    }
    private static Set<String> worlds(List<String> values) {
        Set<String> result = new TreeSet<>();
        if (values != null) for (String value : values) if (value != null) result.add(value.toLowerCase(Locale.ROOT));
        return result;
    }
    private static String clean(String value) { return value == null ? "" : value.trim(); }
}
