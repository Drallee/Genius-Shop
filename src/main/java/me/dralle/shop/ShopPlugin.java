package me.dralle.shop;

import me.dralle.shop.economy.EconomyHook;
import me.dralle.shop.gui.GenericShopGui;
import me.dralle.shop.gui.MainMenu;
import me.dralle.shop.gui.PurchaseMenu;
import me.dralle.shop.gui.SellMenu;
import me.dralle.shop.gui.SpawnerPlaceListener;
import me.dralle.shop.metrics.MetricsWrapper;
import me.dralle.shop.util.ConfigUpdater;
import me.dralle.shop.util.UpdateChecker;
import org.bstats.bukkit.Metrics;
import org.bstats.charts.SimplePie;
import org.bstats.charts.SingleLineChart;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;

public class ShopPlugin extends JavaPlugin {

    private static ShopPlugin instance;

    private FileConfiguration messagesConfig;
    private FileConfiguration guiConfig;  // Kept for backwards compatibility
    private FileConfiguration shopsConfig;
    private FileConfiguration discordConfig;

    private MenuManager menuManager;  // New menu system
    private MessageManager messages;
    private ShopFileManager shopFileManager;
    private ShopManager shopManager;
    private GenericShopGui genericShopGui;
    private EconomyHook economy;
    private MetricsWrapper metricsWrapper;
    private me.dralle.shop.util.DiscordWebhook discordWebhook;
    private me.dralle.shop.api.ConfigApiServer apiServer;

    // Counters for metrics
    public int itemsBought = 0;
    public int itemsSold = 0;
    public int shopsOpened = 0;
    public int playersUsed = 0;

    public static ShopPlugin getInstance() {
        return instance;
    }

    @Override
    public void onEnable() {
        instance = this;

        if (!getDataFolder().exists()) {
            getDataFolder().mkdirs();
        }

        // Ensure shops folder exists
        File shopsFolder = new File(getDataFolder(), "shops");
        if (!shopsFolder.exists()) {
            shopsFolder.mkdirs();
        }

        // Generate/update README.md in shops folder
        generateShopsReadme();

        // create default files (only if missing)
        saveDefaultConfig();
        saveDefaultResourceIfNotExists("messages.yml");
        // gui.yml is deprecated - menu files are now in menus/ folder
        // shops.yml removed - shops are in shops/ folder (see shops/README.md)
        saveDefaultResourceIfNotExists("discord.yml");

        // run smart updater once on startup
        ConfigUpdater.update(this, "config.yml");
        ConfigUpdater.update(this, "messages.yml");
        ConfigUpdater.update(this, "discord.yml");

        // Initialize menu manager (handles migration from gui.yml)
        this.menuManager = new MenuManager(this);
        this.menuManager.load();

        // load configs
        reloadAllConfigs();

        // managers
        this.messages = new MessageManager(this);
        this.shopFileManager = new ShopFileManager(this); // Initialize before ShopManager
        this.shopManager = new ShopManager(this);
        this.economy = new EconomyHook(this);
        this.genericShopGui = new GenericShopGui(this);
        this.discordWebhook = new me.dralle.shop.util.DiscordWebhook(this);

        // listeners
        getServer().getPluginManager().registerEvents(new MainMenu(this), this);
        getServer().getPluginManager().registerEvents(this.genericShopGui, this);
        getServer().getPluginManager().registerEvents(new PurchaseMenu(this), this);
        getServer().getPluginManager().registerEvents(new SellMenu(this), this);
        getServer().getPluginManager().registerEvents(new SpawnerPlaceListener(), this);

        UpdateChecker updater = new UpdateChecker(this, "genius-shop");
        updater.checkForUpdates();
        getServer().getPluginManager().registerEvents(updater, this);

        // command /shop
        getCommand("shop").setExecutor((sender, cmd, label, args) -> {
            // /shop reload
            if (args.length > 0 && args[0].equalsIgnoreCase("reload")) {
                if (!sender.hasPermission("geniusshop.reload") && !sender.hasPermission("shop.admin")) {
                    sender.sendMessage(getMessages().getMessage("reload-no-permission"));
                    return true;
                }
                try {
                    reloadPlugin();
                    sender.sendMessage(getMessages().getMessage("reload-success"));
                } catch (Exception ex) {
                    sender.sendMessage(getMessages().getMessage("reload-failed"));
                    ex.printStackTrace();
                }
                return true;
            }

            // /shop editor
            if (args.length > 0 && args[0].equalsIgnoreCase("editor")) {
                // Check if editor command is enabled
                if (!getConfig().getBoolean("api.enable-editor-command", true)) {
                    sender.sendMessage("§cThe /shop editor command is disabled");
                    return true;
                }

                if (!(sender instanceof Player)) {
                    sender.sendMessage(getMessages().getMessage("player-only"));
                    return true;
                }

                Player p = (Player) sender;

                // Check permission
                if (!p.hasPermission("geniusshop.admin") && !p.hasPermission("shop.admin") && !p.isOp()) {
                    sender.sendMessage("§cYou don't have permission to access the shop editor!");
                    return true;
                }

                // Check if API server is running
                if (apiServer == null) {
                    sender.sendMessage("§cShop editor is not disabled!");
                    return true;
                }

                // Generate auto-login token
                String token = apiServer.createAutoLoginToken(p);
                int port = getConfig().getInt("api.port", 8080);

                // Try to detect server IP
                String serverHost = "localhost";
                try {
                    // Get server bind address from server.properties
                    String serverIp = getServer().getIp();
                    if (serverIp != null && !serverIp.isEmpty() && !serverIp.equals("0.0.0.0")) {
                        serverHost = serverIp;
                    } else {
                        // Try to get external IP
                        java.net.InetAddress addr = java.net.InetAddress.getLocalHost();
                        String hostAddress = addr.getHostAddress();
                        // Don't use 127.0.0.1
                        if (!hostAddress.equals("127.0.0.1")) {
                            serverHost = hostAddress;
                        }
                    }
                } catch (Exception e) {
                    // Fall back to localhost
                    getLogger().warning("Could not detect server IP, using localhost");
                }

                String url = "http://" + serverHost + ":" + port + "/?token=" + token;

                // Send messages
                sender.sendMessage("§a§l[Shop Editor]");
                sender.sendMessage("§7Click the link below to open the shop editor:");

                // Send as clickable text component using Spigot API
                try {
                    net.md_5.bungee.api.chat.TextComponent message = new net.md_5.bungee.api.chat.TextComponent("Click to open web editor");
                    message.setColor(net.md_5.bungee.api.ChatColor.AQUA);
                    message.setUnderlined(true);
                    message.setClickEvent(new net.md_5.bungee.api.chat.ClickEvent(
                        net.md_5.bungee.api.chat.ClickEvent.Action.OPEN_URL,
                        url
                    ));
                    message.setHoverEvent(new net.md_5.bungee.api.chat.HoverEvent(
                        net.md_5.bungee.api.chat.HoverEvent.Action.SHOW_TEXT,
                        new net.md_5.bungee.api.chat.ComponentBuilder("§aClick to open in browser").create()
                    ));
                    p.spigot().sendMessage(message);
                } catch (Exception e) {
                    // Fallback to plain text if component API fails
                    sender.sendMessage("§b" + url);
                }

                sender.sendMessage("§7This link will expire in 5 minutes.");

                // Also show IP info
                if (!serverHost.equals("localhost")) {
                    sender.sendMessage("§7Server IP: §e" + serverHost);
                }

                return true;
            }

            // /shop (open main menu)
            if (!(sender instanceof Player)) {
                sender.sendMessage(getMessages().getMessage("player-only"));
                return true;
            }
            Player p = (Player) sender;
            MainMenu.open(p);

            // metrics
            shopsOpened++;
            playersUsed++; // very lightweight counter (not unique per-player, but okay for stats)

            return true;
        });

        // bStats metrics (opt-in via config)
        if (getConfig().getBoolean("metrics", true)) {
            try {
                Metrics metrics = new Metrics(this, 27943); // your bStats plugin ID
                this.metricsWrapper = new MetricsWrapper(metrics);

                // SimplePie: which economy plugin is used
                metrics.addCustomChart(new SimplePie("economy_plugin", () ->
                        economy.getProviderName()
                ));

                // SimplePie: currency symbol (from economy or config fallback)
                metrics.addCustomChart(new SimplePie("currency_symbol", this::getCurrencySymbol));

                // Line charts for counts (per-server)
                metrics.addCustomChart(new SingleLineChart("items_bought", () -> itemsBought));
                metrics.addCustomChart(new SingleLineChart("items_sold", () -> itemsSold));
                metrics.addCustomChart(new SingleLineChart("shops_opened", () -> shopsOpened));
                metrics.addCustomChart(new SingleLineChart("players_used", () -> playersUsed));

                getLogger().info("[Genius-Shop] Metrics enabled.");
            } catch (Throwable t) {
                getLogger().warning("[Genius-Shop] Failed to initialise bStats metrics: " + t.getMessage());
            }
        } else {
            getLogger().info("[Genius-Shop] Metrics disabled via config.");
        }

        // Start API server if enabled
        if (getConfig().getBoolean("api.enabled", false)) {
            int apiPort = getConfig().getInt("api.port", 8080);
            String apiKey = getConfig().getString("api.api-key", "");

            // Auto-generate API key if not set or is default
            if (apiKey.isEmpty() || apiKey.equals("change-this-to-a-secure-random-key")) {
                apiKey = java.util.UUID.randomUUID().toString() + "-" + java.util.UUID.randomUUID().toString();
                getConfig().set("api.api-key", apiKey);
                saveConfig();
                getLogger().info("Generated new API key for web editor security");
            }

            this.apiServer = new me.dralle.shop.api.ConfigApiServer(this, apiPort, apiKey);
            this.apiServer.start();
        }

        getLogger().info("Genius-Shop enabled.");
    }

    @Override
    public void onDisable() {
        // Stop API server
        if (apiServer != null) {
            apiServer.stop();
        }
        
        try {
            getMessagesConfig().save(new File(getDataFolder(), "messages.yml"));
            // gui.yml is deprecated - menu configs are now in menus/ folder
            getDiscordConfig().save(new File(getDataFolder(), "discord.yml"));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void saveDefaultResourceIfNotExists(String name) {
        File f = new File(getDataFolder(), name);
        if (!f.exists()) {
            saveResource(name, false);
        }
    }

    /**
     * Reload everything from disk, re-apply new defaults (if enabled),
     * and rebuild managers so already-registered GUIs see new data.
     */
    public void reloadPlugin() {
        // smart updater
        ConfigUpdater.update(this, "config.yml");
        ConfigUpdater.update(this, "messages.yml");
        ConfigUpdater.update(this, "discord.yml");

        // Reload menu configurations
        this.menuManager.reload();

        // reload yml into memory
        reloadAllConfigs();

        // rebuild managers
        this.messages = new MessageManager(this);
        this.shopFileManager = new ShopFileManager(this); // Reload shop files
        this.shopManager = new ShopManager(this);

        // re-hook economy
        this.economy = new EconomyHook(this);

        // reinitialize Discord webhook
        this.discordWebhook = new me.dralle.shop.util.DiscordWebhook(this);

        getLogger().info("Genius-Shop reloaded from disk.");
    }

    public void reloadAllConfigs() {
        this.messagesConfig = YamlConfiguration.loadConfiguration(new File(getDataFolder(), "messages.yml"));

        // Load gui.yml only if it exists (legacy support - menu configs are now in menus/ folder)
        File guiFile = new File(getDataFolder(), "gui.yml");
        if (guiFile.exists()) {
            this.guiConfig = YamlConfiguration.loadConfiguration(guiFile);
        } else {
            // Create empty config for legacy code compatibility
            this.guiConfig = new YamlConfiguration();
        }

        // Load shops.yml only if it exists (legacy support for older versions)
        File shopsFile = new File(getDataFolder(), "shops.yml");
        if (shopsFile.exists()) {
            this.shopsConfig = YamlConfiguration.loadConfiguration(shopsFile);
        } else {
            // Create empty config for legacy code compatibility
            this.shopsConfig = new YamlConfiguration();
        }

        this.discordConfig = YamlConfiguration.loadConfiguration(new File(getDataFolder(), "discord.yml"));
    }

    public void incrementShopPopularity(String shopKey) {
        ShopStats.incrementOpens(shopKey);
    }

    // ========= Currency helper =========

    /**
     * Returns the currency symbol used for display.
     * Priority:
     * 1) EconomyHook's symbol (if provided by the hooked economy)
     * 2) config.yml: fallback-currency-symbol
     * 3) "$"
     */
    public String getCurrencySymbol() {
        String ecoSymbol = economy != null ? economy.getCurrencySymbol() : null;
        if (ecoSymbol != null && !ecoSymbol.isEmpty()) {
            return ecoSymbol;
        }
        String cfgSymbol = getConfig().getString("fallback-currency-symbol", "$");
        if (cfgSymbol == null || cfgSymbol.isEmpty()) {
            return "$";
        }
        return cfgSymbol;
    }

    // ========= Getters =========

    public FileConfiguration getMessagesConfig() {
        return messagesConfig;
    }

    public FileConfiguration getGuiConfig() {
        return guiConfig;
    }

    public MenuManager getMenuManager() {
        return menuManager;
    }

    public FileConfiguration getShopsConfig() {
        return shopsConfig;
    }

    public FileConfiguration getDiscordConfig() {
        return discordConfig;
    }

    public MessageManager getMessages() {
        return messages;
    }

    public ShopFileManager getShopFileManager() {
        return shopFileManager;
    }

    public ShopManager getShopManager() {
        return shopManager;
    }

    public GenericShopGui getGenericShopGui() {
        return genericShopGui;
    }

    public EconomyHook getEconomy() {
        return economy;
    }

    public me.dralle.shop.util.DiscordWebhook getDiscordWebhook() {
        return discordWebhook;
    }

    /**
     * Log a debug message if debug mode is enabled
     */
    public void debug(String message) {
        if (getConfig().getBoolean("debug", false)) {
            getLogger().info("[DEBUG] " + message);
        }
    }

    /**
     * Generate or update the README.md file in the shops folder
     * This is called on every startup to ensure documentation is up-to-date
     */
    private void generateShopsReadme() {
        File readmeFile = new File(getDataFolder(), "shops/README.md");
        String currentVersion = getDescription().getVersion();

        try {
            // Check if README exists and read current version
            boolean shouldUpdate = true;
            if (readmeFile.exists()) {
                String existingContent = new String(java.nio.file.Files.readAllBytes(readmeFile.toPath()));
                // Check if version marker exists and matches
                if (existingContent.contains("<!-- VERSION: " + currentVersion + " -->")) {
                    shouldUpdate = false; // Already up to date
                }
            }

            if (shouldUpdate) {
                // Try to load from plugin resources first
                java.io.InputStream resourceStream = getResource("shops/README.md");

                if (resourceStream != null) {
                    // Read template from resources
                    String template = new String(resourceStream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                    resourceStream.close();

                    // Add version marker at the top
                    String versionedContent = "<!-- VERSION: " + currentVersion + " -->\n" + template;

                    // Write to file
                    java.nio.file.Files.write(readmeFile.toPath(), versionedContent.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    getLogger().info("Generated/updated shops/README.md (v" + currentVersion + ")");
                } else {
                    getLogger().warning("Could not find shops/README.md template in plugin resources");
                }
            }
        } catch (Exception e) {
            getLogger().warning("Failed to generate shops/README.md: " + e.getMessage());
        }
    }
}
