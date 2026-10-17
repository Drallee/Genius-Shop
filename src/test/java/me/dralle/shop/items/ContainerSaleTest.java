package me.dralle.shop.items;

import me.dralle.shop.ShopManager;
import me.dralle.shop.ShopPlugin;
import me.dralle.shop.commands.CustomSellAllService;
import me.dralle.shop.economy.EconomyHook;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.CampaignUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.*;

class ContainerSaleTest {
    @Test
    void multiplierStacksWithCampaignsAndCountsActualItems() {
        sale(true, true, 420D);
    }

    @Test
    void disablingCampaignsStillUsesDynamicPricesAndFormulas() {
        sale(false, true, 210D);
    }

    @Test
    void failedPaymentRestoresContainerWithoutUpdatingStockOrLimits() {
        sale(true, false, 420D);
    }

    private void sale(boolean campaigns, boolean depositSucceeds, double expected) {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        Player player = mock(Player.class);
        Inventory inventory = mock(Inventory.class);
        ShopItem item = mock(ShopItem.class);
        ItemStack stack = mock(ItemStack.class);
        ItemStack original = mock(ItemStack.class);
        AtomicInteger amount = new AtomicInteger(3);
        ItemStack[] contents = {stack};
        YamlConfiguration config = new YamlConfiguration();
        config.set("economy-safety.enabled", false);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getEconomy().isReady()).thenReturn(true);
        when(plugin.getMessages().getMessage(anyString())).thenReturn("summary %amount% %price%");
        when(plugin.formatCurrency(anyDouble())).thenAnswer(invocation -> String.valueOf((double) invocation.getArgument(0)));
        when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        org.bukkit.World world = mock(org.bukkit.World.class);
        when(world.getName()).thenReturn("world");
        when(player.getWorld()).thenReturn(world);
        when(inventory.getStorageContents()).thenAnswer(invocation -> contents.clone());
        when(inventory.getItem(0)).thenAnswer(invocation -> contents[0]);
        doAnswer(invocation -> { contents[0] = invocation.getArgument(1); return null; }).when(inventory).setItem(eq(0), any());
        doAnswer(invocation -> { contents[0] = ((ItemStack[]) invocation.getArgument(0))[0]; return null; }).when(inventory).setStorageContents(any());
        when(stack.getType()).thenReturn(Material.STONE);
        when(stack.getAmount()).thenAnswer(invocation -> amount.get());
        doAnswer(invocation -> { amount.set(invocation.getArgument(0)); return null; }).when(stack).setAmount(anyInt());
        when(stack.clone()).thenReturn(original);
        when(original.getAmount()).thenReturn(3);
        when(original.clone()).thenReturn(original);
        when(stack.isSimilar(original)).thenReturn(true);
        when(item.getMaterial()).thenReturn(Material.STONE);
        when(item.getUniqueKey()).thenReturn("stone");
        when(item.getSellPrice()).thenReturn(40D);
        when(item.getAmount()).thenReturn(1);
        when(item.isDynamicPricing()).thenReturn(true);
        when(item.getPriceChange()).thenReturn(2D);
        when(item.getSellPriceFormula()).thenReturn("dynamic + 10");
        when(item.getLimit()).thenReturn(2);
        when(plugin.getStateRepository().getGlobalCount("stone")).thenReturn(10);
        when(item.calculateSellTotal(anyDouble(), anyInt())).thenAnswer(invocation ->
                (double) invocation.getArgument(0) * (int) invocation.getArgument(1));
        when(plugin.getShopManager().getSellInfos(player, stack, null)).thenReturn(List.of(new ShopManager.SellInfo(item, "blocks")));
        when(plugin.getEconomy().tryDeposit(player, expected)).thenReturn(new EconomyHook.EconomyOperationResult(depositSucceeds, "test failure"));

        try (var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS); var campaign = mockStatic(CampaignUtil.class)) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
            campaign.when(() -> CampaignUtil.applySellCampaign(any(), eq(item), anyDouble()))
                    .thenAnswer(invocation -> (double) invocation.getArgument(2) * 2D);
            campaign.when(() -> CampaignUtil.getActiveSellMultiplier(any(), eq(item))).thenReturn(2D);

            assertEquals(depositSucceeds, new CustomSellAllService(plugin).sellContainer(player, inventory, null, 1.5, campaigns, "wand"));

            verify(plugin.getEconomy()).tryDeposit(player, expected);
            if (depositSucceeds) {
                assertEquals(1, amount.get());
                verify(plugin.getDataManager()).incrementPlayerCount(player.getUniqueId(), "stone", 2);
                verify(plugin.getDataManager()).incrementGlobalCount("stone", -2);
                assertEquals(2, plugin.itemsSold);
            } else {
                assertSame(original, contents[0]);
                assertEquals(3, contents[0].getAmount());
                verify(plugin.getDataManager(), never()).incrementPlayerCount(any(), anyString(), anyInt());
                verify(plugin.getDataManager(), never()).incrementGlobalCount(anyString(), anyInt());
                assertEquals(0, plugin.itemsSold);
            }
            verify(player, never()).getInventory();
            if (!campaigns) campaign.verifyNoInteractions();
        }
    }
}
