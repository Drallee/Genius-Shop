package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryAction;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryView;
import org.bukkit.inventory.ItemStack;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.function.Consumer;

import static org.mockito.Mockito.*;

class MenuInventoryClickTest {
    private record Menu(MenuInventoryHolder holder, Consumer<InventoryClickEvent> onClick) {}

    private List<Menu> readOnlyMenus(ShopPlugin plugin) {
        GenericShopGui shop = mock(GenericShopGui.class, CALLS_REAL_METHODS);
        return List.of(
                new Menu(new MainMenu.MainMenuHolder(), new MainMenu(plugin)::onClick),
                new Menu(new GenericShopGui.GenericShopHolder("ores", 1), shop::onClick),
                new Menu(new GenericShopGui.VariantHolder("ores", 1, List.of()), shop::onClick),
                new Menu(new PurchaseMenu.PurchaseHolder(), new PurchaseMenu(plugin)::onClick),
                new Menu(new SellMenu.SellHolder(), new SellMenu(plugin)::onClick));
    }

    @Test
    void playerInventoryAndOutsideClicksCannotTriggerMenuActions() {
        ShopPlugin plugin = mock(ShopPlugin.class);
        for (Menu menu : readOnlyMenus(plugin)) {
            for (int rawSlot : new int[]{27, 35, 62, -999}) {
                for (ClickType click : List.of(ClickType.LEFT, ClickType.SHIFT_LEFT,
                        ClickType.NUMBER_KEY, ClickType.SWAP_OFFHAND, ClickType.DOUBLE_CLICK)) {
                    Player player = mock(Player.class);
                    Inventory top = mock(Inventory.class);
                    InventoryClickEvent event = mock(InventoryClickEvent.class);
                    when(top.getHolder()).thenReturn(menu.holder());
                    when(top.getSize()).thenReturn(27);
                    when(event.getWhoClicked()).thenReturn(player);
                    when(event.getInventory()).thenReturn(top);
                    when(event.getRawSlot()).thenReturn(rawSlot);
                    when(event.getSlot()).thenReturn(0);
                    when(event.getClick()).thenReturn(click);
                    when(event.getCurrentItem()).thenReturn(mock(ItemStack.class));

                    menu.onClick().accept(event);

                    verify(event).setCancelled(true);
                    verify(event, never()).getCurrentItem();
                    verify(player, never()).closeInventory();
                    verify(player, never()).hasMetadata(anyString());
                }
            }
        }
        verifyNoInteractions(plugin);
    }

    @Test
    void mainMenuButtonStillWorksWhenClickedInTopInventory() {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        YamlConfiguration config = new YamlConfiguration();
        config.set("items.close.slot", 0);
        config.set("items.close.action", "close");
        when(plugin.getMenuManager().getMainMenuConfig()).thenReturn(config);
        Player player = mock(Player.class);
        Inventory top = mock(Inventory.class);
        ItemStack button = mock(ItemStack.class);
        InventoryClickEvent event = mock(InventoryClickEvent.class);
        when(top.getHolder()).thenReturn(new MainMenu.MainMenuHolder());
        when(top.getSize()).thenReturn(27);
        when(button.getType()).thenReturn(Material.BARRIER);
        when(event.getWhoClicked()).thenReturn(player);
        when(event.getInventory()).thenReturn(top);
        when(event.getRawSlot()).thenReturn(0);
        when(event.getSlot()).thenReturn(0);
        when(event.getCurrentItem()).thenReturn(button);

        new MainMenu(plugin).onClick(event);

        verify(event).setCancelled(true);
        verify(player).closeInventory();
    }

    @Test
    void bulkSellStillAllowsPlayerInventoryTransfersWithoutConfirmingSale() {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        when(plugin.getMenuManager().getBulkSellMenuConfig().getInt("buttons.confirm.slot", 49))
                .thenReturn(49);
        Player player = mock(Player.class);
        Inventory top = mock(Inventory.class);
        Inventory bottom = mock(Inventory.class);
        InventoryView view = mock(InventoryView.class);
        when(top.getHolder()).thenReturn(new BulkSellMenu.BulkSellHolder());
        when(view.getTopInventory()).thenReturn(top);
        for (InventoryAction action : List.of(InventoryAction.PICKUP_ALL,
                InventoryAction.MOVE_TO_OTHER_INVENTORY, InventoryAction.HOTBAR_SWAP)) {
            InventoryClickEvent event = mock(InventoryClickEvent.class);
            when(event.getWhoClicked()).thenReturn(player);
            when(event.getInventory()).thenReturn(top);
            when(event.getClickedInventory()).thenReturn(bottom);
            when(event.getView()).thenReturn(view);
            when(event.getRawSlot()).thenReturn(54);
            when(event.getAction()).thenReturn(action);

            new BulkSellMenu(plugin).onClick(event);

            verify(event, never()).setCancelled(true);
            verify(player, never()).closeInventory();
        }
        verify(plugin, never()).getShopManager();
        verify(plugin, never()).getEconomy();
    }
}
