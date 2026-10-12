package me.dralle.shop.util;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ShopItemUtilMetadataTest {
    @Test
    void readsTypedEnchantmentsIntoIndependentMap() {
        Map<String, Integer> source = new LinkedHashMap<>(Map.of("sharpness", 5));
        Map<String, Integer> result = ShopItemUtil.readEnchantmentMetadata(source);
        assertEquals(source, result);
        source.clear();
        assertEquals(Map.of("sharpness", 5), result);
    }

    @Test
    void rejectsMissingAndMalformedMetadataWithoutUncheckedCast() {
        assertNull(ShopItemUtil.readEnchantmentMetadata(null));
        assertNull(ShopItemUtil.readEnchantmentMetadata("sharpness"));
        assertNull(ShopItemUtil.readEnchantmentMetadata(Map.of("sharpness", "5")));
        assertNull(ShopItemUtil.readEnchantmentMetadata(Map.of(1, 5)));
        assertEquals(Map.of(), ShopItemUtil.readEnchantmentMetadata(Map.of()));
    }
}
