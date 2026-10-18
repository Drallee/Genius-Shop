package me.dralle.shop.gui;

import me.dralle.shop.ShopManager;
import me.dralle.shop.ShopPlugin;
import me.dralle.shop.economy.EconomyHook;
import me.dralle.shop.model.ShopItem;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TransactionEntryPointsTest {
    private static ItemStack stack(int count) {
        ItemStack stack = mock(ItemStack.class);
        AtomicInteger amount = new AtomicInteger(count);
        when(stack.getType()).thenReturn(Material.STONE);
        when(stack.getAmount()).thenAnswer(call -> amount.get());
        doAnswer(call -> { amount.set(call.getArgument(0)); return null; }).when(stack).setAmount(anyInt());
        when(stack.clone()).thenAnswer(call -> stack(amount.get()));
        when(stack.isSimilar(any())).thenAnswer(call -> ((ItemStack) call.getArgument(0)).getType() == Material.STONE);
        return stack;
    }

    private static ShopPlugin plugin(Player player) {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        var config = new YamlConfiguration();
        config.set("economy-safety.enabled", false);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getMessages().getMessage(anyString())).thenAnswer(call -> call.getArgument(0));
        when(plugin.formatCurrency(anyDouble())).thenReturn("money");
        when(plugin.getEconomy().isReady()).thenReturn(true);
        when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        World world = mock(World.class);
        when(world.getName()).thenReturn("world");
        when(player.getWorld()).thenReturn(world);
        return plugin;
    }

    @Test
    void bulkMenuSharesOneLimitAcrossStacksAndRemovesBeforePayment() throws Exception {
        bulk(true, false);
    }

    @Test
    void bulkMenuRefusedPaymentRestoresEverySlotAndLeavesCountsAlone() throws Exception {
        bulk(false, false);
    }

    @Test
    void bulkMenuPartialRemovalExceptionRestoresWithoutPaying() throws Exception {
        bulk(false, true);
    }

    private void bulk(boolean paid, boolean removalFails) throws Exception {
        Player player = mock(Player.class);
        when(player.spigot()).thenReturn(mock(Player.Spigot.class));
        ShopPlugin plugin = plugin(player);
        Inventory inventory = mock(Inventory.class);
        ItemStack[] contents = {stack(4), stack(4)};
        when(inventory.getSize()).thenReturn(2);
        when(inventory.getItem(anyInt())).thenAnswer(call -> contents[(int) call.getArgument(0)]);
        when(inventory.getStorageContents()).thenAnswer(call -> contents.clone());
        doAnswer(call -> {
            int slot = call.getArgument(0);
            if (removalFails && slot == 1) throw new IllegalStateException("partial removal");
            contents[slot] = call.getArgument(1);
            return null;
        }).when(inventory).setItem(anyInt(), any());
        doAnswer(call -> { System.arraycopy(call.getArgument(0), 0, contents, 0, 2); return null; }).when(inventory).setStorageContents(any());
        when(plugin.getMenuManager().getBulkSellMenuConfig().getInt("buttons.confirm.slot", 49)).thenReturn(49);
        ShopItem item = mock(ShopItem.class);
        when(item.getMaterial()).thenReturn(Material.STONE);
        when(item.getUniqueKey()).thenReturn("stone");
        when(item.getLimit()).thenReturn(5);
        when(item.getSellPrice()).thenReturn(10D);
        when(item.calculateSellTotal(anyDouble(), anyInt())).thenAnswer(call -> (double) call.getArgument(0) * (int) call.getArgument(1));
        when(plugin.getShopManager().getBestSellInfo(eq(player), any())).thenReturn(new ShopManager.SellInfo(item, "blocks"));
        when(plugin.getEconomy().tryDeposit(player, 50D)).thenAnswer(call -> {
            assertNull(contents[0], "Items must be removed before payment");
            assertEquals(3, contents[1].getAmount());
            return new EconomyHook.EconomyOperationResult(paid, "test refusal");
        });
        try (var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS)) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
            var process = BulkSellMenu.class.getDeclaredMethod("processSell", Player.class, Inventory.class);
            process.setAccessible(true);
            process.invoke(new BulkSellMenu(plugin), player, inventory);
            if (paid) {
                assertNull(contents[0]);
                assertEquals(3, contents[1].getAmount());
                verify(plugin.getDataManager()).incrementPlayerCount(player.getUniqueId(), "stone", 4);
                verify(plugin.getDataManager()).incrementPlayerCount(player.getUniqueId(), "stone", 1);
                assertEquals(5, plugin.itemsSold);
            } else {
                assertEquals(4, contents[0].getAmount());
                assertEquals(4, contents[1].getAmount());
                verify(plugin.getDataManager(), never()).incrementPlayerCount(any(), anyString(), anyInt());
                bukkit.verify(Bukkit::getPluginManager, never());
            }
            verify(plugin.getEconomy(), times(removalFails ? 0 : 1)).tryDeposit(player, 50D);
        }
    }

    @Test
    void sellMenuWithoutEconomyRestoresItemsInsteadOfDestroyingThem() throws Exception {
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        ShopPlugin plugin = plugin(player);
        EconomyHook economy = mock(EconomyHook.class, CALLS_REAL_METHODS);
        when(plugin.getEconomy()).thenReturn(economy);
        ItemStack[] contents = {stack(4)};
        var inventory = player.getInventory();
        when(inventory.getContents()).thenAnswer(call -> contents.clone());
        when(inventory.getItem(0)).thenAnswer(call -> contents[0]);
        doAnswer(call -> { contents[0] = call.getArgument(1); return null; }).when(inventory).setItem(eq(0), any());
        doAnswer(call -> { contents[0] = ((ItemStack[]) call.getArgument(0))[0]; return null; }).when(inventory).setContents(any());
        try (var bukkit = mockStatic(Bukkit.class); var singleton = mockStatic(ShopPlugin.class)) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
            singleton.when(ShopPlugin::getInstance).thenReturn(plugin);
            var sell = java.util.Arrays.stream(SellMenu.class.getDeclaredMethods())
                    .filter(method -> method.getName().equals("sellItems")).findFirst().orElseThrow();
            sell.setAccessible(true);
            sell.invoke(new SellMenu(plugin), player, Material.STONE, null, null, null, null, 4, 2, 10D, 1,
                    null, null, false, false, false, false, true, null, 0, 0, false, 0D, 0D, 0D, null, "");
            assertEquals(4, contents[0].getAmount());
            verify(economy, never()).tryDeposit(player, 20D);
            verify(inventory, never()).setItem(anyInt(), any());
            verify(inventory, never()).setContents(any());
            verify(plugin.getDataManager(), never()).incrementPlayerCount(any(), anyString(), anyInt());
            verify(player).sendMessage("economy-error-sell");
        }
    }

    @Test
    void commandPurchaseFailureUsesSharedInventoryRestoreAndRefund() throws Exception {
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        ShopPlugin plugin = plugin(player);
        ItemStack original = stack(3);
        when(player.getInventory().getContents()).thenReturn(new ItemStack[]{original});
        when(plugin.getEconomy().isReady()).thenReturn(true);
        when(plugin.getEconomy().getBalance(player)).thenReturn(1000D);
        when(plugin.getEconomy().tryWithdraw(player, 20D)).thenReturn(new EconomyHook.EconomyOperationResult(true, null));
        when(plugin.getEconomy().tryDeposit(player, 20D)).thenReturn(new EconomyHook.EconomyOperationResult(true, null));
        when(plugin.refundFailedPurchase(any(UUID.class), eq(player), eq(20D), anyString()))
                .thenAnswer(call -> plugin.getEconomy().tryDeposit(player, 20D));
        try (var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS); var singleton = mockStatic(ShopPlugin.class)) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
            bukkit.when(() -> Bukkit.dispatchCommand(any(), eq("broken"))).thenThrow(new IllegalStateException("command failure"));
            singleton.when(ShopPlugin::getInstance).thenReturn(plugin);
            var purchase = java.util.Arrays.stream(PurchaseMenu.class.getDeclaredMethods())
                    .filter(method -> method.getName().equals("finalizePurchase")).findFirst().orElseThrow();
            purchase.setAccessible(true);
            purchase.invoke(new PurchaseMenu(plugin), player, Material.STONE, 2, 10D, 1,
                    null, null, null, 0, null, null, null, false, false, false, false, false,
                    true, null, 0, 0, false, 0D, 0D, 0D, List.of("broken"), "console", true, "");
            verify(plugin.getEconomy()).tryWithdraw(player, 20D);
            verify(plugin.getEconomy()).tryDeposit(player, 20D);
            verify(player.getInventory()).setContents(argThat(restored -> restored.length == 1 && restored[0].getAmount() == 3));
            verify(plugin.getDataManager(), never()).incrementPlayerCount(any(), anyString(), anyInt());
            verify(player).sendMessage("purchase-rollback-failed");
        }
    }
}
