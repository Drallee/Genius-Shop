package me.dralle.shop.api;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import me.dralle.shop.ShopPlugin;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.sun.net.httpserver.HttpServer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConfigApiServerStaticAssetsTest {
    @TempDir Path folder;
    private final Map<String, byte[]> assets = new HashMap<>();
    private ConfigApiServer server;

    @BeforeEach
    void setup() {
        ShopPlugin plugin = mock(ShopPlugin.class);
        when(plugin.getDataFolder()).thenReturn(folder.toFile());
        when(plugin.getResource(anyString())).thenAnswer(call -> {
            byte[] bytes = assets.get(call.getArgument(0));
            return bytes == null ? null : new ByteArrayInputStream(bytes);
        });
        server = new ConfigApiServer(plugin, 0, "test");
        put("index.html", "<link href=\"style.css\"><script defer src=\"js/ui.js?v=old\"></script>"
                + "<link href=\"https://example.com/external.css\"><script src=\"missing.js\"></script>");
        put("style.css", "body { color: white; }");
        put("js/ui.js", "const version = 'first';");
    }

    @Test
    void cacheValidationWorksOverHttpWithoutSendingTheBodyAgain() throws Exception {
        HttpServer http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var handler = ConfigApiServer.class.getDeclaredMethod("serveWebFile", HttpExchange.class, String.class);
        handler.setAccessible(true);
        http.createContext("/", exchange -> {
            try {
                handler.invoke(server, exchange, exchange.getRequestURI().getPath().substring(1));
            } catch (ReflectiveOperationException error) {
                throw new java.io.IOException(error);
            }
        });
        http.start();
        try (HttpClient client = HttpClient.newHttpClient()) {
            String base = "http://127.0.0.1:" + http.getAddress().getPort();
            var html = client.send(HttpRequest.newBuilder(URI.create(base + "/index.html")).build(),
                    HttpResponse.BodyHandlers.ofString());
            String path = "/js/ui.js?v=" + scriptVersion(html.body());
            var first = client.send(HttpRequest.newBuilder(URI.create(base + path)).build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            assertEquals(200, first.statusCode());
            assertTrue(first.headers().firstValue("Cache-Control").orElseThrow().contains("immutable"));
            var cached = client.send(HttpRequest.newBuilder(URI.create(base + path))
                    .header("If-None-Match", first.headers().firstValue("ETag").orElseThrow()).build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            assertEquals(304, cached.statusCode());
            assertEquals(0, cached.body().length);
        } finally {
            http.stop(0);
        }
    }

    @Test
    void htmlVersionsAssetsByContentAndStillChecksForUpdates() throws Exception {
        Response first = serve("index.html", "/index.html", new Headers(), "GET");
        assertEquals("no-cache", first.headers.getFirst("Cache-Control"));
        assertFalse(first.text().contains("?v=old"));
        assertTrue(first.text().contains("https://example.com/external.css"));
        assertTrue(first.text().contains("src=\"missing.js\""));
        String version = scriptVersion(first.text());
        Response script = serve("js/ui.js", "/js/ui.js?v=" + version, new Headers(), "GET");
        assertEquals("public, max-age=31536000, immutable", script.headers.getFirst("Cache-Control"));
        assertEquals("const version = 'first';", script.text());
        put("js/ui.js", "const version = 'second';");
        Headers conditional = new Headers();
        conditional.set("If-None-Match", first.headers.getFirst("ETag"));
        Response changed = serve("index.html", "/index.html", conditional, "GET");
        verify(changed.exchange).sendResponseHeaders(eq(200), anyLong());
        assertNotEquals(version, scriptVersion(changed.text()));
        assertNotEquals(first.headers.getFirst("ETag"), changed.headers.getFirst("ETag"));
        Response oldUrl = serve("js/ui.js", "/js/ui.js?v=" + version, new Headers(), "GET");
        assertEquals("no-cache", oldUrl.headers.getFirst("Cache-Control"));
    }

    @Test
    void unversionedAssetsRevalidateWithoutRetransmittingUnchangedBytes() throws Exception {
        Response first = serve("js/ui.js", "/js/ui.js", new Headers(), "GET");
        assertEquals("no-cache", first.headers.getFirst("Cache-Control"));
        Headers conditional = new Headers();
        conditional.set("If-None-Match", "\"another-tag\", " + first.headers.getFirst("ETag").substring(2));
        Response cached = serve("js/ui.js", "/js/ui.js", conditional, "GET");
        verify(cached.exchange).sendResponseHeaders(304, -1);
        assertEquals(0, cached.body.size());
        assertEquals(first.headers.getFirst("ETag"), cached.headers.getFirst("ETag"));
        assertEquals("Accept-Encoding", cached.headers.getFirst("Vary"));
    }

    @Test
    void gzipAndIdentityShareAWeakValidatorAndHaveVaryAndCorrectBodies() throws Exception {
        String source = "const text = '" + "hello".repeat(1000) + "';";
        put("js/ui.js", source);
        Response identity = serve("js/ui.js", "/js/ui.js", new Headers(), "GET");
        Headers headers = new Headers();
        headers.set("Accept-Encoding", "gzip");
        Response zipped = serve("js/ui.js", "/js/ui.js", headers, "GET");
        assertEquals("gzip", zipped.headers.getFirst("Content-Encoding"));
        assertEquals(identity.headers.getFirst("ETag"), zipped.headers.getFirst("ETag"));
        assertTrue(zipped.headers.getFirst("ETag").startsWith("W/"));
        try (var gzip = new GZIPInputStream(new ByteArrayInputStream(zipped.body.toByteArray()))) {
            assertEquals(source, new String(gzip.readAllBytes(), StandardCharsets.UTF_8));
        }
        headers.set("If-None-Match", zipped.headers.getFirst("ETag"));
        Response cached = serve("js/ui.js", "/js/ui.js", headers, "HEAD");
        verify(cached.exchange).sendResponseHeaders(304, -1);
    }

    @Test
    void fallbackFileChangesUpdateValidatorsAndHeadHasNoBody() throws Exception {
        Path file = folder.resolve("web/js/local.js");
        Files.createDirectories(file.getParent());
        Files.writeString(file, "first");
        Response first = serve("js/local.js", "/js/local.js", new Headers(), "HEAD");
        assertEquals("5", first.headers.getFirst("Content-Length"));
        assertEquals(0, first.body.size());
        Files.writeString(file, "second");
        Response second = serve("js/local.js", "/js/local.js", new Headers(), "GET");
        assertNotEquals(first.headers.getFirst("ETag"), second.headers.getFirst("ETag"));
        assertEquals("second", second.text());
    }

    @Test
    void apiResponsesRemainUncacheable() throws Exception {
        Response response = response("/api/files", new Headers(), "GET");
        var send = ConfigApiServer.class.getDeclaredMethod("sendJsonResponse", HttpExchange.class, int.class, Object.class);
        send.setAccessible(true);
        send.invoke(server, response.exchange, 200, Map.of("private", "shop-data"));
        assertTrue(response.headers.getFirst("Cache-Control").contains("no-store"));
        assertNull(response.headers.getFirst("ETag"));
    }

    private void put(String path, String content) {
        assets.put("web/" + path, content.getBytes(StandardCharsets.UTF_8));
    }

    private String scriptVersion(String html) {
        var matcher = Pattern.compile("js/ui\\.js\\?v=([a-f0-9]{64})").matcher(html);
        assertTrue(matcher.find(), html);
        return matcher.group(1);
    }

    private Response serve(String path, String uri, Headers headers, String method) throws Exception {
        Response response = response(uri, headers, method);
        var serve = ConfigApiServer.class.getDeclaredMethod("serveWebFile", HttpExchange.class, String.class);
        serve.setAccessible(true);
        serve.invoke(server, response.exchange, path);
        return response;
    }

    private Response response(String uri, Headers headers, String method) {
        HttpExchange exchange = mock(HttpExchange.class);
        Headers responseHeaders = new Headers();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        when(exchange.getRequestURI()).thenReturn(URI.create(uri));
        when(exchange.getRequestHeaders()).thenReturn(headers);
        when(exchange.getResponseHeaders()).thenReturn(responseHeaders);
        when(exchange.getRequestMethod()).thenReturn(method);
        when(exchange.getResponseBody()).thenReturn(body);
        return new Response(exchange, responseHeaders, body);
    }

    private record Response(HttpExchange exchange, Headers headers, ByteArrayOutputStream body) {
        String text() { return body.toString(StandardCharsets.UTF_8); }
    }
}
