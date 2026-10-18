package me.dralle.shop.util;

import io.papermc.paper.registry.RegistryAccess;
import me.dralle.shop.gui.SellMenu;
import me.dralle.shop.model.ShopItem;
import org.bukkit.Material;
import org.bukkit.Registry;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.inventory.meta.EnchantmentStorageMeta;
import org.bukkit.inventory.meta.ItemMeta;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ShopItemUtilEnchantmentTest {
    @Test
    void matchesStoredBookEnchantmentsAndRequiresExactLevel() {
        withEnchantment(enchantment -> {
            ItemStack book = mock(ItemStack.class);
            EnchantmentStorageMeta meta = mock(EnchantmentStorageMeta.class);
            when(book.getType()).thenReturn(Material.ENCHANTED_BOOK);
            when(book.hasItemMeta()).thenReturn(true);
            when(book.getItemMeta()).thenReturn(meta);
            when(meta.hasStoredEnchants()).thenReturn(true);
            when(meta.getStoredEnchantLevel(enchantment)).thenReturn(5);

            assertTrue(ShopItemUtil.enchantmentsMatch(book, Map.of("sharpness", 5)));
            assertFalse(ShopItemUtil.enchantmentsMatch(book, Map.of("sharpness", 4)));
            when(meta.getStoredEnchantLevel(enchantment)).thenReturn(0);
            assertFalse(ShopItemUtil.enchantmentsMatch(book, Map.of("sharpness", 5)));
            when(meta.hasStoredEnchants()).thenReturn(false);
            assertFalse(ShopItemUtil.enchantmentsMatch(book, Map.of("sharpness", 5)));
            verify(meta, never()).getEnchantLevel(any());
        });
    }

    @Test
    void createsBooksWithStoredEnchantments() {
        withEnchantment(enchantment -> {
            ItemStack book = mock(ItemStack.class);
            EnchantmentStorageMeta meta = mock(EnchantmentStorageMeta.class);
            when(book.getType()).thenReturn(Material.ENCHANTED_BOOK);
            when(book.getItemMeta()).thenReturn(meta);

            ShopItemUtil.applyEnchantments(book, Map.of("sharpness", 5));

            verify(meta).addStoredEnchant(enchantment, 5, true);
            verify(book).setItemMeta(meta);
            verify(book, never()).addUnsafeEnchantment(any(), anyInt());
        });
    }

    @Test
    void ordinaryItemsStillUseAppliedEnchantments() {
        withEnchantment(enchantment -> {
            ItemStack sword = mock(ItemStack.class);
            ItemMeta meta = mock(ItemMeta.class);
            when(sword.getType()).thenReturn(Material.DIAMOND_SWORD);
            when(sword.hasItemMeta()).thenReturn(true);
            when(sword.getItemMeta()).thenReturn(meta);
            when(meta.hasEnchants()).thenReturn(true);
            when(meta.getEnchantLevel(enchantment)).thenReturn(5);

            assertTrue(ShopItemUtil.enchantmentsMatch(sword, Map.of("sharpness", 5)));
            assertFalse(ShopItemUtil.enchantmentsMatch(sword, Map.of("sharpness", 4)));
            ShopItemUtil.applyEnchantments(sword, Map.of("sharpness", 5));
            verify(sword).addUnsafeEnchantment(enchantment, 5);
        });
    }

    @Test
    void sellMenuCountsAndPlansBooksWithRequiredNameLoreAndStoredEnchantments() {
        withEnchantment(enchantment -> {
            Player player = mock(Player.class);
            PlayerInventory inventory = mock(PlayerInventory.class);
            ItemStack book = mock(ItemStack.class);
            EnchantmentStorageMeta meta = mock(EnchantmentStorageMeta.class);
            when(player.getInventory()).thenReturn(inventory);
            when(inventory.getContents()).thenReturn(new ItemStack[]{book});
            when(inventory.getSize()).thenReturn(1);
            when(inventory.getItem(0)).thenReturn(book);
            when(book.getType()).thenReturn(Material.ENCHANTED_BOOK);
            when(book.getAmount()).thenReturn(1);
            when(book.hasItemMeta()).thenReturn(true);
            when(book.getItemMeta()).thenReturn(meta);
            when(meta.hasStoredEnchants()).thenReturn(true);
            when(meta.getStoredEnchantLevel(enchantment)).thenReturn(5);
            when(meta.hasDisplayName()).thenReturn(true);
            String bookName = ShopItemUtil.color("&eSharp Book");
            when(meta.getDisplayName()).thenReturn(bookName);
            when(meta.hasLore()).thenReturn(true);
            when(meta.getLore()).thenReturn(List.of(""));

            Map<String, Integer> enchantments = Map.of("sharpness", 5);
            ShopItem shopItem = mock(ShopItem.class);
            when(shopItem.getMaterial()).thenReturn(Material.ENCHANTED_BOOK);
            when(shopItem.getEnchantments()).thenReturn(enchantments);
            when(shopItem.requiresName()).thenReturn(true);
            when(shopItem.getName()).thenReturn("&eSharp Book");
            when(shopItem.requiresLore()).thenReturn(true);
            when(shopItem.getLore()).thenReturn(List.of(""));
            assertTrue(ShopItemUtil.isSameItem(book, shopItem));

            try {
                var count = SellMenu.class.getDeclaredMethod("countPlayerItems", Player.class, Material.class,
                        String.class, String.class, String.class, Map.class, String.class, List.class,
                        boolean.class, boolean.class);
                count.setAccessible(true);
                assertEquals(1, count.invoke(null, player, Material.ENCHANTED_BOOK, null, null, null,
                        enchantments, "&eSharp Book", List.of(""), true, true));

                var remove = SellMenu.class.getDeclaredMethod("matchingQuantities", ItemStack[].class, Material.class,
                        String.class, String.class, String.class, Map.class, int.class, String.class, List.class,
                        boolean.class, boolean.class);
                remove.setAccessible(true);
                assertEquals(Map.of(0, 1), remove.invoke(null, new ItemStack[]{book}, Material.ENCHANTED_BOOK, null, null, null,
                        enchantments, 1, "&eSharp Book", List.of(""), true, true));
                verify(inventory, never()).setItem(anyInt(), any());

                when(meta.getDisplayName()).thenReturn("Different name");
                assertFalse(ShopItemUtil.isSameItem(book, shopItem));
                assertEquals(0, count.invoke(null, player, Material.ENCHANTED_BOOK, null, null, null,
                        enchantments, "&eSharp Book", List.of(""), true, true));
                when(meta.getDisplayName()).thenReturn(bookName);
                when(meta.getLore()).thenReturn(List.of("Different lore"));
                assertFalse(ShopItemUtil.isSameItem(book, shopItem));
            } catch (ReflectiveOperationException ex) {
                throw new AssertionError(ex);
            }
        });
    }

    private void withEnchantment(java.util.function.Consumer<Enchantment> test) {
        // Paper initializes enchantment constants through its server registry.
        try (var registries = mockStatic(RegistryAccess.class)) {
            RegistryAccess access = mock(RegistryAccess.class, invocation -> mock(Registry.class));
            registries.when(RegistryAccess::registryAccess).thenReturn(access);
            Enchantment enchantment = mock(Enchantment.class);
            try (var items = mockStatic(ShopItemUtil.class, CALLS_REAL_METHODS)) {
                items.when(() -> ShopItemUtil.getEnchantment("sharpness")).thenAnswer(invocation -> enchantment);
                test.accept(enchantment);
            }
        }
    }
}
