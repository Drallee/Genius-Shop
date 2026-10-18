package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ShopTimeUtilTimezoneTest {
    @Test
    void globalTimezoneChangesAvailabilityAndReloadUsesNewValue() {
        var config = new YamlConfiguration();
        var plugin = mock(ShopPlugin.class);
        when(plugin.getConfig()).thenReturn(config);
        config.set("timezone", "Europe/Copenhagen");
        assertEquals(ZoneId.of("Europe/Copenhagen"), ShopTimeUtil.getTimezone(plugin));
        config.set("timezone", "Asia/Tokyo");
        assertEquals(ZoneId.of("Asia/Tokyo"), ShopTimeUtil.getTimezone(plugin));
        assertTrue(ShopTimeUtil.isShopAvailable(List.of("00:00-23:59"), plugin));
    }

    @Test
    void dateAndTimeUseTheSameConfiguredInstantAcrossMidnight() {
        Instant instant = Instant.parse("2026-10-16T22:30:00Z");
        var restrictions = List.of("SATURDAY", "17", "October", "2026",
                "2026-10-17 to 2026-10-17", "00:00-01:00");
        assertTrue(available(restrictions, instant, "Europe/Copenhagen"));
        assertFalse(available(restrictions, instant, "UTC"));
        assertTrue(available(List.of("23:00-01:00"), instant, "Europe/Copenhagen"));
        assertTrue(available(List.of(), instant, "UTC"));
    }

    @Test
    void daylightSavingUsesLocalWallClockOnBothSidesOfTheChange() {
        var restrictions = List.of("SUNDAY", "02:00-03:00");
        assertTrue(available(restrictions, Instant.parse("2026-10-25T00:30:00Z"), "Europe/Copenhagen"));
        assertTrue(available(restrictions, Instant.parse("2026-10-25T01:30:00Z"), "Europe/Copenhagen"));
        assertFalse(available(restrictions, Instant.parse("2026-10-25T02:30:00Z"), "Europe/Copenhagen"));
    }

    @Test
    void absentBlankServerAndInvalidSettingsFallBackToServerZone() {
        var config = new YamlConfiguration();
        var plugin = mock(ShopPlugin.class);
        when(plugin.getConfig()).thenReturn(config);
        for (String value : new String[]{null, "", " ", "SERVER", "not/a-zone"}) {
            config.set("timezone", value);
            assertEquals(ZoneId.systemDefault(), ShopTimeUtil.getTimezone(plugin));
        }
    }

    private boolean available(List<String> restrictions, Instant instant, String zone) {
        return ShopTimeUtil.isShopAvailable(restrictions, Clock.fixed(instant, ZoneId.of(zone)));
    }
}
