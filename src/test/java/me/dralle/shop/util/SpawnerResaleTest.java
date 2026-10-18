package me.dralle.shop.util;

import org.bukkit.Material;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.BlockStateMeta;
import org.bukkit.block.CreatureSpawner;
import org.bukkit.entity.EntityType;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.gui.SellMenu;
import org.bukkit.entity.Player;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SpawnerResaleTest {
    @Test
    void sellMenuCountsAndRemovesOnlyTheSelectedNativeItemSpawner() throws Exception {
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        ItemStack diamond = mock(ItemStack.class), coal = mock(ItemStack.class);
        for (ItemStack item : List.of(diamond, coal)) {
            when(item.getType()).thenReturn(Material.SPAWNER);
            when(item.hasItemMeta()).thenReturn(true);
        }
        when(diamond.getAmount()).thenReturn(2);
        when(coal.getAmount()).thenReturn(3);
        ItemStack[] contents = {diamond, coal};
        when(player.getInventory().getContents()).thenReturn(contents);
        try (var provider = mockStatic(SmartSpawnerHook.class)) {
            provider.when(() -> SmartSpawnerHook.identify(diamond)).thenReturn(new SmartSpawnerHook.Identity(true, "ITEM:DIAMOND"));
            provider.when(() -> SmartSpawnerHook.identify(coal)).thenReturn(new SmartSpawnerHook.Identity(true, "ITEM:COAL"));
            var count = SellMenu.class.getDeclaredMethod("countPlayerItems", Player.class, Material.class,
                    String.class, String.class, String.class, Map.class, String.class, List.class, boolean.class, boolean.class);
            count.setAccessible(true);
            assertEquals(2, count.invoke(null, player, Material.SPAWNER, null, "DIAMOND", null, null, null, null, false, false));
            var quantities = SellMenu.class.getDeclaredMethod("matchingQuantities", ItemStack[].class, Material.class,
                    String.class, String.class, String.class, Map.class, int.class, String.class, List.class, boolean.class, boolean.class);
            quantities.setAccessible(true);
            assertEquals(Map.of(0, 2), quantities.invoke(null, contents, Material.SPAWNER, null, "DIAMOND", null, null, 2, null, null, false, false));
        }
    }

    @Test
    void nativeDiamondItemSpawnerResellsWithoutMatchingOtherTypes() {
        ItemStack item = mock(ItemStack.class);
        when(item.getType()).thenReturn(Material.SPAWNER);
        when(item.hasItemMeta()).thenReturn(true);
        when(item.getItemMeta()).thenReturn(mock(ItemMeta.class));
        ShopItem offer = mock(ShopItem.class);
        when(offer.getMaterial()).thenReturn(Material.SPAWNER);
        when(offer.isSpawner()).thenReturn(true);
        when(offer.getSpawnerItem()).thenReturn("DIAMOND");
        try (var provider = mockStatic(SmartSpawnerHook.class)) {
            provider.when(() -> SmartSpawnerHook.identify(item)).thenReturn(new SmartSpawnerHook.Identity(true, "ITEM:DIAMOND"));
            assertTrue(ShopItemUtil.isSameItem(item, offer));
            assertFalse(ShopItemUtil.spawnerMatches(item, "ITEM:COAL"));
            assertFalse(ShopItemUtil.spawnerMatches(item, "PIG"));
            when(offer.getSpawnerItem()).thenReturn("COAL");
            assertFalse(ShopItemUtil.isSameItem(item, offer));
            when(offer.getSpawnerItem()).thenReturn("DIAMOND");
            when(offer.requiresName()).thenReturn(true);
            when(offer.getName()).thenReturn("Required name");
            assertFalse(ShopItemUtil.isSameItem(item, offer));
        }
    }

    @Test
    void invalidProviderIdentityDoesNotMasqueradeAsVanillaPig() {
        ItemStack item = mock(ItemStack.class);
        BlockStateMeta metadata = mock(BlockStateMeta.class);
        CreatureSpawner state = mock(CreatureSpawner.class);
        when(item.getType()).thenReturn(Material.SPAWNER);
        when(item.hasItemMeta()).thenReturn(true);
        when(item.getItemMeta()).thenReturn(metadata);
        when(metadata.getBlockState()).thenReturn(state);
        when(state.getSpawnedType()).thenReturn(EntityType.PIG);
        try (var provider = mockStatic(SmartSpawnerHook.class)) {
            provider.when(() -> SmartSpawnerHook.identify(item)).thenReturn(new SmartSpawnerHook.Identity(true, null));
            assertFalse(ShopItemUtil.spawnerMatches(item, "PIG"));
            provider.when(() -> SmartSpawnerHook.identify(item)).thenReturn(new SmartSpawnerHook.Identity(false, null));
            assertTrue(ShopItemUtil.spawnerMatches(item, "PIG"));
        }
    }
    @Test
    void nativeItemSpawnerMetadataCannotBeReadAsVanillaBlockState() {
        ItemStack item = mock(ItemStack.class);
        ItemMeta metadata = mock(ItemMeta.class);
        when(item.getType()).thenReturn(Material.SPAWNER);
        when(item.hasItemMeta()).thenReturn(true);
        when(item.getItemMeta()).thenReturn(metadata);
        assertFalse(ShopItemUtil.spawnerMatches(item, "ITEM:DIAMOND"));
        assertNull(ShopItemUtil.getSpawnerType(item));
    }
}
