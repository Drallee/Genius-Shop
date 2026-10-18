package me.dralle.shop.gui;

import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ShopLayoutTest {
    @Test void discoveryMenusHaveIndependentLayoutsAndInheritMissingSettings() throws Exception {
        var shared = new YamlConfiguration();
        shared.loadFromString("gui: {layout: {rows: 6}, discovery: {search: {rows: 3, content-slots: [10, 11], empty-slots: [0], buttons: {search-button: {slot: 26}}}, favorites: {rows: 4}, recent: {rows: 5}}}\n");
        var search = ShopLayout.forDiscovery(shared, me.dralle.shop.discovery.ItemDiscoveryService.Mode.SEARCH);
        assertEquals(27, search.size());
        assertEquals(List.of(10, 11), search.contentSlots());
        assertEquals(List.of(0), search.emptySlots());
        assertEquals(26, search.slot(ShopLayout.Control.SEARCH));
        assertEquals(36, ShopLayout.forDiscovery(shared, me.dralle.shop.discovery.ItemDiscoveryService.Mode.FAVORITES).size());
        assertEquals(45, ShopLayout.forDiscovery(shared, me.dralle.shop.discovery.ItemDiscoveryService.Mode.RECENT).size());
        assertEquals(6, shared.getInt("gui.layout.rows"));
        shared.set("gui.discovery.search", null);
        assertEquals(54, ShopLayout.forDiscovery(shared, me.dralle.shop.discovery.ItemDiscoveryService.Mode.SEARCH).size());
    }

    @Test void explicitAirStaysEmptyWhileUnusedContentCanUseFillerOrAnotherItem() throws Exception {
        var plugin = mock(me.dralle.shop.ShopPlugin.class, RETURNS_DEEP_STUBS);
        var config = new YamlConfiguration();
        config.loadFromString("gui: {layout: {rows: 5, content-slots: [10, 11], empty-slots: [42, 43, 44], empty-area: item, empty-item: {material: PAPER}, filler: {enabled: true, material: YELLOW_STAINED_GLASS_PANE}}}\n");
        when(plugin.getMessages().resolveConfigString(any(), anyString(), anyString())).thenAnswer(call -> call.getArgument(2));
        when(plugin.getMessages().resolveConfigStringList(any(), anyString())).thenReturn(List.of());
        var fillerMaterial = mock(org.bukkit.Material.class);
        var placeholderMaterial = mock(org.bukkit.Material.class);
        when(fillerMaterial.isItem()).thenReturn(true);
        when(placeholderMaterial.isItem()).thenReturn(true);
        var filler = mock(org.bukkit.inventory.ItemStack.class);
        var placeholder = mock(org.bukkit.inventory.ItemStack.class);
        when(filler.clone()).thenReturn(filler);
        when(placeholder.clone()).thenReturn(placeholder);
        var inventory = mock(org.bukkit.inventory.Inventory.class);
        when(inventory.getSize()).thenReturn(45);
        try (var items = mockStatic(me.dralle.shop.util.ShopItemUtil.class)) {
            items.when(() -> me.dralle.shop.util.ShopItemUtil.getMaterial("YELLOW_STAINED_GLASS_PANE", org.bukkit.Material.YELLOW_STAINED_GLASS_PANE)).thenReturn(fillerMaterial);
            items.when(() -> me.dralle.shop.util.ShopItemUtil.getMaterial("PAPER", org.bukkit.Material.GRAY_STAINED_GLASS_PANE)).thenReturn(placeholderMaterial);
            items.when(() -> me.dralle.shop.util.ShopItemUtil.create(fillerMaterial, 1, " ", List.of())).thenReturn(filler);
            items.when(() -> me.dralle.shop.util.ShopItemUtil.create(placeholderMaterial, 1, " ", List.of())).thenReturn(placeholder);
            var layout = ShopLayout.of(config, 3, true);
            layout.fill(plugin, inventory);
            verify(inventory).setItem(10, placeholder);
            verify(inventory).setItem(11, placeholder);
            verify(inventory).setItem(0, filler);
            for (int slot : List.of(42, 43, 44, 36)) verify(inventory, never()).setItem(eq(slot), any());
            clearInvocations(inventory);
            config.set("gui.layout.empty-area", "filler");
            ShopLayout.of(config, 3, true).fill(plugin, inventory);
            verify(inventory).setItem(10, filler);
            clearInvocations(inventory);
            config.set("gui.layout.empty-area", "item");
            config.set("gui.layout.filler.enabled", false);
            ShopLayout.of(config, 3, true).fill(plugin, inventory);
            verify(inventory).setItem(10, placeholder);
            verify(inventory, never()).setItem(eq(0), any());
        }
    }

    @Test void airSlotsCannotOverlapContentOrButtonsAndInvalidBackgroundModesAreRejected() throws Exception {
        var config = new YamlConfiguration();
        config.loadFromString("gui: {layout: {rows: 5, content-slots: [10, 11], empty-slots: [42, 43, 44]}}\n");
        assertEquals(List.of(), ShopLayout.validate(config, 3));
        assertEquals(List.of(42, 43, 44), ShopLayout.of(config, 3, true).emptySlots());
        config.set("gui.layout.empty-slots", List.of(10, 36, 44, 44));
        assertTrue(ShopLayout.validate(config, 3).stream().anyMatch(error -> error.contains("overlaps")));
        config.set("gui.layout.empty-area", "invalid");
        assertTrue(ShopLayout.validate(config, 3).stream().anyMatch(error -> error.contains("empty-area")));
    }

    @Test void perShopRowsContentButtonsAndFillerOverrideSharedSettingsWithoutMutatingThem() throws Exception {
        var shared = new YamlConfiguration();
        shared.loadFromString("gui: {layout: {rows: 6, filler: {enabled: false, material: YELLOW_STAINED_GLASS_PANE}}}\n");
        var shopConfig = new YamlConfiguration();
        shopConfig.loadFromString("layout: {rows: 3, content-slots: [10, 11, 12, 13, 14, 15, 16], buttons: {search-button: {slot: 0}}, filler: {enabled: true, material: BLUE_STAINED_GLASS_PANE}}\n");
        var shop = mock(me.dralle.shop.model.ShopData.class);
        when(shop.getRows()).thenReturn(5);
        when(shop.getLayout()).thenReturn(shopConfig.getConfigurationSection("layout"));
        var layout = ShopLayout.forShop(shared, shop, true);
        assertEquals(27, layout.size());
        assertEquals(7, layout.capacity());
        assertEquals(0, layout.slot(ShopLayout.Control.SEARCH));
        assertEquals("BLUE_STAINED_GLASS_PANE", layout.appearance().get("gui.layout.filler.material"));
        assertEquals(6, shared.getInt("gui.layout.rows"));
        assertFalse(shared.getBoolean("gui.layout.filler.enabled"));
        when(shop.getLayout()).thenReturn(null);
        assertEquals(54, ShopLayout.forShop(shared, shop, true).size());
    }

    @Test void buttonsApplyAmountTextLoreAndConfiguredTooltipFlags() {
        var plugin = mock(me.dralle.shop.ShopPlugin.class, RETURNS_DEEP_STUBS);
        var config = new YamlConfiguration();
        config.set("gui.search-button.material", "PAPER");
        config.set("gui.search-button.amount", 3);
        config.set("gui.search-button.hide-attributes", true);
        config.set("gui.search-button.hide-additional", false);
        config.set("gui.search-button.hide-enchants", true);
        when(plugin.getMenuManager().getGuiSettingsConfig()).thenReturn(config);
        when(plugin.getMessages().resolveConfigString(config, "gui.search-button.name", "discovery.search")).thenReturn("Find items");
        when(plugin.getMessages().resolveConfigStringList(config, "gui.search-button.lore")).thenReturn(List.of("Search here"));
        var material = mock(org.bukkit.Material.class);
        when(material.isItem()).thenReturn(true);
        var icon = mock(org.bukkit.inventory.ItemStack.class);
        var meta = mock(org.bukkit.inventory.meta.ItemMeta.class);
        when(icon.getItemMeta()).thenReturn(meta);
        try (var items = mockStatic(me.dralle.shop.util.ShopItemUtil.class)) {
            items.when(() -> me.dralle.shop.util.ShopItemUtil.getMaterial("PAPER", org.bukkit.Material.COMPASS)).thenReturn(material);
            items.when(() -> me.dralle.shop.util.ShopItemUtil.create(material, 3, "Find items", List.of("Search here"))).thenReturn(icon);
            assertSame(icon, ShopLayout.button(plugin, ShopLayout.Control.SEARCH));
            verify(meta).addItemFlags(org.bukkit.inventory.ItemFlag.HIDE_ATTRIBUTES);
            verify(meta).addItemFlags(org.bukkit.inventory.ItemFlag.HIDE_ENCHANTS);
            verify(meta, never()).addItemFlags(org.bukkit.inventory.ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
            verify(icon).setItemMeta(meta);
        }
    }

    @Test void defaultsKeepExistingCapacityAndReserveDiscoveryAndNavigation() {
        var layout = ShopLayout.of(new YamlConfiguration(), 3, true);
        assertEquals(36, layout.size());
        assertEquals(27, layout.capacity());
        assertEquals(27, layout.slot(ShopLayout.Control.SEARCH));
        assertEquals(31, layout.slot(ShopLayout.Control.BACK));
        assertEquals(List.of(), ShopLayout.validate(new YamlConfiguration(), 3));
    }

    @Test void sixRowsNeverExceedChestSizeAndWithoutDiscoveryItsSlotsRemainFree() {
        var layout = ShopLayout.of(new YamlConfiguration(), 6, false);
        assertEquals(54, layout.size());
        assertEquals(45, layout.capacity());
        assertEquals(-1, layout.slot(ShopLayout.Control.SEARCH));
        assertEquals(49, layout.slot(ShopLayout.Control.BACK));
    }

    @Test void sparseContentAndMovedButtonsUsePhysicalSlotsWithoutChangingLogicalOrder() {
        var config = new YamlConfiguration();
        config.set("gui.layout.rows", 3);
        config.set("gui.layout.content-slots", List.of(10, 11, 12, 13, 14, 15, 16));
        config.set("gui.search-button.slot", 26);
        var layout = ShopLayout.of(config, 5, true);
        assertEquals(27, layout.size());
        assertEquals(7, layout.capacity());
        assertEquals(10, layout.contentSlots().getFirst());
        assertEquals(26, layout.slot(ShopLayout.Control.SEARCH));
        assertEquals(List.of(), ShopLayout.validate(config, 5));
        config.set("gui.next-button.slot", 26);
        assertTrue(ShopLayout.validate(config, 5).stream().anyMatch(error -> error.contains("multiple")));
        config.set("gui.next-button.slot", 10);
        assertTrue(ShopLayout.validate(config, 5).stream().anyMatch(error -> error.contains("overlaps")));
    }

    @Test void malformedSlotsAndRowsAreRejectedAndRuntimeKeepsUsableFallbacks() {
        var config = new YamlConfiguration();
        config.set("gui.layout.rows", 2.5);
        config.set("gui.layout.content-slots", List.of(1000, 1.5, -1));
        config.set("gui.back-button.slot", "wrong");
        assertFalse(ShopLayout.validate(config, 3).isEmpty());
        assertTrue(ShopLayout.of(config, 3, true).capacity() > 0);
    }
}
