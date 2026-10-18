package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ShopItemUtil;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.metadata.MetadataValue;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.*;

class PurchaseMenuSafetyTest {
    @Test
    void inflatedIronBlockPriceIsBlockedAgainstConfiguredBaseBeforeWithdrawal() throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        ShopItem item = mock(ShopItem.class);
        ShopData shop = mock(ShopData.class);
        YamlConfiguration config = new YamlConfiguration();
        config.set("economy-safety.anti-spike.max-base-multiplier", 1.5);
        config.set("economy-safety.cooldowns.enabled", false);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getMessages().getMessage(anyString())).thenReturn("blocked");
        when(plugin.formatCurrency(anyDouble())).thenReturn("money");
        when(plugin.getEconomy().isReady()).thenReturn(true);
        MetadataValue shopKey = mock(MetadataValue.class);
        when(shopKey.asString()).thenReturn("ores");
        when(player.hasMetadata("buy.shopKey")).thenReturn(true);
        when(player.getMetadata("buy.shopKey")).thenReturn(List.of(shopKey));
        when(plugin.getShopManager().getShop("ores")).thenReturn(shop);
        when(shop.getItemByUniqueKey("iron-block")).thenReturn(item);
        when(item.getUniqueKey()).thenReturn("iron-block");
        when(item.getPrice()).thenReturn(8600D);
        when(item.isDynamicPricing()).thenReturn(true);
        when(item.getPriceChange()).thenReturn(50D);
        when(plugin.getStateRepository().getGlobalCount("iron-block")).thenReturn(641);

        try (var singleton = mockStatic(ShopPlugin.class)) {
            singleton.when(ShopPlugin::getInstance).thenReturn(plugin);
            finalizePurchase(plugin, player, "iron-block", 71, 40650D);
        }
        verify(player).sendMessage("blocked");
        verify(plugin.getEconomy(), never()).tryWithdraw(any(), anyDouble());
        verify(plugin.getDataManager(), never()).incrementGlobalCount(anyString(), anyInt());
        verify(player, never()).getInventory();
        verify(plugin, never()).recordTransactions(any(java.util.UUID.class), any(), any(), anyList());
        verify(plugin, never()).refundFailedPurchase(any(), any(), anyDouble(), any());
    }

    @Test
    void fullInventoryIsRejectedBeforeWithdrawalCommandsAndStockChanges() throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        ItemStack template = mock(ItemStack.class);
        ItemStack occupied = mock(ItemStack.class);
        YamlConfiguration config = new YamlConfiguration();
        config.set("economy-safety.enabled", false);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getEconomy().isReady()).thenReturn(true);
        when(plugin.getMessages().getMessage("purchase-inventory-full")).thenReturn("inventory-full");
        ShopItem item = mock(ShopItem.class);
        ShopData shop = mock(ShopData.class);
        MetadataValue shopKey = mock(MetadataValue.class);
        when(shopKey.asString()).thenReturn("ores");
        when(player.hasMetadata("buy.shopKey")).thenReturn(true);
        when(player.getMetadata("buy.shopKey")).thenReturn(List.of(shopKey));
        when(plugin.getShopManager().getShop("ores")).thenReturn(shop);
        when(shop.getItemByUniqueKey("iron-block")).thenReturn(item);
        when(item.getPrice()).thenReturn(8600D);
        when(item.getItemStackData()).thenReturn("serialized-item");
        when(template.getMaxStackSize()).thenReturn(64);
        when(player.getInventory().getMaxStackSize()).thenReturn(64);
        when(occupied.getType()).thenReturn(Material.STONE);
        ItemStack[] contents = new ItemStack[36];
        java.util.Arrays.fill(contents, occupied);
        when(player.getInventory().getStorageContents()).thenReturn(contents);

        try (var singleton = mockStatic(ShopPlugin.class); var items = mockStatic(ShopItemUtil.class)) {
            singleton.when(ShopPlugin::getInstance).thenReturn(plugin);
            items.when(() -> ShopItemUtil.deserializeItemStack("serialized-item")).thenReturn(template);
            finalizePurchase(plugin, player, "iron-block", 71, 8600D);
        }
        verify(player).sendMessage("inventory-full");
        verify(plugin.getEconomy(), never()).tryWithdraw(any(), anyDouble());
        verify(plugin.getDataManager(), never()).incrementGlobalCount(anyString(), anyInt());
        verify(plugin.getDataManager(), never()).incrementPlayerCount(any(), anyString(), anyInt());
        verify(player.getInventory(), never()).addItem(any(ItemStack[].class));
        verify(plugin, never()).recordTransactions(any(java.util.UUID.class), any(), any(), anyList());
        verify(plugin, never()).refundFailedPurchase(any(), any(), anyDouble(), any());
    }

    private void finalizePurchase(ShopPlugin plugin, Player player, String itemKey, int amount, double price) throws Exception {
        var method = java.util.Arrays.stream(PurchaseMenu.class.getDeclaredMethods())
                .filter(candidate -> candidate.getName().equals("finalizePurchase")).findFirst().orElseThrow();
        method.setAccessible(true);
        method.invoke(new PurchaseMenu(plugin), player, Material.IRON_BLOCK, amount, price, 1,
                null, null, null, 0, null, null, null,
                false, false, false, false, false, true,
                itemKey, 0, 0, true, 0D, 0D, 50D,
                List.of("say purchased"), "console", false, "");
    }
}
