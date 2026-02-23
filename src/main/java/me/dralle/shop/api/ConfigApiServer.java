package me.dralle.shop.api;

import me.dralle.shop.ShopPlugin;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.reflect.TypeToken;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.YamlUtil;
import org.bukkit.entity.Player;

import java.io.*;
import java.net.BindException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
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
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private final Map<String, SessionData> sessions = new ConcurrentHashMap<>();
    private final Map<String, AutoLoginToken> autoLoginTokens = new ConcurrentHashMap<>();
    private final Map<String, String> loginCodes = new ConcurrentHashMap<>();
    private final Map<String, PendingLoginConfirmation> pendingConfirmations = new ConcurrentHashMap<>();
    private final Map<String, java.util.Set<String>> trustedIps = new ConcurrentHashMap<>();
    private static final long SESSION_DURATION = 3600000; // 1 hour
    private static final long AUTO_LOGIN_TOKEN_DURATION = 300000; // 5 minutes
    private static final long PENDING_CONFIRMATION_DURATION = 180000; // 3 minutes
    private static final int MAX_ACTIVITY_ENTRIES = 400;

    public static class PendingLoginConfirmation {
        public String username;
        public String playerIp;
        public String requestIp;
        public String token;
        public long expiry;

        public PendingLoginConfirmation(String username, String playerIp, String requestIp, String token, long expiry) {
            this.username = username;
            this.playerIp = playerIp;
            this.requestIp = requestIp;
            this.token = token;
            this.expiry = expiry;
        }
    }

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
        loadTrustedIps();
    }

    /**
     * Load trusted IPs from file
     */
    private void loadTrustedIps() {
        File trustedIpsFile = new File(plugin.getDataFolder(), "trusted-ips.yml");
        if (!trustedIpsFile.exists()) {
            return;
        }

        try {
            YamlConfiguration config = YamlUtil.loadUtf8(trustedIpsFile);
            for (String username : config.getKeys(false)) {
                java.util.List<String> ips = config.getStringList(username);
                if (!ips.isEmpty()) {
                    trustedIps.put(username.toLowerCase(), new java.util.HashSet<>(ips));
                }
            }
            plugin.debug("WebEditor API: loaded trusted IPs for " + trustedIps.size() + " user(s)");
        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Failed to load trusted IPs: " + e.getMessage());
        }
    }

    /**
     * Save trusted IPs to file
     */
    private void saveTrustedIps() {
        File trustedIpsFile = new File(plugin.getDataFolder(), "trusted-ips.yml");
        YamlConfiguration config = new YamlConfiguration();

        for (Map.Entry<String, java.util.Set<String>> entry : trustedIps.entrySet()) {
            config.set(entry.getKey(), new java.util.ArrayList<>(entry.getValue()));
        }

        try {
            YamlUtil.saveUtf8(config, trustedIpsFile);
        } catch (IOException e) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Failed to save trusted IPs: " + e.getMessage());
        }
    }

    /**
     * Check if an IP is trusted for a user
     */
    private boolean isIpTrusted(String username, String ip) {
        java.util.Set<String> userTrustedIps = trustedIps.get(username.toLowerCase());
        return userTrustedIps != null && userTrustedIps.contains(ip);
    }

    /**
     * Add a trusted IP for a user
     */
    public void addTrustedIp(String username, String ip) {
        trustedIps.computeIfAbsent(username.toLowerCase(), k -> new java.util.HashSet<>()).add(ip);
        saveTrustedIps();
        me.dralle.shop.util.ConsoleLog.apiInfo(plugin, "Added trusted IP for user '" + username + "'");
    }

    /**
     * Get pending confirmation for a token
     */
    public PendingLoginConfirmation getPendingConfirmation(String token) {
        // Clean up expired confirmations
        pendingConfirmations.entrySet().removeIf(entry -> entry.getValue().expiry < System.currentTimeMillis());
        return pendingConfirmations.get(token);
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

        // Generate a 6-digit login code for Bedrock users
        String code = String.format("%06d", new java.util.Random().nextInt(1000000));
        loginCodes.put(code, token);

        // Clean up expired tokens and codes
        autoLoginTokens.entrySet().removeIf(entry -> entry.getValue().expiry < System.currentTimeMillis());
        loginCodes.entrySet().removeIf(entry -> !autoLoginTokens.containsKey(entry.getValue()));

        plugin.debug("WebEditor API: created auto-login token for " + player.getName() + " (" + ipAddress + ", 5m expiry)");
        return token;
    }

    public String getLoginCodeForToken(String token) {
        for (Map.Entry<String, String> entry : loginCodes.entrySet()) {
            if (entry.getValue().equals(token)) {
                return entry.getKey();
            }
        }
        return null;
    }

    public void start() {
        try {
            // Bind to all interfaces (0.0.0.0) so it can be accessed from network
            server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
            server.setExecutor(Executors.newFixedThreadPool(4));

            // Serve static web UI files
            server.createContext("/", exchange -> {
                String path = exchange.getRequestURI().getPath();

                if (path.startsWith("/api/")) {
                    // Handle API requests
                    exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                    exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
                    exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, X-API-Key, X-Session-Token, Cache-Control, Pragma");

                    if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                        exchange.sendResponseHeaders(204, -1);
                        return;
                    }

                    handleRequest(exchange);
                } else {
                    // Serve static files
                    String filename = path.equals("/") ? "index.html" : path.substring(1);
                    serveWebFile(exchange, filename);
                }
            });

            server.start();
            me.dralle.shop.util.ConsoleLog.apiInfo(plugin, "Online on port " + port + " (http://localhost:" + port + "/)");
        } catch (IOException e) {
            if (e instanceof BindException) {
                me.dralle.shop.util.ConsoleLog.apiError(plugin, "Failed to start: port " + port + " is already in use. Change 'api.port' in config.yml.");
            } else {
                me.dralle.shop.util.ConsoleLog.apiError(plugin, "Failed to start on port " + port + ": " + e.getMessage());
            }
            plugin.debug("WebEditor API startup exception: " + e);
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            me.dralle.shop.util.ConsoleLog.apiInfo(plugin, "Stopped");
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
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts POST requests");
                }
                return;
            }

            // Auto-login endpoint
            if (path.equals("/api/autologin")) {
                if (method.equals("POST")) {
                    handleAutoLogin(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts POST requests");
                }
                return;
            }

            // Login with code endpoint
            if (path.equals("/api/logincode")) {
                if (method.equals("POST")) {
                    handleLoginCode(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts POST requests");
                }
                return;
            }

            // Language endpoint
            if (path.equals("/api/language")) {
                if (method.equals("GET")) {
                    handleGetLanguage(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET requests");
                }
                return;
            }

            // Languages list endpoint
            if (path.equals("/api/languages")) {
                if (method.equals("GET")) {
                    handleListLanguages(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET requests");
                }
                return;
            }

            // All other endpoints require valid session
            if (!validateSession(exchange)) {
                sendError(exchange, 401, "Unauthorized", "Invalid or expired session token");
                return;
            }

            if (path.equals("/api/files")) {
                if (method.equals("GET")) {
                    handleListFiles(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET requests");
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
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET, POST, and DELETE requests");
                }
            } else if (path.equals("/api/activity-log")) {
                if (method.equals("GET")) {
                    handleGetActivityLog(exchange);
                } else if (method.equals("POST")) {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET requests");
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET requests");
                }
            } else if (path.equals("/api/activity-log/rollback")) {
                if (method.equals("POST")) {
                    handleRollbackActivityLog(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts POST requests");
                }
            } else if (path.equals("/api/activity-log/clear")) {
                if (method.equals("POST")) {
                    handleClearActivityLog(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts POST requests");
                }
            } else if (path.equals("/api/economy-safety")) {
                if (method.equals("GET")) {
                    handleGetEconomySafety(exchange);
                } else if (method.equals("POST")) {
                    handleSaveEconomySafety(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET and POST requests");
                }
            } else if (path.equals("/api/stock-analytics")) {
                if (method.equals("GET")) {
                    handleGetStockAnalytics(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET requests");
                }
            } else if (path.equals("/api/database")) {
                if (method.equals("GET")) {
                    handleGetDatabase(exchange);
                } else if (method.equals("POST")) {
                    handleUpsertDatabaseEntry(exchange);
                } else if (method.equals("DELETE")) {
                    handleDeleteDatabaseEntry(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET, POST, and DELETE requests");
                }
            } else if (path.equals("/api/telemetry")) {
                if (method.equals("GET")) {
                    handleGetTelemetry(exchange);
                } else if (method.equals("POST")) {
                    handlePostTelemetry(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET and POST requests");
                }
            } else {
                sendError(exchange, 404, "Endpoint Not Found", "The requested API endpoint does not exist");
            }
        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.apiError(plugin, method + " " + path + " failed: " + e.getClass().getSimpleName() + ": " + e.getMessage());
            plugin.debug("WebEditor API request exception (" + method + " " + path + "): " + e);
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("exception", e.getClass().getSimpleName());
            sendError(exchange, 500, "Internal Server Error", "An unexpected error occurred while processing your request", errorData);
        }
    }

    private void handleLogin(HttpExchange exchange) throws IOException {
        // Read request body
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);

        String username = extractJsonField(body, "username");
        String password = extractJsonField(body, "password");

        if (username == null || password == null) {
            sendError(exchange, 400, "Bad Request", "Missing username or password in request body");
            return;
        }

        // Check if player is online and has admin permission
        Player player = getPlayerByName(username);
        if (player == null || !player.isOnline()) {
            sendError(exchange, 401, "Unauthorized", "Player must be logged into the Minecraft server to authenticate");
            return;
        }

        // Check admin permission
        if (!player.hasPermission("geniusshop.admin") && !player.hasPermission("shop.admin") && !player.isOp()) {
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("username", username);
            errorData.put("requiredPermissions", new String[]{"geniusshop.admin", "shop.admin", "OP"});
            sendError(exchange, 403, "Forbidden", "Player does not have admin permission to access the editor", errorData);
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Login denied for '" + username + "': missing admin permission");
            return;
        }

        // Get player's IP address
        String playerIp = player.getAddress().getAddress().getHostAddress();

        // Get request IP address
        String requestIp = exchange.getRemoteAddress().getAddress().getHostAddress();

        // Check if IPs match
        if (!playerIp.equals(requestIp)) {
            // Check if IP bypass is enabled and user has permission
            boolean allowBypass = plugin.getConfig().getBoolean("api.allow-ip-bypass", true);

            if (allowBypass && player.hasPermission("geniusshop.login.ip.bypass")) {
                // Check if this IP is already trusted
                if (!isIpTrusted(username, requestIp)) {
                    // Create pending confirmation
                    String confirmToken = UUID.randomUUID().toString();
                    long confirmExpiry = System.currentTimeMillis() + PENDING_CONFIRMATION_DURATION;
                    pendingConfirmations.put(confirmToken, new PendingLoginConfirmation(
                            username, playerIp, requestIp, confirmToken, confirmExpiry
                    ));

                    // Send message to player with confirmation command
                    Bukkit.getScheduler().runTask(plugin, () ->
                            sendSecurityConfirmationPrompt(player, requestIp, playerIp, confirmToken));

                    Map<String, String> response = new HashMap<>();
                    response.put("status", "pending_confirmation");
                    response.put("message", "Please confirm this login in-game");
                    response.put("confirmToken", confirmToken);
                    response.put("username", username);
                    sendJsonResponse(exchange, 403, response);
                    me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Login blocked for '" + username + "': IP mismatch requires in-game confirmation");
                    return;
                }
                // IP is trusted, allow login to continue
                plugin.debug("WebEditor API: trusted IP bypass used for " + username);
            } else {
                Map<String, Object> errorData = new HashMap<>();
                errorData.put("playerIp", playerIp);
                errorData.put("requestIp", requestIp);
                sendError(exchange, 403, "IP Mismatch", "You must access this from the same network as your Minecraft client", errorData);
                me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Login blocked for '" + username + "': request IP does not match in-game IP");
                return;
            }
        }

        // Validate password (simple check - player's UUID as password)
        if (!password.equals(player.getUniqueId().toString())) {
            sendError(exchange, 401, "Invalid Credentials", "Incorrect password provided");
            return;
        }

        // Create session with IP address
        String sessionToken = UUID.randomUUID().toString();
        long expiry = System.currentTimeMillis() + SESSION_DURATION;
        sessions.put(sessionToken, new SessionData(username, requestIp, expiry));

        // Clean up expired sessions
        sessions.entrySet().removeIf(entry -> entry.getValue().expiry < System.currentTimeMillis());

        me.dralle.shop.util.ConsoleLog.apiInfo(plugin, "Admin '" + username + "' logged in");

        Map<String, String> response = new HashMap<>();
        response.put("sessionToken", sessionToken);
        response.put("username", username);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleAutoLogin(HttpExchange exchange) throws IOException {
        // Read request body
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        String token = extractJsonField(body, "token");

        plugin.debug("WebEditor API: auto-login attempt received");

        if (token == null) {
            sendError(exchange, 400, "Bad Request", "Auto-login token is required in the request body");
            return;
        }

        // Get token data
        AutoLoginToken tokenData = autoLoginTokens.get(token);
        if (tokenData == null) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Auto-login failed: token not found or expired");
            // List all token prefixes for debugging
            autoLoginTokens.keySet().forEach(t -> plugin.debug("WebEditor API: active token " + t.substring(0, 8) + "..."));
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("activeTokens", autoLoginTokens.size());
            sendError(exchange, 401, "Authentication Failed", "The auto-login token is invalid or has expired. Please generate a new token using /shop editor", errorData);
            return;
        }

        plugin.debug("WebEditor API: token found for " + tokenData.username);

        // Check if expired
        long now = System.currentTimeMillis();
        long timeLeft = tokenData.expiry - now;
        plugin.debug("WebEditor API: token time left " + (timeLeft / 1000) + "s");

        if (tokenData.expiry < now) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Auto-login failed: token expired");
            autoLoginTokens.remove(token);
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("expiredAt", tokenData.expiry);
            errorData.put("timeExpiredMs", Math.abs(timeLeft));
            sendError(exchange, 401, "Token Expired", "Your auto-login token has expired. Auto-login tokens are valid for 5 minutes. Please generate a new token using /shop editor", errorData);
            return;
        }

        plugin.debug("WebEditor API: token validated");

        completeAutoLogin(exchange, token, tokenData);
    }

    private void handleLoginCode(HttpExchange exchange) throws IOException {
        // Read request body
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        String username = extractJsonField(body, "username");
        String code = extractJsonField(body, "code");

        if (username == null || code == null) {
            sendError(exchange, 400, "Bad Request", "Username and login code are required");
            return;
        }

        // Find token for this code
        String token = loginCodes.get(code);
        if (token == null) {
            sendError(exchange, 401, "Invalid Code", "The login code is invalid or has expired");
            return;
        }

        AutoLoginToken tokenData = autoLoginTokens.get(token);
        if (tokenData == null) {
            loginCodes.remove(code);
            sendError(exchange, 401, "Expired Code", "The login code has expired");
            return;
        }

        // Verify username matches (case-insensitive for Bedrock support)
        if (!tokenData.username.equalsIgnoreCase(username)) {
            // Check if they are the same player (e.g. prefix handling)
            Player p = getPlayerByName(username);
            if (p == null || !p.getName().equalsIgnoreCase(tokenData.username)) {
                sendError(exchange, 401, "Invalid Username", "This login code was generated for a different player");
                return;
            }
        }

        // If username and code match, we proceed with the same logic as handleAutoLogin
        completeAutoLogin(exchange, token, tokenData);
    }

    private void completeAutoLogin(HttpExchange exchange, String token, AutoLoginToken tokenData) throws IOException {
        // Get request IP
        String requestIp = exchange.getRemoteAddress().getAddress().getHostAddress();

        // Verify IP matches
        boolean ipMatches = requestIp.equals(tokenData.ipAddress);

        // Allow localhost + private network ranges (IPv4/IPv6)
        boolean playerIsLocalhost = isLoopbackIp(tokenData.ipAddress);
        boolean requestIsLocal = isLocalNetworkIp(requestIp);

        // If player is connecting via localhost and request is from local network, allow it
        if (!ipMatches && !(playerIsLocalhost && requestIsLocal)) {
            // Check if IP bypass is enabled and user has permission
            boolean allowBypass = plugin.getConfig().getBoolean("api.allow-ip-bypass", true);
            Player player = getPlayerByName(tokenData.username);

            if (allowBypass && player != null && player.hasPermission("geniusshop.login.ip.bypass")) {
                // Check if this IP is already trusted
                if (isIpTrusted(tokenData.username, requestIp)) {
                    plugin.debug("WebEditor API: trusted IP bypass used for " + tokenData.username);
                } else {
                    // Create pending confirmation
                    String confirmToken = UUID.randomUUID().toString();
                    long confirmExpiry = System.currentTimeMillis() + PENDING_CONFIRMATION_DURATION;
                    pendingConfirmations.put(confirmToken, new PendingLoginConfirmation(
                            tokenData.username, tokenData.ipAddress, requestIp, token, confirmExpiry
                    ));

                    // Send message to player with confirmation command
                    Bukkit.getScheduler().runTask(plugin, () ->
                            sendSecurityConfirmationPrompt(player, requestIp, tokenData.ipAddress, confirmToken));

                    Map<String, String> response = new HashMap<>();
                    response.put("status", "pending_confirmation");
                    response.put("message", "Please confirm this login in-game");
                    response.put("confirmToken", confirmToken);
                    sendJsonResponse(exchange, 403, response);
                    me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Auto-login blocked for '" + tokenData.username + "': IP mismatch requires in-game confirmation");
                    return;
                }
                // IP is trusted, allow login to continue
                plugin.debug("WebEditor API: trusted IP bypass used for " + tokenData.username);
            } else {
                Map<String, Object> errorData = new HashMap<>();
                errorData.put("playerIp", tokenData.ipAddress);
                errorData.put("requestIp", requestIp);
                errorData.put("username", tokenData.username);
                sendError(exchange, 403, "IP Address Mismatch", "The request is coming from a different IP address than the one used to generate the token. For security reasons, you must access the editor from the same network as your Minecraft client", errorData);
                me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Auto-login blocked for '" + tokenData.username + "': request IP does not match in-game IP");
                // Don't remove token - let it expire naturally
                return;
            }
        }

        plugin.debug("WebEditor API: IP verification passed");

        // Verify player is still online
        Player player = getPlayerByName(tokenData.username);
        if (player == null || !player.isOnline()) {
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("username", tokenData.username);
            sendError(exchange, 401, "Player Offline", "The player associated with this token is no longer online on the Minecraft server. Please log in and generate a new token", errorData);
            autoLoginTokens.remove(token);
            return;
        }

        // Verify permission
        if (!player.hasPermission("geniusshop.admin") && !player.hasPermission("shop.admin") && !player.isOp()) {
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("username", tokenData.username);
            errorData.put("requiredPermissions", new String[]{"geniusshop.admin", "shop.admin", "OP"});
            sendError(exchange, 403, "Insufficient Permissions", "Your player no longer has admin permission to access the editor. You need one of: geniusshop.admin, shop.admin, or OP status", errorData);
            autoLoginTokens.remove(token);
            return;
        }

        // Remove used token (one-time use)
        autoLoginTokens.remove(token);
        // Also remove login code if it exists
        loginCodes.entrySet().removeIf(entry -> entry.getValue().equals(token));

        // Create session
        String sessionToken = UUID.randomUUID().toString();
        long expiry = System.currentTimeMillis() + SESSION_DURATION;
        sessions.put(sessionToken, new SessionData(tokenData.username, requestIp, expiry));

        // Clean up expired sessions
        sessions.entrySet().removeIf(entry -> entry.getValue().expiry < System.currentTimeMillis());

        me.dralle.shop.util.ConsoleLog.apiInfo(plugin, "Admin '" + tokenData.username + "' logged in");

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

        boolean sessionIsLocal = isLocalNetworkIp(session.ipAddress);
        boolean requestIsLocal = isLocalNetworkIp(requestIp);

        // If session and request are both local, allow it
        if (!ipMatches && !(sessionIsLocal && requestIsLocal)) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Session rejected for '" + session.username + "': request IP changed");
            sessions.remove(sessionToken);
            return false;
        }

        // Check if player is still online and has permission
        Player player = getPlayerByName(session.username);
        if (player == null || !player.isOnline()) {
            sessions.remove(sessionToken);
            return false;
        }

        // Don't check player IP changes if both are local network
        // (player might be IPv6 localhost while browser uses IPv4 LAN address)
        String playerIp = player.getAddress().getAddress().getHostAddress();
        boolean playerIsLocalhost = isLoopbackIp(playerIp);

        if (!playerIsLocalhost && !playerIp.equals(session.ipAddress) && !(sessionIsLocal && requestIsLocal)) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Session invalidated for '" + session.username + "': in-game IP changed");
            sessions.remove(sessionToken);
            return false;
        }

        if (!player.hasPermission("geniusshop.admin") && !player.hasPermission("shop.admin") && !player.isOp()) {
            sessions.remove(sessionToken);
            return false;
        }

        return true;
    }

    private boolean isLoopbackIp(String ip) {
        if (ip == null) return false;
        return ip.equals("127.0.0.1") || ip.equals("::1") || ip.equals("0:0:0:0:0:0:0:1");
    }

    private boolean isLocalNetworkIp(String ip) {
        if (ip == null || ip.isBlank()) return false;
        if (isLoopbackIp(ip)) return true;

        // IPv6 link-local + unique local
        String lower = ip.toLowerCase();
        if (lower.startsWith("fe80:") || lower.startsWith("fd") || lower.startsWith("fc")) {
            return true;
        }

        // IPv4 RFC1918 ranges
        if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
        if (ip.startsWith("172.")) {
            String[] parts = ip.split("\\.");
            if (parts.length >= 2) {
                try {
                    int second = Integer.parseInt(parts[1]);
                    return second >= 16 && second <= 31;
                } catch (NumberFormatException ignored) {
                    return false;
                }
            }
        }
        return false;
    }

    private void handleListFiles(HttpExchange exchange) throws IOException {
        Map<String, Object> response = new HashMap<>();
        response.put("shops", new HashMap<String, String>());

        ensureEditorFilesExist();

        // List shop files
        File shopsDir = new File(plugin.getDataFolder(), "shops");
        if (shopsDir.exists() && shopsDir.isDirectory()) {
            File[] shopFiles = shopsDir.listFiles((dir, name) -> name.endsWith(".yml"));
            if (shopFiles != null) {
                Map<String, String> shops = new HashMap<>();
                for (File file : shopFiles) {
                    String content = readFileSafely(file);
                    if (content != null) {
                        shops.put(file.getName(), content);
                    }
                }
                response.put("shops", shops);
            }
        }

        // Menu files
        File menusDir = new File(plugin.getDataFolder(), "menus");
        if (menusDir.exists() && menusDir.isDirectory()) {
            putIfPresent(response, "mainMenu", new File(menusDir, "main-menu.yml"));
            putIfPresent(response, "purchaseMenu", new File(menusDir, "purchase-menu.yml"));
            putIfPresent(response, "sellMenu", new File(menusDir, "sell-menu.yml"));
            putIfPresent(response, "guiSettings", new File(menusDir, "gui-settings.yml"));
            putIfPresent(response, "bulkSellMenu", new File(menusDir, "bulk-sell-menu.yml"));
        }

        // discord.yml
        putIfPresent(response, "discord", new File(plugin.getDataFolder(), "discord.yml"));
        putIfPresent(response, "campaignsFile", new File(plugin.getDataFolder(), "campaigns.yml"));

        // Sanitized price format config for web preview (no sensitive config values exposed).
        Map<String, Object> priceFormat = new HashMap<>();
        priceFormat.put("mode", plugin.getConfig().getString("price-format.mode", ""));
        Map<String, Object> grouped = new HashMap<>();
        grouped.put("thousandsSeparator", plugin.getConfig().getString("price-format.grouped.thousands-separator", "."));
        grouped.put("decimalSeparator", plugin.getConfig().getString("price-format.grouped.decimal-separator", ","));
        grouped.put("maxDecimals", plugin.getConfig().getInt("price-format.grouped.max-decimals", 2));
        priceFormat.put("grouped", grouped);
        response.put("priceFormat", priceFormat);
        response.put("economySafety", getEconomySafetySettingsMap());

        // Add server info
        Map<String, Object> serverInfo = new HashMap<>();
        serverInfo.put("version", plugin.getDescription().getVersion());
        boolean ssEnabled = plugin.getConfig().getBoolean("smart-spawner-support", true) &&
                (Bukkit.getPluginManager().isPluginEnabled("SmartSpawner") || Bukkit.getPluginManager().isPluginEnabled("SmartSpawners"));
        serverInfo.put("smartSpawnerEnabled", ssEnabled);

        if (ssEnabled) {
            org.bukkit.plugin.Plugin ssPlugin = Bukkit.getPluginManager().getPlugin("SmartSpawner");
            if (ssPlugin == null) ssPlugin = Bukkit.getPluginManager().getPlugin("SmartSpawners");

            if (ssPlugin != null) {
                try {
                    // Get Entity Types
                    File sFile = new File(ssPlugin.getDataFolder(), "spawners_settings.yml");
                    if (sFile.exists()) {
                        YamlConfiguration sYaml = YamlUtil.loadUtf8(sFile);
                        java.util.List<String> keys = new java.util.ArrayList<>();
                        for (String key : sYaml.getKeys(false)) {
                            if (key.equalsIgnoreCase("config_version") || key.equalsIgnoreCase("default_material")) {
                                continue;
                            }
                            if (sYaml.isConfigurationSection(key)) {
                                keys.add(key);
                            }
                        }
                        serverInfo.put("smartSpawnerEntityTypes", keys);
                    } else {
                        serverInfo.put("smartSpawnerEntityTypes", java.util.Collections.emptyList());
                    }

                    // Get Item Types
                    File iFile = new File(ssPlugin.getDataFolder(), "item_spawners_settings.yml");
                    if (iFile.exists()) {
                        YamlConfiguration iYaml = YamlUtil.loadUtf8(iFile);
                        java.util.List<String> keys = new java.util.ArrayList<>();
                        for (String key : iYaml.getKeys(false)) {
                            if (key.equalsIgnoreCase("config_version") || key.equalsIgnoreCase("default_material")) {
                                continue;
                            }
                            if (iYaml.isConfigurationSection(key)) {
                                keys.add(key);
                            }
                        }
                        serverInfo.put("smartSpawnerItemTypes", keys);
                    } else {
                        serverInfo.put("smartSpawnerItemTypes", java.util.Collections.emptyList());
                    }
                } catch (Exception e) {
                    me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "SmartSpawner settings unavailable: " + e.getMessage());
                    serverInfo.put("smartSpawnerEntityTypes", java.util.Collections.emptyList());
                    serverInfo.put("smartSpawnerItemTypes", java.util.Collections.emptyList());
                }
            }
        }

        java.util.List<String> entityTypes = new java.util.ArrayList<>();
        for (org.bukkit.entity.EntityType type : org.bukkit.entity.EntityType.values()) {
            if (type.isSpawnable()) {
                entityTypes.add(type.name());
            }
        }
        java.util.Collections.sort(entityTypes);
        serverInfo.put("entityTypes", entityTypes);

        java.util.List<String> materials = new java.util.ArrayList<>();
        for (org.bukkit.Material material : org.bukkit.Material.values()) {
            if (!material.isAir() && material.isItem()) {
                materials.add(material.name());
            }
        }
        java.util.Collections.sort(materials);
        serverInfo.put("materials", materials);
        
        response.put("serverInfo", serverInfo);

        sendJsonResponse(exchange, 200, response);
    }

    private void handleGetEconomySafety(HttpExchange exchange) throws IOException {
        sendJsonResponse(exchange, 200, getEconomySafetySettingsMap());
    }

    private void handleGetStockAnalytics(HttpExchange exchange) throws IOException {
        sendJsonResponse(exchange, 200, getStockAnalyticsMap());
    }

    private void handleGetDatabase(HttpExchange exchange) throws IOException {
        sendJsonResponse(exchange, 200, getDatabaseEditorMap());
    }

    private void handleUpsertDatabaseEntry(HttpExchange exchange) throws IOException {
        JsonObject body = parseJsonObject(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        if (body == null) {
            sendError(exchange, 400, "Invalid JSON", "Request body must be valid JSON");
            return;
        }

        String table = body.has("table") ? body.get("table").getAsString() : "";
        if (table.isBlank()) {
            sendError(exchange, 400, "Missing Field", "Field 'table' is required");
            return;
        }

        try {
            switch (table.toLowerCase(java.util.Locale.ROOT)) {
                case "player_counts" -> {
                    String uuid = body.has("uuid") ? body.get("uuid").getAsString() : "";
                    String itemKey = body.has("itemKey") ? body.get("itemKey").getAsString() : "";
                    int count = body.has("count") ? body.get("count").getAsInt() : 0;
                    if (uuid.isBlank() || itemKey.isBlank()) {
                        sendError(exchange, 400, "Missing Field", "Fields 'uuid' and 'itemKey' are required");
                        return;
                    }
                    plugin.getDataManager().setPlayerCount(uuid, itemKey, count, true);
                }
                case "global_counts" -> {
                    String itemKey = body.has("itemKey") ? body.get("itemKey").getAsString() : "";
                    int count = body.has("count") ? body.get("count").getAsInt() : 0;
                    if (itemKey.isBlank()) {
                        sendError(exchange, 400, "Missing Field", "Field 'itemKey' is required");
                        return;
                    }
                    plugin.getDataManager().setGlobalCount(itemKey, count, true);
                }
                case "stock_resets" -> {
                    String storedResetId = body.has("storedResetId") ? body.get("storedResetId").getAsString() : "";
                    long lastRun = body.has("lastRun") ? body.get("lastRun").getAsLong() : 0L;
                    if (storedResetId.isBlank()) {
                        sendError(exchange, 400, "Missing Field", "Field 'storedResetId' is required");
                        return;
                    }
                    plugin.getDataManager().setLastStockResetStored(storedResetId, lastRun, true);
                }
                default -> {
                    sendError(exchange, 400, "Invalid Table", "Unsupported table: " + table);
                    return;
                }
            }
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid Payload", "Failed to process database entry payload");
            return;
        }

        sendJsonResponse(exchange, 200, Map.of("success", true, "database", getDatabaseEditorMap()));
    }

    private void handleDeleteDatabaseEntry(HttpExchange exchange) throws IOException {
        JsonObject body = parseJsonObject(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        if (body == null) {
            sendError(exchange, 400, "Invalid JSON", "Request body must be valid JSON");
            return;
        }

        String table = body.has("table") ? body.get("table").getAsString() : "";
        if (table.isBlank()) {
            sendError(exchange, 400, "Missing Field", "Field 'table' is required");
            return;
        }

        switch (table.toLowerCase(java.util.Locale.ROOT)) {
            case "player_counts" -> {
                String uuid = body.has("uuid") ? body.get("uuid").getAsString() : "";
                String itemKey = body.has("itemKey") ? body.get("itemKey").getAsString() : "";
                if (uuid.isBlank() || itemKey.isBlank()) {
                    sendError(exchange, 400, "Missing Field", "Fields 'uuid' and 'itemKey' are required");
                    return;
                }
                plugin.getDataManager().removePlayerCount(uuid, itemKey);
            }
            case "global_counts" -> {
                String itemKey = body.has("itemKey") ? body.get("itemKey").getAsString() : "";
                if (itemKey.isBlank()) {
                    sendError(exchange, 400, "Missing Field", "Field 'itemKey' is required");
                    return;
                }
                plugin.getDataManager().removeGlobalCount(itemKey);
            }
            case "stock_resets" -> {
                String storedResetId = body.has("storedResetId") ? body.get("storedResetId").getAsString() : "";
                if (storedResetId.isBlank()) {
                    sendError(exchange, 400, "Missing Field", "Field 'storedResetId' is required");
                    return;
                }
                plugin.getDataManager().removeStockReset(storedResetId);
            }
            default -> {
                sendError(exchange, 400, "Invalid Table", "Unsupported table: " + table);
                return;
            }
        }

        sendJsonResponse(exchange, 200, Map.of("success", true, "database", getDatabaseEditorMap()));
    }

    private void handleSaveEconomySafety(HttpExchange exchange) throws IOException {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject root;
        try {
            root = JsonParser.parseString(body).getAsJsonObject();
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON", "Request body must be valid JSON");
            return;
        }

        JsonObject src = root.has("settings") && root.get("settings").isJsonObject()
                ? root.getAsJsonObject("settings")
                : root;
        if (src == null) {
            sendError(exchange, 400, "Missing Settings", "No economy safety settings were provided");
            return;
        }

        FileConfiguration cfg = plugin.getConfig();
        setBooleanIfPresent(cfg, src, "enabled", "economy-safety.enabled");
        setDoubleIfPresent(cfg, src, "maxTransactionValue", "economy-safety.max-transaction-value");
        setDoubleIfPresent(cfg, src, "maxUnitPrice", "economy-safety.max-unit-price");

        setBooleanIfPresent(cfg, src, "antiSpikeEnabled", "economy-safety.anti-spike.enabled");
        setDoubleIfPresent(cfg, src, "antiSpikeMaxBaseMultiplier", "economy-safety.anti-spike.max-base-multiplier");
        setDoubleIfPresent(cfg, src, "antiSpikeMinBaseMultiplier", "economy-safety.anti-spike.min-base-multiplier");
        setDoubleIfPresent(cfg, src, "antiSpikeMaxStepChangeRatio", "economy-safety.anti-spike.max-step-change-ratio");

        setBooleanIfPresent(cfg, src, "cooldownsEnabled", "economy-safety.cooldowns.enabled");
        setLongIfPresent(cfg, src, "buyCooldownMs", "economy-safety.cooldowns.buy-ms");
        setLongIfPresent(cfg, src, "sellCooldownMs", "economy-safety.cooldowns.sell-ms");
        setLongIfPresent(cfg, src, "bulkSellCooldownMs", "economy-safety.cooldowns.bulk-sell-ms");

        setBooleanIfPresent(cfg, src, "largePurchaseConfirmEnabled", "economy-safety.large-purchase-confirmation.enabled");
        setDoubleIfPresent(cfg, src, "largePurchaseConfirmThreshold", "economy-safety.large-purchase-confirmation.threshold");
        setLongIfPresent(cfg, src, "largePurchaseConfirmTimeoutSeconds", "economy-safety.large-purchase-confirmation.timeout-seconds");

        setBooleanIfPresent(cfg, src, "adminAlertsEnabled", "economy-safety.admin-alerts.enabled");
        setStringIfPresent(cfg, src, "adminNotifyPermission", "economy-safety.admin-alerts.notify-permission");
        setLongIfPresent(cfg, src, "adminAlertRateLimitMs", "economy-safety.admin-alerts.rate-limit-ms");

        plugin.saveConfig();
        plugin.reloadPlugin();
        sendJsonResponse(exchange, 200, Map.of("success", true, "economySafety", getEconomySafetySettingsMap()));
    }

    private Map<String, Object> getEconomySafetySettingsMap() {
        Map<String, Object> out = new HashMap<>();
        FileConfiguration cfg = plugin.getConfig();
        out.put("enabled", cfg.getBoolean("economy-safety.enabled", true));
        out.put("maxTransactionValue", cfg.getDouble("economy-safety.max-transaction-value", 0D));
        out.put("maxUnitPrice", cfg.getDouble("economy-safety.max-unit-price", 0D));

        out.put("antiSpikeEnabled", cfg.getBoolean("economy-safety.anti-spike.enabled", true));
        out.put("antiSpikeMaxBaseMultiplier", cfg.getDouble("economy-safety.anti-spike.max-base-multiplier", 10D));
        out.put("antiSpikeMinBaseMultiplier", cfg.getDouble("economy-safety.anti-spike.min-base-multiplier", 0D));
        out.put("antiSpikeMaxStepChangeRatio", cfg.getDouble("economy-safety.anti-spike.max-step-change-ratio", 5D));

        out.put("cooldownsEnabled", cfg.getBoolean("economy-safety.cooldowns.enabled", true));
        out.put("buyCooldownMs", cfg.getLong("economy-safety.cooldowns.buy-ms", 250L));
        out.put("sellCooldownMs", cfg.getLong("economy-safety.cooldowns.sell-ms", 250L));
        out.put("bulkSellCooldownMs", cfg.getLong("economy-safety.cooldowns.bulk-sell-ms", 500L));

        out.put("largePurchaseConfirmEnabled", cfg.getBoolean("economy-safety.large-purchase-confirmation.enabled", false));
        out.put("largePurchaseConfirmThreshold", cfg.getDouble("economy-safety.large-purchase-confirmation.threshold", 0D));
        out.put("largePurchaseConfirmTimeoutSeconds", cfg.getLong("economy-safety.large-purchase-confirmation.timeout-seconds", 10L));

        out.put("adminAlertsEnabled", cfg.getBoolean("economy-safety.admin-alerts.enabled", false));
        out.put("adminNotifyPermission", cfg.getString("economy-safety.admin-alerts.notify-permission", "geniusshop.admin"));
        out.put("adminAlertRateLimitMs", cfg.getLong("economy-safety.admin-alerts.rate-limit-ms", 3000L));
        return out;
    }

    private Map<String, Object> getStockAnalyticsMap() {
        Map<String, Object> out = new LinkedHashMap<>();
        List<Map<String, Object>> entries = new ArrayList<>();
        Map<String, Integer> globalCounts = plugin.getDataManager().getAllGlobalCounts();

        int totalShops = 0;
        int totalItems = 0;
        int trackedItems = 0;
        int outOfStock = 0;
        int lowStock = 0;
        long totalLimit = 0L;
        long totalCount = 0L;

        for (String shopKey : plugin.getShopManager().getShopKeys()) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop == null) continue;
            totalShops++;

            for (ShopItem item : shop.getItems()) {
                if (item == null) continue;
                totalItems++;

                int limit = Math.max(0, item.getGlobalLimit());
                if (limit <= 0) continue;

                trackedItems++;
                int current = Math.max(0, globalCounts.getOrDefault(item.getUniqueKey(), 0));
                int remaining = Math.max(0, limit - current);
                long lowThreshold = Math.max(1L, Math.round(limit * 0.20D));
                if (remaining <= 0) {
                    outOfStock++;
                } else if (remaining <= lowThreshold) {
                    lowStock++;
                }

                totalLimit += limit;
                totalCount += Math.min(current, limit);

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("shopKey", shopKey);
                row.put("itemKey", item.getUniqueKey());
                row.put("slot", item.getSlot() != null ? item.getSlot() : -1);
                row.put("material", item.getMaterial() != null ? item.getMaterial().name() : "UNKNOWN");
                row.put("name", item.getName() != null ? item.getName() : "");
                row.put("globalLimit", limit);
                row.put("current", current);
                row.put("remaining", remaining);
                row.put("utilizationPct", limit > 0 ? Math.min(100D, (current * 100D) / limit) : 0D);
                row.put("showStock", item.isShowStock());
                row.put("showStockResetTimer", item.isShowStockResetTimer());
                row.put("dynamicPricing", item.isDynamicPricing());
                entries.add(row);
            }
        }

        entries.sort(Comparator
                .comparingDouble((Map<String, Object> m) -> ((Number) m.getOrDefault("utilizationPct", 0D)).doubleValue())
                .reversed()
                .thenComparingInt((Map<String, Object> m) -> ((Number) m.getOrDefault("remaining", 0)).intValue())
        );

        out.put("generatedAt", Instant.now().toString());
        out.put("totals", Map.of(
                "shops", totalShops,
                "items", totalItems,
                "trackedItems", trackedItems,
                "outOfStock", outOfStock,
                "lowStock", lowStock,
                "totalLimit", totalLimit,
                "totalCount", totalCount,
                "fillPct", totalLimit > 0 ? (totalCount * 100D) / totalLimit : 0D
        ));
        out.put("entries", entries);
        return out;
    }

    private Map<String, Object> getDatabaseEditorMap() {
        Map<String, Object> out = new LinkedHashMap<>();
        List<Map<String, Object>> playerRows = new ArrayList<>();
        for (me.dralle.shop.data.DataManager.PlayerCountEntry entry : plugin.getDataManager().getAllPlayerCountEntries()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("uuid", entry.uuid());
            row.put("itemKey", entry.itemKey());
            row.put("count", entry.count());
            playerRows.add(row);
        }

        List<Map<String, Object>> globalRows = new ArrayList<>();
        for (me.dralle.shop.data.DataManager.GlobalCountEntry entry : plugin.getDataManager().getAllGlobalCountEntries()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("itemKey", entry.itemKey());
            row.put("count", entry.count());
            globalRows.add(row);
        }

        List<Map<String, Object>> stockRows = new ArrayList<>();
        for (me.dralle.shop.data.DataManager.StockResetEntry entry : plugin.getDataManager().getAllStockResetEntries()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("storedResetId", entry.storedResetId());
            row.put("resetId", entry.resetId());
            row.put("lastRun", entry.lastRun());
            row.put("lastRunIso", entry.lastRun() > 0 ? Instant.ofEpochMilli(entry.lastRun()).toString() : "");
            stockRows.add(row);
        }

        out.put("generatedAt", Instant.now().toString());
        out.put("playerCounts", playerRows);
        out.put("globalCounts", globalRows);
        out.put("stockResets", stockRows);
        out.put("totals", Map.of(
                "playerCounts", playerRows.size(),
                "globalCounts", globalRows.size(),
                "stockResets", stockRows.size()
        ));
        return out;
    }

    private void setBooleanIfPresent(FileConfiguration cfg, JsonObject src, String key, String path) {
        if (src.has(key) && src.get(key).isJsonPrimitive()) {
            cfg.set(path, src.get(key).getAsBoolean());
        }
    }

    private void setLongIfPresent(FileConfiguration cfg, JsonObject src, String key, String path) {
        if (src.has(key) && src.get(key).isJsonPrimitive()) {
            cfg.set(path, src.get(key).getAsLong());
        }
    }

    private void setDoubleIfPresent(FileConfiguration cfg, JsonObject src, String key, String path) {
        if (src.has(key) && src.get(key).isJsonPrimitive()) {
            cfg.set(path, src.get(key).getAsDouble());
        }
    }

    private void setStringIfPresent(FileConfiguration cfg, JsonObject src, String key, String path) {
        if (src.has(key) && src.get(key).isJsonPrimitive()) {
            cfg.set(path, src.get(key).getAsString());
        }
    }

    private void ensureEditorFilesExist() {
        File menusDir = new File(plugin.getDataFolder(), "menus");
        File shopsDir = new File(plugin.getDataFolder(), "shops");
        if (!menusDir.exists()) menusDir.mkdirs();
        if (!shopsDir.exists()) shopsDir.mkdirs();

        ensureDefaultResourceExists("menus/main-menu.yml");
        ensureDefaultResourceExists("menus/purchase-menu.yml");
        ensureDefaultResourceExists("menus/sell-menu.yml");
        ensureDefaultResourceExists("menus/bulk-sell-menu.yml");
        ensureDefaultResourceExists("menus/gui-settings.yml");
        ensureDefaultResourceExists("discord.yml");
        ensureTextFileExists(new File(plugin.getDataFolder(), "campaigns.yml"), "campaigns: []\n");
    }

    private void ensureDefaultResourceExists(String resourcePath) {
        File file = new File(plugin.getDataFolder(), resourcePath);
        if (!file.exists() && plugin.getResource(resourcePath) != null) {
            try {
                plugin.saveResource(resourcePath, false);
            } catch (Exception e) {
                me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Failed to create default resource '" + resourcePath + "': " + e.getMessage());
            }
        }
    }

    private void ensureTextFileExists(File file, String content) {
        if (file.exists()) return;
        try {
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            Files.writeString(file.toPath(), content, StandardCharsets.UTF_8);
        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Failed to create default file '" + file.getName() + "': " + e.getMessage());
        }
    }

    private String readFileSafely(File file) {
        if (file == null || !file.exists()) return null;
        try {
            return Files.readString(file.toPath(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Failed to read file '" + file.getName() + "': " + e.getMessage());
            return null;
        }
    }

    private void putIfPresent(Map<String, Object> response, String key, File file) {
        String content = readFileSafely(file);
        if (content != null) {
            response.put(key, content);
        }
    }

    private void handleGetFile(HttpExchange exchange, String fileName) throws IOException {
        File file = resolveFile(fileName);

        if (file == null || !file.exists()) {
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("fileName", fileName);
            errorData.put("reason", file == null ? "Invalid file path" : "File does not exist");
            sendError(exchange, 404, "File Not Found", "The requested configuration file could not be found or is not accessible", errorData);
            return;
        }

        String content = Files.readString(file.toPath(), StandardCharsets.UTF_8);
        Map<String, String> response = new HashMap<>();
        response.put("content", content);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleSaveFile(HttpExchange exchange, String fileName) throws IOException {
        File file = resolveFile(fileName);

        if (file == null) {
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("fileName", fileName);
            sendError(exchange, 400, "Invalid File Name", "The specified file name is invalid or contains illegal characters. File paths cannot contain '..' or reference files outside the allowed directories", errorData);
            return;
        }

        // Read request body
        String content = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        
        // Parse JSON to get content
        String fileContent = extractJsonField(content, "content");
        if (fileContent == null) {
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("fileName", fileName);
            sendError(exchange, 400, "Missing Content", "The request body must include a 'content' field with the file data to save", errorData);
            return;
        }

        // Validate YAML
        try {
            YamlConfiguration.loadConfiguration(new StringReader(fileContent));
        } catch (Exception e) {
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("fileName", fileName);
            errorData.put("validationError", e.getMessage());
            errorData.put("exception", e.getClass().getSimpleName());
            sendError(exchange, 400, "Invalid YAML Syntax", "The file content contains invalid YAML syntax and cannot be saved. Please fix the syntax errors and try again", errorData);
            return;
        }

        // Create parent directories if needed
        if (!file.getParentFile().exists()) {
            boolean created = file.getParentFile().mkdirs();
            if (!created) {
                me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Failed to create directory: " + file.getParentFile());
            }
        }

        String previousContent = readFileSafely(file);

        // Save file
        Files.writeString(file.toPath(), fileContent, StandardCharsets.UTF_8);

        String username = getSessionUsername(exchange);
        boolean existedBefore = previousContent != null;
        if (!existedBefore) {
            appendActivityEntry("created", "file", username, fileName, null, fileContent, null);
        } else if (!previousContent.equals(fileContent)) {
            appendActivityEntry("updated", "file", username, fileName, previousContent, fileContent, null);
        }

        // Reload plugin configuration
        plugin.reloadPlugin();
        
        sendResponse(exchange, 200, "{\"success\": true}");
    }

    private void handleDeleteFile(HttpExchange exchange, String fileName) throws IOException {
        File file = resolveFile(fileName);

        if (file == null) {
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("fileName", fileName);
            sendError(exchange, 400, "Invalid File Name", "The specified file name is invalid or contains illegal characters. File paths cannot contain '..' or reference files outside the allowed directories", errorData);
            return;
        }

        // Don't allow deletion of main config files or menu files
        if (fileName.equals("discord.yml") || fileName.equals("config.yml") ||
            fileName.startsWith("menus/")) {
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("fileName", fileName);
            errorData.put("fileType", "protected");
            sendError(exchange, 403, "Deletion Forbidden", "This file is a core configuration file and cannot be deleted through the API. Protected files include: config.yml, discord.yml, and all menu files", errorData);
            return;
        }

        if (!file.exists()) {
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("fileName", fileName);
            sendError(exchange, 404, "File Not Found", "The file you are trying to delete does not exist on the server", errorData);
            return;
        }

        String previousContent = readFileSafely(file);

        // Delete the file
        try {
            boolean deleted = file.delete();
            if (!deleted) {
                Map<String, Object> errorData = new HashMap<>();
                errorData.put("fileName", fileName);
                errorData.put("filePath", file.getAbsolutePath());
                sendError(exchange, 500, "Deletion Failed", "The file could not be deleted. It may be locked by another process or the server may not have sufficient permissions", errorData);
                return;
            }

            // Get session info for logging
            String username = getSessionUsername(exchange);

            me.dralle.shop.util.ConsoleLog.apiInfo(plugin, "Admin '" + username + "' deleted '" + fileName + "'");
            appendActivityEntry("deleted", "file", username, fileName, previousContent, null, null);

            sendResponse(exchange, 200, "{\"success\": true}");
        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.apiError(plugin, "Delete failed for '" + fileName + "': " + e.getMessage());
            plugin.debug("WebEditor API delete exception: " + e);
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("fileName", fileName);
            errorData.put("exception", e.getClass().getSimpleName());
            errorData.put("exceptionMessage", e.getMessage());
            sendError(exchange, 500, "Deletion Error", "An unexpected error occurred while attempting to delete the file", errorData);
        }
    }

    private void handleGetActivityLog(HttpExchange exchange) throws IOException {
        sendJsonResponse(exchange, 200, loadActivityEntries());
    }

    private void handleGetLanguage(HttpExchange exchange) throws IOException {
        String query = exchange.getRequestURI().getQuery();
        String lang = null;
        if (query != null && query.contains("lang=")) {
            // Very basic query param parsing
            String[] params = query.split("&");
            for (String param : params) {
                if (param.startsWith("lang=")) {
                    lang = param.substring(5);
                    break;
                }
            }
        }

        if (lang == null || lang.isEmpty() || lang.contains("..") || lang.contains("/") || lang.contains("\\")) {
            lang = plugin.getConfig().getString("language", "en_US");
        }

        File langFile = new File(plugin.getDataFolder(), "languages" + File.separator + lang + ".yml");
        if (!langFile.exists()) {
            langFile = new File(plugin.getDataFolder(), "languages" + File.separator + "en_US.yml");
        }

        if (!langFile.exists()) {
            sendError(exchange, 404, "Not Found", "Language file not found");
            return;
        }

        YamlConfiguration config = YamlUtil.loadUtf8(langFile);
        Map<String, Object> response = new HashMap<>();

        // Only send web-editor section
        if (config.contains("web-editor")) {
            response.put("web-editor", recursiveSectionToMap(config.getConfigurationSection("web-editor")));
        } else {
            // Fallback to en_US if current doesn't have web-editor
            File enFile = new File(plugin.getDataFolder(), "languages" + File.separator + "en_US.yml");
            if (enFile.exists()) {
                YamlConfiguration enConfig = YamlUtil.loadUtf8(enFile);
                if (enConfig.contains("web-editor")) {
                    response.put("web-editor", recursiveSectionToMap(enConfig.getConfigurationSection("web-editor")));
                }
            }
        }

        response.put("language", lang);

        sendJsonResponse(exchange, 200, response);
    }

    private void handleListLanguages(HttpExchange exchange) throws IOException {
        File langFolder = new File(plugin.getDataFolder(), "languages");
        String[] langFiles = langFolder.list((dir, name) -> name.endsWith(".yml"));
        java.util.List<String> languages = new java.util.ArrayList<>();
        if (langFiles != null) {
            java.util.Arrays.sort(langFiles);
            for (String file : langFiles) {
                languages.add(file.replace(".yml", ""));
            }
        }
        sendJsonResponse(exchange, 200, languages);
    }

    private void handleRollbackActivityLog(HttpExchange exchange) throws IOException {
        JsonObject body = parseJsonObject(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        if (body == null || !body.has("id")) {
            sendError(exchange, 400, "Bad Request", "Request body must contain an activity-log entry id");
            return;
        }

        long id;
        try {
            id = body.get("id").getAsLong();
        } catch (Exception e) {
            sendError(exchange, 400, "Bad Request", "Invalid activity-log entry id");
            return;
        }

        List<Map<String, Object>> entries = loadActivityEntries();
        Map<String, Object> entry = null;
        for (Map<String, Object> candidate : entries) {
            Object entryId = candidate.get("id");
            if (entryId instanceof Number n && n.longValue() == id) {
                entry = candidate;
                break;
            }
        }
        if (entry == null) {
            sendError(exchange, 404, "Not Found", "Activity log entry not found");
            return;
        }

        String action = String.valueOf(entry.getOrDefault("action", "")).toLowerCase(java.util.Locale.ROOT);
        @SuppressWarnings("unchecked")
        Map<String, Object> details = entry.get("details") instanceof Map ? (Map<String, Object>) entry.get("details") : null;

        String fileName = details != null ? toStringOrNull(details.get("fileName")) : null;
        if (fileName == null || fileName.isEmpty()) {
            fileName = inferFileNameFromEntry(entry);
        }
        if (fileName == null || fileName.isEmpty()) {
            sendError(exchange, 400, "Rollback Failed", "Could not determine file for rollback entry");
            return;
        }

        File file = resolveFile(fileName);
        if (file == null) {
            sendError(exchange, 400, "Rollback Failed", "Rollback entry references an invalid file path");
            return;
        }

        String currentContent = readFileSafely(file);
        String restoredContent = null;
        boolean changed = false;

        if (action.equals("created")) {
            if (file.exists()) {
                changed = file.delete();
            }
        } else {
            String beforeContent = extractSnapshotContent(entry.get("beforeData"));
            if (beforeContent == null) {
                sendError(exchange, 400, "Rollback Failed", "Rollback entry has no restorable previous content");
                return;
            }
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            Files.writeString(file.toPath(), beforeContent, StandardCharsets.UTF_8);
            restoredContent = beforeContent;
            changed = true;
        }

        if (!changed) {
            sendJsonResponse(exchange, 200, Map.of("success", true, "changed", false));
            return;
        }

        plugin.reloadPlugin();

        String username = getSessionUsername(exchange);
        Map<String, Object> extra = new HashMap<>();
        extra.put("rolledBackEntryId", id);
        appendActivityEntry("rollback", "file", username, fileName, currentContent, restoredContent, extra);

        sendJsonResponse(exchange, 200, Map.of("success", true, "changed", true));
    }

    private void handleClearActivityLog(HttpExchange exchange) throws IOException {
        saveActivityEntries(new ArrayList<>());
        sendJsonResponse(exchange, 200, Map.of("success", true));
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

        // Handle language files in languages/ directory
        if (fileName.startsWith("languages/") || fileName.startsWith("languages\\")) {
            String langFile = fileName.substring(10); // Remove "languages/"
            if (langFile.contains("..") || langFile.contains("/") || langFile.contains("\\")) {
                return null;
            }
            return new File(plugin.getDataFolder(), "languages" + File.separator + langFile);
        }

        // Handle main config files
        if (fileName.equals("discord.yml") || fileName.equals("config.yml") || 
            fileName.equals("gui.yml") || fileName.equals("campaigns.yml")) {
            return new File(plugin.getDataFolder(), fileName);
        }

        return null;
    }

    private String extractJsonField(String json, String field) {
        try {
            JsonObject jsonObject = JsonParser.parseString(json).getAsJsonObject();
            if (jsonObject.has(field)) {
                return jsonObject.get(field).getAsString();
            }
        } catch (Exception ignored) {}
        return null;
    }

    private JsonObject parseJsonObject(String json) {
        try {
            return JsonParser.parseString(json).getAsJsonObject();
        } catch (Exception ignored) {
            return null;
        }
    }

    private String getSessionUsername(HttpExchange exchange) {
        String sessionToken = exchange.getRequestHeaders().getFirst("X-Session-Token");
        SessionData session = sessions.get(sessionToken);
        return session != null ? session.username : "unknown";
    }

    private File getActivityLogFile() {
        return new File(plugin.getDataFolder(), "activity-log.json");
    }

    private File getTelemetryLogFile() {
        return new File(plugin.getDataFolder(), "telemetry-log.json");
    }

    private List<Map<String, Object>> loadTelemetryEntries() {
        File logFile = getTelemetryLogFile();
        if (!logFile.exists()) return new ArrayList<>();
        try {
            String json = Files.readString(logFile.toPath(), StandardCharsets.UTF_8);
            if (json == null || json.trim().isEmpty()) return new ArrayList<>();
            java.lang.reflect.Type listType = new TypeToken<List<Map<String, Object>>>() {}.getType();
            List<Map<String, Object>> entries = GSON.fromJson(json, listType);
            return entries != null ? entries : new ArrayList<>();
        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Failed to read telemetry log: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private void saveTelemetryEntries(List<Map<String, Object>> entries) {
        File logFile = getTelemetryLogFile();
        try {
            if (!logFile.getParentFile().exists()) {
                logFile.getParentFile().mkdirs();
            }
            Files.writeString(logFile.toPath(), GSON.toJson(entries), StandardCharsets.UTF_8);
        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Failed to write telemetry log: " + e.getMessage());
        }
    }

    private void handlePostTelemetry(HttpExchange exchange) throws IOException {
        JsonObject body = parseJsonObject(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        if (body == null) {
            sendError(exchange, 400, "Invalid JSON", "Request body must be valid JSON");
            return;
        }

        String event = body.has("event") ? body.get("event").getAsString() : "";
        if (event.isEmpty()) {
            sendError(exchange, 400, "Missing Field", "Field 'event' is required");
            return;
        }

        String username = getSessionUsername(exchange);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("timestamp", Instant.now().toString());
        row.put("event", event);
        row.put("username", username != null ? username : "unknown");
        row.put("tab", body.has("tab") ? body.get("tab").getAsString() : "");
        row.put("mode", body.has("mode") ? body.get("mode").getAsString() : "");
        row.put("durationMs", body.has("durationMs") ? body.get("durationMs").getAsLong() : 0L);
        row.put("success", !body.has("success") || body.get("success").getAsBoolean());
        row.put("metadata", body.has("metadata") ? body.get("metadata").toString() : "{}");

        List<Map<String, Object>> entries = loadTelemetryEntries();
        entries.add(row);
        if (entries.size() > 2000) {
            entries = new ArrayList<>(entries.subList(entries.size() - 2000, entries.size()));
        }
        saveTelemetryEntries(entries);
        sendJsonResponse(exchange, 200, Map.of("success", true));
    }

    private void handleGetTelemetry(HttpExchange exchange) throws IOException {
        List<Map<String, Object>> entries = loadTelemetryEntries();
        Map<String, Integer> totals = new LinkedHashMap<>();
        for (Map<String, Object> row : entries) {
            String event = String.valueOf(row.getOrDefault("event", "unknown"));
            totals.put(event, totals.getOrDefault(event, 0) + 1);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("count", entries.size());
        response.put("totals", totals);
        response.put("recent", entries.stream()
                .sorted((a, b) -> String.valueOf(b.getOrDefault("timestamp", "")).compareTo(String.valueOf(a.getOrDefault("timestamp", ""))))
                .limit(100)
                .toList());
        sendJsonResponse(exchange, 200, response);
    }

    private synchronized List<Map<String, Object>> loadActivityEntries() {
        File logFile = getActivityLogFile();
        if (!logFile.exists()) return new ArrayList<>();
        try {
            String raw = Files.readString(logFile.toPath(), StandardCharsets.UTF_8);
            if (raw == null || raw.trim().isEmpty()) return new ArrayList<>();
            java.lang.reflect.Type type = new TypeToken<List<Map<String, Object>>>() {}.getType();
            List<Map<String, Object>> parsed = GSON.fromJson(raw, type);
            return parsed != null ? parsed : new ArrayList<>();
        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Failed to read activity log: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private synchronized void saveActivityEntries(List<Map<String, Object>> entries) {
        File logFile = getActivityLogFile();
        try {
            File parent = logFile.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            Files.writeString(logFile.toPath(), GSON.toJson(entries), StandardCharsets.UTF_8);
        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.apiWarn(plugin, "Failed to write activity log: " + e.getMessage());
        }
    }

    private synchronized void appendActivityEntry(
            String action,
            String target,
            String username,
            String fileName,
            String beforeContent,
            String afterContent,
            Map<String, Object> extraDetails
    ) {
        List<Map<String, Object>> entries = loadActivityEntries();
        Map<String, Object> entry = new LinkedHashMap<>();
        long id = System.currentTimeMillis() * 1000L + (long) (Math.random() * 1000L);
        entry.put("id", id);
        entry.put("timestamp", Instant.now().toString());
        entry.put("username", username == null ? "unknown" : username);
        entry.put("action", action);
        entry.put("target", target);
        entry.put("beforeData", makeFileSnapshot(fileName, beforeContent));
        entry.put("afterData", makeFileSnapshot(fileName, afterContent));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("fileName", fileName);
        if (extraDetails != null) {
            details.putAll(extraDetails);
        }
        entry.put("details", details);

        entries.add(0, entry);
        if (entries.size() > MAX_ACTIVITY_ENTRIES) {
            entries = new ArrayList<>(entries.subList(0, MAX_ACTIVITY_ENTRIES));
        }
        saveActivityEntries(entries);
    }

    private Map<String, Object> makeFileSnapshot(String fileName, String content) {
        if (content == null) return null;
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("fileName", fileName);
        snapshot.put("content", content);
        return snapshot;
    }

    private String extractSnapshotContent(Object snapshotObj) {
        if (!(snapshotObj instanceof Map<?, ?> map)) return null;
        Object content = map.get("content");
        return toStringOrNull(content);
    }

    private String inferFileNameFromEntry(Map<String, Object> entry) {
        String fileName = inferFileNameFromSnapshot(entry.get("afterData"));
        if (fileName != null && !fileName.isEmpty()) return fileName;
        return inferFileNameFromSnapshot(entry.get("beforeData"));
    }

    private String inferFileNameFromSnapshot(Object snapshotObj) {
        if (!(snapshotObj instanceof Map<?, ?> map)) return null;
        return toStringOrNull(map.get("fileName"));
    }

    private String toStringOrNull(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Map<String, Object> recursiveSectionToMap(org.bukkit.configuration.ConfigurationSection section) {
        Map<String, Object> map = new HashMap<>();
        if (section == null) return map;
        for (String key : section.getKeys(false)) {
            Object value = section.get(key);
            if (value instanceof org.bukkit.configuration.ConfigurationSection) {
                map.put(key, recursiveSectionToMap((org.bukkit.configuration.ConfigurationSection) value));
            } else if (value instanceof java.util.List) {
                java.util.List<Object> newList = new java.util.ArrayList<>();
                for (Object item : (java.util.List<?>) value) {
                    if (item instanceof org.bukkit.configuration.ConfigurationSection) {
                        newList.add(recursiveSectionToMap((org.bukkit.configuration.ConfigurationSection) item));
                    } else {
                        newList.add(item);
                    }
                }
                map.put(key, newList);
            } else {
                map.put(key, value);
            }
        }
        return map;
    }

    private void sendJsonResponse(HttpExchange exchange, int statusCode, Object data) throws IOException {
        String json = GSON.toJson(data);
        sendResponse(exchange, statusCode, json);
    }

    private void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().add("Content-Type", "application/json");

        // API responses should not be cached to ensure the editor always has the latest data
        exchange.getResponseHeaders().add("Cache-Control", "no-cache, no-store, must-revalidate");
        exchange.getResponseHeaders().add("Pragma", "no-cache");
        exchange.getResponseHeaders().add("Expires", "0");

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

    private void sendError(HttpExchange exchange, int statusCode, String error, String message) throws IOException {
        sendError(exchange, statusCode, error, message, null);
    }

    private void sendError(HttpExchange exchange, int statusCode, String error, String message, Map<String, Object> additionalData) throws IOException {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", error);
        errorResponse.put("status", statusCode);
        errorResponse.put("message", message);
        errorResponse.put("timestamp", System.currentTimeMillis());
        errorResponse.put("path", exchange.getRequestURI().getPath());

        if (additionalData != null) {
            errorResponse.putAll(additionalData);
        }

        sendJsonResponse(exchange, statusCode, errorResponse);
    }

    private void serveWebFile(HttpExchange exchange, String filename) throws IOException {
        if (filename.contains("..") || filename.contains("//") || filename.startsWith("/") || filename.startsWith("\\")) {
            sendError(exchange, 400, "Invalid Path", "The requested path contains illegal characters");
            return;
        }
        try {
            // Try to load from plugin resources
            InputStream resourceStream = plugin.getResource("web/" + filename);

            if (resourceStream == null) {
                // Fall back to file in plugin data folder
                File webFile = new File(plugin.getDataFolder(), "web/" + filename);
                if (!webFile.exists()) {
                    Map<String, Object> errorData = new HashMap<>();
                    errorData.put("filename", filename);
                    sendError(exchange, 404, "File Not Found", "The requested web file does not exist in resources or data folder", errorData);
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
            } else if (filename.endsWith(".css")) {
                contentType = "text/css; charset=UTF-8";
            } else if (filename.endsWith(".js")) {
                contentType = "application/javascript; charset=UTF-8";
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
            me.dralle.shop.util.ConsoleLog.apiError(plugin, "Failed to serve web file '" + filename + "': " + e.getMessage());
            plugin.debug("WebEditor API serveWebFile exception: " + e);
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("filename", filename);
            errorData.put("exception", e.getClass().getSimpleName());
            sendError(exchange, 500, "Internal Server Error", "An error occurred while serving the requested file", errorData);
        }
    }

    private void sendSecurityConfirmationPrompt(Player player, String requestIp, String currentIp, String confirmToken) {
        player.sendMessage(ShopItemUtil.color("&8&m----------------------------------------------------------------"));
        player.sendMessage(ShopItemUtil.color("<gradient:#EF4444:#F97316>&lSECURITY ALERT</gradient>"));
        player.sendMessage("");
        player.sendMessage(ShopItemUtil.color("&7Someone is trying to access the shop editor from:"));
        player.sendMessage(ShopItemUtil.color("&e" + requestIp));
        player.sendMessage("");
        player.sendMessage(ShopItemUtil.color("&7Your current IP: &a" + currentIp));
        player.sendMessage("");
        player.sendMessage(ShopItemUtil.color("&7If this is you, run this command to confirm:"));
        player.sendMessage(ShopItemUtil.color("&aType: &e/shop confirmlogin " + confirmToken));
        player.sendMessage("");
        player.sendMessage(ShopItemUtil.color("&cThis request will expire in 3 minutes."));
        player.sendMessage(ShopItemUtil.color("&8&m----------------------------------------------------------------"));
    }

    private Player getPlayerByName(String username) {
        Player player = Bukkit.getPlayerExact(username);
        if (player == null) {
            for (Player p : Bukkit.getOnlinePlayers()) {
                if (p.getName().equalsIgnoreCase(username)) {
                    return p;
                }
                // Check if it's a Bedrock player with a prefix
                if (me.dralle.shop.util.BedrockUtil.isBedrockPlayer(p)) {
                    if (p.getName().endsWith(username)) {
                        return p;
                    }
                }
            }
        }
        return player;
    }
}

