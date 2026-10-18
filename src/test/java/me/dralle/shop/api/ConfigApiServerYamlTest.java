package me.dralle.shop.api;

import com.google.gson.Gson;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import me.dralle.shop.ShopPlugin;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class ConfigApiServerYamlTest {
    @TempDir Path folder;

    @Test
    void rejectsInvalidYamlBeforeOverwritingExistingShop() throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class);
        when(plugin.getDataFolder()).thenReturn(folder.toFile());
        Path shops = Files.createDirectories(folder.resolve("shops"));
        Path file = shops.resolve("weekend_market.yml");
        String original = "# Keep this comment\ngui-name: 'Weekend'\nrows: 4\nitems: []\n";
        Files.writeString(file, original);
        HttpExchange exchange = mock(HttpExchange.class);
        String request = new Gson().toJson(Map.of("content", "items:\n  - name: 'Player's Iron'\n"));
        when(exchange.getRequestBody()).thenReturn(new ByteArrayInputStream(request.getBytes(StandardCharsets.UTF_8)));
        when(exchange.getRequestHeaders()).thenReturn(new Headers());
        when(exchange.getResponseHeaders()).thenReturn(new Headers());
        when(exchange.getRequestURI()).thenReturn(URI.create("/api/file/shops/weekend_market.yml"));
        ByteArrayOutputStream response = new ByteArrayOutputStream();
        when(exchange.getResponseBody()).thenReturn(response);
        ConfigApiServer server = new ConfigApiServer(plugin, 0, "test");
        var save = ConfigApiServer.class.getDeclaredMethod("handleSaveFile", HttpExchange.class, String.class);
        save.setAccessible(true);
        Player admin = mock(Player.class);
        when(admin.isOp()).thenReturn(true);
        try (var bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(() -> Bukkit.getPlayerExact("unknown")).thenReturn(admin);
            save.invoke(server, exchange, "shops/weekend_market.yml");
        }
        verify(exchange).sendResponseHeaders(eq(400), anyLong());
        assertTrue(response.toString(StandardCharsets.UTF_8).contains("Invalid YAML Syntax"));
        assertEquals(original, Files.readString(file));
        verify(plugin, never()).reloadPlugin();
    }
}
