package me.dralle.shop;

import me.dralle.shop.stock.StockResetRule;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ShopManagerStockResetTimezoneTest {
    @TempDir
    Path dataFolder;

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t\n"})
    void fillsAndPersistsMissingOrBlankMainTimezone(String timezone) throws Exception {
        YamlConfiguration config = new YamlConfiguration();
        config.set("stock-reset.timezone", timezone);
        config.set("merge-missing-defaults", false);
        config.set("config-version", 15);
        config.addDefault("stock-reset.timezone", "UTC");
        ShopPlugin plugin = plugin(config, dailyShop(null));

        try (var in = getClass().getResourceAsStream("/config.yml")) {
            assertNotNull(in);
            String bundledDefault = YamlConfiguration.loadConfiguration(
                    new InputStreamReader(in, StandardCharsets.UTF_8)).getString("stock-reset.timezone");
            assertNotNull(bundledDefault);
            new ShopManager(plugin);
            assertEquals(bundledDefault, config.getString("stock-reset.timezone"));
            assertEquals(bundledDefault, YamlConfiguration.loadConfiguration(
                    dataFolder.resolve("config.yml").toFile()).getString("stock-reset.timezone"));
        }
        verify(plugin).saveConfig();
        new ShopManager(plugin);
        verify(plugin, times(1)).saveConfig();
    }

    @ParameterizedTest
    @ValueSource(strings = {"UTC", "Europe/Copenhagen", "server"})
    void preservesExplicitMainTimezone(String timezone) throws Exception {
        YamlConfiguration config = new YamlConfiguration();
        config.set("stock-reset.timezone", timezone);
        ShopPlugin plugin = plugin(config, dailyShop(null));

        new ShopManager(plugin);

        assertEquals(timezone, config.getString("stock-reset.timezone"));
        verify(plugin, never()).saveConfig();
        verify(plugin, never()).getResource("config.yml");
    }

    @Test
    void readsDefaultFromBundledResourceRatherThanHardCodingIt() throws Exception {
        YamlConfiguration config = new YamlConfiguration();
        ShopPlugin plugin = plugin(config, dailyShop(null));
        when(plugin.getResource("config.yml")).thenAnswer(invocation -> new ByteArrayInputStream(
                "stock-reset:\n  timezone: Asia/Tokyo\n".getBytes(StandardCharsets.UTF_8)));

        StockResetRule rule = new ShopManager(plugin).getShop("market").getStockResetRule();

        assertEquals("Asia/Tokyo", config.getString("stock-reset.timezone"));
        assertEquals(Instant.parse("2026-10-12T15:00:00Z"),
                rule.getNextResetInstant(Instant.parse("2026-10-12T10:00:00Z"), 0));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t"})
    void shopAndItemSchedulesInheritMainTimezone(String timezone) throws Exception {
        YamlConfiguration config = new YamlConfiguration();
        config.set("stock-reset.timezone", "Europe/Copenhagen");
        YamlConfiguration shop = dailyShop(timezone);
        Map<String, Object> reset = new LinkedHashMap<>();
        reset.put("type", "DAILY");
        reset.put("timezone", timezone);
        shop.set("items", List.of(
                Map.of("material", "DIAMOND", "stock-reset", reset),
                Map.of("material", "EMERALD", "stock-reset", "DAILY")));

        var loaded = new ShopManager(plugin(config, shop)).getShop("market");
        assertDailyCopenhagenSchedule(loaded.getStockResetRule());
        assertEquals(2, loaded.getItems().size());
        loaded.getItems().forEach(item -> assertDailyCopenhagenSchedule(item.getStockResetRule()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"UTC", "server"})
    void explicitShopAndItemTimezonesOverrideMainTimezone(String timezone) throws Exception {
        YamlConfiguration config = new YamlConfiguration();
        config.set("stock-reset.timezone", "Asia/Tokyo");
        YamlConfiguration shop = dailyShop(timezone);
        shop.set("items", List.of(Map.of("material", "DIAMOND", "stock-reset",
                Map.of("type", "DAILY", "timezone", timezone))));
        var loaded = new ShopManager(plugin(config, shop)).getShop("market");
        Instant now = Instant.parse("2026-10-12T10:00:00Z");
        ZoneId zone = timezone.equals("server") ? ZoneId.systemDefault() : ZoneId.of(timezone);
        Instant expected = LocalDate.ofInstant(now, zone).plusDays(1).atStartOfDay(zone).toInstant();

        assertEquals(expected, loaded.getStockResetRule().getNextResetInstant(now, 0));
        assertEquals(expected, loaded.getItems().get(0).getStockResetRule().getNextResetInstant(now, 0));
    }

    @Test
    void rebuildingManagerUsesUpdatedMainTimezone() throws Exception {
        YamlConfiguration config = new YamlConfiguration();
        config.set("stock-reset.timezone", "UTC");
        ShopPlugin plugin = plugin(config, dailyShop(null));
        Instant now = Instant.parse("2026-10-12T10:00:00Z");
        assertEquals(Instant.parse("2026-10-13T00:00:00Z"), new ShopManager(plugin)
                .getShop("market").getStockResetRule().getNextResetInstant(now, 0));

        config.set("stock-reset.timezone", "Europe/Copenhagen");
        assertDailyCopenhagenSchedule(new ShopManager(plugin).getShop("market").getStockResetRule());
    }

    private void assertDailyCopenhagenSchedule(StockResetRule rule) {
        assertNotNull(rule);
        Instant beforeReset = Instant.parse("2026-10-12T21:59:59Z");
        Instant reset = Instant.parse("2026-10-12T22:00:00Z");
        assertEquals(reset, rule.getNextResetInstant(beforeReset, 0));
        long previousReset = Instant.parse("2026-10-11T22:00:00Z").toEpochMilli();
        assertFalse(rule.shouldReset(previousReset, beforeReset));
        assertTrue(rule.shouldReset(previousReset, reset));
        assertFalse(rule.shouldReset(reset.toEpochMilli(), reset));
    }

    private YamlConfiguration dailyShop(String timezone) {
        YamlConfiguration shop = new YamlConfiguration();
        shop.set("stock-reset.type", "DAILY");
        shop.set("stock-reset.timezone", timezone);
        return shop;
    }

    private ShopPlugin plugin(YamlConfiguration config, YamlConfiguration shop) throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class);
        ShopFileManager files = mock(ShopFileManager.class);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getDataFolder()).thenReturn(dataFolder.toFile());
        when(plugin.getShopFileManager()).thenReturn(files);
        when(files.getShopKeys()).thenReturn(Set.of("market"));
        when(files.getShopConfig("market")).thenReturn(shop);
        when(plugin.getResource("config.yml")).thenAnswer(invocation -> getClass().getResourceAsStream("/config.yml"));
        doAnswer(invocation -> {
            config.save(new File(dataFolder.toFile(), "config.yml"));
            return null;
        }).when(plugin).saveConfig();
        return plugin;
    }
}
