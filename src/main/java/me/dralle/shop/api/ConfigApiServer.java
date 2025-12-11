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
    private final Map<String, PendingLoginConfirmation> pendingConfirmations = new ConcurrentHashMap<>();
    private final Map<String, java.util.Set<String>> trustedIps = new ConcurrentHashMap<>();
    private static final long SESSION_DURATION = 3600000; // 1 hour
    private static final long AUTO_LOGIN_TOKEN_DURATION = 300000; // 5 minutes
    private static final long PENDING_CONFIRMATION_DURATION = 180000; // 3 minutes

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
            YamlConfiguration config = YamlConfiguration.loadConfiguration(trustedIpsFile);
            for (String username : config.getKeys(false)) {
                java.util.List<String> ips = config.getStringList(username);
                if (!ips.isEmpty()) {
                    trustedIps.put(username.toLowerCase(), new java.util.HashSet<>(ips));
                }
            }
            plugin.getLogger().info("Loaded trusted IPs for " + trustedIps.size() + " users");
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to load trusted IPs: " + e.getMessage());
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
            config.save(trustedIpsFile);
        } catch (IOException e) {
            plugin.getLogger().warning("Failed to save trusted IPs: " + e.getMessage());
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
        plugin.getLogger().info("Added trusted IP " + ip + " for user " + username);
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
                } else if (path.equals("/style.css")) {
                    serveWebFile(exchange, "style.css");
                } else if (path.equals("/script.js")) {
                    serveWebFile(exchange, "script.js");
                } else if (path.equals("/login-style.css")) {
                    serveWebFile(exchange, "login-style.css");
                } else if (path.equals("/login-script.js")) {
                    serveWebFile(exchange, "login-script.js");
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
                    // 404 for unknown paths - return detailed JSON error
                    Map<String, Object> errorResponse = new HashMap<>();
                    errorResponse.put("error", "Not Found");
                    errorResponse.put("status", 404);
                    errorResponse.put("path", path);
                    errorResponse.put("message", "The requested resource was not found on this server");
                    errorResponse.put("timestamp", System.currentTimeMillis());

                    sendJsonResponse(exchange, 404, errorResponse);
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
                    handleSaveActivityLog(exchange);
                } else {
                    sendError(exchange, 405, "Method Not Allowed", "This endpoint only accepts GET and POST requests");
                }
            } else {
                sendError(exchange, 404, "Endpoint Not Found", "The requested API endpoint does not exist");
            }
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Error handling API request", e);
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
        Player player = Bukkit.getPlayerExact(username);
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
            plugin.getLogger().warning("Unauthorized login attempt by " + username + " - missing admin permission");
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

                    // Send message to player with clickable confirmation
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        player.sendMessage("§8§l▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬");
                        player.sendMessage("§c§lSECURITY ALERT");
                        player.sendMessage("");
                        player.sendMessage("§7Someone is trying to access the shop editor from:");
                        player.sendMessage("§e" + requestIp);
                        player.sendMessage("");
                        player.sendMessage("§7Your current IP: §a" + playerIp);
                        player.sendMessage("");
                        player.sendMessage("§7If this is you, click below to confirm:");

                        // Create clickable confirmation button
                        try {
                            net.md_5.bungee.api.chat.TextComponent message = new net.md_5.bungee.api.chat.TextComponent(" [✓ CONFIRM LOGIN] ");
                            message.setColor(net.md_5.bungee.api.ChatColor.GREEN);
                            message.setBold(true);
                            message.setClickEvent(new net.md_5.bungee.api.chat.ClickEvent(
                                    net.md_5.bungee.api.chat.ClickEvent.Action.RUN_COMMAND,
                                    "/shop confirmlogin " + confirmToken
                            ));
                            message.setHoverEvent(new net.md_5.bungee.api.chat.HoverEvent(
                                    net.md_5.bungee.api.chat.HoverEvent.Action.SHOW_TEXT,
                                    new net.md_5.bungee.api.chat.ComponentBuilder("§aClick to confirm and trust this IP").create()
                            ));
                            player.spigot().sendMessage(message);
                        } catch (Exception e) {
                            player.sendMessage("§aType: §e/shop confirmlogin " + confirmToken);
                        }

                        player.sendMessage("");
                        player.sendMessage("§cThis request will expire in 3 minutes.");
                        player.sendMessage("§8§l▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬");
                    });

                    Map<String, String> response = new HashMap<>();
                    response.put("status", "pending_confirmation");
                    response.put("message", "Please confirm this login in-game");
                    response.put("confirmToken", confirmToken);
                    response.put("username", username);
                    sendJsonResponse(exchange, 403, response);
                    plugin.getLogger().warning("Manual login IP mismatch for " + username + " - Confirmation required. Player IP: " + playerIp + ", Request IP: " + requestIp);
                    return;
                }
                // IP is trusted, allow login to continue
                plugin.getLogger().info("IP mismatch allowed - " + requestIp + " is a trusted IP for " + username);
            } else {
                Map<String, Object> errorData = new HashMap<>();
                errorData.put("playerIp", playerIp);
                errorData.put("requestIp", requestIp);
                sendError(exchange, 403, "IP Mismatch", "You must access this from the same network as your Minecraft client", errorData);
                plugin.getLogger().warning("Login attempt from mismatched IP - Player: " + playerIp + ", Request: " + requestIp);
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
            sendError(exchange, 400, "Bad Request", "Auto-login token is required in the request body");
            return;
        }

        // Get token data
        AutoLoginToken tokenData = autoLoginTokens.get(token);
        if (tokenData == null) {
            plugin.getLogger().warning("Auto-login failed: Token not found in map. Active tokens: " + autoLoginTokens.size());
            // List all token prefixes for debugging
            autoLoginTokens.keySet().forEach(t -> plugin.getLogger().info("  - Token: " + t.substring(0, 8) + "..."));
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("activeTokens", autoLoginTokens.size());
            sendError(exchange, 401, "Authentication Failed", "The auto-login token is invalid or has expired. Please generate a new token using /shop editor", errorData);
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
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("expiredAt", tokenData.expiry);
            errorData.put("timeExpiredMs", Math.abs(timeLeft));
            sendError(exchange, 401, "Token Expired", "Your auto-login token has expired. Auto-login tokens are valid for 5 minutes. Please generate a new token using /shop editor", errorData);
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
            // Check if IP bypass is enabled and user has permission
            boolean allowBypass = plugin.getConfig().getBoolean("api.allow-ip-bypass", true);
            Player player = Bukkit.getPlayerExact(tokenData.username);

            if (allowBypass && player != null && player.hasPermission("geniusshop.login.ip.bypass")) {
                // Check if this IP is already trusted
                if (isIpTrusted(tokenData.username, requestIp)) {
                    plugin.getLogger().info("IP mismatch allowed - " + requestIp + " is a trusted IP for " + tokenData.username);
                } else {
                    // Create pending confirmation
                    String confirmToken = UUID.randomUUID().toString();
                    long confirmExpiry = System.currentTimeMillis() + PENDING_CONFIRMATION_DURATION;
                    pendingConfirmations.put(confirmToken, new PendingLoginConfirmation(
                            tokenData.username, tokenData.ipAddress, requestIp, token, confirmExpiry
                    ));

                    // Send message to player with clickable confirmation
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        player.sendMessage("§8§l▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬");
                        player.sendMessage("§c§lSECURITY ALERT");
                        player.sendMessage("");
                        player.sendMessage("§7Someone is trying to access the shop editor from:");
                        player.sendMessage("§e" + requestIp);
                        player.sendMessage("");
                        player.sendMessage("§7Your current IP: §a" + tokenData.ipAddress);
                        player.sendMessage("");
                        player.sendMessage("§7If this is you, click below to confirm:");

                        // Create clickable confirmation button
                        try {
                            net.md_5.bungee.api.chat.TextComponent message = new net.md_5.bungee.api.chat.TextComponent(" [✓ CONFIRM LOGIN] ");
                            message.setColor(net.md_5.bungee.api.ChatColor.GREEN);
                            message.setBold(true);
                            message.setClickEvent(new net.md_5.bungee.api.chat.ClickEvent(
                                    net.md_5.bungee.api.chat.ClickEvent.Action.RUN_COMMAND,
                                    "/shop confirmlogin " + confirmToken
                            ));
                            message.setHoverEvent(new net.md_5.bungee.api.chat.HoverEvent(
                                    net.md_5.bungee.api.chat.HoverEvent.Action.SHOW_TEXT,
                                    new net.md_5.bungee.api.chat.ComponentBuilder("§aClick to confirm and trust this IP").create()
                            ));
                            player.spigot().sendMessage(message);
                        } catch (Exception e) {
                            player.sendMessage("§aType: §e/shop confirmlogin " + confirmToken);
                        }

                        player.sendMessage("");
                        player.sendMessage("§cThis request will expire in 3 minutes.");
                        player.sendMessage("§8§l▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬");
                    });

                    Map<String, String> response = new HashMap<>();
                    response.put("status", "pending_confirmation");
                    response.put("message", "Please confirm this login in-game");
                    response.put("confirmToken", confirmToken);
                    sendJsonResponse(exchange, 403, response);
                    plugin.getLogger().warning("Auto-login IP mismatch for " + tokenData.username + " - Confirmation required. Player IP: " + tokenData.ipAddress + ", Request IP: " + requestIp);
                    return;
                }
            } else {
                Map<String, Object> errorData = new HashMap<>();
                errorData.put("playerIp", tokenData.ipAddress);
                errorData.put("requestIp", requestIp);
                errorData.put("username", tokenData.username);
                sendError(exchange, 403, "IP Address Mismatch", "The request is coming from a different IP address than the one used to generate the token. For security reasons, you must access the editor from the same network as your Minecraft client", errorData);
                plugin.getLogger().warning("Auto-login IP mismatch for " + tokenData.username + " - Player IP: " + tokenData.ipAddress + ", Request IP: " + requestIp);
                // Don't remove token - let it expire naturally
                return;
            }
        }

        plugin.getLogger().info("IP verification passed: Player=" + tokenData.ipAddress + ", Request=" + requestIp);

        // Verify player is still online
        Player player = Bukkit.getPlayerExact(tokenData.username);
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
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("fileName", fileName);
            errorData.put("reason", file == null ? "Invalid file path" : "File does not exist");
            sendError(exchange, 404, "File Not Found", "The requested configuration file could not be found or is not accessible", errorData);
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
            String sessionToken = exchange.getRequestHeaders().getFirst("X-Session-Token");
            SessionData session = sessions.get(sessionToken);
            String username = session != null ? session.username : "unknown";

            plugin.getLogger().info("Admin " + username + " deleted file: " + fileName);

            sendResponse(exchange, 200, "{\"success\": true}");
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Error deleting file: " + fileName, e);
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("fileName", fileName);
            errorData.put("exception", e.getClass().getSimpleName());
            errorData.put("exceptionMessage", e.getMessage());
            sendError(exchange, 500, "Deletion Error", "An unexpected error occurred while attempting to delete the file", errorData);
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
            Map<String, Object> errorData = new HashMap<>();
            errorData.put("filename", filename);
            errorData.put("exception", e.getClass().getSimpleName());
            sendError(exchange, 500, "Internal Server Error", "An error occurred while serving the requested file", errorData);
        }
    }
}
