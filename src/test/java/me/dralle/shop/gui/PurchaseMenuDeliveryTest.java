package me.dralle.shop.gui;

import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.junit.jupiter.api.Test;

import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PurchaseMenuDeliveryTest {
    @Test
    void splitsTemplateIntoStackLimitsWithoutDroppingItems() throws Exception {
        Player player = mock(Player.class);
        PlayerInventory inventory = mock(PlayerInventory.class);
        World world = mock(World.class);
        Location location = new Location(world, 1, 2, 3);
        ItemStack template = mock(ItemStack.class);
        ItemStack first = mock(ItemStack.class);
        ItemStack second = mock(ItemStack.class);
        when(player.getInventory()).thenReturn(inventory);
        when(player.getWorld()).thenReturn(world);
        when(player.getLocation()).thenReturn(location);
        when(template.getMaxStackSize()).thenReturn(64);
        when(inventory.getMaxStackSize()).thenReturn(64);
        when(inventory.getStorageContents()).thenReturn(new ItemStack[36]);
        when(template.clone()).thenReturn(first, second);
        when(inventory.addItem(first)).thenReturn(new HashMap<>());
        when(inventory.addItem(second)).thenReturn(new HashMap<>());

        var delivery = PurchaseMenu.class.getDeclaredMethod("giveItemTemplateSafe", Player.class, ItemStack.class, int.class);
        delivery.setAccessible(true);
        delivery.invoke(null, player, template, 65);

        verify(first).setAmount(64);
        verify(second).setAmount(1);
        verify(inventory).addItem(first);
        verify(inventory).addItem(second);
        verifyNoInteractions(world);
        verify(template, never()).setAmount(anyInt());
    }

    @Test
    void rejectsFullStorageBeforeAddingOrDroppingAnything() throws Exception {
        Player player = mock(Player.class);
        PlayerInventory inventory = mock(PlayerInventory.class);
        ItemStack template = mock(ItemStack.class);
        ItemStack occupied = mock(ItemStack.class);
        when(player.getInventory()).thenReturn(inventory);
        when(inventory.getMaxStackSize()).thenReturn(64);
        when(template.getMaxStackSize()).thenReturn(64);
        when(occupied.getType()).thenReturn(Material.STONE);
        ItemStack[] contents = new ItemStack[36];
        java.util.Arrays.fill(contents, occupied);
        when(inventory.getStorageContents()).thenReturn(contents);

        assertFalse(fits(player, template, 1));
        var delivery = PurchaseMenu.class.getDeclaredMethod("giveItemTemplateSafe", Player.class, ItemStack.class, int.class);
        delivery.setAccessible(true);
        var failure = assertThrows(java.lang.reflect.InvocationTargetException.class,
                () -> delivery.invoke(null, player, template, 1));
        assertInstanceOf(IllegalStateException.class, failure.getCause());
        verify(inventory, never()).addItem(any(ItemStack[].class));
        verify(player, never()).getWorld();
    }

    @Test
    void countsOnlyMatchingStackSpaceAndRejectsOversizedPurchases() throws Exception {
        Player player = mock(Player.class);
        PlayerInventory inventory = mock(PlayerInventory.class);
        ItemStack template = mock(ItemStack.class);
        ItemStack matching = mock(ItemStack.class);
        ItemStack differentMeta = mock(ItemStack.class);
        when(player.getInventory()).thenReturn(inventory);
        when(inventory.getMaxStackSize()).thenReturn(64);
        when(template.getMaxStackSize()).thenReturn(64);
        when(matching.getType()).thenReturn(Material.IRON_BLOCK);
        when(matching.getAmount()).thenReturn(60);
        when(template.isSimilar(matching)).thenReturn(true);
        when(differentMeta.getType()).thenReturn(Material.IRON_BLOCK);
        when(inventory.getStorageContents()).thenReturn(new ItemStack[]{matching, differentMeta, null});
        assertTrue(fits(player, template, 68));
        assertFalse(fits(player, template, 69));
    }

    @Test
    void respectsUnstackableItemsAndInventoryStackLimit() throws Exception {
        Player player = mock(Player.class);
        PlayerInventory inventory = mock(PlayerInventory.class);
        ItemStack template = mock(ItemStack.class);
        when(player.getInventory()).thenReturn(inventory);
        when(inventory.getStorageContents()).thenReturn(new ItemStack[]{null, null});
        when(inventory.getMaxStackSize()).thenReturn(64);
        when(template.getMaxStackSize()).thenReturn(1);
        assertTrue(fits(player, template, 2));
        assertFalse(fits(player, template, 3));
        when(template.getMaxStackSize()).thenReturn(64);
        when(inventory.getMaxStackSize()).thenReturn(16);
        assertTrue(fits(player, template, 32));
        assertFalse(fits(player, template, 33));
    }

    private boolean fits(Player player, ItemStack template, int amount) throws Exception {
        var check = PurchaseMenu.class.getDeclaredMethod("canFitPurchase", Player.class, ItemStack.class, int.class);
        check.setAccessible(true);
        return (boolean) check.invoke(null, player, template, amount);
    }

    @Test
    void restoresStorageIfDeliveryUnexpectedlyReturnsLeftovers() throws Exception {
        Player player = mock(Player.class);
        PlayerInventory inventory = mock(PlayerInventory.class);
        ItemStack template = mock(ItemStack.class);
        ItemStack first = mock(ItemStack.class);
        ItemStack second = mock(ItemStack.class);
        when(player.getInventory()).thenReturn(inventory);
        when(inventory.getMaxStackSize()).thenReturn(64);
        when(template.getMaxStackSize()).thenReturn(64);
        when(template.clone()).thenReturn(first, second);
        when(inventory.getStorageContents()).thenReturn(new ItemStack[36]);
        when(inventory.addItem(first)).thenReturn(new HashMap<>());
        when(inventory.addItem(second)).thenReturn(new HashMap<>(java.util.Map.of(0, second)));
        var delivery = PurchaseMenu.class.getDeclaredMethod("giveItemTemplateSafe", Player.class, ItemStack.class, int.class);
        delivery.setAccessible(true);
        assertThrows(java.lang.reflect.InvocationTargetException.class,
                () -> delivery.invoke(null, player, template, 65));
        verify(inventory).setStorageContents(argThat(contents -> contents.length == 36
                && java.util.Arrays.stream(contents).allMatch(java.util.Objects::isNull)));
        verify(player, never()).getWorld();
    }
}
