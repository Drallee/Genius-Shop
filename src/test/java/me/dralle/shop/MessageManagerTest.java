package me.dralle.shop;

import org.bukkit.ChatColor;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MessageManagerTest {
    @Test
    void readsLegacyUnquotedOnKeyWithoutLosingTheConfiguredTranslation() throws Exception {
        YamlConfiguration language = new YamlConfiguration();
        language.loadFromString("messages:\n  on: ' am '\n");
        assertEquals(" am ", manager(language).getMessage("on"));
    }

    @Test
    void quotedOnOverridesLegacyTrueKey() throws Exception {
        YamlConfiguration language = new YamlConfiguration();
        language.loadFromString("messages:\n  true: ' old '\n  \"on\": ' on '\n");
        assertEquals(" on ", manager(language).getMessage("on"));
    }

    @Test
    void allBundledLanguagesKeepOnAsAStringKey() throws Exception {
        try (var files = java.nio.file.Files.list(java.nio.file.Path.of("src/main/resources/languages"))) {
            for (var file : files.filter(path -> path.toString().endsWith(".yml")).toList()) {
                YamlConfiguration language = new YamlConfiguration();
                String key = java.nio.file.Files.readAllLines(file, java.nio.charset.StandardCharsets.UTF_8).stream()
                        .filter(line -> line.startsWith("  \"on\":"))
                        .findFirst().orElseThrow(() -> new AssertionError("Missing quoted on key: " + file));
                language.loadFromString("messages:\n" + key + "\n");
                org.junit.jupiter.api.Assertions.assertNotNull(language.getString("messages.on"), file.toString());
            }
        }
    }
    @Test
    void replacesVersionInTranslatedLoreBeforeGradientColoring() {
        YamlConfiguration language = new YamlConfiguration();
        language.set("messages.menus.main.info.lore", List.of(
                "&7Version: <gradient:#46F7D9:#62ED44>%version%</gradient>"));
        YamlConfiguration menu = new YamlConfiguration();
        menu.set("items.info.lore", List.of("menus.main.info.lore"));

        List<String> lore = manager(language).resolveConfigStringList(menu, "items.info.lore",
                line -> line.replace("%version%", "2.5.0"));

        assertEquals(List.of("Version: 2.5.0"), plain(lore));
        assertFalse(lore.get(0).contains("<gradient:"));
    }

    @Test
    void replacesAvailableTimesBeforeColoringAndSplittingInlineLore() {
        YamlConfiguration language = new YamlConfiguration();
        YamlConfiguration menu = new YamlConfiguration();
        menu.set("items.market.lore", List.of(
                "&7Available: <gradient:#C8FF00:#9BFCA2>%available-times%</gradient>"));

        List<String> lore = manager(language).resolveConfigStringList(menu, "items.market.lore",
                line -> line.replace("%available-times%", "Friday-Sunday</gradient>\n<gradient:#C8FF00:#9BFCA2>10 AM-10 PM"));

        assertEquals(List.of("Available: Friday-Sunday", "10 AM-10 PM"), plain(lore));
    }

    @Test
    void existingResolverStillColorsAndSplitsLore() {
        YamlConfiguration language = new YamlConfiguration();
        assertEquals(List.of("First", "Second"), plain(manager(language)
                .resolveConfiguredStringList(List.of("&aFirst\n&bSecond"))));
    }

    private MessageManager manager(YamlConfiguration language) {
        language.set("messages.prefix", "");
        ShopPlugin plugin = mock(ShopPlugin.class);
        when(plugin.getMessagesConfig()).thenReturn(language);
        return new MessageManager(plugin);
    }

    private List<String> plain(List<String> lines) {
        return lines.stream().map(ChatColor::stripColor).toList();
    }
}
