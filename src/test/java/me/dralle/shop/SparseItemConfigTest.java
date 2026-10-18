package me.dralle.shop;

import com.google.gson.Gson;
import me.dralle.shop.model.ShopItem;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.io.InputStreamReader;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SparseItemConfigTest {
    record Fixture(String name, String before, String after) {}

    @Test
    void actualEditorFixturesReloadWithOnlyTheRequestedPriceChanged() throws Exception {
        try (var reader = new InputStreamReader(Objects.requireNonNull(getClass().getResourceAsStream("/sparse-item-roundtrip.json")), StandardCharsets.UTF_8)) {
            for (var fixture : new Gson().fromJson(reader, Fixture[].class)) {
                ShopItem before = item(fixture.before());
                ShopItem after = item(fixture.after());
                assertEquals(125D, after.getPrice());
                for (var method : ShopItem.class.getDeclaredMethods()) {
                    if (!Modifier.isPublic(method.getModifiers()) || method.getParameterCount() != 0
                            || !(method.getName().startsWith("get") || method.getName().startsWith("is"))) continue;
                    if (method.getName().equals("getPrice") || method.getName().equals("getStockResetRule")) continue;
                    assertEquals(method.invoke(before), method.invoke(after), fixture.name() + ": " + method.getName());
                }
                if (before.getStockResetRule() == null) assertNull(after.getStockResetRule());
                else {
                    assertEquals(before.getStockResetRule().isEnabled(), after.getStockResetRule().isEnabled());
                    assertEquals(before.getStockResetRule().getType(), after.getStockResetRule().getType());
                }
            }
        }
    }

    @Test
    void compactResetDefaultsMatchExpandedRuntimeRules() throws Exception {
        for (String type : new String[]{"daily", "hourly", "minute-interval", "second-interval", "monthly", "yearly"}) {
            var compact = item("items:\n  - material: STONE\n    stock-reset: {enabled: true, type: " + type + "}\n");
            var expanded = item("items:\n  - material: STONE\n    stock-reset: {enabled: true, type: " + type
                    + ", time: '00:00', interval: 1, day-of-month: 1, month: 1, month-day: 1, timezone: server}\n");
            var now = Instant.parse("2026-10-18T12:34:56Z");
            assertEquals(expanded.getStockResetRule().getNextResetInstant(now, 0), compact.getStockResetRule().getNextResetInstant(now, 0), type);
        }
        assertFalse(item("items:\n  - material: STONE\n    stock-reset: {enabled: false, type: daily}\n").getStockResetRule().isEnabled());
    }

    private ShopItem item(String yaml) throws Exception {
        var configuration = new YamlConfiguration();
        configuration.loadFromString(yaml);
        var parser = mock(ShopManager.class, CALLS_REAL_METHODS);
        var plugin = ShopManager.class.getDeclaredField("plugin");
        plugin.setAccessible(true);
        plugin.set(parser, mock(ShopPlugin.class, RETURNS_DEEP_STUBS));
        var create = ShopManager.class.getDeclaredMethod("createShopItem", Map.class, String.class, boolean.class, Integer.class);
        create.setAccessible(true);
        return (ShopItem) create.invoke(parser, configuration.getMapList("items").getFirst(), "", false, null);
    }
}
