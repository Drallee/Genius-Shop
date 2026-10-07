package me.dralle.shop.commands;

import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;

import java.util.Map;

/** A sale source must remove exact quantities and be able to restore failed payments. */
public interface SaleStorage {
    ItemStack[] getStorageContents();

    default boolean approveSale(Map<Integer, Integer> quantities, double payout) { return true; }

    boolean removeItems(ItemStack[] expected, Map<Integer, Integer> quantities);

    void restoreItems(ItemStack[] snapshot);

    static SaleStorage inventory(Inventory inventory) {
        return new SaleStorage() {
            public ItemStack[] getStorageContents() { return inventory.getStorageContents(); }

            public boolean removeItems(ItemStack[] expected, Map<Integer, Integer> quantities) {
                for (var entry : quantities.entrySet()) {
                    ItemStack current = inventory.getItem(entry.getKey());
                    ItemStack original = expected[entry.getKey()];
                    if (current == null || current.getAmount() != original.getAmount()
                            || !current.isSimilar(original) || entry.getValue() > current.getAmount()) return false;
                }
                for (var entry : quantities.entrySet()) {
                    ItemStack current = inventory.getItem(entry.getKey());
                    current.setAmount(current.getAmount() - entry.getValue());
                    inventory.setItem(entry.getKey(), current.getAmount() == 0 ? null : current);
                }
                return true;
            }

            public void restoreItems(ItemStack[] snapshot) { inventory.setStorageContents(snapshot); }
        };
    }
}
