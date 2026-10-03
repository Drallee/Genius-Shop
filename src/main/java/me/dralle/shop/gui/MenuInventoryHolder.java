package me.dralle.shop.gui;

import org.bukkit.Bukkit;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.NotNull;

import java.util.Objects;

public abstract class MenuInventoryHolder implements InventoryHolder {
    private Inventory inventory;

    final Inventory createInventory(int size, String title) {
        if (inventory != null) {
            throw new IllegalStateException("Menu inventory already created");
        }
        inventory = Bukkit.createInventory(this, size, title);
        return inventory;
    }

    @Override
    public final @NotNull Inventory getInventory() {
        return Objects.requireNonNull(inventory, "Menu inventory has not been created");
    }
}
