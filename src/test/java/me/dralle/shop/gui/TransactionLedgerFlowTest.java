package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.data.RefundRecovery;
import me.dralle.shop.data.TransactionEntry;
import me.dralle.shop.economy.EconomyHook;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.mockito.Mockito.*;

class TransactionLedgerFlowTest {
    @TempDir java.nio.file.Path folder;
    @ParameterizedTest
    @ValueSource(strings = {"success", "payment-failure", "delivery-failure", "refund-failure", "ambiguous-refund"})
    void purchaseRecordsOnlyAfterPaymentAndDelivery(String outcome) throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        ItemStack template = mock(ItemStack.class);
        ItemStack delivered = mock(ItemStack.class);
        YamlConfiguration config = new YamlConfiguration();
        config.set("economy-safety.enabled", false);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getEconomy().isReady()).thenReturn(true);
        when(plugin.getEconomy().getBalance(player)).thenReturn(2000D);
        when(plugin.getEconomy().tryWithdraw(player, 1000D)).thenReturn(new EconomyHook.EconomyOperationResult(!outcome.equals("payment-failure"), "failure"));
        when(plugin.getEconomy().tryDeposit(player, 1000D)).thenReturn(new EconomyHook.EconomyOperationResult(
                !outcome.equals("refund-failure") && !outcome.equals("ambiguous-refund"), "refund result", outcome.equals("ambiguous-refund")));
        when(plugin.getMessages().getMessage(anyString())).thenReturn("message %amount% %item% %price%");
        when(plugin.formatPrice(anyDouble())).thenReturn("money");
        when(player.getName()).thenReturn("Alice");
        when(player.getInventory().getStorageContents()).thenReturn(new ItemStack[36]);
        when(player.getInventory().getContents()).thenReturn(new ItemStack[36]);
        when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        when(player.getInventory().getMaxStackSize()).thenReturn(64);
        when(template.getMaxStackSize()).thenReturn(64);
        when(template.clone()).thenReturn(delivered);
        when(player.getInventory().addItem(delivered)).thenReturn(new HashMap<>());
        if (outcome.equals("delivery-failure") || outcome.contains("refund")) when(player.getInventory().addItem(delivered)).thenThrow(new IllegalStateException("Delivery failed"));

        try (var queue = new RefundRecovery(folder.resolve("refunds.db").toFile());
             var singleton = mockStatic(ShopPlugin.class); var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS);
             var menu = mockStatic(PurchaseMenu.class, invocation -> switch (invocation.getMethod().getName()) {
                 case "open" -> null;
                 case "createDeliveryTemplate" -> template;
                 default -> invocation.callRealMethod();
             })) {
            singleton.when(ShopPlugin::getInstance).thenReturn(plugin);
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
            when(plugin.refundFailedPurchase(any(UUID.class), eq(player), eq(1000D), anyString())).thenAnswer(invocation ->
                    queue.automatic(invocation.getArgument(0), player, 1000D, invocation.getArgument(3), plugin.getEconomy()));
            var finalize = java.util.Arrays.stream(PurchaseMenu.class.getDeclaredMethods())
                    .filter(method -> method.getName().equals("finalizePurchase")).findFirst().orElseThrow();
            finalize.setAccessible(true);
            finalize.invoke(new PurchaseMenu(plugin), player, Material.GOLDEN_APPLE, 4, 1000D, 4,
                    null, null, null, 0, null, null, null,
                    false, false, false, false, false, false,
                    "apples", 0, 0, false, 0D, 0D, 0D, List.of(), "console", false, "");

            if (outcome.equals("success")) {
                var order = inOrder(player.getInventory(), plugin);
                order.verify(player.getInventory()).addItem(delivered);
                order.verify(plugin).recordTransactions(any(UUID.class), eq(player), eq(TransactionEntry.Type.PURCHASE),
                        eq(List.of(new TransactionEntry.Line(null, "apples", 4, 1000D))));
                verify(plugin, times(1)).recordTransactions(any(UUID.class), any(), any(), anyList());
                org.junit.jupiter.api.Assertions.assertTrue(queue.list(1).isEmpty());
            } else {
                verify(plugin, never()).recordTransactions(any(UUID.class), any(), any(), anyList());
                if (!outcome.equals("payment-failure")) {
                    verify(plugin.getEconomy()).tryDeposit(player, 1000D);
                    var id = org.mockito.ArgumentCaptor.forClass(UUID.class);
                    verify(plugin).refundFailedPurchase(id.capture(), eq(player), eq(1000D), contains("Delivery failed"));
                    var entry = queue.get(id.getValue());
                    org.junit.jupiter.api.Assertions.assertEquals(player.getUniqueId(), entry.playerId());
                    org.junit.jupiter.api.Assertions.assertEquals(1000D, entry.amount());
                    org.junit.jupiter.api.Assertions.assertEquals(outcome.equals("delivery-failure") ? RefundRecovery.Status.RECOVERED
                            : outcome.equals("refund-failure") ? RefundRecovery.Status.PENDING : RefundRecovery.Status.REVIEW, entry.status());
                    if (!outcome.equals("delivery-failure")) verify(player).sendMessage(contains(id.getValue().toString()));
                } else org.junit.jupiter.api.Assertions.assertTrue(queue.list(1).isEmpty());
            }
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void individualSaleRecordsOnlyAfterSuccessfulDepositAndRemoval(boolean succeeds) throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        YamlConfiguration config = new YamlConfiguration();
        config.set("economy-safety.enabled", false);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getEconomy().isReady()).thenReturn(true);
        when(plugin.getEconomy().tryDeposit(player, 400D)).thenReturn(new EconomyHook.EconomyOperationResult(succeeds, "failure"));
        when(plugin.getMessages().getMessage(anyString())).thenReturn("message %amount% %item% %price%");
        when(plugin.formatCurrency(anyDouble())).thenReturn("money");
        when(player.getInventory().getSize()).thenReturn(1);
        when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        ItemStack stack = mock(ItemStack.class);
        when(stack.getType()).thenReturn(Material.GOLDEN_APPLE);
        AtomicInteger amount = new AtomicInteger(4);
        when(stack.getAmount()).thenAnswer(invocation -> amount.get());
        doAnswer(invocation -> { amount.set(invocation.getArgument(0)); return null; }).when(stack).setAmount(anyInt());
        when(stack.clone()).thenReturn(stack);
        when(stack.isSimilar(stack)).thenReturn(true);
        when(player.getInventory().getItem(0)).thenReturn(stack);
        when(player.getInventory().getContents()).thenReturn(new ItemStack[]{stack});

        try (var singleton = mockStatic(ShopPlugin.class); var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS);
             var menu = mockStatic(SellMenu.class, invocation -> invocation.getMethod().getName().equals("open") ? null : invocation.callRealMethod())) {
            singleton.when(ShopPlugin::getInstance).thenReturn(plugin);
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
            var sell = java.util.Arrays.stream(SellMenu.class.getDeclaredMethods())
                    .filter(method -> method.getName().equals("sellItems")).findFirst().orElseThrow();
            sell.setAccessible(true);
            sell.invoke(new SellMenu(plugin), player, Material.GOLDEN_APPLE, null, null, null, null, 4, 4, 400D, 4,
                    null, null, false, false, false, false, false, "apples", 0, 0, false, 0D, 0D, 0D, null, "");
            if (succeeds) {
                var order = inOrder(player.getInventory(), plugin);
                order.verify(player.getInventory()).setItem(0, null);
                order.verify(plugin).recordTransactions(any(UUID.class), eq(player), eq(TransactionEntry.Type.SALE),
                        eq(List.of(new TransactionEntry.Line(null, "apples", 4, 400D))));
            } else verify(plugin, never()).recordTransactions(any(UUID.class), any(), any(), anyList());
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void bulkSaleRecordsOnceAfterInventoryRemoval(boolean succeeds) throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        Inventory inventory = mock(Inventory.class);
        ItemStack stack = mock(ItemStack.class);
        var item = mock(me.dralle.shop.model.ShopItem.class);
        var config = new YamlConfiguration();
        config.set("economy-safety.enabled", false);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getMenuManager().getBulkSellMenuConfig().getInt("buttons.confirm.slot", 49)).thenReturn(49);
        when(plugin.getMessages().getMessage(anyString())).thenReturn("summary %amount% %price%");
        when(plugin.formatCurrency(anyDouble())).thenReturn("money");
        when(inventory.getSize()).thenReturn(1);
        when(inventory.getItem(0)).thenReturn(stack);
        when(inventory.getStorageContents()).thenReturn(new ItemStack[]{stack});
        when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        when(plugin.getEconomy().isReady()).thenReturn(true);
        when(stack.getType()).thenReturn(Material.STONE);
        AtomicInteger amount = new AtomicInteger(4);
        when(stack.getAmount()).thenAnswer(invocation -> amount.get());
        doAnswer(invocation -> { amount.set(invocation.getArgument(0)); return null; }).when(stack).setAmount(anyInt());
        when(stack.clone()).thenReturn(stack);
        when(stack.isSimilar(stack)).thenReturn(true);
        when(item.getUniqueKey()).thenReturn("stone");
        when(item.getSellPrice()).thenReturn(100D);
        when(item.getAmount()).thenReturn(4);
        when(item.calculateSellTotal(100D, 4)).thenReturn(100D);
        when(plugin.getShopManager().getBestSellInfo(player, stack)).thenReturn(new me.dralle.shop.ShopManager.SellInfo(item, "blocks"));
        when(plugin.getEconomy().tryDeposit(player, 100D)).thenReturn(new EconomyHook.EconomyOperationResult(succeeds, "failure"));

        try (var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS); var campaigns = mockStatic(me.dralle.shop.util.CampaignUtil.class)) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
            campaigns.when(() -> me.dralle.shop.util.CampaignUtil.applySellCampaign(any(), eq(item), anyDouble())).thenAnswer(invocation -> invocation.getArgument(2));
            var sell = BulkSellMenu.class.getDeclaredMethod("processSell", Player.class, Inventory.class);
            sell.setAccessible(true);
            sell.invoke(new BulkSellMenu(plugin), player, inventory);
            if (succeeds) {
                var order = inOrder(inventory, plugin);
                order.verify(inventory).setItem(0, null);
                order.verify(plugin).recordTransactions(any(UUID.class), eq(player), eq(TransactionEntry.Type.SALE), argThat(lines ->
                        lines.size() == 1 && lines.getFirst().quantity() == 4 && lines.getFirst().total() == 100D
                                && lines.getFirst().shop().equals("blocks") && lines.getFirst().item().equals("stone")));
                verify(plugin, times(1)).recordTransactions(any(UUID.class), any(), any(), anyList());
            } else {
                verify(plugin, never()).recordTransactions(any(UUID.class), any(), any(), anyList());
                verify(inventory).setStorageContents(any());
            }
        }
    }
}
