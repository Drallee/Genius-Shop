package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.SmartSpawnerHook;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.plugin.Plugin;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SmartSpawnerPurchaseTest {
    @Test
    void nativePurchasePreservesProviderItemAndSatisfiesExplicitResaleMetadata() {
        ShopPlugin plugin = mock(ShopPlugin.class);
        Plugin providerPlugin = mock(Plugin.class);
        ItemStack nativeItem = mock(ItemStack.class);
        ItemMeta metadata = mock(ItemMeta.class);
        var config = new YamlConfiguration();
        when(plugin.getConfig()).thenReturn(config);
        when(providerPlugin.isEnabled()).thenReturn(true);
        when(nativeItem.getType()).thenReturn(Material.SPAWNER);
        when(nativeItem.hasItemMeta()).thenReturn(true);
        when(nativeItem.getItemMeta()).thenReturn(metadata);
        when(metadata.hasDisplayName()).thenReturn(true);
        when(metadata.hasLore()).thenReturn(true);
        AtomicReference<String> name = new AtomicReference<>("Native Diamond Spawner");
        AtomicReference<List<String>> lore = new AtomicReference<>(List.of("Native description"));
        when(metadata.getDisplayName()).thenAnswer(call -> name.get());
        when(metadata.getLore()).thenAnswer(call -> lore.get());
        doAnswer(call -> { name.set(call.getArgument(0)); return null; }).when(metadata).setDisplayName(anyString());
        doAnswer(call -> { lore.set(call.getArgument(0)); return null; }).when(metadata).setLore(anyList());
        try (var singleton = mockStatic(ShopPlugin.class); var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS);
             var provider = mockStatic(SmartSpawnerHook.class)) {
            singleton.when(ShopPlugin::getInstance).thenReturn(plugin);
            when(Bukkit.getPluginManager().isPluginEnabled("SmartSpawner")).thenReturn(true);
            when(Bukkit.getPluginManager().getPlugin("SmartSpawner")).thenReturn(providerPlugin);
            provider.when(() -> SmartSpawnerHook.createSpawnerItem(providerPlugin, null, "DIAMOND")).thenReturn(nativeItem);
            provider.when(() -> SmartSpawnerHook.identify(nativeItem)).thenReturn(new SmartSpawnerHook.Identity(true, "ITEM:DIAMOND"));
            ItemStack delivered = PurchaseMenu.createDeliveryTemplate(Material.SPAWNER, null, "DIAMOND", null, 0,
                    "&6Diamond Spawner", List.of("&7Produces diamonds"), Map.of(), true, true, false, null, null);
            assertSame(nativeItem, delivered);
            verify(nativeItem).setItemMeta(metadata);
            ShopItem offer = mock(ShopItem.class);
            when(offer.getMaterial()).thenReturn(Material.SPAWNER);
            when(offer.isSpawner()).thenReturn(true);
            when(offer.getSpawnerItem()).thenReturn("DIAMOND");
            when(offer.requiresName()).thenReturn(true);
            when(offer.requiresLore()).thenReturn(true);
            when(offer.getName()).thenReturn("&6Diamond Spawner");
            when(offer.getLore()).thenReturn(List.of("&7Produces diamonds"));
            assertTrue(ShopItemUtil.isSameItem(delivered, offer));
        }
    }
}
