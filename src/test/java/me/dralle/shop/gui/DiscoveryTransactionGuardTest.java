package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.discovery.ItemDiscoveryService;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.metadata.MetadataValue;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.mockito.Mockito.*;

class DiscoveryTransactionGuardTest {
    @Test void revokedShopAccessCannotWithdrawOrDeliverThroughAnAlreadyOpenPurchaseMenu() throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        Player player = mock(Player.class);
        when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        when(player.hasPermission("geniusshop.use")).thenReturn(true);
        when(plugin.getMessages().getMessage("discovery.unavailable")).thenReturn("unavailable");
        ShopItem item = mock(ShopItem.class);
        when(item.getSlot()).thenReturn(0);
        when(item.getMaterial()).thenReturn(Material.IRON_BLOCK);
        when(item.getUniqueKey()).thenReturn("iron-block");
        ShopData shop = mock(ShopData.class);
        when(shop.getKey()).thenReturn("ores");
        when(shop.getPermission()).thenReturn("vip");
        when(shop.getItems()).thenReturn(List.of(item));
        when(plugin.getShopManager().getShop("ores")).thenReturn(shop);
        ItemDiscoveryService service = new ItemDiscoveryService(plugin);
        when(plugin.getItemDiscovery()).thenReturn(service);
        service.bindTrade(player, "buy", "ores", item);
        MetadataValue key = mock(MetadataValue.class);
        when(key.asString()).thenReturn("ores");
        when(player.hasMetadata("buy.shopKey")).thenReturn(true);
        when(player.getMetadata("buy.shopKey")).thenReturn(List.of(key));
        var method = Arrays.stream(PurchaseMenu.class.getDeclaredMethods()).filter(candidate -> candidate.getName().equals("finalizePurchase")).findFirst().orElseThrow();
        method.setAccessible(true);
        try (var singleton = mockStatic(ShopPlugin.class)) {
            singleton.when(ShopPlugin::getInstance).thenReturn(plugin);
            method.invoke(new PurchaseMenu(plugin), player, Material.IRON_BLOCK, 1, 10D, 1,
                    null, null, null, 0, null, null, null, false, false, false, false, false, true,
                    "iron-block", 0, 0, false, 0D, 0D, 0D, List.of(), "console", false, "");
        }
        verify(player).sendMessage("unavailable");
        verify(player).closeInventory();
        verify(plugin, never()).getEconomy();
        verify(player, never()).getInventory();
        verify(plugin, never()).getDataManager();
    }

    @Test void removedItemCannotDepositOrRemoveInventoryThroughAnAlreadyOpenSellMenu() throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        Player player = mock(Player.class);
        when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        when(player.hasPermission("geniusshop.use")).thenReturn(true);
        when(plugin.getMessages().getMessage("discovery.unavailable")).thenReturn("unavailable");
        ShopItem item = mock(ShopItem.class);
        when(item.getSlot()).thenReturn(0);
        when(item.getMaterial()).thenReturn(Material.IRON_BLOCK);
        when(item.getUniqueKey()).thenReturn("iron-block");
        ShopData shop = mock(ShopData.class);
        when(shop.getKey()).thenReturn("ores");
        when(shop.getItems()).thenReturn(List.of(item));
        when(plugin.getShopManager().getShop("ores")).thenReturn(shop);
        ItemDiscoveryService service = new ItemDiscoveryService(plugin);
        when(plugin.getItemDiscovery()).thenReturn(service);
        service.bindTrade(player, "sell", "ores", item);
        when(plugin.getShopManager().getShop("ores")).thenReturn(null);
        var method = Arrays.stream(SellMenu.class.getDeclaredMethods()).filter(candidate -> candidate.getName().equals("sellItems")).findFirst().orElseThrow();
        method.setAccessible(true);
        try (var singleton = mockStatic(ShopPlugin.class)) {
            singleton.when(ShopPlugin::getInstance).thenReturn(plugin);
            method.invoke(new SellMenu(plugin), player, Material.IRON_BLOCK, null, null, null,
                    Map.of(), 64, 1, 10D, 1, null, List.of(), false, false, false, false, true,
                    "iron-block", 0, 0, false, 0D, 0D, 0D, "ores", "");
        }
        verify(player).sendMessage("unavailable");
        verify(player).closeInventory();
        verify(plugin, never()).getEconomy();
        verify(player, never()).getInventory();
        verify(plugin, never()).getDataManager();
    }
}
