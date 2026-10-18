package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.*;

class ShopLayoutClickTest {
    @Test void sparseShopClicksResolveLogicalSlotsOnEachPageAndFillerCannotTrade() throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        var config = new YamlConfiguration();
        config.set("gui.layout.rows", 3);
        config.set("gui.layout.content-slots", List.of(10, 11, 12, 13, 14, 15, 16));
        when(plugin.getMenuManager().getGuiSettingsConfig()).thenReturn(config);
        ShopData shop = mock(ShopData.class);
        when(shop.getRows()).thenReturn(3);
        var override = new YamlConfiguration();
        override.set("layout.rows", 3);
        override.set("layout.content-slots", List.of(10, 11, 12, 13, 14, 15, 16));
        when(shop.getLayout()).thenReturn(override.getConfigurationSection("layout"));
        when(shop.getItems()).thenReturn(List.of());
        when(plugin.getShopManager().getShop("blocks")).thenReturn(shop);
        var gui = mock(GenericShopGui.class, CALLS_REAL_METHODS);
        var field = GenericShopGui.class.getDeclaredField("plugin");
        field.setAccessible(true);
        field.set(gui, plugin);
        var layout = ShopLayout.forShop(config, shop, true);
        var inventory = mock(Inventory.class);
        when(inventory.getSize()).thenReturn(27);
        when(inventory.getHolder()).thenReturn(new GenericShopGui.GenericShopHolder("blocks", 2, layout));
        var icon = mock(ItemStack.class);
        when(icon.getType()).thenReturn(Material.STONE);
        var event = mock(InventoryClickEvent.class);
        when(event.getWhoClicked()).thenReturn(mock(Player.class));
        when(event.getInventory()).thenReturn(inventory);
        when(event.getCurrentItem()).thenReturn(icon);
        when(event.getClick()).thenReturn(ClickType.LEFT);
        when(event.getRawSlot()).thenReturn(10);
        when(event.getSlot()).thenReturn(10);
        gui.onClick(event);
        verify(shop).getItemBySlot(7);
        when(event.getRawSlot()).thenReturn(16);
        when(event.getSlot()).thenReturn(16);
        gui.onClick(event);
        verify(shop).getItemBySlot(13);
        clearInvocations(shop);
        when(event.getRawSlot()).thenReturn(0);
        when(event.getSlot()).thenReturn(0);
        gui.onClick(event);
        verify(shop, never()).getItemBySlot(anyInt());
        verify(event, times(3)).setCancelled(true);
    }
}
