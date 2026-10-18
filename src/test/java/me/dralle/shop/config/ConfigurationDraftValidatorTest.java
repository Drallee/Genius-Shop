package me.dralle.shop.config;

import me.dralle.shop.ShopPlugin;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConfigurationDraftValidatorTest {
    private ConfigurationDraftValidator validator() {
        ShopPlugin plugin = mock(ShopPlugin.class);
        when(plugin.getDataFolder()).thenReturn(new File("unused"));
        when(plugin.getLogger()).thenReturn(Logger.getAnonymousLogger());
        when(plugin.getConfig()).thenReturn(new YamlConfiguration());
        return new ConfigurationDraftValidator(plugin);
    }

    private void withMaterials(Runnable test) {
        Material item = mock(Material.class);
        when(item.isItem()).thenReturn(true);
        when(item.name()).thenReturn("STONE");
        try (var materials = mockStatic(Material.class)) {
            materials.when(() -> Material.matchMaterial(anyString())).thenReturn(item);
            materials.when(() -> Material.matchMaterial("INVALID")).thenReturn(null);
            test.run();
        }
    }

    @Test void checksReferencesAgainstProposedShopsAndItemsNotLiveManagers() {
        withMaterials(() -> {
            Map<String, String> files = new TreeMap<>();
            files.put("shops/new.yml", "rows: 3\nitems: [{material: STONE, slot: 0}]\n");
            files.put("menus/main-menu.yml", "items: {new: {shop-key: new}}\n");
            files.put("commands.yml", "commands: {new: {action: {type: OPEN_ITEM, shop: new, item: STONE}}}\n");
            assertEquals(List.of(), validator().validate(files));
            files.remove("shops/new.yml");
            assertTrue(validator().validate(files).stream().anyMatch(error -> error.contains("missing shop")));
            files.put("shops/new.yml", "items: []\n");
            assertTrue(validator().validate(files).stream().anyMatch(error -> error.contains("missing item")));
        });
    }

    @Test void rejectsBadSyntaxMaterialsNumbersAndDuplicateCommands() {
        withMaterials(() -> {
            assertFalse(validator().validate(Map.of("shops/a.yml", "items: [\n")).isEmpty());
            assertFalse(validator().validate(Map.of("shops/a.yml", "items: []\nitems: []\n")).isEmpty());
            assertFalse(validator().validate(Map.of("shops/a.yml", "rows: 8\nitems: [{material: INVALID, price: .nan}]\n")).isEmpty());
            String commands = "commands: {first: {aliases: [second], action: {type: SELL_ALL}}, second: {action: {type: SELL_ALL}}}\n";
            var errors = validator().validate(Map.of("commands.yml", commands));
            assertTrue(errors.stream().anyMatch(error -> error.contains("Duplicate command")), errors.toString());
        });
    }

    @Test void validatesCampaignAndReusableItemReferencesAcrossFiles() {
        withMaterials(() -> {
            Map<String, String> files = new TreeMap<>();
            files.put("shops/a.yml", "campaign: sale\nitems: [{material: STONE}]\n");
            assertTrue(validator().validate(files).stream().anyMatch(error -> error.contains("missing campaign")));
            files.put("campaigns.yml", "campaigns: [{key: sale, buy-multiplier: 0.9}]\n");
            assertEquals(List.of(), validator().validate(files));
            files.put("custom-items.yml", "items: {wand: {actions: {right-click-air: {type: OPEN_SHOP, shop: absent}}}}\n");
            assertTrue(validator().validate(files).stream().anyMatch(error -> error.contains("missing shop 'absent'")));
        });
    }

    @Test void validatesEconomyNumbersAndConfiguredLanguageReferences() {
        assertFalse(validator().validate(Map.of("config.yml", "economy-safety: {max-unit-price: .nan}\n")).isEmpty());
        assertTrue(validator().validate(Map.of("config.yml", "language: missing\n")).stream().anyMatch(error -> error.contains("language file")));
    }

    @Test void bundledConfigurationValidatesWithoutWritingToDisk() {
        withMaterials(() -> {
            Map<String, String> files = new TreeMap<>();
            Path root = Path.of("src/main/resources");
            try {
                for (String directory : List.of("shops", "menus")) {
                    try (var entries = Files.list(root.resolve(directory))) {
                        for (Path path : entries.toList()) if (path.toString().endsWith(".yml")) {
                            files.put(directory + "/" + path.getFileName(), Files.readString(path, StandardCharsets.UTF_8));
                        }
                    }
                }
                files.put("commands.yml", Files.readString(root.resolve("commands.yml")));
                files.put("custom-items.yml", Files.readString(root.resolve("custom-items.yml")));
            } catch (Exception e) { throw new AssertionError(e); }
            assertEquals(List.of(), validator().validate(files));
        });
    }
}
