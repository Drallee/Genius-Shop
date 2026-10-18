package me.dralle.shop.api;

import com.google.gson.JsonParser;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import me.dralle.shop.ShopPlugin;
import me.dralle.shop.data.TransactionLedger;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SalesAnalyticsApiTest {
    @TempDir Path folder;

    @SuppressWarnings("unchecked")
    private void session(ConfigApiServer api) throws Exception {
        var type = Class.forName(ConfigApiServer.class.getName() + "$SessionData");
        var constructor = type.getDeclaredConstructor(String.class, String.class, long.class);
        constructor.setAccessible(true);
        var field = ConfigApiServer.class.getDeclaredField("sessions");
        field.setAccessible(true);
        ((Map<String, Object>) field.get(api)).put("token", constructor.newInstance("Admin", "127.0.0.1", System.currentTimeMillis() + 60000));
    }

    private String request(ConfigApiServer api, String method, String query, boolean token, int status) throws Exception {
        var exchange = mock(HttpExchange.class);
        var headers = new Headers();
        if (token) headers.set("X-Session-Token", "token");
        when(exchange.getRequestHeaders()).thenReturn(headers);
        var responseHeaders = new Headers();
        when(exchange.getResponseHeaders()).thenReturn(responseHeaders);
        when(exchange.getRequestURI()).thenReturn(URI.create("/api/sales-analytics" + query));
        when(exchange.getRequestMethod()).thenReturn(method);
        when(exchange.getRemoteAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 1234));
        var output = new ByteArrayOutputStream();
        when(exchange.getResponseBody()).thenReturn(output);
        var handler = ConfigApiServer.class.getDeclaredMethod("handleRequest", HttpExchange.class);
        handler.setAccessible(true);
        handler.invoke(api, exchange);
        verify(exchange).sendResponseHeaders(eq(status), anyLong());
        if (status == 200) assertEquals("no-store", responseHeaders.getFirst("Cache-Control"));
        return output.toString(StandardCharsets.UTF_8);
    }

    @Test
    void requiresOnlineAdministratorSessionAndIsReadOnly() throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class);
        when(plugin.getDataFolder()).thenReturn(folder.toFile());
        when(plugin.getLogger()).thenReturn(Logger.getAnonymousLogger());
        ConfigApiServer api = new ConfigApiServer(plugin, 0, "unused");
        Player player = mock(Player.class);
        when(player.isOnline()).thenReturn(true);
        when(player.getAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 25565));
        when(player.hasPermission("geniusshop.admin")).thenReturn(true);
        try (var bukkit = mockStatic(Bukkit.class); var ledger = new TransactionLedger(folder.resolve("ledger.db").toFile())) {
            bukkit.when(() -> Bukkit.getPlayerExact("Admin")).thenReturn(player);
            when(plugin.getTransactionLedger()).thenReturn(ledger);
            request(api, "GET", "", false, 401);
            session(api);
            var json = JsonParser.parseString(request(api, "GET", "?from=2026-10-01&through=2026-10-18", true, 200)).getAsJsonObject();
            assertEquals(0, json.get("playerInflow").getAsDouble());
            assertEquals("2026-10-01", json.getAsJsonObject("filter").get("from").getAsString());
            assertTrue(json.has("prices"));
            request(api, "POST", "", true, 405);
            request(api, "GET", "?from=2026-02-30", true, 400);
            request(api, "GET", "?shop=a&shop=b", true, 400);
            when(plugin.getTransactionLedger()).thenReturn(null);
            request(api, "GET", "", true, 503);
            when(plugin.getTransactionLedger()).thenReturn(ledger);
            ledger.close();
            String failure = request(api, "GET", "", true, 500);
            assertFalse(failure.contains("SQLException"));
            assertFalse(failure.contains(folder.toString()));
            when(player.hasPermission("geniusshop.admin")).thenReturn(false);
            request(api, "GET", "", true, 401);
            when(player.hasPermission("geniusshop.admin")).thenReturn(true);
            when(player.isOnline()).thenReturn(false);
            session(api);
            request(api, "GET", "", true, 401);
        }
    }
}
