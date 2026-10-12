package me.dralle.shop.items;

import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CustomItemRepositoryTest {
    @Test
    void bundledExamplesAndDefaultsAreValid() throws Exception {
        withMaterials(() -> {
            try (var resource = getClass().getResourceAsStream("/custom-items.yml")) {
                String source = new String(resource.readAllBytes(), StandardCharsets.UTF_8);
                assertTrue(CustomItemRepository.validateYaml(source).isEmpty());
                YamlConfiguration config = new YamlConfiguration();
                config.loadFromString(source);
                var items = CustomItemRepository.parse(config);
                var premium = items.get("premium-sell-wand").actions().get("right-click-container");
                assertEquals(1.5, premium.multiplier());
                assertFalse(premium.useCampaigns());
                assertTrue(items.get("sell-wand").actions().get("right-click-container").useCampaigns());
                assertFalse(items.get("command-token").enabled());
                assertEquals(10, items.get("command-token").maxUses());
            } catch (Exception ex) { throw new AssertionError(ex); }
        });
    }

    @Test
    void rejectsInvalidMoneyTriggersCommandsAndUses() {
        withMaterials(() -> {
            for (String setting : new String[]{"multiplier: .nan", "multiplier: .inf", "multiplier: -1", "multiplier: 0", "use-campaigns: nope"}) {
                assertFalse(CustomItemRepository.validateYaml("items:\n  wand:\n    actions:\n      right-click-container:\n        type: SELL_CONTAINER\n        " + setting + "\n").isEmpty(), setting);
            }
            assertFalse(CustomItemRepository.validateYaml("items:\n  wand:\n    max-uses: 1.5\n    actions: {right-click-air: {type: OPEN_MAIN_MENU}}\n").isEmpty());
            assertFalse(CustomItemRepository.validateYaml("items:\n  wand:\n    actions: {right-click-air: {type: SELL_CONTAINER}}\n").isEmpty());
            assertFalse(CustomItemRepository.validateYaml("items:\n  wand:\n    actions: {right-click-air: {type: COMMAND}}\n").isEmpty());
            assertFalse(CustomItemRepository.validateYaml("items: []\n").isEmpty());
        });
    }

    private void withMaterials(Runnable test) {
        // Material.isItem consults the server registry; parsing tests supply a valid item material.
        Material item = mock(Material.class);
        when(item.isItem()).thenReturn(true);
        try (var materials = mockStatic(Material.class)) {
            materials.when(() -> Material.matchMaterial(anyString())).thenReturn(item);
            test.run();
        }
    }
}
