package me.dralle.shop.api;

import me.dralle.shop.ShopPlugin;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.logging.Level;
import java.util.zip.GZIPOutputStream;

public class ConfigApiServer {
    private final ShopPlugin plugin;
    private HttpServer server;
    private final int port;
    private final String apiKey;
    private final Map<String, SessionData> sessions = new ConcurrentHashMap<>();
    private final Map<String, AutoLoginToken> autoLoginTokens = new ConcurrentHashMap<>();
    private static final long SESSION_DURATION = 3600000; // 1 hour
    private static final long AUTO_LOGIN_TOKEN_DURATION = 300000; // 5 minutes

    private static class SessionData {
        String username;
        String ipAddress;
        long expiry;

        SessionData(String username, String ipAddress, long expiry) {
            this.username = username;
            this.ipAddress = ipAddress;
            this.expiry = expiry;
        }
    }

    private static class AutoLoginToken {
        String username;
        String ipAddress;
        long expiry;

        AutoLoginToken(String username, String ipAddress, long expiry) {
            this.username = username;
            this.ipAddress = ipAddress;
            this.expiry = expiry;
        }
    }

    public ConfigApiServer(ShopPlugin plugin, int port, String apiKey) {
        this.plugin = plugin;
        this.port = port;
        this.apiKey = apiKey;
    }

    /**
     * Create an auto-login token for a player
     * @param player The player to create a token for
     * @return The auto-login token
     */
    public String createAutoLoginToken(Player player) {
        String token = UUID.randomUUID().toString();
        String ipAddress = player.getAddress().getAddress().getHostAddress();
        long expiry = System.currentTimeMillis() + AUTO_LOGIN_TOKEN_DURATION;

        autoLoginTokens.put(token, new AutoLoginToken(player.getName(), ipAddress, expiry));

        // Clean up expired tokens
        autoLoginTokens.entrySet().removeIf(entry -> entry.getValue().expiry < System.currentTimeMillis());

        plugin.getLogger().info("Created auto-login token for " + player.getName() + " from IP " + ipAddress + " (expires in 5 minutes)");
        plugin.getLogger().info("Active tokens: " + autoLoginTokens.size());
        return token;
    }

    public void start() {
        try {
            // Bind to all interfaces (0.0.0.0) so it can be accessed from network
            server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
            server.setExecutor(Executors.newFixedThreadPool(4));

            // Serve static web UI files
            server.createContext("/", exchange -> {
                String path = exchange.getRequestURI().getPath();

                // Handle root path
                if (path.equals("/") || path.equals("/index.html")) {
                    serveWebFile(exchange, "index.html");
                } else if (path.equals("/login.html")) {
                    serveWebFile(exchange, "login.html");
                } else if (path.equals("/favicon.ico")) {
                    serveWebFile(exchange, "favicon.ico");
                } else if (path.startsWith("/api/")) {
                    // Handle API requests
                    exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                    exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
                    exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, X-API-Key, X-Session-Token");

                    if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                        exchange.sendResponseHeaders(204, -1);
                        return;
                    }

                    handleRequest(exchange);
                } else {
                    // 404 for unknown paths
                    String response = "404 Not Found";
                    exchange.getResponseHeaders().add("Content-Type", "text/plain");
                    byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(404, bytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(bytes);
                    }
                }
            });

            server.start();
            plugin.getLogger().info("Config API Server started on port " + port);
            plugin.getLogger().info("Web UI available at: http://localhost:" + port + "/");
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to start API server", e);
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            plugin.getLogger().info("Config API Server stopped");
        }
    }

    private void handleRequest(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();

        try {
            // Login endpoint doesn't require session
            if (path.equals("/api/login")) {
                if (method.equals("POST")) {
                    handleLogin(exchange);
                } else {
                    sendResponse(exchange, 405, "{\"error\": \"Method not allowed\"}");
                }
                return;
            }

            // Auto-login endpoint
            if (path.equals("/api/autologin")) {
                if (method.equals("POST")) {
                    handleAutoLogin(exchange);
                } else {
                    sendResponse(exchange, 405, "{\"error\": \"Method not allowed\"}");
                }
                return;
            }

            // All other endpoints require valid session
            if (!validateSession(exchange)) {
                sendResponse(exchange, 401, "{\"error\": \"Unauthorized - Invalid or expired session\"}");
                return;
            }

            if (path.equals("/api/files")) {
                if (method.equals("GET")) {
                    handleListFiles(exchange);
                } else {
                    sendResponse(exchange, 405, "{\"error\": \"Method not allowed\"}");
                }
            } else if (path.startsWith("/api/file/")) {
                String fileName = path.substring("/api/file/".length());
                if (method.equals("GET")) {
                    handleGetFile(exchange, fileName);
                } else if (method.equals("POST")) {
                    handleSaveFile(exchange, fileName);
                } else if (method.equals("DELETE")) {
                    handleDeleteFile(exchange, fileName);
                } else {
                    sendResponse(exchange, 405, "{\"error\": \"Method not allowed\"}");
                }
            } else if (path.equals("/api/activity-log")) {
                if (method.equals("GET")) {
                    handleGetActivityLog(exchange);
                } else if (method.equals("POST")) {
                    handleSaveActivityLog(exchange);
                } else {
                    sendResponse(exchange, 405, "{\"error\": \"Method not allowed\"}");
                }
            } else {
                sendResponse(exchange, 404, "{\"error\": \"Not found\"}");
            }
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Error handling API request", e);
            sendResponse(exchange, 500, "{\"error\": \"Internal server error\"}");
        }
    }

    private void handleLogin(HttpExchange exchange) throws IOException {
        // Read request body
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);

        String username = extractJsonField(body, "username");
        String password = extractJsonField(body, "password");

        if (username == null || password == null) {
            sendResponse(exchange, 400, "{\"error\": \"Missing username or password\"}");
            return;
        }

        // Check if player is online and has admin permission
        Player player = Bukkit.getPlayerExact(username);
        if (player == null || !player.isOnline()) {
            sendResponse(exchange, 401, "{\"error\": \"Player must be online to authenticate\"}");
            return;
        }

        // Check admin permission
        if (!player.hasPermission("geniusshop.admin") && !player.hasPermission("shop.admin") && !player.isOp()) {
            sendResponse(exchange, 403, "{\"error\": \"No admin permission\"}");
            plugin.getLogger().warning("Unauthorized login attempt by " + username + " - missing admin permission");
            return;
        }

        // Get player's IP address
        String playerIp = player.getAddress().getAddress().getHostAddress();

        // Get request IP address
        String requestIp = exchange.getRemoteAddress().getAddress().getHostAddress();

        // Check if IPs match
        if (!playerIp.equals(requestIp)) {
            sendResponse(exchange, 403, "{\"error\": \"IP address mismatch. You must access this from the same network as your Minecraft client.\"}");
            plugin.getLogger().warning("Login attempt from mismatched IP - Player: " + playerIp + ", Request: " + requestIp);
            return;
        }

        // Validate password (simple check - player's UUID as password)
        if (!password.equals(player.getUniqueId().toString())) {
            sendResponse(exchange, 401, "{\"error\": \"Invalid credentials\"}");
            return;
        }

        // Create session with IP address
        String sessionToken = UUID.randomUUID().toString();
        long expiry = System.currentTimeMillis() + SESSION_DURATION;
        sessions.put(sessionToken, new SessionData(username, requestIp, expiry));

        // Clean up expired sessions
        sessions.entrySet().removeIf(entry -> entry.getValue().expiry < System.currentTimeMillis());

        plugin.getLogger().info("Admin " + username + " logged into config editor from IP: " + requestIp);

        Map<String, String> response = new HashMap<>();
        response.put("sessionToken", sessionToken);
        response.put("username", username);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleAutoLogin(HttpExchange exchange) throws IOException {
        // Read request body
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        String token = extractJsonField(body, "token");

        plugin.getLogger().info("Auto-login attempt with token: " + (token != null ? token.substring(0, Math.min(8, token.length())) + "..." : "null"));

        if (token == null) {
            sendResponse(exchange, 400, "{\"error\": \"Missing token\"}");
            return;
        }

        // Get token data
        AutoLoginToken tokenData = autoLoginTokens.get(token);
        if (tokenData == null) {
            plugin.getLogger().warning("Auto-login failed: Token not found in map. Active tokens: " + autoLoginTokens.size());
            // List all token prefixes for debugging
            autoLoginTokens.keySet().forEach(t -> plugin.getLogger().info("  - Token: " + t.substring(0, 8) + "..."));
            sendResponse(exchange, 401, "{\"error\": \"Invalid or expired token\"}");
            return;
        }

        plugin.getLogger().info("Token found for user: " + tokenData.username);

        // Check if expired
        long now = System.currentTimeMillis();
        long timeLeft = tokenData.expiry - now;
        plugin.getLogger().info("Token expiry check: now=" + now + ", expiry=" + tokenData.expiry + ", timeLeft=" + timeLeft + "ms");

        if (tokenData.expiry < now) {
            plugin.getLogger().warning("Token has expired! Time left was: " + timeLeft + "ms");
            autoLoginTokens.remove(token);
            sendResponse(exchange, 401, "{\"error\": \"Token has expired\"}");
            return;
        }

        plugin.getLogger().info("Token is valid. Time remaining: " + (timeLeft / 1000) + " seconds");

        // Get request IP
        String requestIp = exchange.getRemoteAddress().getAddress().getHostAddress();

        // Verify IP matches
        boolean ipMatches = requestIp.equals(tokenData.ipAddress);

        // Allow localhost variations (IPv4 127.0.0.1, IPv6 ::1 or 0:0:0:0:0:0:0:1)
        boolean playerIsLocalhost = tokenData.ipAddress.equals("127.0.0.1") ||
                                   tokenData.ipAddress.equals("0:0:0:0:0:0:0:1") ||
                                   tokenData.ipAddress.equals("::1");

        boolean requestIsLocal = requestIp.equals("127.0.0.1") ||
                                requestIp.equals("0:0:0:0:0:0:0:1") ||
                                requestIp.equals("::1") ||
                                requestIp.startsWith("192.168.") ||  // Local network
                                requestIp.startsWith("10.") ||       // Local network
                                requestIp.startsWith("172.");        // Local network

        // If player is connecting via localhost and request is from local network, allow it
        if (!ipMatches && !(playerIsLocalhost && requestIsLocal)) {
            sendResponse(exchange, 403, "{\"error\": \"IP address mismatch\"}");
            plugin.getLogger().warning("Auto-login IP mismatch for " + tokenData.username + " - Player IP: " + tokenData.ipAddress + ", Request IP: " + requestIp);
            // Don't remove token - let it expire naturally
            return;
        }

        plugin.getLogger().info("IP verification passed: Player=" + tokenData.ipAddress + ", Request=" + requestIp);

        // Verify player is still online
        Player player = Bukkit.getPlayerExact(tokenData.username);
        if (player == null || !player.isOnline()) {
            sendResponse(exchange, 401, "{\"error\": \"Player is no longer online\"}");
            autoLoginTokens.remove(token);
            return;
        }

        // Verify permission
        if (!player.hasPermission("geniusshop.admin") && !player.hasPermission("shop.admin") && !player.isOp()) {
            sendResponse(exchange, 403, "{\"error\": \"No admin permission\"}");
            autoLoginTokens.remove(token);
            return;
        }

        // Remove used token (one-time use)
        autoLoginTokens.remove(token);

        // Create session
        String sessionToken = UUID.randomUUID().toString();
        long expiry = System.currentTimeMillis() + SESSION_DURATION;
        sessions.put(sessionToken, new SessionData(tokenData.username, requestIp, expiry));

        // Clean up expired sessions
        sessions.entrySet().removeIf(entry -> entry.getValue().expiry < System.currentTimeMillis());

        plugin.getLogger().info("Admin " + tokenData.username + " auto-logged into config editor from IP: " + requestIp);

        Map<String, String> response = new HashMap<>();
        response.put("sessionToken", sessionToken);
        response.put("username", tokenData.username);
        sendJsonResponse(exchange, 200, response);
    }

    private boolean validateSession(HttpExchange exchange) {
        String sessionToken = exchange.getRequestHeaders().getFirst("X-Session-Token");

        if (sessionToken == null) {
            return false;
        }

        SessionData session = sessions.get(sessionToken);
        if (session == null) {
            return false;
        }

        // Check if expired
        if (session.expiry < System.currentTimeMillis()) {
            sessions.remove(sessionToken);
            return false;
        }

        // Validate IP address matches
        String requestIp = exchange.getRemoteAddress().getAddress().getHostAddress();

        // Use same logic as auto-login: allow localhost/local network mixing
        boolean ipMatches = requestIp.equals(session.ipAddress);

        boolean sessionIsLocal = session.ipAddress.equals("127.0.0.1") ||
                                session.ipAddress.equals("0:0:0:0:0:0:0:1") ||
                                session.ipAddress.equals("::1") ||
                                session.ipAddress.startsWith("192.168.") ||
                                session.ipAddress.startsWith("10.") ||
                                session.ipAddress.startsWith("172.");

        boolean requestIsLocal = requestIp.equals("127.0.0.1") ||
                                requestIp.equals("0:0:0:0:0:0:0:1") ||
                                requestIp.equals("::1") ||
                                requestIp.startsWith("192.168.") ||
                                requestIp.startsWith("10.") ||
                                requestIp.startsWith("172.");

        // If session and request are both local, allow it
        if (!ipMatches && !(sessionIsLocal && requestIsLocal)) {
            plugin.getLogger().warning("Session IP mismatch for " + session.username + " - Session IP: " + session.ipAddress + ", Request IP: " + requestIp);
            sessions.remove(sessionToken);
            return false;
        }

        // Check if player is still online and has permission
        Player player = Bukkit.getPlayerExact(session.username);
        if (player == null || !player.isOnline()) {
            sessions.remove(sessionToken);
            return false;
        }

        // Don't check player IP changes if both are local network
        // (player might be IPv6 localhost while browser uses IPv4 LAN address)
        String playerIp = player.getAddress().getAddress().getHostAddress();
        boolean playerIsLocalhost = playerIp.equals("127.0.0.1") ||
                                   playerIp.equals("0:0:0:0:0:0:0:1") ||
                                   playerIp.equals("::1");

        if (!playerIsLocalhost && !playerIp.equals(session.ipAddress) && !(sessionIsLocal && requestIsLocal)) {
            plugin.getLogger().warning("Player IP changed for " + session.username + " - Session invalidated");
            sessions.remove(sessionToken);
            return false;
        }

        if (!player.hasPermission("geniusshop.admin") && !player.hasPermission("shop.admin") && !player.isOp()) {
            sessions.remove(sessionToken);
            return false;
        }

        return true;
    }

    private void handleListFiles(HttpExchange exchange) throws IOException {
        plugin.getLogger().info("[API] handleListFiles called");
        Map<String, Object> response = new HashMap<>();

        // List shop files
        File shopsDir = new File(plugin.getDataFolder(), "shops");
        plugin.getLogger().info("[API] shops directory: " + shopsDir.getAbsolutePath() + " (exists: " + shopsDir.exists() + ")");
        if (shopsDir.exists() && shopsDir.isDirectory()) {
            File[] shopFiles = shopsDir.listFiles((dir, name) -> name.endsWith(".yml"));
            if (shopFiles != null) {
                plugin.getLogger().info("[API] Found " + shopFiles.length + " shop files");
                Map<String, String> shops = new HashMap<>();
                for (File file : shopFiles) {
                    String content = Files.readString(file.toPath());
                    shops.put(file.getName(), content);
                    plugin.getLogger().info("[API] Loaded shop: " + file.getName() + " (" + content.length() + " chars)");
                }
                response.put("shops", shops);
            }
        }

        // Get menu files from menus/ folder
        File menusDir = new File(plugin.getDataFolder(), "menus");
        plugin.getLogger().info("[API] Menus directory: " + menusDir.getAbsolutePath() + " (exists: " + menusDir.exists() + ")");
        if (menusDir.exists() && menusDir.isDirectory()) {
            // Load main-menu.yml
            File mainMenuFile = new File(menusDir, "main-menu.yml");
            if (mainMenuFile.exists()) {
                String content = Files.readString(mainMenuFile.toPath());
                response.put("mainMenu", content);
                plugin.getLogger().info("[API] Loaded main-menu.yml (" + content.length() + " chars)");
            }

            // Load purchase-menu.yml
            File purchaseMenuFile = new File(menusDir, "purchase-menu.yml");
            if (purchaseMenuFile.exists()) {
                String content = Files.readString(purchaseMenuFile.toPath());
                response.put("purchaseMenu", content);
                plugin.getLogger().info("[API] Loaded purchase-menu.yml (" + content.length() + " chars)");
            }

            // Load sell-menu.yml
            File sellMenuFile = new File(menusDir, "sell-menu.yml");
            if (sellMenuFile.exists()) {
                String content = Files.readString(sellMenuFile.toPath());
                response.put("sellMenu", content);
                plugin.getLogger().info("[API] Loaded sell-menu.yml (" + content.length() + " chars)");
            }

            // Load gui-settings.yml
            File guiSettingsFile = new File(menusDir, "gui-settings.yml");
            if (guiSettingsFile.exists()) {
                String content = Files.readString(guiSettingsFile.toPath());
                response.put("guiSettings", content);
                plugin.getLogger().info("[API] Loaded gui-settings.yml (" + content.length() + " chars)");
            }
        }

        // Get discord.yml
        File discordFile = new File(plugin.getDataFolder(), "discord.yml");
        if (discordFile.exists()) {
            response.put("discord", Files.readString(discordFile.toPath()));
        }

        plugin.getLogger().info("[API] Sending response with " + response.size() + " items");
        sendJsonResponse(exchange, 200, response);
    }

    private void handleGetFile(HttpExchange exchange, String fileName) throws IOException {
        File file = resolveFile(fileName);
        
        if (file == null || !file.exists()) {
            sendResponse(exchange, 404, "{\"error\": \"File not found\"}");
            return;
        }

        String content = Files.readString(file.toPath());
        Map<String, String> response = new HashMap<>();
        response.put("content", content);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleSaveFile(HttpExchange exchange, String fileName) throws IOException {
        File file = resolveFile(fileName);
        
        if (file == null) {
            sendResponse(exchange, 400, "{\"error\": \"Invalid file name\"}");
            return;
        }

        // Read request body
        String content = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        
        // Parse JSON to get content
        String fileContent = extractJsonField(content, "content");
        if (fileContent == null) {
            sendResponse(exchange, 400, "{\"error\": \"Missing content field\"}");
            return;
        }

        // Validate YAML
        try {
            YamlConfiguration.loadConfiguration(new StringReader(fileContent));
        } catch (Exception e) {
            sendResponse(exchange, 400, "{\"error\": \"Invalid YAML: " + e.getMessage() + "\"}");
            return;
        }

        // Create parent directories if needed
        if (!file.getParentFile().exists()) {
            boolean created = file.getParentFile().mkdirs();
            if (!created) {
                plugin.getLogger().warning("Failed to create directory: " + file.getParentFile());
            }
        }

        // Save file
        Files.writeString(file.toPath(), fileContent);

        // Reload plugin configuration
        plugin.reloadPlugin();
        
        sendResponse(exchange, 200, "{\"success\": true}");
    }

    private void handleDeleteFile(HttpExchange exchange, String fileName) throws IOException {
        File file = resolveFile(fileName);

        if (file == null) {
            sendResponse(exchange, 400, "{\"error\": \"Invalid file name\"}");
            return;
        }

        // Don't allow deletion of main config files or menu files
        if (fileName.equals("discord.yml") || fileName.equals("config.yml") ||
            fileName.startsWith("menus/")) {
            sendResponse(exchange, 403, "{\"error\": \"Cannot delete main config files\"}");
            return;
        }

        if (!file.exists()) {
            sendResponse(exchange, 404, "{\"error\": \"File not found\"}");
            return;
        }

        // Delete the file
        try {
            boolean deleted = file.delete();
            if (!deleted) {
                sendResponse(exchange, 500, "{\"error\": \"Failed to delete file\"}");
                return;
            }

            // Get session info for logging
            String sessionToken = exchange.getRequestHeaders().getFirst("X-Session-Token");
            SessionData session = sessions.get(sessionToken);
            String username = session != null ? session.username : "unknown";

            plugin.getLogger().info("Admin " + username + " deleted file: " + fileName);

            sendResponse(exchange, 200, "{\"success\": true}");
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Error deleting file: " + fileName, e);
            sendResponse(exchange, 500, "{\"error\": \"Failed to delete file: " + e.getMessage() + "\"}");
        }
    }

    private void handleGetActivityLog(HttpExchange exchange) throws IOException {
        File activityLogFile = new File(plugin.getDataFolder(), "activity-log.json");

        if (!activityLogFile.exists()) {
            // Return empty array if file doesn't exist
            sendResponse(exchange, 200, "[]");
            return;
        }

        String content = Files.readString(activityLogFile.toPath());
        sendResponse(exchange, 200, content);
    }

    private void handleSaveActivityLog(HttpExchange exchange) throws IOException {
        // Read request body
        String content = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);

        File activityLogFile = new File(plugin.getDataFolder(), "activity-log.json");

        // Create parent directories if needed
        if (!activityLogFile.getParentFile().exists()) {
            boolean created = activityLogFile.getParentFile().mkdirs();
            if (!created) {
                plugin.getLogger().warning("Failed to create directory: " + activityLogFile.getParentFile());
            }
        }

        // Save file
        Files.writeString(activityLogFile.toPath(), content);

        sendResponse(exchange, 200, "{\"success\": true}");
    }

    private File resolveFile(String fileName) {
        // Prevent directory traversal
        if (fileName.contains("..")) {
            return null;
        }

        // Handle shop files in shops/ directory
        if (fileName.startsWith("shops/") || fileName.startsWith("shops\\")) {
            String shopFile = fileName.substring(6); // Remove "shops/"
            if (shopFile.contains("..") || shopFile.contains("/") || shopFile.contains("\\")) {
                return null;
            }
            return new File(plugin.getDataFolder(), "shops" + File.separator + shopFile);
        }

        // Handle menu files in menus/ directory
        if (fileName.startsWith("menus/") || fileName.startsWith("menus\\")) {
            String menuFile = fileName.substring(6); // Remove "menus/"
            if (menuFile.contains("..") || menuFile.contains("/") || menuFile.contains("\\")) {
                return null;
            }
            // Only allow specific menu files
            if (menuFile.equals("main-menu.yml") || menuFile.equals("purchase-menu.yml") ||
                menuFile.equals("sell-menu.yml") || menuFile.equals("gui-settings.yml")) {
                return new File(plugin.getDataFolder(), "menus" + File.separator + menuFile);
            }
        }

        // Handle main config files (gui.yml kept for legacy but not editable via API)
        if (fileName.equals("discord.yml") || fileName.equals("config.yml")) {
            return new File(plugin.getDataFolder(), fileName);
        }

        return null;
    }

    private String extractJsonField(String json, String field) {
        // Simple JSON parser for content field
        String searchFor = "\"" + field + "\":";
        int start = json.indexOf(searchFor);
        if (start == -1) return null;
        
        start += searchFor.length();
        while (start < json.length() && Character.isWhitespace(json.charAt(start))) start++;
        
        if (start >= json.length() || json.charAt(start) != '"') return null;
        start++; // Skip opening quote
        
        StringBuilder result = new StringBuilder();
        boolean escaped = false;
        for (int i = start; i < json.length(); i++) {
            char c = json.charAt(i);
            if (escaped) {
                if (c == 'n') result.append('\n');
                else if (c == 't') result.append('\t');
                else if (c == 'r') result.append('\r');
                else if (c == '"') result.append('"');
                else if (c == '\\') result.append('\\');
                else result.append(c);
                escaped = false;
            } else if (c == '\\') {
                escaped = true;
            } else if (c == '"') {
                return result.toString();
            } else {
                result.append(c);
            }
        }
        return null;
    }

    private void sendJsonResponse(HttpExchange exchange, int statusCode, Map<String, ?> data) throws IOException {
        StringBuilder json = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, ?> entry : data.entrySet()) {
            if (!first) json.append(",");
            first = false;
            json.append("\"").append(entry.getKey()).append("\":");
            if (entry.getValue() instanceof Map) {
                json.append(mapToJson((Map<?, ?>) entry.getValue()));
            } else {
                json.append("\"").append(escapeJson(String.valueOf(entry.getValue()))).append("\"");
            }
        }
        json.append("}");
        sendResponse(exchange, statusCode, json.toString());
    }

    private String mapToJson(Map<?, ?> map) {
        StringBuilder json = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (!first) json.append(",");
            first = false;
            json.append("\"").append(entry.getKey()).append("\":\"");
            json.append(escapeJson(String.valueOf(entry.getValue()))).append("\"");
        }
        json.append("}");
        return json.toString();
    }

    private String escapeJson(String str) {
        return str.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().add("Content-Type", "application/json");

        // Add caching headers for successful responses
        if (statusCode == 200) {
            exchange.getResponseHeaders().add("Cache-Control", "public, max-age=300"); // 5 minutes
        } else {
            exchange.getResponseHeaders().add("Cache-Control", "no-cache, no-store, must-revalidate");
        }

        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);

        // Check if client accepts gzip compression
        String acceptEncoding = exchange.getRequestHeaders().getFirst("Accept-Encoding");
        if (acceptEncoding != null && acceptEncoding.contains("gzip") && bytes.length > 1024) {
            // Compress response if larger than 1KB
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (GZIPOutputStream gzipOut = new GZIPOutputStream(baos)) {
                gzipOut.write(bytes);
            }
            bytes = baos.toByteArray();
            exchange.getResponseHeaders().add("Content-Encoding", "gzip");
        }

        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void serveWebFile(HttpExchange exchange, String filename) throws IOException {
        try {
            // Try to load from plugin resources
            InputStream resourceStream = plugin.getResource("web/" + filename);

            if (resourceStream == null) {
                // Fall back to file in plugin data folder
                File webFile = new File(plugin.getDataFolder(), "web/" + filename);
                if (!webFile.exists()) {
                    String response = "404 - File not found: " + filename;
                    exchange.getResponseHeaders().add("Content-Type", "text/plain");
                    exchange.getResponseHeaders().add("Cache-Control", "no-cache, no-store, must-revalidate");
                    byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(404, bytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(bytes);
                    }
                    return;
                }
                resourceStream = new FileInputStream(webFile);
            }

            // Determine content type and if file is binary
            String contentType = "text/html; charset=UTF-8";
            boolean isBinary = false;

            if (filename.endsWith(".png")) {
                contentType = "image/png";
                isBinary = true;
            } else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
                contentType = "image/jpeg";
                isBinary = true;
            } else if (filename.endsWith(".ico")) {
                contentType = "image/x-icon";
                isBinary = true;
            }

            byte[] bytes;

            if (isBinary) {
                // Read binary content directly
                bytes = resourceStream.readAllBytes();
                resourceStream.close();

                // Send response with long caching for static images
                exchange.getResponseHeaders().add("Content-Type", contentType);
                exchange.getResponseHeaders().add("Cache-Control", "public, max-age=86400"); // 24 hours
            } else {
                // Read text content and process
                String content = new String(resourceStream.readAllBytes(), StandardCharsets.UTF_8);
                resourceStream.close();

                // Auto-configure API URL - use window.location.origin for correct URL
                // This works for both localhost and remote access without needing to detect IP
                String apiUrlReplacement = "window.location.protocol + '//' + window.location.host";

                content = content.replace("const API_URL = 'http://localhost:8080';",
                                         "const API_URL = " + apiUrlReplacement + ";");

                // Send response with minimal caching for HTML files
                exchange.getResponseHeaders().add("Content-Type", contentType);
                // Short cache to allow for updates while still being performant
                exchange.getResponseHeaders().add("Cache-Control", "public, max-age=30, must-revalidate");

                bytes = content.getBytes(StandardCharsets.UTF_8);
            }

            // Check if client accepts gzip compression
            String acceptEncoding = exchange.getRequestHeaders().getFirst("Accept-Encoding");
            if (acceptEncoding != null && acceptEncoding.contains("gzip") && bytes.length > 1024) {
                // Compress response if larger than 1KB
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                try (GZIPOutputStream gzipOut = new GZIPOutputStream(baos)) {
                    gzipOut.write(bytes);
                }
                bytes = baos.toByteArray();
                exchange.getResponseHeaders().add("Content-Encoding", "gzip");
            }

            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Error serving web file: " + filename, e);
            String response = "500 Internal Server Error";
            exchange.getResponseHeaders().add("Content-Type", "text/plain");
            exchange.getResponseHeaders().add("Cache-Control", "no-cache, no-store, must-revalidate");
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(500, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }
}
