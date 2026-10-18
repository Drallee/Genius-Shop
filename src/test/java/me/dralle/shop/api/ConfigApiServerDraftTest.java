package me.dralle.shop.api;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import me.dralle.shop.ShopPlugin;
import org.bukkit.Server;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.mockito.MockedStatic;
import org.junit.jupiter.api.AfterEach;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.scheduler.BukkitScheduler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.*;
import java.lang.reflect.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConfigApiServerDraftTest {
    @TempDir Path root;
    private ShopPlugin plugin;
    private ConfigApiServer api;
    private BukkitScheduler scheduler;
    private MockedStatic<Bukkit> bukkit;

    @BeforeEach void setup() throws Exception {
        plugin = mock(ShopPlugin.class);
        when(plugin.getDataFolder()).thenReturn(root.toFile());
        YamlConfiguration config = new YamlConfiguration();
        config.loadFromString("economy-safety: {max-unit-price: 10}\n");
        when(plugin.getConfig()).thenReturn(config);
        Files.writeString(root.resolve("config.yml"), config.saveToString());
        Server server = mock(Server.class);
        scheduler = mock(BukkitScheduler.class);
        when(plugin.getServer()).thenReturn(server);
        when(server.getScheduler()).thenReturn(scheduler);
        when(scheduler.callSyncMethod(eq(plugin), any())).thenAnswer(invocation -> {
            CompletableFuture<Object> result = new CompletableFuture<>();
            try { result.complete(((Callable<?>) invocation.getArgument(1)).call()); }
            catch (Exception e) { result.completeExceptionally(e); }
            return result;
        });
        api = new ConfigApiServer(plugin, 0, "unused");
        Player player = mock(Player.class);
        when(player.isOp()).thenReturn(true);
        when(player.isOnline()).thenReturn(true);
        when(player.getAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 25565));
        bukkit = mockStatic(Bukkit.class);
        bukkit.when(() -> Bukkit.getPlayerExact("unknown")).thenReturn(player);
        bukkit.when(() -> Bukkit.getPlayerExact("test")).thenReturn(player);
        Class<?> sessionType = Class.forName(ConfigApiServer.class.getName() + "$SessionData");
        Constructor<?> constructor = sessionType.getDeclaredConstructor(String.class, String.class, long.class);
        constructor.setAccessible(true);
        Field sessions = ConfigApiServer.class.getDeclaredField("sessions");
        sessions.setAccessible(true);
        @SuppressWarnings("unchecked") var map = (java.util.Map<String, Object>) sessions.get(api);
        map.put("test-session", constructor.newInstance("test", "127.0.0.1", Long.MAX_VALUE));
    }

    @AfterEach void cleanup() { if (bukkit != null) bukkit.close(); }

    private record Response(HttpExchange exchange, ByteArrayOutputStream output) {
        JsonObject json() { return JsonParser.parseString(output.toString(StandardCharsets.UTF_8)).getAsJsonObject(); }
    }

    private Response exchange(String body) {
        HttpExchange exchange = mock(HttpExchange.class);
        Headers headers = new Headers();
        headers.set("X-Session-Token", "test-session");
        when(exchange.getRequestHeaders()).thenReturn(headers);
        when(exchange.getResponseHeaders()).thenReturn(new Headers());
        when(exchange.getRequestBody()).thenReturn(new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
        when(exchange.getRemoteAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 50000));
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        when(exchange.getResponseBody()).thenReturn(output);
        return new Response(exchange, output);
    }

    private void invoke(String name, Response response, String... arguments) throws Exception {
        if (name.equals("handleSaveFile") || name.equals("handleDeleteFile") || name.equals("handleSaveEconomySafety")) {
            Field draftField = ConfigApiServer.class.getDeclaredField("drafts");
            draftField.setAccessible(true);
            var store = (me.dralle.shop.config.ConfigurationDraftStore) draftField.get(api);
            String file = name.equals("handleSaveEconomySafety") ? "config.yml" : arguments[0];
            response.exchange().getRequestHeaders().set("X-File-Revision", RevisionedFileStore.snapshot(store.files("test").get(file)).revision());
        }
        Class<?>[] types = new Class<?>[arguments.length + 1];
        Object[] values = new Object[types.length];
        types[0] = HttpExchange.class; values[0] = response.exchange();
        for (int i = 0; i < arguments.length; i++) { types[i + 1] = String.class; values[i + 1] = arguments[i]; }
        Method method = ConfigApiServer.class.getDeclaredMethod(name, types);
        method.setAccessible(true);
        try { method.invoke(api, values); }
        catch (InvocationTargetException e) { if (e.getCause() instanceof Exception cause) throw cause; throw e; }
    }

    @Test void savingReadingAndDeletingShopFilesOnlyAffectsTheDraft() throws Exception {
        Files.createDirectories(root.resolve("shops"));
        Files.writeString(root.resolve("shops/a.yml"), "items: []\n");
        Response saved = exchange("{\"content\":\"rows: 4\\nitems: []\\n\"}");
        invoke("handleSaveFile", saved, "shops/a.yml");
        assertTrue(saved.json().get("success").getAsBoolean());
        assertEquals("items: []\n", Files.readString(root.resolve("shops/a.yml")));
        Response read = exchange("");
        invoke("handleGetFile", read, "shops/a.yml");
        assertEquals("rows: 4\nitems: []\n", read.json().get("content").getAsString());
        invoke("handleDeleteFile", exchange(""), "shops/a.yml");
        assertTrue(Files.exists(root.resolve("shops/a.yml")));
        verify(plugin, never()).reloadPlugin();
        verify(plugin, never()).reloadPublishedConfiguration();
        verifyNoInteractions(scheduler);
    }

    @Test void economySettingsAreClonedRatherThanMutatingTheLiveConfig() throws Exception {
        String baseline = Files.readString(root.resolve("config.yml"));
        Response saved = exchange("{\"settings\":{\"maxUnitPrice\":25}}");
        invoke("handleSaveEconomySafety", saved);
        assertEquals(25, saved.json().getAsJsonObject("economySafety").get("maxUnitPrice").getAsInt());
        assertEquals(10, plugin.getConfig().getInt("economy-safety.max-unit-price"));
        assertEquals(baseline, Files.readString(root.resolve("config.yml")));
        verify(plugin, never()).saveConfig();
        verify(plugin, never()).reloadPlugin();
    }

    @Test void publicationInstallsTheReviewedSetInOneServerTask() throws Exception {
        invoke("handleSaveFile", exchange("{\"content\":\"items: []\\n\"}"), "shops/new.yml");
        Response reviewed = exchange("");
        invoke("handleDraftAction", reviewed, "/api/draft/review", "GET");
        assertTrue(reviewed.json().getAsJsonArray("errors").isEmpty(), reviewed.json().toString());
        String token = reviewed.json().get("token").getAsString();
        assertFalse(Files.exists(root.resolve("shops/new.yml")));
        doAnswer(invocation -> {
            assertEquals("items: []\n", Files.readString(root.resolve("shops/new.yml")));
            return null;
        }).when(plugin).reloadPublishedConfiguration();
        Response published = exchange("{\"token\":\"" + token + "\"}");
        invoke("handleDraftAction", published, "/api/draft/publish", "POST");
        assertTrue(published.json().get("success").getAsBoolean());
        assertEquals(0, published.json().getAsJsonObject("draft").get("changedFiles").getAsInt());
        verify(scheduler, times(1)).callSyncMethod(eq(plugin), any());
        verify(plugin, times(1)).reloadPublishedConfiguration();
    }

    @Test void missingReviewTokenCannotPublish() throws Exception {
        invoke("handleSaveFile", exchange("{\"content\":\"items: []\\n\"}"), "shops/new.yml");
        assertThrows(java.util.ConcurrentModificationException.class,
                () -> invoke("handleDraftAction", exchange("{}"), "/api/draft/publish", "POST"));
        assertFalse(Files.exists(root.resolve("shops/new.yml")));
        verify(plugin, never()).reloadPublishedConfiguration();
    }
}
