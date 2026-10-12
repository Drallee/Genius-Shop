package me.dralle.shop.gui;

import org.bukkit.Bukkit;
import org.bukkit.inventory.Inventory;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

class MenuInventoryHolderTest {
    @Test
    void allMenusReturnTheirCreatedInventoryAndKeepHolderIdentity() {
        List<MenuInventoryHolder> holders = List.of(
                new MainMenu.MainMenuHolder(), new PurchaseMenu.PurchaseHolder(),
                new SellMenu.SellHolder(), new BulkSellMenu.BulkSellHolder(),
                new GenericShopGui.GenericShopHolder("ores", 1),
                new GenericShopGui.VariantHolder("ores", 1, List.of()));
        try (var bukkit = mockStatic(Bukkit.class)) {
            for (MenuInventoryHolder holder : holders) {
                Inventory inventory = mock(Inventory.class);
                bukkit.when(() -> Bukkit.createInventory(holder, 27, "Menu")).thenReturn(inventory);
                assertSame(inventory, holder.createInventory(27, "Menu"));
                assertSame(inventory, holder.getInventory());
                assertThrows(IllegalStateException.class, () -> holder.createInventory(27, "Other"));
            }
        }
    }
}
