package me.dralle.shop.economy;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.commands.SaleStorage;
import me.dralle.shop.data.TransactionEntry;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.CampaignUtil;
import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.junit.jupiter.api.*;
import org.mockito.MockedStatic;

import java.util.Map;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.logging.Level;

import static me.dralle.shop.economy.TransactionResult.FailureReason.*;
import static me.dralle.shop.economy.TransactionResult.Status.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TransactionServiceTest {
    private final ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
    private final EconomyHook economy = mock(EconomyHook.class);
    private final Player player = mock(Player.class);
    private final Runnable delivery = mock(Runnable.class), restore = mock(Runnable.class), stock = mock(Runnable.class);
    private final SaleStorage storage = mock(SaleStorage.class);
    private final ItemStack stack = mock(ItemStack.class);
    private final TransactionService.Context context = new TransactionService.Context("test", "shop", "stone");
    private MockedStatic<Bukkit> bukkit;

    @BeforeEach
    void setUp() {
        bukkit = mockStatic(Bukkit.class);
        bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
        when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        when(plugin.getEconomy()).thenReturn(economy);
        when(economy.isReady()).thenReturn(true);
        when(economy.tryWithdraw(player, 100D)).thenReturn(new EconomyHook.EconomyOperationResult(true, null));
        when(economy.tryDeposit(player, 100D)).thenReturn(new EconomyHook.EconomyOperationResult(true, null));
        when(stack.clone()).thenReturn(stack);
        when(stack.getAmount()).thenReturn(4);
        when(storage.approveSale(anyMap(), eq(100D))).thenReturn(true);
        when(storage.removeItems(any(), anyMap())).thenReturn(true);
    }

    @AfterEach
    void tearDown() { bukkit.close(); }

    private TransactionResult buy() { return TransactionService.purchase(plugin, player, context, 100, delivery, restore, stock); }
    private TransactionResult sell() { return TransactionService.sale(plugin, player, context, 100, storage, new ItemStack[]{stack}, Map.of(0, 2), stock); }

    @Test
    void completedPurchaseRecordsOnceWithSettlementIdBeforeStockFailure() {
        var lines = List.of(new TransactionEntry.Line("shop", "stone", 2, 100D));
        var ledgerContext = new TransactionService.Context("purchase", "shop", "stone", TransactionEntry.Type.PURCHASE, lines);
        doThrow(new IllegalStateException("stock")).when(stock).run();
        var result = TransactionService.purchase(plugin, player, ledgerContext, 100, delivery, restore, stock);
        assertEquals(COMPLETED_WITH_ERRORS, result.status());
        var order = inOrder(economy, delivery, plugin, stock);
        order.verify(economy).tryWithdraw(player, 100D);
        order.verify(delivery).run();
        order.verify(plugin).recordTransactions(result.id(), player, TransactionEntry.Type.PURCHASE, lines);
        order.verify(stock).run();
        verify(plugin, times(1)).recordTransactions(any(UUID.class), any(), any(), anyList());
    }

    @Test
    void wandSaleRecordsEveryShopUnderOneSettlementId() {
        var lines = List.of(new TransactionEntry.Line("blocks", "stone", 1, 40D),
                new TransactionEntry.Line("ores", "iron", 1, 60D));
        var ledgerContext = new TransactionService.Context("custom-item-sell", null, "wand", TransactionEntry.Type.WAND_SALE, lines);
        var result = TransactionService.sale(plugin, player, ledgerContext, 100, storage,
                new ItemStack[]{stack}, Map.of(0, 2), stock);
        assertEquals(COMPLETED, result.status());
        var order = inOrder(storage, economy, plugin);
        order.verify(storage).removeItems(any(), anyMap());
        order.verify(economy).tryDeposit(player, 100D);
        order.verify(plugin).recordTransactions(result.id(), player, TransactionEntry.Type.WAND_SALE, lines);
        verify(plugin, times(1)).recordTransactions(any(UUID.class), any(), any(), anyList());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"payment", "delivery", "compensation", "sale-payment"})
    void unsuccessfulSettlementNeverRecordsLedgerEntries(String failure) {
        var lines = List.of(new TransactionEntry.Line("shop", "stone", 2, 100D));
        var ledgerContext = new TransactionService.Context("test", "shop", "stone", TransactionEntry.Type.SALE, lines);
        TransactionResult result;
        if (failure.equals("sale-payment")) {
            when(economy.tryDeposit(player, 100D)).thenReturn(new EconomyHook.EconomyOperationResult(false, "refused"));
            result = TransactionService.sale(plugin, player, ledgerContext, 100, storage,
                    new ItemStack[]{stack}, Map.of(0, 2), stock);
        } else {
            if (failure.equals("payment")) {
                when(economy.tryWithdraw(player, 100D)).thenReturn(new EconomyHook.EconomyOperationResult(false, "refused"));
            } else {
                doThrow(new IllegalStateException("delivery")).when(delivery).run();
                if (failure.equals("compensation")) doThrow(new IllegalStateException("restore")).when(restore).run();
            }
            result = TransactionService.purchase(plugin, player, ledgerContext, 100, delivery, restore, stock);
        }
        assertFalse(result.completed());
        verify(plugin, never()).recordTransactions(any(UUID.class), any(), any(), anyList());
    }

    @Test
    void purchaseSettlesInOrderAndExposesUniqueIds() {
        var result = buy();
        assertEquals(COMPLETED, result.status());
        assertEquals(NONE, result.failureReason());
        assertTrue(result.completed());
        assertNotNull(result.id());
        verify(plugin).debug(contains("Transaction " + result.id()));
        var order = inOrder(economy, delivery, stock);
        order.verify(economy).tryWithdraw(player, 100D);
        order.verify(delivery).run();
        order.verify(stock).run();
        verifyNoInteractions(restore);
        verify(economy, never()).tryDeposit(any(), anyDouble());
        assertNotEquals(result.id(), buy().id());
    }

    @Test
    void refusedWithdrawalDoesNotDeliverOrUpdateStock() {
        when(economy.tryWithdraw(player, 100D)).thenReturn(new EconomyHook.EconomyOperationResult(false, "denied"));
        var result = buy();
        assertEquals(REJECTED, result.status());
        assertEquals(PAYMENT_FAILED, result.failureReason());
        verifyNoInteractions(delivery, restore, stock);
        verify(economy, never()).tryDeposit(any(), anyDouble());
    }

    @Test
    void thrownOrMissingPaymentResponsesReturnFailuresAndReleaseTheGuard() {
        when(economy.tryWithdraw(player, 100D)).thenThrow(new IllegalStateException("provider"));
        assertEquals(PAYMENT_FAILED, buy().failureReason());
        doReturn(null).when(economy).tryWithdraw(player, 100D);
        assertEquals(PAYMENT_FAILED, buy().failureReason());
        when(economy.tryWithdraw(player, 100D)).thenReturn(new EconomyHook.EconomyOperationResult(true, null));
        assertEquals(COMPLETED, buy().status());
    }

    @Test
    void partialDeliveryRestoresBeforeRefundAndNeverChangesStock() {
        doThrow(new IllegalStateException("partial delivery")).when(delivery).run();
        var result = buy();
        assertEquals(COMPENSATED, result.status());
        assertEquals(DELIVERY_FAILED, result.failureReason());
        var order = inOrder(economy, delivery, restore);
        order.verify(economy).tryWithdraw(player, 100D);
        order.verify(delivery).run();
        order.verify(restore).run();
        order.verify(economy).tryDeposit(player, 100D);
        verifyNoInteractions(stock);
    }

    @Test
    void failedInventoryRestoreDoesNotGiveMoneyAndPossiblyItemsBackTogether() {
        doThrow(new IllegalStateException("delivery")).when(delivery).run();
        doThrow(new IllegalStateException("restore")).when(restore).run();
        var result = buy();
        assertEquals(COMPENSATION_FAILED, result.status());
        assertFalse(result.completed());
        verify(economy, never()).tryDeposit(any(), anyDouble());
        verifyNoInteractions(stock);
        verify(plugin.getLogger()).log(eq(Level.SEVERE), contains(result.id().toString()));
    }

    @Test
    void refusedOrThrownRefundIsNotRetriedAndRequiresManualReconciliation() {
        doThrow(new IllegalStateException("delivery")).when(delivery).run();
        when(economy.tryDeposit(player, 100D)).thenReturn(new EconomyHook.EconomyOperationResult(false, "refund denied"));
        assertEquals(COMPENSATION_FAILED, buy().status());
        verify(economy).tryDeposit(player, 100D);
        when(economy.tryDeposit(player, 100D)).thenThrow(new IllegalStateException("refund exception"));
        assertEquals(COMPENSATION_FAILED, buy().status());
        verify(economy, times(2)).tryDeposit(player, 100D);
        verifyNoInteractions(stock);
    }

    @Test
    void stockFailureIsFinanciallyCompletedAndNeverRefundsOrRetries() {
        doThrow(new IllegalStateException("database")).when(stock).run();
        var result = buy();
        assertEquals(COMPLETED_WITH_ERRORS, result.status());
        assertEquals(STOCK_UPDATE_FAILED, result.failureReason());
        assertTrue(result.completed());
        verify(economy).tryWithdraw(player, 100D);
        verify(economy, never()).tryDeposit(any(), anyDouble());
        verifyNoInteractions(restore);
        String playerId = player.getUniqueId().toString();
        verify(plugin.getLogger()).log(eq(Level.SEVERE), contains(playerId));
    }

    @Test
    void saleRemovesBeforePaymentAndOnlyThenUpdatesStock() {
        assertEquals(COMPLETED, sell().status());
        var order = inOrder(storage, economy, stock);
        order.verify(storage).approveSale(Map.of(0, 2), 100D);
        order.verify(storage).removeItems(any(), eq(Map.of(0, 2)));
        order.verify(economy).tryDeposit(player, 100D);
        order.verify(stock).run();
        verify(storage, never()).restoreItems(any());
    }

    @Test
    void staleSourceOrCancelledApprovalIsNotPaidOrOverwritten() {
        when(storage.removeItems(any(), anyMap())).thenReturn(false);
        assertEquals(REJECTED, sell().status());
        assertEquals(DELIVERY_FAILED, sell().failureReason());
        when(storage.approveSale(anyMap(), anyDouble())).thenReturn(false);
        assertEquals(REJECTED, sell().status());
        verifyNoInteractions(stock);
        verify(economy, never()).tryWithdraw(any(), anyDouble());
        verify(economy, never()).tryDeposit(any(), anyDouble());
        verify(storage, never()).restoreItems(any());
    }

    @Test
    void approvalExceptionDoesNotOverwriteAnUnremovedSource() {
        when(storage.approveSale(anyMap(), anyDouble())).thenThrow(new IllegalStateException("listener"));
        assertEquals(REJECTED, sell().status());
        verify(storage, never()).removeItems(any(), any());
        verify(storage, never()).restoreItems(any());
        verifyNoInteractions(stock);
        verify(economy, never()).tryWithdraw(any(), anyDouble());
        verify(economy, never()).tryDeposit(any(), anyDouble());
    }

    @Test
    void removalExceptionRestoresBeforeAnyPayment() {
        when(storage.removeItems(any(), anyMap())).thenThrow(new IllegalStateException("partial removal"));
        assertEquals(COMPENSATED, sell().status());
        verify(storage).restoreItems(any());
        verifyNoInteractions(stock);
        verify(economy, never()).tryWithdraw(any(), anyDouble());
        verify(economy, never()).tryDeposit(any(), anyDouble());
    }

    @Test
    void saleDepositFailureRestoresSourceAndDoesNotUpdateCounts() {
        when(economy.tryDeposit(player, 100D)).thenReturn(new EconomyHook.EconomyOperationResult(false, "not ready"));
        var result = sell();
        assertEquals(COMPENSATED, result.status());
        assertEquals(PAYMENT_FAILED, result.failureReason());
        verify(storage).restoreItems(any());
        verify(economy).tryDeposit(player, 100D);
        verifyNoInteractions(stock);
    }

    @Test
    void saleRestoreFailureIsReportedWithoutRetryingPayment() {
        when(economy.tryDeposit(player, 100D)).thenReturn(new EconomyHook.EconomyOperationResult(false, "denied"));
        doThrow(new IllegalStateException("restore")).when(storage).restoreItems(any());
        var result = sell();
        assertEquals(COMPENSATION_FAILED, result.status());
        verify(economy).tryDeposit(player, 100D);
        verifyNoInteractions(stock);
    }

    @Test
    void invalidMoneyAndWrongThreadAreRejectedBeforeSideEffects() {
        for (double value : new double[]{0, -1, Double.NaN, Double.POSITIVE_INFINITY, 1e13}) {
            assertEquals(INVALID_REQUEST, TransactionService.purchase(plugin, player, context, value, delivery, restore, stock).failureReason());
        }
        bukkit.when(Bukkit::isPrimaryThread).thenReturn(false);
        assertEquals(WRONG_THREAD, buy().failureReason());
        verifyNoInteractions(economy, delivery, restore, stock);
    }

    @Test
    void reentrantTradeForSamePlayerCannotSettleInsideAnotherTrade() {
        AtomicReference<TransactionResult> nested = new AtomicReference<>();
        doAnswer(call -> { nested.set(sell()); return null; }).when(delivery).run();
        assertEquals(COMPLETED, buy().status());
        assertEquals(BUSY, nested.get().failureReason());
        verify(economy, never()).tryDeposit(any(), anyDouble());
        verifyNoInteractions(storage);
    }

    @Test
    void capacityAccountsForPreviouslyPlannedStacksAndUsesLongArithmetic() {
        ShopItem item = mock(ShopItem.class);
        ShopData shop = mock(ShopData.class);
        when(item.getUniqueKey()).thenReturn("stone");
        when(item.getLimit()).thenReturn(10);
        when(item.getGlobalLimit()).thenReturn(100);
        when(item.getSellAddsToStock()).thenReturn(true);
        when(plugin.getDataManager().getPlayerCount(player.getUniqueId(), "stone")).thenReturn(3);
        when(plugin.getDataManager().getGlobalCount("stone")).thenReturn(6);
        assertEquals(2, TransactionService.sellCapacity(plugin, player, shop, item, 64, 4));
        assertEquals(0, TransactionService.sellCapacity(plugin, player, shop, item, Integer.MAX_VALUE, Integer.MAX_VALUE));
        when(item.getAllowSellStockOverflow()).thenReturn(true);
        assertEquals(3, TransactionService.sellCapacity(plugin, player, shop, item, 64, 4));
    }

    @Test
    void pricingPreservesFormulaCampaignMultiplierBoundsAndBundleMath() {
        ShopItem item = mock(ShopItem.class);
        ShopData shop = mock(ShopData.class);
        when(item.getPrice()).thenReturn(10D);
        when(item.getSellPrice()).thenReturn(8D);
        when(item.getUniqueKey()).thenReturn("stone");
        when(item.isDynamicPricing()).thenReturn(true);
        when(item.getPriceChange()).thenReturn(2D);
        when(item.getSellPriceFormula()).thenReturn("dynamic + 3");
        when(plugin.getStateRepository().getGlobalCount("stone")).thenReturn(4);
        when(item.getMinPrice()).thenReturn(2D);
        when(item.getMaxPrice()).thenReturn(30D);
        try (var campaigns = mockStatic(CampaignUtil.class)) {
            campaigns.when(() -> CampaignUtil.getActiveSellMultiplier(shop, item)).thenReturn(2D);
            campaigns.when(() -> CampaignUtil.applySellCampaign(eq(shop), eq(item), anyDouble())).thenAnswer(call -> (double) call.getArgument(2) * 2);
            var price = TransactionService.price(plugin, shop, item, false, true, 1.5);
            assertEquals(57D, price.unit());
            assertEquals(12D, price.base());
            assertEquals(6D, price.minimum());
            assertEquals(90D, price.maximum());
            assertTrue(price.dynamic());
            assertEquals(28.5D, TransactionService.total(price.unit(), 2, false, 4));
            assertEquals(114D, TransactionService.total(price.unit(), 2, true, 4));
            assertEquals(28.5D, TransactionService.price(plugin, shop, item, false, false, 1.5).unit());
        }
    }

    @Test
    void eligibilityUsesShopAndItemPermissionsAndPlayerConditions() {
        ShopItem item = mock(ShopItem.class);
        ShopData shop = mock(ShopData.class);
        World world = mock(World.class);
        when(player.getWorld()).thenReturn(world);
        when(world.getName()).thenReturn("world");
        when(plugin.getMessages().getMessage(anyString())).thenReturn("denied %level%");
        when(shop.getPermission()).thenReturn("shop.private");
        assertFalse(TransactionService.eligibility(plugin, player, shop, item, null).allowed());
        when(player.hasPermission("shop.private")).thenReturn(true);
        when(item.getPermission()).thenReturn("item.private");
        assertFalse(TransactionService.eligibility(plugin, player, shop, item, null).allowed());
        when(player.hasPermission("item.private")).thenReturn(true);
        when(item.getMinPlayerLevel()).thenReturn(5);
        assertFalse(TransactionService.eligibility(plugin, player, shop, item, null).allowed());
        when(player.getLevel()).thenReturn(5);
        assertTrue(TransactionService.eligibility(plugin, player, shop, item, null).allowed());
    }

    @Test
    void countUpdatesKeepBuyAndSellStockDirections() {
        TransactionService.updateCounts(plugin, player, "buy", 2, true, true, 0, false);
        TransactionService.updateCounts(plugin, player, "sell", 3, false, false, 10, true);
        TransactionService.updateCounts(plugin, player, "no-stock", 4, false, false, 10, false);
        verify(plugin.getDataManager()).incrementGlobalCount("buy", 2);
        verify(plugin.getDataManager()).incrementGlobalCount("sell", -3);
        verify(plugin.getDataManager(), never()).incrementGlobalCount(eq("no-stock"), anyInt());
        verify(plugin.getDataManager()).incrementPlayerCount(player.getUniqueId(), "no-stock", 4);
    }

    @Test
    void purchaseAndPlayerLimitsCannotOverflowIntegerAddition() {
        when(plugin.getMessages().getMessage(anyString())).thenReturn("limit %current% %limit%");
        when(plugin.getDataManager().getPlayerCount(player.getUniqueId(), "stone")).thenReturn(Integer.MAX_VALUE - 1);
        when(plugin.getDataManager().getGlobalCount("stone")).thenReturn(Integer.MAX_VALUE - 1);
        assertFalse(TransactionService.playerLimit(plugin, player, "stone", 10, Integer.MAX_VALUE, true).allowed());
        assertFalse(TransactionService.playerLimit(plugin, player, "stone", 10, Integer.MAX_VALUE, false).allowed());
        assertFalse(TransactionService.purchaseStock(plugin, "stone", 10, Integer.MAX_VALUE).allowed());
        assertTrue(TransactionService.purchaseStock(plugin, "stone", 1, Integer.MAX_VALUE).allowed());
    }

    @Test
    void unavailableEconomyRejectsBeforeRemovalOrDelivery() {
        when(economy.isReady()).thenReturn(false);
        assertEquals(PAYMENT_FAILED, buy().failureReason());
        assertEquals(PAYMENT_FAILED, sell().failureReason());
        verifyNoInteractions(delivery, restore, stock, storage);
        verify(economy, never()).tryWithdraw(any(), anyDouble());
        verify(economy, never()).tryDeposit(any(), anyDouble());
    }
}
