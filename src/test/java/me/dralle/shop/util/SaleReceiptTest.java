package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopItem;
import net.md_5.bungee.api.chat.BaseComponent;
import net.md_5.bungee.api.chat.hover.content.Text;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SaleReceiptTest {
    private ShopPlugin plugin() {
        ShopPlugin plugin = mock(ShopPlugin.class);
        when(plugin.formatCurrency(anyDouble())).thenAnswer(call -> "$" + call.getArgument(0));
        return plugin;
    }

    @Test
    void groupsRepeatedStacksUsingActualPaymentsAndKeepsTypesSeparate() {
        String details = org.bukkit.ChatColor.stripColor(SaleReceipt.tooltip(plugin(), List.of(
                new SaleReceipt.Line("spawners", "diamond", "Diamond Spawner", 2, 40),
                new SaleReceipt.Line("spawners", "diamond", "Diamond Spawner", 3, 90),
                new SaleReceipt.Line("spawners", "coal", "Coal Spawner", 4, 20))));
        assertTrue(details.contains("5x Diamond Spawner"));
        assertTrue(details.contains("$130.0 ($26.0 /item average)"));
        assertTrue(details.contains("4x Coal Spawner"));
        assertTrue(details.contains("Items: 9"));
        assertTrue(details.contains("Total paid: $150.0"));
        assertEquals(1, details.split("Diamond Spawner", -1).length - 1);
    }

    @Test
    void attachesHoverWithoutChangingConfiguredSuccessText() {
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        SaleReceipt.send(plugin(), player, "&aSold 2 items for $40", List.of(
                new SaleReceipt.Line("blocks", "stone", "Stone", 2, 40)));
        var captured = ArgumentCaptor.forClass(BaseComponent.class);
        verify(player.spigot()).sendMessage(captured.capture());
        assertEquals("Sold 2 items for $40", captured.getValue().toPlainText());
        Text hover = (Text) captured.getValue().getHoverEvent().getContents().getFirst();
        assertTrue(BaseComponent.toPlainText((BaseComponent[]) hover.getValue()).contains("Stone"));
        assertNull(captured.getValue().getClickEvent());
    }

    @Test
    void gradientsUseRgbComponentsInsteadOfRawLegacyHexInHover() {
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        SaleReceipt.send(plugin(), player, "Sold", List.of(new SaleReceipt.Line("blocks", "stone",
                "<gradient:#FF0000:#00FF00>Stone</gradient>", 128, 256)));
        var captured = ArgumentCaptor.forClass(BaseComponent.class);
        verify(player.spigot()).sendMessage(captured.capture());
        Text hover = (Text) captured.getValue().getHoverEvent().getContents().getFirst();
        BaseComponent[] components = (BaseComponent[]) hover.getValue();
        String plain = BaseComponent.toPlainText(components);
        assertTrue(plain.contains("128x Stone"));
        assertFalse(plain.contains("\u00a7"));
        String json = net.md_5.bungee.chat.ComponentSerializer.toString(components);
        assertTrue(json.toLowerCase(java.util.Locale.ROOT).contains("#ff0000"));
        assertTrue(json.toLowerCase(java.util.Locale.ROOT).contains("#00ff00"));
        assertFalse(json.contains("\u00a7x"));
    }

    @Test
    void largeReceiptsStayCompactWithoutDroppingOverallTotals() {
        var lines = IntStream.range(0, 20).mapToObj(index ->
                new SaleReceipt.Line("blocks", "item-" + index, "Item " + index, 1, 10)).toList();
        String details = org.bukkit.ChatColor.stripColor(SaleReceipt.tooltip(plugin(), lines));
        assertTrue(details.contains("+ 8 more item types"));
        assertTrue(details.contains("Items: 20"));
        assertTrue(details.contains("Total paid: $200.0"));
        assertFalse(details.contains("Item 12"));
    }

    @Test
    void unnamedSpawnersIncludeTheirType() {
        ShopItem item = mock(ShopItem.class);
        when(item.getMaterial()).thenReturn(Material.SPAWNER);
        when(item.isSpawner()).thenReturn(true);
        when(item.getSpawnerType()).thenReturn("ITEM:DIAMOND");
        when(item.getUniqueKey()).thenReturn("diamond");
        var line = SaleReceipt.line("spawners", item, 3, 100);
        assertEquals("SPAWNER (ITEM:DIAMOND)", line.name());
        assertEquals(3, line.quantity());
        assertEquals(100, line.total());
    }
}
