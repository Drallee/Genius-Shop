package me.dralle.shop.api;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import me.dralle.shop.ShopPlugin;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.plugin.PluginDescriptionFile;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.MockedStatic;

import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConfigApiServerRevisionTest {
    @TempDir Path root;
    private ShopPlugin plugin;
    private ConfigApiServer api;
    private MockedStatic<Bukkit> bukkit;
    private MockedStatic<Material> materials;
    private final String config = "smart-spawner-support: false\napi: {key: top-secret}\neconomy-safety: {max-unit-price: 10}\n";

    @BeforeEach void setup() throws Exception {
        plugin = mock(ShopPlugin.class);
        when(plugin.getDataFolder()).thenReturn(root.toFile());
        YamlConfiguration yaml = new YamlConfiguration();
        yaml.loadFromString(config);
        when(plugin.getConfig()).thenReturn(yaml);
        when(plugin.getDescription()).thenReturn(new PluginDescriptionFile("Genius-Shop", "test", "me.dralle.shop.ShopPlugin"));
        Files.writeString(root.resolve("config.yml"), config);
        Files.createDirectories(root.resolve("shops"));
        Files.writeString(root.resolve("shops/blocks.yml"), "rows: 3\nitems: []\n");
        api = new ConfigApiServer(plugin, 0, "unused");
        Class<?> session = Class.forName(ConfigApiServer.class.getName() + "$SessionData");
        Constructor<?> constructor = session.getDeclaredConstructor(String.class, String.class, long.class);
        constructor.setAccessible(true);
        Field sessions = ConfigApiServer.class.getDeclaredField("sessions");
        sessions.setAccessible(true);
        @SuppressWarnings("unchecked") Map<String, Object> values = (Map<String, Object>) sessions.get(api);
        values.put("test-session", constructor.newInstance("Admin", "127.0.0.1", System.currentTimeMillis() + 60000));
        Player player = mock(Player.class);
        when(player.isOnline()).thenReturn(true);
        when(player.hasPermission("geniusshop.admin")).thenReturn(true);
        when(player.getAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 1234));
        bukkit = mockStatic(Bukkit.class);
        bukkit.when(() -> Bukkit.getPlayerExact("Admin")).thenReturn(player);
        materials = mockStatic(Material.class);
        materials.when(Material::values).thenReturn(new Material[0]);
    }

    @AfterEach void teardown() { materials.close(); bukkit.close(); }

    private record Response(int status, JsonObject data) {}

    private Response call(String method, String path, String body, String revision) throws Exception {
        HttpExchange exchange = mock(HttpExchange.class);
        Headers headers = new Headers();
        headers.set("X-Session-Token", "test-session");
        if (revision != null) headers.set("X-File-Revision", revision);
        when(exchange.getRequestHeaders()).thenReturn(headers);
        when(exchange.getResponseHeaders()).thenReturn(new Headers());
        when(exchange.getRequestMethod()).thenReturn(method);
        when(exchange.getRequestURI()).thenReturn(URI.create(path));
        when(exchange.getRemoteAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 1234));
        when(exchange.getRequestBody()).thenReturn(new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        when(exchange.getResponseBody()).thenReturn(output);
        int[] status = new int[1];
        doAnswer(invocation -> { status[0] = invocation.getArgument(0); return null; }).when(exchange).sendResponseHeaders(anyInt(), anyLong());
        Method handler = ConfigApiServer.class.getDeclaredMethod("handleRequest", HttpExchange.class);
        handler.setAccessible(true);
        handler.invoke(api, exchange);
        return new Response(status[0], JsonParser.parseString(output.toString(StandardCharsets.UTF_8)).getAsJsonObject());
    }

    private String revision(String file) throws IOException { return new RevisionedFileStore(root.toFile()).read(root.resolve(file).toFile()).revision(); }
    private String content(String source) { return new com.google.gson.Gson().toJson(Map.of("content", source)); }

    @Test void loadedContentsAndRevisionsAreReturnedTogetherWithoutConfigSecrets() throws Exception {
        Response files = call("GET", "/api/files", "", null);
        assertEquals(200, files.status());
        assertEquals(Files.readString(root.resolve("shops/blocks.yml")), files.data().getAsJsonObject("shops").get("blocks.yml").getAsString());
        assertEquals(revision("shops/blocks.yml"), files.data().getAsJsonObject("revisions").get("shops/blocks.yml").getAsString());
        assertEquals(revision("config.yml"), files.data().getAsJsonObject("revisions").get("config.yml").getAsString());
        assertFalse(files.data().toString().contains("top-secret"));
    }

    @Test void externalEditsRejectStaleSavesAndReturnLatestContent() throws Exception {
        String original = revision("shops/blocks.yml");
        Files.writeString(root.resolve("shops/blocks.yml"), "rows: 4\nitems: []\n");
        Response conflict = call("POST", "/api/file/shops/blocks.yml", content("rows: 5\nitems: []\n"), original);
        assertEquals(409, conflict.status());
        assertEquals("rows: 4\nitems: []\n", conflict.data().get("content").getAsString());
        assertEquals("shops/blocks.yml", conflict.data().get("fileName").getAsString());
        assertEquals(revision("shops/blocks.yml"), conflict.data().get("revision").getAsString());
        assertEquals("rows: 4\nitems: []\n", Files.readString(root.resolve("shops/blocks.yml")));
        verify(plugin, never()).reloadPlugin();
    }

    @Test void oldClientsCannotBypassRevisionChecksAndFreshSavesAdvanceTheRevision() throws Exception {
        String original = revision("shops/blocks.yml");
        assertEquals(428, call("POST", "/api/file/shops/blocks.yml", content("rows: 5\n"), null).status());
        Response saved = call("POST", "/api/file/shops/blocks.yml", content("rows: 4\nitems: []\n"), original);
        assertEquals(200, saved.status());
        assertEquals(revision("shops/blocks.yml"), saved.data().get("revision").getAsString());
        assertEquals(409, call("POST", "/api/file/shops/blocks.yml", content("rows: 6\n"), original).status());
        verify(plugin, times(1)).reloadPlugin();
    }

    @Test void deletionsAndNewFileCollisionsAreAlsoProtected() throws Exception {
        String original = revision("shops/blocks.yml");
        assertEquals(409, call("DELETE", "/api/file/shops/blocks.yml", "", "missing").status());
        assertTrue(Files.exists(root.resolve("shops/blocks.yml")));
        assertEquals(200, call("DELETE", "/api/file/shops/blocks.yml", "", original).status());
        assertEquals(409, call("POST", "/api/file/shops/blocks.yml", content("rows: 3\n"), original).status());
        assertFalse(Files.exists(root.resolve("shops/blocks.yml")));
        assertEquals(200, call("POST", "/api/file/shops/blocks.yml", content("rows: 3\n"), "missing").status());
        assertEquals(409, call("POST", "/api/file/shops/blocks.yml", content("rows: 4\n"), "missing").status());
    }

    @Test void staleEconomySettingsDoNotMutateLiveConfigAndDoNotExposeCredentials() throws Exception {
        Response loaded = call("GET", "/api/economy-safety", "", null);
        assertEquals(10, loaded.data().get("maxUnitPrice").getAsInt());
        Files.writeString(root.resolve("config.yml"), config.replace("price: 10", "price: 20"));
        Response conflict = call("POST", "/api/economy-safety", "{\"settings\":{\"maxUnitPrice\":30}}", loaded.data().get("revision").getAsString());
        assertEquals(409, conflict.status());
        assertFalse(conflict.data().toString().contains("top-secret"));
        assertEquals(20, JsonParser.parseString(conflict.data().get("content").getAsString()).getAsJsonObject().get("maxUnitPrice").getAsInt());
        assertEquals(10, plugin.getConfig().getInt("economy-safety.max-unit-price"));
        verify(plugin, never()).reloadPlugin();
        verify(plugin, never()).saveConfig();
    }

    @Test void historyRestoreCannotBypassTheSameRevisionGuard() throws Exception {
        Files.writeString(root.resolve("activity-log.json"), "[{\"id\":7,\"action\":\"updated\",\"details\":{\"fileName\":\"shops/blocks.yml\"},\"beforeData\":{\"content\":\"items: []\\n\"}}]");
        String original = revision("shops/blocks.yml");
        Files.writeString(root.resolve("shops/blocks.yml"), "rows: 4\nitems: []\n");
        assertEquals(409, call("POST", "/api/activity-log/rollback", "{\"id\":7}", original).status());
        assertEquals("rows: 4\nitems: []\n", Files.readString(root.resolve("shops/blocks.yml")));
        assertEquals(200, call("POST", "/api/activity-log/rollback", "{\"id\":7}", revision("shops/blocks.yml")).status());
        assertEquals("items: []\n", Files.readString(root.resolve("shops/blocks.yml")));
    }
}
