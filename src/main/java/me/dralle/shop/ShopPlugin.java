package me.dralle.shop;

import me.dralle.shop.data.DataManager;
import me.dralle.shop.economy.EconomyHook;
import me.dralle.shop.gui.BulkSellMenu;
import me.dralle.shop.gui.GenericShopGui;
import me.dralle.shop.gui.MainMenu;
import me.dralle.shop.gui.PurchaseMenu;
import me.dralle.shop.gui.SellMenu;
import me.dralle.shop.gui.SpawnerPlaceListener;
import me.dralle.shop.metrics.MetricsWrapper;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.stock.StockResetService;
import me.dralle.shop.util.ConfigUpdater;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.UpdateChecker;
import org.bstats.bukkit.Metrics;
import org.bstats.charts.SimplePie;
import org.bstats.charts.SingleLineChart;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.command.CommandSender;
import org.bukkit.command.PluginCommand;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

public class ShopPlugin extends JavaPlugin {

    private static ShopPlugin instance;

    private FileConfiguration messagesConfig;
    private FileConfiguration guiConfig;  // Kept for backwards compatibility
    private FileConfiguration shopsConfig;
    private FileConfiguration discordConfig;

    private MenuManager menuManager;  // New menu system
    private MessageManager messages;
    private ShopFileManager shopFileManager;
    private DataManager dataManager;
    private ShopManager shopManager;
    private GenericShopGui genericShopGui;
    private BulkSellMenu bulkSellMenu;
    private EconomyHook economy;
    private MetricsWrapper metricsWrapper;
    private me.dralle.shop.util.DiscordWebhook discordWebhook;
    private me.dralle.shop.api.ConfigApiServer apiServer;
    private UpdateChecker updateChecker;
    private StockResetService stockResetService;

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

        // Create languages folder
        File langFolder = new File(getDataFolder(), "languages");
        if (!langFolder.exists()) {
            langFolder.mkdirs();
        }

        // Migrate old messages.yml if it exists
        File oldMessages = new File(getDataFolder(), "messages.yml");
        if (oldMessages.exists()) {
            File enUsFile = new File(langFolder, "en_US.yml");
            if (!enUsFile.exists()) {
                oldMessages.renameTo(enUsFile);
                me.dralle.shop.util.ConsoleLog.info(this, "Migrated messages.yml to languages/en_US.yml");
            } else {
                // If en_US already exists, just delete the old one or leave it?
                // Better to rename it to something else to be safe or just delete if it's identical
                oldMessages.delete();
            }
        }

        // create default files (only if missing)
        saveDefaultConfig();
        saveDefaultResourceIfNotExists("languages/en_US.yml");
        saveDefaultResourceIfNotExists("languages/ru_RU.yml");
        saveDefaultResourceIfNotExists("languages/de_DE.yml");
        saveDefaultResourceIfNotExists("languages/fr_FR.yml");
        saveDefaultResourceIfNotExists("languages/tr_TR.yml");
        saveDefaultResourceIfNotExists("languages/ro_RO.yml");
        saveDefaultResourceIfNotExists("languages/es_MX.yml");
        saveDefaultResourceIfNotExists("languages/es_ES.yml");
        saveDefaultResourceIfNotExists("languages/es_AR.yml");
        saveDefaultResourceIfNotExists("languages/pt_BR.yml");
        saveDefaultResourceIfNotExists("languages/pt_PT.yml");
        saveDefaultResourceIfNotExists("languages/vi_VN.yml");
        saveDefaultResourceIfNotExists("languages/en_GB.yml");
        saveDefaultResourceIfNotExists("languages/nl_NL.yml");
        saveDefaultResourceIfNotExists("languages/fi_FI.yml");
        saveDefaultResourceIfNotExists("languages/pl_PL.yml");
        saveDefaultResourceIfNotExists("languages/da_DK.yml");
        saveDefaultResourceIfNotExists("discord.yml");

        // run smart updater on config first to get the language setting
        ConfigUpdater.update(this, "config.yml");
        reloadConfig();
        
        // Load language from config
        String lang = getConfig().getString("language", "en_US");
        String langPath = "languages/" + lang + ".yml";
        
        // Ensure the configured language file exists (if we have it in resources)
        if (getResource(langPath) != null) {
            saveDefaultResourceIfNotExists(langPath);
        }
        
        // Update language file
        ConfigUpdater.update(this, langPath);
        ConfigUpdater.update(this, "discord.yml");

        // Initialize menu manager (handles migration from gui.yml)
        this.menuManager = new MenuManager(this);
        this.menuManager.load();

        // load configs
        reloadAllConfigs();

        // managers
        this.messages = new MessageManager(this);
        this.dataManager = new DataManager(this);
        this.shopFileManager = new ShopFileManager(this); // Initialize before ShopManager
        this.shopManager = new ShopManager(this);
        this.economy = new EconomyHook(this);
        this.genericShopGui = new GenericShopGui(this);
        this.bulkSellMenu = new BulkSellMenu(this);
        this.discordWebhook = new me.dralle.shop.util.DiscordWebhook(this);
        this.stockResetService = new StockResetService(this);

        // listeners
        getServer().getPluginManager().registerEvents(new MainMenu(this), this);
        getServer().getPluginManager().registerEvents(this.genericShopGui, this);
        getServer().getPluginManager().registerEvents(this.bulkSellMenu, this);
        getServer().getPluginManager().registerEvents(new PurchaseMenu(this), this);
        getServer().getPluginManager().registerEvents(new SellMenu(this), this);
        getServer().getPluginManager().registerEvents(new SpawnerPlaceListener(), this);

        this.updateChecker = new UpdateChecker(this, "genius-shop");
        this.updateChecker.checkForUpdates();
        getServer().getPluginManager().registerEvents(this.updateChecker, this);
        this.stockResetService.start();

        // command /shop
        PluginCommand shopCommand = getCommand("shop");
        if (shopCommand != null) {
            shopCommand.setExecutor((sender, cmd, label, args) -> {
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
                if (!getConfig().getBoolean("api.enable-editor-command", true)) {
                    sender.sendMessage(ShopItemUtil.color("&cThe /shop editor command is disabled"));
                    return true;
                }

                if (!(sender instanceof Player)) {
                    sender.sendMessage(getMessages().getMessage("player-only"));
                    return true;
                }

                Player p = (Player) sender;
                if (!p.hasPermission("geniusshop.admin") && !p.hasPermission("shop.admin") && !p.isOp()) {
                    sender.sendMessage(ShopItemUtil.color("&cYou don't have permission to access the shop editor!"));
                    return true;
                }

                if (apiServer == null) {
                    sender.sendMessage(ShopItemUtil.color("&cShop editor is disabled!"));
                    return true;
                }

                String token = apiServer.createAutoLoginToken(p);
                int port = getConfig().getInt("api.port", 8080);
                String customDomain = getConfig().getString("api.domain", "");
                String serverHost;

                if (customDomain != null && !customDomain.trim().isEmpty()) {
                    serverHost = customDomain.trim();
                } else {
                    serverHost = "localhost";
                    try {
                        String serverIp = getServer().getIp();
                        if (serverIp != null && !serverIp.isEmpty() && !serverIp.equals("0.0.0.0")) {
                            serverHost = serverIp;
                        } else {
                            java.net.InetAddress addr = java.net.InetAddress.getLocalHost();
                            String hostAddress = addr.getHostAddress();
                            if (!hostAddress.equals("127.0.0.1")) {
                                serverHost = hostAddress;
                            }
                        }
                    } catch (Exception e) {
                        me.dralle.shop.util.ConsoleLog.warn(this, "Could not detect server IP, using localhost");
                    }
                }

                String url;
                if (customDomain != null && !customDomain.trim().isEmpty() && customDomain.contains(":")) {
                    url = "http://" + serverHost + "/?token=" + token;
                } else {
                    url = "http://" + serverHost + ":" + port + "/?token=" + token;
                }

                sender.sendMessage(ShopItemUtil.color("<gradient:#3B82F6:#06B6D4>&l[Shop Editor]</gradient>"));
                sender.sendMessage(ShopItemUtil.color("&7Click the link below to open the shop editor:"));

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
                            new net.md_5.bungee.api.chat.ComponentBuilder(ShopItemUtil.color("&aClick to open in browser")).create()
                    ));
                    p.spigot().sendMessage(message);
                } catch (Exception e) {
                    sender.sendMessage(ShopItemUtil.color("&cYour server build does not support clickable chat links."));
                    sender.sendMessage(ShopItemUtil.color("&7Please use a compatible Spigot/Paper/Purpur build."));
                }

                sender.sendMessage(ShopItemUtil.color("&7This link will expire in 5 minutes."));
                if (!serverHost.equals("localhost")) {
                    sender.sendMessage(ShopItemUtil.color("&7Server IP: &e" + serverHost));
                }

                return true;
            }

            // /shop confirmlogin <token>
            if (args.length > 0 && args[0].equalsIgnoreCase("confirmlogin")) {
                if (!(sender instanceof Player)) {
                    sender.sendMessage(ShopItemUtil.color("&cOnly players can use this command."));
                    return true;
                }

                if (args.length < 2) {
                    sender.sendMessage(ShopItemUtil.color("&cUsage: /shop confirmlogin <token>"));
                    return true;
                }

                Player player = (Player) sender;
                String confirmToken = args[1];

                if (apiServer == null) {
                    sender.sendMessage(ShopItemUtil.color("&cAPI server is not running."));
                    return true;
                }

                me.dralle.shop.api.ConfigApiServer.PendingLoginConfirmation confirmation =
                        apiServer.getPendingConfirmation(confirmToken);

                if (confirmation == null) {
                    sender.sendMessage(ShopItemUtil.color("&cInvalid or expired confirmation token."));
                    return true;
                }

                if (!confirmation.username.equalsIgnoreCase(player.getName())) {
                    sender.sendMessage(ShopItemUtil.color("&cThis confirmation is not for you."));
                    return true;
                }

                apiServer.addTrustedIp(confirmation.username, confirmation.requestIp);
                player.sendMessage(ShopItemUtil.color("<gradient:#22C55E:#14B8A6>&lLogin Confirmed!</gradient>"));
                player.sendMessage(ShopItemUtil.color("&7The IP &e" + confirmation.requestIp + " &7has been trusted."));
                player.sendMessage(ShopItemUtil.color("&7You can now access the shop editor from this IP."));

                return true;
            }

            // /shop sell
            if (args.length > 0 && args[0].equalsIgnoreCase("sell")) {
                if (!(sender instanceof Player)) {
                    sender.sendMessage(getMessages().getMessage("player-only"));
                    return true;
                }
                Player player = (Player) sender;
                if (!player.hasPermission("geniusshop.sell")
                        && !player.hasPermission("geniusshop.admin")
                        && !player.hasPermission("shop.admin")
                        && !player.isOp()) {
                    sender.sendMessage(getMessages().getMessage("no-permission"));
                    return true;
                }

                bulkSellMenu.open(player);
                return true;
            }

            // /shop wiki
            if (args.length > 0 && args[0].equalsIgnoreCase("wiki")) {
                if (!sender.hasPermission("geniusshop.wiki")
                        && !sender.hasPermission("geniusshop.admin")
                        && !sender.hasPermission("shop.admin")
                        && !(sender instanceof Player && ((Player) sender).isOp())) {
                    sender.sendMessage(getMessages().getMessage("no-permission"));
                    return true;
                }

                String rawUrl = getConfig().getString("wiki.url", "https://github.com/Drallee/Genius-Shop/wiki");
                String url = (rawUrl == null || rawUrl.trim().isEmpty())
                        ? "https://github.com/Drallee/Genius-Shop/wiki"
                        : rawUrl.trim();
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    url = "https://" + url;
                }

                sender.sendMessage(ShopItemUtil.color("&7Wiki: &b" + url));

                if (sender instanceof Player) {
                    try {
                        net.md_5.bungee.api.chat.TextComponent wikiLink =
                                new net.md_5.bungee.api.chat.TextComponent("Click to open wiki");
                        wikiLink.setColor(net.md_5.bungee.api.ChatColor.AQUA);
                        wikiLink.setUnderlined(true);
                        wikiLink.setClickEvent(new net.md_5.bungee.api.chat.ClickEvent(
                                net.md_5.bungee.api.chat.ClickEvent.Action.OPEN_URL,
                                url
                        ));
                        wikiLink.setHoverEvent(new net.md_5.bungee.api.chat.HoverEvent(
                                net.md_5.bungee.api.chat.HoverEvent.Action.SHOW_TEXT,
                                new net.md_5.bungee.api.chat.ComponentBuilder(ShopItemUtil.color("&aClick to open in browser")).create()
                        ));
                        ((Player) sender).spigot().sendMessage(wikiLink);
                    } catch (Exception ignored) {
                        // Fallback plain text message was already sent above.
                    }
                }
                return true;
            }

            // /shop resetstock all|shop|item
            if (args.length > 0 && args[0].equalsIgnoreCase("resetstock")) {
                if (!sender.hasPermission("geniusshop.resetstock")
                        && !sender.hasPermission("geniusshop.admin")
                        && !sender.hasPermission("shop.admin")
                        && !(sender instanceof Player && ((Player) sender).isOp())) {
                    sender.sendMessage(getMessages().getMessage("no-permission"));
                    return true;
                }

                if (args.length < 2) {
                    sender.sendMessage(ShopItemUtil.color("&cUsage: /shop resetstock all"));
                    sender.sendMessage(ShopItemUtil.color("&cUsage: /shop resetstock shop <shopKey>"));
                    sender.sendMessage(ShopItemUtil.color("&cUsage: /shop resetstock item <shopKey> <slot>"));
                    return true;
                }

                StockResetService resetService = new StockResetService(this);
                String mode = args[1].toLowerCase(java.util.Locale.ROOT);

                if (mode.equals("all")) {
                    int count = resetService.resetAllShopsManual();
                    sender.sendMessage(ShopItemUtil.color("&aReset stock for &e" + count + " &aitem entries across all shops."));
                    return true;
                }

                if (mode.equals("shop")) {
                    if (args.length < 3) {
                        sender.sendMessage(ShopItemUtil.color("&cUsage: /shop resetstock shop <shopKey>"));
                        return true;
                    }
                    String shopKey = args[2];
                    if (getShopManager().getShop(shopKey) == null) {
                        sender.sendMessage(getMessages().getMessage("shop-not-found").replace("%shop%", shopKey));
                        return true;
                    }
                    int count = resetService.resetShopManual(shopKey);
                    sender.sendMessage(ShopItemUtil.color("&aReset stock for &e" + count + " &aitem entries in shop &e" + shopKey + "&a."));
                    return true;
                }

                if (mode.equals("item")) {
                    if (args.length < 4) {
                        sender.sendMessage(ShopItemUtil.color("&cUsage: /shop resetstock item <shopKey> <slot>"));
                        return true;
                    }
                    String shopKey = args[2];
                    if (getShopManager().getShop(shopKey) == null) {
                        sender.sendMessage(getMessages().getMessage("shop-not-found").replace("%shop%", shopKey));
                        return true;
                    }
                    int slot;
                    try {
                        slot = Integer.parseInt(args[3]);
                    } catch (NumberFormatException ex) {
                        sender.sendMessage(ShopItemUtil.color("&cSlot must be a number."));
                        return true;
                    }
                    boolean ok = resetService.resetItemManual(shopKey, slot);
                    if (!ok) {
                        sender.sendMessage(ShopItemUtil.color("&cNo item found in shop &e" + shopKey + "&c at slot &e" + slot + "&c."));
                        return true;
                    }
                    sender.sendMessage(ShopItemUtil.color("&aReset stock for shop &e" + shopKey + "&a item at slot &e" + slot + "&a."));
                    return true;
                }

                sender.sendMessage(ShopItemUtil.color("&cUnknown mode. Use: all, shop, item"));
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
            shopCommand.setTabCompleter((sender, cmd, alias, args) -> tabCompleteShopCommand(sender, args));
        }

        // bStats metrics (opt-in via config)
        if (getConfig().getBoolean("metrics", true)) {
            try {
                Metrics metrics = new Metrics(this, 27943); // your bStats plugin ID
                this.metricsWrapper = new MetricsWrapper(metrics);

                // SimplePie: which economy plugin is used
                metrics.addCustomChart(new SimplePie("economy_plugin", () ->
                        economy.getProviderName()
                ));

                // SimplePie: plugin language
                metrics.addCustomChart(new SimplePie("language", () ->
                        getConfig().getString("language", "en_US")
                ));

                // SimplePie: currency symbol (from economy or config fallback)
                metrics.addCustomChart(new SimplePie("currency_symbol", this::getCurrencySymbol));

                // Line charts for counts (per-server)
                metrics.addCustomChart(new SingleLineChart("items_bought", () -> itemsBought));
                metrics.addCustomChart(new SingleLineChart("items_sold", () -> itemsSold));
                metrics.addCustomChart(new SingleLineChart("shops_opened", () -> shopsOpened));
                metrics.addCustomChart(new SingleLineChart("players_used", () -> playersUsed));

                me.dralle.shop.util.ConsoleLog.info(this, "[Genius-Shop] Metrics enabled.");
            } catch (Throwable t) {
                me.dralle.shop.util.ConsoleLog.warn(this, "[Genius-Shop] Failed to initialise bStats metrics: " + t.getMessage());
            }
        } else {
            me.dralle.shop.util.ConsoleLog.info(this, "[Genius-Shop] Metrics disabled via config.");
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
                me.dralle.shop.util.ConsoleLog.info(this, "Generated new API key for web editor security");
            }

            this.apiServer = new me.dralle.shop.api.ConfigApiServer(this, apiPort, apiKey);
            this.apiServer.start();
        }

        me.dralle.shop.util.ConsoleLog.info(this, "Genius-Shop enabled.");
    }

    @Override
    public void onDisable() {
        if (stockResetService != null) {
            stockResetService.stop();
        }
        if (apiServer != null) {
            apiServer.stop();
        }
        
        try {
            String lang = getConfig().getString("language", "en_US");
            getMessagesConfig().save(new File(getDataFolder(), "languages/" + lang + ".yml"));
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
        reloadConfig();
        
        String lang = getConfig().getString("language", "en_US");
        ConfigUpdater.update(this, "languages/" + lang + ".yml");
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
        if (this.stockResetService == null) {
            this.stockResetService = new StockResetService(this);
        }
        this.stockResetService.start();

        me.dralle.shop.util.ConsoleLog.info(this, "Genius-Shop reloaded from disk.");
    }

    public void reloadAllConfigs() {
        String lang = getConfig().getString("language", "en_US");
        File langFile = new File(getDataFolder(), "languages/" + lang + ".yml");
        if (!langFile.exists()) {
            // Fallback to en_US if configured language is missing
            langFile = new File(getDataFolder(), "languages/en_US.yml");
        }
        this.messagesConfig = YamlConfiguration.loadConfiguration(langFile);

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

    public String formatPrice(double amount) {
        String mode = getConfig().getString("price-format.mode", "plain").toLowerCase(Locale.ROOT).trim();
        if (getConfig().getBoolean("price-format.compact.enabled", false)) {
            mode = "compact";
        }

        return switch (mode) {
            case "compact" -> formatCompactNumber(amount);
            case "grouped" -> formatGroupedNumber(amount);
            default -> trimTrailingZeros(amount);
        };
    }

    public String formatCurrency(double amount) {
        return getCurrencySymbol() + formatPrice(amount);
    }

    private String formatCompactNumber(double amount) {
        if (getConfig().getBoolean("price-format.compact.use-scientific-notation", false)) {
            java.text.DecimalFormat scientific = new java.text.DecimalFormat("0.##E0");
            return scientific.format(amount);
        }

        String thousandSuffix = getConfig().getString("price-format.compact.thousand-suffix", "k");
        String millionSuffix = getConfig().getString("price-format.compact.million-suffix", "m");
        String billionSuffix = getConfig().getString("price-format.compact.billion-suffix", "b");

        double abs = Math.abs(amount);
        if (abs >= 1_000_000_000D) {
            return trimTrailingZeros(amount / 1_000_000_000D) + (billionSuffix == null ? "b" : billionSuffix);
        }
        if (abs >= 1_000_000D) {
            return trimTrailingZeros(amount / 1_000_000D) + (millionSuffix == null ? "m" : millionSuffix);
        }
        if (abs >= 1_000D) {
            return trimTrailingZeros(amount / 1_000D) + (thousandSuffix == null ? "k" : thousandSuffix);
        }
        return trimTrailingZeros(amount);
    }

    private String formatGroupedNumber(double amount) {
        String thousandSepRaw = getConfig().getString("price-format.grouped.thousands-separator", ".");
        String decimalSepRaw = getConfig().getString("price-format.grouped.decimal-separator", ",");
        int maxDecimals = getConfig().getInt("price-format.grouped.max-decimals", 2);
        if (maxDecimals < 0) maxDecimals = 0;
        if (maxDecimals > 6) maxDecimals = 6;

        char groupingSep = (thousandSepRaw == null || thousandSepRaw.isEmpty()) ? '.' : thousandSepRaw.charAt(0);
        char decimalSep = (decimalSepRaw == null || decimalSepRaw.isEmpty()) ? ',' : decimalSepRaw.charAt(0);

        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.US);
        symbols.setGroupingSeparator(groupingSep);
        symbols.setDecimalSeparator(decimalSep);

        StringBuilder pattern = new StringBuilder("#,##0");
        if (maxDecimals > 0) {
            pattern.append('.');
            for (int i = 0; i < maxDecimals; i++) {
                pattern.append('#');
            }
        }

        DecimalFormat formatter = new DecimalFormat(pattern.toString(), symbols);
        formatter.setGroupingUsed(true);
        formatter.setMaximumFractionDigits(maxDecimals);
        formatter.setMinimumFractionDigits(0);
        return formatter.format(amount);
    }

    private String trimTrailingZeros(double value) {
        if (value == (long) value) {
            return String.format(java.util.Locale.US, "%d", (long) value);
        }
        String out = String.format(java.util.Locale.US, "%.2f", value);
        if (out.endsWith(".00")) {
            return out.substring(0, out.length() - 3);
        }
        if (out.endsWith("0")) {
            return out.substring(0, out.length() - 1);
        }
        return out;
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

    public DataManager getDataManager() {
        return dataManager;
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

    public BulkSellMenu getBulkSellMenu() {
        return bulkSellMenu;
    }

    public EconomyHook getEconomy() {
        return economy;
    }

    public me.dralle.shop.util.DiscordWebhook getDiscordWebhook() {
        return discordWebhook;
    }

    public UpdateChecker getUpdateChecker() {
        return updateChecker;
    }

    /**
     * Log a debug message if debug mode is enabled
     */
    public void debug(String message) {
        if (getConfig().getBoolean("debug", false)) {
            me.dralle.shop.util.ConsoleLog.info(this, "[DEBUG] " + message);
        }
    }

    private List<String> tabCompleteShopCommand(CommandSender sender, String[] args) {
        if (args.length == 0) {
            return Collections.emptyList();
        }

        if (args.length == 1) {
            List<String> options = new ArrayList<>();
            if (canUseReload(sender)) options.add("reload");
            if (canUseEditor(sender)) options.add("editor");
            if (sender instanceof Player) options.add("confirmlogin");
            if (canUseSell(sender)) options.add("sell");
            if (canUseWiki(sender)) options.add("wiki");
            if (canUseResetStock(sender)) options.add("resetstock");
            return filterByPrefix(options, args[0]);
        }

        String sub = args[0].toLowerCase(Locale.ROOT);
        if (!sub.equals("resetstock") || !canUseResetStock(sender)) {
            return Collections.emptyList();
        }

        if (args.length == 2) {
            return filterByPrefix(List.of("all", "shop", "item"), args[1]);
        }

        String mode = args[1].toLowerCase(Locale.ROOT);
        if (args.length == 3 && (mode.equals("shop") || mode.equals("item"))) {
            return filterByPrefix(new ArrayList<>(getShopManager().getShopKeys()), args[2]);
        }

        if (args.length == 4 && mode.equals("item")) {
            ShopData shop = getShopManager().getShop(args[2]);
            if (shop == null || shop.getItems() == null) {
                return Collections.emptyList();
            }
            List<String> slots = new ArrayList<>();
            for (me.dralle.shop.model.ShopItem item : shop.getItems()) {
                if (item.getSlot() != null) {
                    slots.add(String.valueOf(item.getSlot()));
                }
            }
            return filterByPrefix(slots, args[3]);
        }

        return Collections.emptyList();
    }

    private List<String> filterByPrefix(List<String> options, String input) {
        String prefix = input == null ? "" : input.toLowerCase(Locale.ROOT);
        List<String> out = new ArrayList<>();
        for (String option : options) {
            if (option != null && option.toLowerCase(Locale.ROOT).startsWith(prefix)) {
                out.add(option);
            }
        }
        return out;
    }

    private boolean canUseReload(CommandSender sender) {
        return sender.hasPermission("geniusshop.reload") || sender.hasPermission("shop.admin");
    }

    private boolean canUseEditor(CommandSender sender) {
        if (!(sender instanceof Player)) return false;
        if (!getConfig().getBoolean("api.enable-editor-command", true)) return false;
        return hasAdminAccess(sender);
    }

    private boolean canUseSell(CommandSender sender) {
        if (!(sender instanceof Player)) return false;
        return sender.hasPermission("geniusshop.sell") || hasAdminAccess(sender);
    }

    private boolean canUseWiki(CommandSender sender) {
        return sender.hasPermission("geniusshop.wiki") || hasAdminAccess(sender);
    }

    private boolean canUseResetStock(CommandSender sender) {
        return sender.hasPermission("geniusshop.resetstock") || hasAdminAccess(sender);
    }

    private boolean hasAdminAccess(CommandSender sender) {
        return sender.hasPermission("geniusshop.admin")
                || sender.hasPermission("shop.admin")
                || sender.isOp();
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
                String existingContent = new String(
                        java.nio.file.Files.readAllBytes(readmeFile.toPath()),
                        java.nio.charset.StandardCharsets.UTF_8
                );
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
                    me.dralle.shop.util.ConsoleLog.info(this, "Generated/updated shops/README.md (v" + currentVersion + ")");
                } else {
                    me.dralle.shop.util.ConsoleLog.warn(this, "Could not find shops/README.md template in plugin resources");
                }
            }
        } catch (Exception e) {
            me.dralle.shop.util.ConsoleLog.warn(this, "Failed to generate shops/README.md: " + e.getMessage());
        }
    }
}

