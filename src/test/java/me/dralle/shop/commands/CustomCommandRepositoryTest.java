package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.io.File;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CustomCommandRepositoryTest {

    @Test
    void loadsValidSellAllCommand() {
        CustomCommandLoadResult result = parse("""
                commands:
                  sellall:
                    enabled: true
                    permission: "geniusshop.command.sellall"
                    action:
                      type: SELL_ALL
                """);

        assertTrue(result.getErrors().isEmpty());
        assertEquals(1, result.getCommands().size());
        assertEquals(CustomCommandActionType.SELL_ALL, result.getCommands().get(0).getAction().getType());
    }

    @Test
    void rejectsInvalidCommandName() {
        CustomCommandLoadResult result = parse("""
                commands:
                  Bad Command:
                    enabled: true
                    action:
                      type: SELL_ALL
                """);

        assertFalse(result.getErrors().isEmpty());
        assertTrue(result.getErrors().stream().anyMatch(e -> e.contains("Invalid command")));
    }

    @Test
    void detectsDuplicateAliasAndCommandName() {
        CustomCommandLoadResult result = parse("""
                commands:
                  one:
                    enabled: true
                    aliases: [two]
                    action:
                      type: SELL_ALL
                  two:
                    enabled: true
                    action:
                      type: SELL_ALL
                """);

        assertFalse(result.getErrors().isEmpty());
        assertTrue(result.getErrors().stream().anyMatch(e -> e.contains("Duplicate command or alias 'two'")));
    }

    @Test
    void detectsAliasConflictBetweenCommands() {
        CustomCommandLoadResult result = parse("""
                commands:
                  one:
                    enabled: true
                    aliases: [shared]
                    action:
                      type: SELL_ALL
                  two:
                    enabled: true
                    aliases: [shared]
                    action:
                      type: SELL_ALL
                """);

        assertFalse(result.getErrors().isEmpty());
        assertTrue(result.getErrors().stream().anyMatch(e -> e.contains("Duplicate command or alias 'shared'")));
    }

    @Test
    void detectsMissingShopForEnabledOpenShopCommand() {
        CustomCommandLoadResult result = parse("""
                commands:
                  blocks:
                    enabled: true
                    action:
                      type: OPEN_SHOP
                      shop: missing
                """);

        assertFalse(result.getErrors().isEmpty());
        assertTrue(result.getErrors().stream().anyMatch(e -> e.contains("references missing shop 'missing'")));
    }

    @Test
    void allowsDisabledProtectedCommandName() {
        CustomCommandLoadResult result = parse("""
                commands:
                  shop:
                    enabled: false
                    action:
                      type: OPEN_SHOP
                      shop: missing
                """);

        assertTrue(result.getErrors().isEmpty());
        assertEquals(1, result.getDisabledCount());
    }

    @Test
    void rejectsEnabledProtectedCommandName() {
        CustomCommandLoadResult result = parse("""
                commands:
                  shop:
                    enabled: true
                    action:
                      type: SELL_ALL
                """);

        assertFalse(result.getErrors().isEmpty());
        assertTrue(result.getErrors().stream().anyMatch(e -> e.contains("conflicts with a protected command")));
    }

    @Test
    void saveValidationAllowsProtectedCommandNameDraft() {
        CustomCommandRepository repository = repository();

        assertTrue(repository.validateYamlForSave("""
                commands:
                  shop:
                    enabled: true
                    action:
                      type: SELL_ALL
                """).isEmpty());
    }

    @Test
    void keepsValidEnabledCommandsWhenAnotherEnabledCommandIsInvalid() {
        CustomCommandLoadResult result = parse("""
                commands:
                  sellall:
                    enabled: true
                    action:
                      type: SELL_ALL
                  broken:
                    enabled: true
                    action:
                      type: OPEN_SHOP
                      shop: missing
                """);

        assertFalse(result.getErrors().isEmpty());
        assertEquals(1, result.getCommands().stream().filter(CustomCommandDefinition::isEnabled).count());
        assertEquals("sellall", result.getCommands().stream().filter(CustomCommandDefinition::isEnabled).findFirst().orElseThrow().getName());
    }

    private CustomCommandLoadResult parse(String yaml) {
        CustomCommandRepository repository = repository();
        YamlConfiguration config = new YamlConfiguration();
        try {
            config.loadFromString(yaml);
        } catch (Exception e) {
            throw new AssertionError(e);
        }
        return repository.parse(config);
    }

    private CustomCommandRepository repository() {
        ShopPlugin plugin = mock(ShopPlugin.class);
        when(plugin.getDataFolder()).thenReturn(new File("."));
        return new CustomCommandRepository(plugin);
    }
}
