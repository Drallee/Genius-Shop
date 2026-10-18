package me.dralle.shop.api;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import me.dralle.shop.ShopPlugin;
import me.dralle.shop.ShopManager;
import me.dralle.shop.data.DataManager;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.Server;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.plugin.PluginDescriptionFile;
import org.bukkit.scheduler.BukkitScheduler;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.MockedStatic;

import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConfigApiServerPermissionsTest {
    @TempDir Path root;
    private ShopPlugin plugin;
    private ConfigApiServer api;
    private Player player;
    private BukkitScheduler scheduler;
    private DataManager data;
    private MockedStatic<Bukkit> bukkit;
    private final Set<String> grants = new HashSet<>();

    @BeforeEach void setup() throws Exception {
        plugin = mock(ShopPlugin.class);
        when(plugin.getDataFolder()).thenReturn(root.toFile());
        when(plugin.getLogger()).thenReturn(Logger.getLogger("permissions-test"));
        when(plugin.getDescription()).thenReturn(new PluginDescriptionFile("Test", "1", "test.Main"));
        YamlConfiguration config = new YamlConfiguration();
        config.loadFromString("api: {key: secret-api-key}\nsmart-spawner-support: false\n");
        when(plugin.getConfig()).thenReturn(config);
        Files.writeString(root.resolve("config.yml"), config.saveToString());
        Files.writeString(root.resolve("discord.yml"), "webhook: secret-webhook\n");
        Files.writeString(root.resolve("commands.yml"), "commands: {}\n");
        Files.createDirectories(root.resolve("shops"));
        Files.writeString(root.resolve("shops/a.yml"), "items: []\n");
        data = mock(DataManager.class);
        when(plugin.getDataManager()).thenReturn(data);
        when(plugin.getShopManager()).thenReturn(mock(ShopManager.class));
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
        player = mock(Player.class);
        when(player.getName()).thenReturn("test");
        when(player.getUniqueId()).thenReturn(UUID.fromString("00000000-0000-0000-0000-000000000001"));
        when(player.isOnline()).thenReturn(true);
        when(player.getAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 25565));
        when(player.hasPermission(anyString())).thenAnswer(invocation -> grants.contains(invocation.getArgument(0)));
        bukkit = mockStatic(Bukkit.class);
        bukkit.when(() -> Bukkit.getPlayerExact("test")).thenReturn(player);
        bukkit.when(Bukkit::getConsoleSender).thenReturn(mock(org.bukkit.command.ConsoleCommandSender.class));
        api = new ConfigApiServer(plugin, 0, "unused");
        Class<?> type = Class.forName(ConfigApiServer.class.getName() + "$SessionData");
        Constructor<?> constructor = type.getDeclaredConstructor(String.class, String.class, long.class);
        constructor.setAccessible(true);
        field("sessions").put("session", constructor.newInstance("test", "127.0.0.1", Long.MAX_VALUE));
    }

    @SuppressWarnings("unchecked") private Map<String, Object> field(String name) throws Exception {
        Field field = ConfigApiServer.class.getDeclaredField(name);
        field.setAccessible(true);
        return (Map<String, Object>) field.get(api);
    }

    @AfterEach void cleanup() { if (bukkit != null) bukkit.close(); }
    private void grant(String... nodes) { for (String node : nodes) grants.add("geniusshop.editor." + node); }
    private record Response(int status, String body) {
        JsonObject json() { return JsonParser.parseString(body).getAsJsonObject(); }
    }
    private Response request(String method, String path, String body) throws Exception {
        HttpExchange exchange = mock(HttpExchange.class);
        Headers headers = new Headers();
        headers.set("X-Session-Token", "session");
        if ((method.equals("POST") || method.equals("DELETE")) && path.startsWith("/api/file/")) {
            Field draftField = ConfigApiServer.class.getDeclaredField("drafts");
            draftField.setAccessible(true);
            var store = (me.dralle.shop.config.ConfigurationDraftStore) draftField.get(api);
            headers.set("X-File-Revision", RevisionedFileStore.snapshot(store.files("test").get(path.substring("/api/file/".length()))).revision());
        }
        when(exchange.getRequestHeaders()).thenReturn(headers);
        when(exchange.getRequestMethod()).thenReturn(method);
        when(exchange.getRequestURI()).thenReturn(URI.create(path));
        when(exchange.getRemoteAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 50000));
        when(exchange.getResponseHeaders()).thenReturn(new Headers());
        when(exchange.getRequestBody()).thenReturn(new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        when(exchange.getResponseBody()).thenReturn(output);
        AtomicInteger code = new AtomicInteger();
        doAnswer(invocation -> { code.set(invocation.getArgument(0)); return null; }).when(exchange).sendResponseHeaders(anyInt(), anyLong());
        Method handler = ConfigApiServer.class.getDeclaredMethod("handleRequest", HttpExchange.class);
        handler.setAccessible(true);
        handler.invoke(api, exchange);
        return new Response(code.get(), output.toString(StandardCharsets.UTF_8));
    }
    private Response save(String file, String content) throws Exception {
        JsonObject body = new JsonObject(); body.addProperty("content", content);
        return request("POST", "/api/file/" + file, body.toString());
    }

    @Test void directRequestsCannotBypassAnyRestrictedOperation() throws Exception {
        grant("analytics");
        for (String path : List.of("/api/file/shops/a.yml", "/api/file/commands.yml", "/api/file/config.yml",
                "/api/draft/publish", "/api/draft/discard", "/api/draft/review", "/api/activity-log/rollback",
                "/api/activity-log/clear", "/api/database", "/api/economy-safety")) {
            for (String method : List.of("GET", "POST", "DELETE")) {
                assertEquals(403, request(method, path, "{}").status(), method + " " + path);
            }
        }
        verifyNoInteractions(data);
        assertEquals("items: []\n", Files.readString(root.resolve("shops/a.yml")));
    }

    @Test void delegatedLoginWorksForUuidLinkAndCode() throws Exception {
        grant("drafts");
        assertEquals(200, request("POST", "/api/login", "{\"username\":\"test\",\"password\":\"" + player.getUniqueId() + "\"}").status());
        String token = api.createAutoLoginToken(player);
        assertEquals(200, request("POST", "/api/autologin", "{\"token\":\"" + token + "\"}").status());
        token = api.createAutoLoginToken(player);
        assertEquals(200, request("POST", "/api/logincode", "{\"username\":\"test\",\"code\":\"" + api.getLoginCodeForToken(token) + "\"}").status());
    }

    @Test void draftWriterCanSaveButCannotPublishOrModifyCommands() throws Exception {
        grant("shop.drafts");
        assertEquals(200, save("shops/a.yml", "rows: 4\nitems: []\n").status());
        assertEquals(200, request("GET", "/api/file/shops/a.yml", "").status());
        assertEquals(403, save("commands.yml", "commands: {}\n").status());
        assertEquals(403, save("config.yml", "api: {key: hacked}\n").status());
        assertEquals(403, request("POST", "/api/draft/publish", "{}").status());
        assertEquals("items: []\n", Files.readString(root.resolve("shops/a.yml")));
        verify(plugin, never()).reloadPublishedConfiguration();
    }

    @Test void sectionDraftAndViewPermissionsAreEnforcedByDirectFileRequests() throws Exception {
        grant("shop");
        assertEquals(200, request("GET", "/api/file/shops/a.yml", "").status());
        assertEquals(403, save("shops/a.yml", "items: []\n").status());
        assertEquals(403, request("GET", "/api/file/commands.yml", "").status());
        assertEquals(403, request("POST", "/api/draft/discard", "").status());
        grant("shop.drafts");
        assertEquals(200, save("shops/a.yml", "rows: 4\nitems: []\n").status());
        assertEquals(403, save("menus/purchase-menu.yml", "rows: 3\n").status());
        assertEquals(403, save("commands.yml", "commands: {}\n").status());
        grants.remove("geniusshop.editor.shop.drafts");
        assertEquals(403, save("shops/a.yml", "items: []\n").status());
    }

    @Test void publishOnlyCanReadTabsButCannotEditOrDiscardDrafts() throws Exception {
        grant("publish");
        assertEquals(200, request("GET", "/api/file/shops/a.yml", "").status());
        assertEquals(200, request("GET", "/api/file/commands.yml", "").status());
        assertEquals(403, request("GET", "/api/file/config.yml", "").status());
        assertEquals(403, save("shops/a.yml", "items: []\n").status());
        assertEquals(403, request("POST", "/api/database", "{}").status());
        assertEquals(403, request("POST", "/api/draft/discard", "").status());
    }

    @Test void shopOnlyReceivesReadOnlyLayoutPreviewWithoutUnrelatedGuiSettings() throws Exception {
        Files.createDirectories(root.resolve("menus"));
        Files.writeString(root.resolve("menus/gui-settings.yml"), "gui: {layout: {rows: 3, content-slots: [10, 11]}, search-button: {slot: 24}}\nunrelated: private-setting\n");
        grant("shop.drafts");
        Material material = mock(Material.class);
        when(material.isItem()).thenReturn(true);
        try (var materials = mockStatic(Material.class)) {
            materials.when(Material::values).thenReturn(new Material[]{material});
            var files = request("GET", "/api/files", "");
            assertEquals(200, files.status(), files.body());
            assertFalse(files.json().has("guiSettings"));
            assertTrue(files.json().get("guiPreview").getAsString().contains("content-slots"));
            assertFalse(files.body().contains("private-setting"));
        }
        assertEquals(403, save("menus/gui-settings.yml", "gui: {}\n").status());
    }

    @Test void commandActionsCannotBeSmuggledThroughOtherFiles() throws Exception {
        grant("shop.drafts", "mainmenu.drafts", "customitems.drafts");
        String commands = "items: [{material: STONE, commands: ['op %player%']}]\n";
        assertEquals(403, save("shops/a.yml", commands).status());
        assertEquals(403, save("menus/main-menu.yml", "items: [{action: command, commands: [say hi]}]").status());
        assertEquals(403, save("custom-items.yml", "items: {wand: {actions: [{type: command, commands: [say hi]}]}}").status());
        grant("commands");
        assertEquals(200, save("shops/a.yml", commands).status());
        grants.remove("geniusshop.editor.commands");
        assertEquals(403, request("DELETE", "/api/file/shops/a.yml", "").status());
        assertEquals(403, save("shops/a.yml", "items: []").status());
    }

    @Test void publishRechecksEveryChangedFileAfterPermissionsAreRevoked() throws Exception {
        grant("commands", "publish");
        assertEquals(200, save("commands.yml", "commands: {}\n# changed\n").status());
        Response review = request("GET", "/api/draft/review", "");
        assertEquals(200, review.status());
        String body = "{\"token\":\"" + review.json().get("token").getAsString() + "\"}";
        grants.remove("geniusshop.editor.commands");
        assertEquals(403, request("POST", "/api/draft/publish", body).status());
        assertEquals(200, request("GET", "/api/draft/review", "").status());
        assertEquals("commands: {}\n", Files.readString(root.resolve("commands.yml")));
        verify(plugin, never()).reloadPublishedConfiguration();
    }

    @Test void publishingRequiresBothPublishAndFileEditingRights() throws Exception {
        grant("drafts", "publish");
        assertEquals(200, save("shops/new.yml", "items: []\n").status());
        Response review = request("GET", "/api/draft/review", "");
        assertEquals(200, review.status());
        Response published = request("POST", "/api/draft/publish", "{\"token\":\"" + review.json().get("token").getAsString() + "\"}");
        assertEquals(200, published.status(), published.body());
        assertTrue(Files.exists(root.resolve("shops/new.yml")));
        verify(plugin).reloadPublishedConfiguration();
    }

    @Test void publishingRechecksPermissionsInTheQueuedServerTask() throws Exception {
        grant("drafts", "publish");
        assertEquals(200, save("shops/new.yml", "items: []\n").status());
        Response review = request("GET", "/api/draft/review", "");
        when(scheduler.callSyncMethod(eq(plugin), any())).thenAnswer(invocation -> {
            grants.remove("geniusshop.editor.publish");
            CompletableFuture<Object> result = new CompletableFuture<>();
            try { result.complete(((Callable<?>) invocation.getArgument(1)).call()); }
            catch (Exception e) { result.completeExceptionally(e); }
            return result;
        });
        assertEquals(403, request("POST", "/api/draft/publish", "{\"token\":\"" + review.json().get("token").getAsString() + "\"}").status());
        assertFalse(Files.exists(root.resolve("shops/new.yml")));
        verify(plugin, never()).reloadPublishedConfiguration();
    }

    @Test void delegatedValidationErrorsDoNotLeakSensitiveSourceInReviewsOrPublication() throws Exception {
        grant("drafts", "publish");
        Files.writeString(root.resolve("config.yml"), "secret-api-key: [unterminated\n");
        assertEquals(200, save("shops/a.yml", "rows: 4\nitems: []\n").status());
        Response review = request("GET", "/api/draft/review", "");
        assertEquals(200, review.status());
        assertFalse(review.body().contains("secret-api-key"));
        Response published = request("POST", "/api/draft/publish", "{\"token\":\"" + review.json().get("token").getAsString() + "\"}");
        assertEquals(400, published.status());
        assertFalse(published.body().contains("secret-api-key"));
    }

    @Test void previouslySavedSensitiveDraftsCannotBeReviewedAfterLosingAdmin() throws Exception {
        grants.add("geniusshop.admin");
        assertEquals(200, save("config.yml", "api: {key: retained-secret}\n").status());
        grants.clear();
        grant("drafts", "publish");
        Response review = request("GET", "/api/draft/review", "");
        assertEquals(403, review.status());
        assertFalse(review.body().contains("retained-secret"));
        assertEquals(403, request("POST", "/api/draft/publish", "{}").status());
    }

    @Test void permissionsAreRefreshedOnEveryRequestAndSessionsAreRevoked() throws Exception {
        grant("analytics", "drafts");
        assertTrue(request("GET", "/api/permissions", "").json().get("drafts").getAsBoolean());
        grants.remove("geniusshop.editor.drafts");
        assertFalse(request("GET", "/api/permissions", "").json().get("drafts").getAsBoolean());
        assertEquals(403, save("shops/a.yml", "items: []").status());
        grants.clear();
        assertEquals(401, request("GET", "/api/permissions", "").status());
    }

    @Test void databasePermissionAllowsLiveRowsButNoOtherAdministration() throws Exception {
        grant("database");
        assertEquals(200, request("GET", "/api/database", "").status());
        assertEquals(200, request("POST", "/api/database", "{\"table\":\"global_counts\",\"itemKey\":\"a:0\",\"count\":3}").status());
        verify(data).setGlobalCount("a:0", 3, true);
        assertEquals(200, request("DELETE", "/api/database", "{\"table\":\"global_counts\",\"itemKey\":\"a:0\"}").status());
        verify(data).removeGlobalCount("a:0");
        assertEquals(403, request("GET", "/api/stock-analytics", "").status());
        assertEquals(403, request("GET", "/api/activity-log", "").status());
    }

    @Test void filesResponseOmitsRestrictedSourcesAndMarksCommandFilesReadOnly() throws Exception {
        grant("shop.drafts");
        Files.writeString(root.resolve("shops/command.yml"), "items: [{commands: [say hi]}]\n");
        try (MockedStatic<Material> materials = mockStatic(Material.class)) {
            materials.when(Material::values).thenReturn(new Material[0]);
            Response response = request("GET", "/api/files", "");
            assertEquals(200, response.status(), response.body());
            assertFalse(response.body().contains("secret-api-key"));
            assertFalse(response.body().contains("secret-webhook"));
            assertFalse(response.json().has("commandsFile"));
            assertFalse(response.json().has("economySafety"));
            assertEquals("shops/command.yml", response.json().getAsJsonArray("readOnlyFiles").get(0).getAsString());
        }
    }

    @Test void analyticsDoesNotCreateDraftsOrExposeConfiguration() throws Exception {
        grant("analytics");
        assertEquals(200, request("GET", "/api/stock-analytics", "").status());
        try (MockedStatic<Material> materials = mockStatic(Material.class)) {
            materials.when(Material::values).thenReturn(new Material[0]);
            Response response = request("GET", "/api/files", "");
            assertEquals(200, response.status(), response.body());
            assertTrue(response.json().getAsJsonObject("shops").isEmpty());
            assertFalse(response.json().has("draft"));
            assertFalse(Files.exists(root.resolve("editor-drafts")));
        }
    }

    @Test void commandOnlyManagersCanSelectShopTargetsWithoutReadingRawShopFiles() throws Exception {
        grant("commands");
        try (MockedStatic<Material> materials = mockStatic(Material.class)) {
            materials.when(Material::values).thenReturn(new Material[0]);
            Response response = request("GET", "/api/files", "");
            assertEquals(200, response.status(), response.body());
            assertTrue(response.json().has("commandsFile"));
            assertTrue(response.json().getAsJsonObject("shops").isEmpty());
            assertTrue(response.json().getAsJsonObject("commandCatalog").has("a"));
            assertEquals(403, request("GET", "/api/file/shops/a.yml", "").status());
        }
    }

    @Test void legacyAdminCanStillAccessSensitiveFiles() throws Exception {
        grants.add("shop.admin");
        assertEquals(200, request("GET", "/api/file/config.yml", "").status());
        assertEquals(200, save("commands.yml", "commands: {}\n").status());
        assertEquals(200, request("GET", "/api/activity-log", "").status());
    }
}
