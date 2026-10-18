package me.dralle.shop.economy;

import me.dralle.shop.commands.PriceSimulationCommand;
import me.dralle.shop.economy.PriceSimulation.*;
import me.dralle.shop.model.ShopCampaign;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.stock.StockResetRule;
import me.dralle.shop.util.CampaignUtil;
import me.dralle.shop.util.PriceFormulaUtil;
import org.bukkit.Material;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PriceSimulationTest {
    private final Instant at = Instant.parse("2026-10-12T12:00:00Z");
    private final Safety safety = new Safety(false, 0, 0, false, 0, 0, -1, 0, 0);

    @Test
    void availabilityUsesConfiguredTimezoneAcrossMidnight() {
        Offer buy = offer("cheap", "buy", 10, 1), sell = offer("premium", "sell", 20, 30);
        when(buy.shop().getAvailableTimes()).thenReturn(List.of("SATURDAY", "00:00-01:00"));
        when(sell.item().getAvailableTimes()).thenReturn(List.of("SATURDAY", "00:00-01:00"));
        Route route = new Route(buy, sell);
        Instant instant = Instant.parse("2026-10-16T22:30:00Z");
        assertNotNull(PriceSimulation.simulate(route, 1, instant, Mode.BATCH, 0, 0,
                Map.of(), List.of(), safety, ZoneId.of("Europe/Copenhagen")));
        assertNull(PriceSimulation.simulate(route, 1, instant, Mode.BATCH, 0, 0,
                Map.of(), List.of(), safety, ZoneId.of("UTC")));
    }

    private Offer offer(String shopKey, String itemKey, double buy, double sell) {
        ShopItem item = mock(ShopItem.class);
        when(item.getUniqueKey()).thenReturn(itemKey);
        when(item.getMaterial()).thenReturn(Material.STONE);
        when(item.getPrice()).thenReturn(buy);
        when(item.getSellPrice()).thenReturn(sell);
        when(item.getAmount()).thenReturn(1);
        when(item.calculateBuyTotal(anyDouble(), anyInt())).thenAnswer(call -> (double) call.getArgument(0) * (int) call.getArgument(1));
        when(item.calculateSellTotal(anyDouble(), anyInt())).thenAnswer(call -> (double) call.getArgument(0) * (int) call.getArgument(1));
        ShopData shop = mock(ShopData.class);
        when(shop.getKey()).thenReturn(shopKey);
        return new Offer(shop, item);
    }

    private Result simulate(Route route, int quantity, Mode mode, int first, int second) {
        return PriceSimulation.simulate(route, quantity, at, mode, first, second, Map.of(), List.of(), safety);
    }

    @Test
    void reportsProfitAndUsesEffectiveBundlePrices() {
        Offer buy = offer("cheap", "stone", 100, 20), sell = offer("premium", "stone-sell", 200, 30);
        when(buy.item().getAmount()).thenReturn(4);
        when(buy.item().calculateBuyTotal(anyDouble(), anyInt())).thenAnswer(call -> (double) call.getArgument(0) * (int) call.getArgument(1) / 4);
        var result = simulate(new Route(buy, sell), 4, Mode.BATCH, 0, 0);
        assertNotNull(result);
        assertEquals(100, result.cost());
        assertEquals(120, result.revenue());
        assertEquals(20, result.profit());
    }

    @Test
    void sequentialTransactionsRepriceEveryUnitAndSharedKeysSeePurchases() {
        Offer buy = offer("cheap", "stone", 10, 1), sell = offer("premium", "stone", 20, 30);
        when(buy.item().isDynamicPricing()).thenReturn(true);
        when(buy.item().getPriceChange()).thenReturn(2D);
        when(sell.item().isDynamicPricing()).thenReturn(true);
        when(sell.item().getPriceChange()).thenReturn(2D);
        Route route = new Route(buy, sell);
        var sequential = simulate(route, 3, Mode.SEQUENTIAL, 0, 0);
        assertNotNull(sequential);
        assertEquals(10 + 12 + 14, sequential.cost());
        assertEquals(36 + 34 + 32, sequential.revenue());
        var batch = simulate(route, 3, Mode.BATCH, 0, 0);
        assertNotNull(batch);
        assertEquals(30, batch.cost());
        assertEquals(108, batch.revenue());
    }

    @Test
    void formulasClampsAndCampaignWindowsUseTheExistingResolvers() {
        Offer buy = offer("cheap", "buy", 10, 1), sell = offer("premium", "sell", 20, 30);
        when(buy.item().isDynamicPricing()).thenReturn(true);
        when(buy.item().getPriceChange()).thenReturn(4D);
        when(buy.item().getMinPrice()).thenReturn(5D);
        when(buy.item().getMaxPrice()).thenReturn(14D);
        when(buy.item().getBuyPriceFormula()).thenReturn("min(dynamic, max_price)");
        var campaign = new ShopCampaign("sale", "sale", "2026-10-12T11:00:00Z", "2026-10-12T13:00:00Z", "UTC", 0.5, 1);
        when(buy.shop().getCampaignKey()).thenReturn("sale");
        when(buy.shop().getCampaigns()).thenReturn(Map.of("sale", campaign));
        assertEquals(14, PriceFormulaUtil.resolveBuyBasePrice(buy.item(), 100));
        assertNotNull(CampaignUtil.resolveCampaign(buy.shop(), buy.item(), at));
        var active = simulate(new Route(buy, sell), 2, Mode.SEQUENTIAL, 0, 0);
        assertNotNull(active);
        assertEquals(5 + 7, active.cost());
        var inactive = PriceSimulation.simulate(new Route(buy, sell), 2, Instant.parse("2026-10-12T14:00:00Z"), Mode.SEQUENTIAL, 0, 0, Map.of(), List.of(), safety);
        assertNotNull(inactive);
        assertEquals(10 + 14, inactive.cost());
    }

    @Test
    void limitsAndStockReplenishmentBlockImpossibleRoutes() {
        Offer buy = offer("cheap", "shared", 10, 1), sell = offer("premium", "shared", 20, 30);
        when(buy.item().getGlobalLimit()).thenReturn(5);
        assertNull(simulate(new Route(buy, sell), 3, Mode.BATCH, 3, 3));
        when(buy.item().getLimit()).thenReturn(4);
        when(sell.item().getLimit()).thenReturn(4);
        assertNull(simulate(new Route(buy, sell), 3, Mode.BATCH, 0, 0));
        when(buy.item().getLimit()).thenReturn(0);
        when(sell.item().getLimit()).thenReturn(0);
        when(sell.item().getGlobalLimit()).thenReturn(5);
        when(sell.item().getSellAddsToStock()).thenReturn(true);
        assertNotNull(simulate(new Route(buy, sell), 3, Mode.BATCH, 0, 0));
        Offer unrelated = offer("other", "other-key", 20, 30);
        when(unrelated.item().getGlobalLimit()).thenReturn(5);
        when(unrelated.item().getSellAddsToStock()).thenReturn(true);
        assertNull(simulate(new Route(buy, unrelated), 3, Mode.BATCH, 0, 0));
        when(unrelated.item().getAllowSellStockOverflow()).thenReturn(true);
        assertNotNull(simulate(new Route(buy, unrelated), 3, Mode.BATCH, 0, 0));
    }

    @Test
    void availabilityMustHoldThroughTheWholeSequence() {
        Offer buy = offer("cheap", "buy", 10, 1), sell = offer("premium", "sell", 20, 30);
        when(sell.shop().getAvailableTimes()).thenReturn(List.of("TUESDAY"));
        assertNull(simulate(new Route(buy, sell), 1, Mode.BATCH, 0, 0));
        when(sell.shop().getAvailableTimes()).thenReturn(List.of());
        ZoneId zone = ZoneId.systemDefault();
        Instant start = LocalDate.of(2026, 10, 12).atTime(12, 59, 59).atZone(zone).toInstant();
        when(buy.item().getAvailableTimes()).thenReturn(List.of("12:00-13:00"));
        Safety slow = new Safety(false, 0, 0, false, 0, 0, -1, 1000, 1000);
        assertNull(PriceSimulation.simulate(new Route(buy, sell), 3, start, Mode.SEQUENTIAL, 0, 0, Map.of(), List.of(), slow));
    }

    @Test
    void resetRulesRunOnCopiesDuringSequences() {
        Offer buy = offer("cheap", "buy", 10, 1), sell = offer("premium", "sell", 20, 30);
        when(buy.item().isDynamicPricing()).thenReturn(true);
        when(buy.item().getPriceChange()).thenReturn(2D);
        var rule = new StockResetRule(true, StockResetRule.Type.SECOND_INTERVAL, ZoneId.of("UTC"), LocalTime.MIDNIGHT, null, 1, null, 1, null, 1);
        var slow = new Safety(false, 0, 0, false, 0, 0, -1, 1000, 1000);
        var result = PriceSimulation.simulate(new Route(buy, sell), 3, at, Mode.SEQUENTIAL, 0, 0, Map.of(), List.of(new Reset(rule, Set.of("buy"))), slow);
        assertNotNull(result);
        assertEquals(30, result.cost());
    }

    @Test
    void contradictoryPlayerConditionsAreNotReportedAsFeasible() {
        Offer a = offer("a", "a", 10, 1), b = offer("b", "b", 20, 30);
        when(a.item().getMinPlayerLevel()).thenReturn(10);
        when(b.item().getMaxPlayerLevel()).thenReturn(5);
        assertFalse(PriceSimulation.compatibleConditions(a.item(), b.item()));
        when(b.item().getMaxPlayerLevel()).thenReturn(0);
        when(a.item().getAllowedWorlds()).thenReturn(List.of("world"));
        when(b.item().getAllowedWorlds()).thenReturn(List.of("nether"));
        assertFalse(PriceSimulation.compatibleConditions(a.item(), b.item()));
        when(b.item().getAllowedWorlds()).thenReturn(List.of("WORLD"));
        assertTrue(PriceSimulation.compatibleConditions(a.item(), b.item()));
        when(b.item().getDeniedWorlds()).thenReturn(List.of("world"));
        assertFalse(PriceSimulation.compatibleConditions(a.item(), b.item()));
    }

    @Test
    void reportsIntentionalRoutesAndDoesNotModifyInputCounts() {
        Route route = new Route(offer("cheap", "buy", 10, 1), offer("premium", "sell", 20, 30));
        when(route.buy().item().isDynamicPricing()).thenReturn(true);
        when(route.buy().item().getPriceChange()).thenReturn(1D);
        Map<String, Integer> stock = new HashMap<>(Map.of("buy", 2));
        Map<String, Integer> players = new HashMap<>(Map.of("buy", 1));
        var options = new PriceSimulationCommand.Options(null, at, List.of(1, 16, 64), "live", "both");
        var report = PriceSimulationCommand.run(List.of(route), stock, players, List.of(), options, safety, Set.of(route.key()), 100000);
        assertTrue(report.stream().anyMatch(line -> line.startsWith("INTENTIONAL " + route.key())));
        assertEquals(Map.of("buy", 2), stock);
        assertEquals(Map.of("buy", 1), players);
        var limited = PriceSimulationCommand.run(List.of(route), stock, players, List.of(), options, safety, Set.of(), 2);
        assertTrue(limited.stream().anyMatch(line -> line.startsWith("INCOMPLETE:")));
        assertTrue(limited.stream().anyMatch(line -> line.startsWith("REVIEW ")));
    }

    @Test
    void safetyFloorsAndStepLimitsStillApply() {
        Route route = new Route(offer("cheap", "buy", 10, 1), offer("premium", "sell", 20, 30));
        when(route.buy().item().getBuyPriceFormula()).thenReturn("base * 0.5");
        when(route.buy().item().getMinPrice()).thenReturn(9D);
        assertNull(simulate(route, 1, Mode.BATCH, 0, 0));
        when(route.buy().item().getMinPrice()).thenReturn(0D);
        when(route.buy().item().getBuyPriceFormula()).thenReturn(null);
        when(route.buy().item().isDynamicPricing()).thenReturn(true);
        when(route.buy().item().getPriceChange()).thenReturn(1D);
        var guarded = new Safety(true, 0, 0, true, 10, 0, 0, 0, 0);
        assertNull(PriceSimulation.simulate(route, 2, at, Mode.SEQUENTIAL, 0, 0, Map.of(), List.of(), guarded));
    }
}
