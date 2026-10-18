package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.economy.PriceSimulation;
import me.dralle.shop.economy.PriceSimulation.*;
import me.dralle.shop.gui.PurchaseMenu;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.CampaignUtil;
import me.dralle.shop.util.ItemConditionUtil;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.ShopTimeUtil;
import net.md_5.bungee.api.chat.ClickEvent;
import net.md_5.bungee.api.chat.HoverEvent;
import net.md_5.bungee.api.chat.TextComponent;
import net.md_5.bungee.api.chat.hover.content.Text;
import org.bukkit.ChatColor;
import org.bukkit.Material;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.logging.Level;

public final class PriceSimulationCommand {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss 'UTC'").withZone(ZoneOffset.UTC);
    private final ShopPlugin plugin;
    public PriceSimulationCommand(ShopPlugin plugin) { this.plugin = plugin; }
    public record Options(String player, Instant at, List<Integer> quantities, String stock, String mode) {}
    record Report(List<String> lines, List<Result> findings, long steps, boolean incomplete) {}

    public static Options parse(String[] args) {
        Map<String, String> values = new HashMap<>();
        for (int i = 1; i < args.length; i++) {
            String[] pair = args[i].split("=", 2);
            if (pair.length != 2 || pair[1].isBlank() || !Set.of("player", "at", "quantities", "stock", "mode").contains(pair[0])
                    || values.putIfAbsent(pair[0], pair[1]) != null) throw new IllegalArgumentException("Invalid or repeated key=value option");
        }
        List<Integer> quantities = Arrays.stream(values.getOrDefault("quantities", "1,16,64").split(",", -1)).map(Integer::parseInt).distinct().sorted().toList();
        if (quantities.isEmpty() || quantities.size() > 8 || quantities.stream().anyMatch(q -> q < 1 || q > 1024)) throw new IllegalArgumentException("Use up to 8 quantities between 1 and 1024");
        String stock = values.getOrDefault("stock", "all"), mode = values.getOrDefault("mode", "both");
        if (!Set.of("all", "live", "zero", "half", "depleted").contains(stock)) {
            if (!stock.matches("\\d+") || Integer.parseInt(stock) < 0) throw new IllegalArgumentException("Invalid stock count");
        }
        if (!Set.of("both", "batch", "sequential").contains(mode)) throw new IllegalArgumentException("Invalid mode");
        try { return new Options(values.get("player"), values.containsKey("at") ? Instant.parse(values.get("at")) : null, quantities, stock, mode); }
        catch (java.time.DateTimeException failure) { throw new IllegalArgumentException("at must be an ISO UTC timestamp", failure); }
    }

    public boolean execute(CommandSender sender, String[] args) {
        if (!sender.hasPermission("geniusshop.validateprices") && !sender.hasPermission("geniusshop.admin")
                && !sender.hasPermission("shop.admin") && !sender.isOp()) {
            sender.sendMessage(plugin.getMessages().getMessage("no-permission"));
            return true;
        }
        final Options options;
        try { options = parse(args); }
        catch (IllegalArgumentException failure) {
            sender.sendMessage(color("&cInvalid simulation options: &f" + failure.getMessage()));
            sender.sendMessage(color("&7/shop validate-prices [player=name] [at=ISO-instant] [quantities=1,16,64] [stock=all|live|zero|half|depleted|count] [mode=both|batch|sequential]"));
            return true;
        }
        Player player = options.player() == null ? null : plugin.getServer().getPlayerExact(options.player());
        if (options.player() != null && player == null) { sender.sendMessage(color("&cSimulation player must be online.")); return true; }
        List<Offer> offers = new ArrayList<>();
        Map<String, Integer> counts = new HashMap<>();
        List<Reset> resets = new ArrayList<>();
        for (String key : plugin.getShopManager().getShopKeys()) {
            var shop = plugin.getShopManager().getShop(key);
            if (shop == null) continue;
            if (shop.getStockResetRule() != null) resets.add(new Reset(shop.getStockResetRule(), Set.copyOf(shop.getItems().stream().map(ShopItem::getUniqueKey).toList())));
            for (ShopItem item : shop.getItems()) {
                if (item.getStockResetRule() != null) resets.add(new Reset(item.getStockResetRule(), Set.of(item.getUniqueKey())));
                if (player != null && ((!blank(shop.getPermission()) && !player.hasPermission(shop.getPermission()))
                        || (!blank(item.getPermission()) && !player.hasPermission(item.getPermission()))
                        || !ItemConditionUtil.check(plugin, player, item).allowed())) continue;
                offers.add(new Offer(shop, item));
                if (player != null) counts.put(item.getUniqueKey(), plugin.getStateRepository().getPlayerCount(player.getUniqueId(), item.getUniqueKey()));
            }
        }
        List<Route> routes = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        for (Offer buy : offers) {
            if (buy.item().getPrice() <= 0) continue;
            if (buy.item().getCommands() != null && !buy.item().getCommands().isEmpty()) {
                warnings.add("Skipped command-backed purchase: " + buy.shop().getKey() + ":" + buy.item().getUniqueKey());
                continue;
            }
            // Never invoke another plugin's item-creation API during a read-only audit.
            if (buy.item().isSpawner() && blank(buy.item().getItemStackData()) && plugin.getConfig().getBoolean("smart-spawner-support", true)
                    && plugin.getConfig().getBoolean("smart-spawner-command-fallback", true)
                    && (plugin.getServer().getPluginManager().isPluginEnabled("SmartSpawner") || plugin.getServer().getPluginManager().isPluginEnabled("SmartSpawners"))) {
                warnings.add("Skipped external spawner delivery: " + buy.shop().getKey() + ":" + buy.item().getUniqueKey());
                continue;
            }
            try {
                ItemStack delivered = template(buy.item());
                for (Offer sell : offers) {
                    if (sell.item().getSellPrice() == null || sell.item().getSellPrice() <= 0) continue;
                    if (blank(sell.item().getItemStackData()) && delivered.getType() != sell.item().getMaterial()) continue;
                    if (PriceSimulation.compatibleConditions(buy.item(), sell.item()) && ShopItemUtil.isSameItem(delivered, sell.item())) routes.add(new Route(buy, sell));
                }
            } catch (RuntimeException failure) {
                warnings.add("Could not validate delivered item " + buy.shop().getKey() + ":" + buy.item().getUniqueKey() + ": " + failure.getMessage());
            }
        }
        Map<String, Integer> stock = Map.copyOf(plugin.getStateRepository().getAllGlobalCounts());
        Set<String> intentional = Set.copyOf(plugin.getConfig().getStringList("price-validation.intentional-routes"));
        var config = plugin.getConfig();
        boolean enabled = config.getBoolean("economy-safety.enabled", true);
        boolean cooldowns = enabled && config.getBoolean("economy-safety.cooldowns.enabled", true);
        Safety safety = new Safety(enabled, config.getDouble("economy-safety.max-unit-price", 0), config.getDouble("economy-safety.max-transaction-value", 0),
                config.getBoolean("economy-safety.anti-spike.enabled", true), config.getDouble("economy-safety.anti-spike.max-base-multiplier", 10),
                config.getDouble("economy-safety.anti-spike.min-base-multiplier", 0), config.getDouble("economy-safety.anti-spike.max-step-change-ratio", 5),
                cooldowns ? Math.max(0, config.getLong("economy-safety.cooldowns.buy-ms", 0)) : 0,
                cooldowns ? Math.max(0, config.getLong("economy-safety.cooldowns.sell-ms", 0)) : 0);
        long budget = Math.max(1000, Math.min(5000000, config.getLong("price-validation.max-simulated-units", 1000000)));
        var output = plugin.getDataFolder().toPath().resolve("price-validation").resolve("price-validation-" + UUID.randomUUID() + ".txt");
        ZoneId timezone = ShopTimeUtil.getTimezone(plugin);
        sender.sendMessage(color("&bChecking &f" + routes.size() + " &broutes... &7Read-only; no trades will execute."));
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                Report report = simulate(routes, stock, counts, resets, options, safety, intentional, budget, timezone);
                List<String> fileLines = new ArrayList<>(report.lines());
                fileLines.addAll(warnings);
                Files.createDirectories(output.getParent());
                Files.write(output, fileLines, StandardCharsets.UTF_8);
                plugin.getServer().getScheduler().runTask(plugin, () ->
                        displayReport(sender, report, options, intentional, warnings, output, routes.size(), timezone));
            } catch (Exception failure) {
                plugin.getLogger().log(Level.WARNING, "Price simulation failed", failure);
                plugin.getServer().getScheduler().runTask(plugin, () -> sender.sendMessage(color("&cPrice simulation failed. &7Check the server log.")));
            }
        });
        return true;
    }

    public static List<String> run(List<Route> routes, Map<String, Integer> stock, Map<String, Integer> counts, List<Reset> resets,
                                   Options options, Safety safety, Set<String> intentional, long budget) {
        return run(routes, stock, counts, resets, options, safety, intentional, budget, ZoneId.systemDefault());
    }

    public static List<String> run(List<Route> routes, Map<String, Integer> stock, Map<String, Integer> counts, List<Reset> resets,
                                   Options options, Safety safety, Set<String> intentional, long budget, ZoneId timezone) {
        return new ArrayList<>(simulate(routes, stock, counts, resets, options, safety, intentional, budget, timezone).lines());
    }

    private static Report simulate(List<Route> routes, Map<String, Integer> stock, Map<String, Integer> counts, List<Reset> resets,
                                   Options options, Safety safety, Set<String> intentional, long budget, ZoneId timezone) {
        Map<String, Result> best = new LinkedHashMap<>();
        long units = 0;
        boolean truncated = false;
        Instant anchor = options.at() != null ? options.at() : Instant.now();
        outer: for (Route route : routes) {
            LinkedHashSet<Instant> times = new LinkedHashSet<>();
            times.add(anchor);
            if (options.at() == null) {
                for (Offer offer : List.of(route.buy(), route.sell())) {
                    times.addAll(CampaignUtil.boundaries(offer.shop(), offer.item()));
                    times.addAll(ShopTimeUtil.simulationTimes(offer.shop().getAvailableTimes(), anchor, timezone));
                    times.addAll(ShopTimeUtil.simulationTimes(offer.item().getAvailableTimes(), anchor, timezone));
                }
            }
            if (times.size() > 64) truncated = true;
            var bindings = resets.stream().filter(reset -> reset.keys().contains(route.buy().item().getUniqueKey()) || reset.keys().contains(route.sell().item().getUniqueKey())).toList();
            for (Instant at : times.stream().limit(64).toList()) for (String stockMode : options.stock().equals("all") ? List.of("live", "zero", "half", "depleted") : List.of(options.stock())) {
                int buyStock = count(route.buy().item(), stock, stockMode), sellStock = count(route.sell().item(), stock, stockMode);
                for (int quantity : options.quantities()) for (Mode mode : Mode.values()) {
                    if (!options.mode().equals("both") && !options.mode().equals(mode.name().toLowerCase(Locale.ROOT))) continue;
                    long work = mode == Mode.BATCH ? 2 : 2L * quantity;
                    if (units + work > budget) { truncated = true; break outer; }
                    units += work;
                    Result result = PriceSimulation.simulate(route, quantity, at, mode, buyStock, sellStock, counts, bindings, safety, timezone);
                    if (result != null && result.profit() > 1e-7) {
                        String key = route.key() + ":" + mode;
                        Result previous = best.get(key);
                        if (previous == null || previous.profit() < result.profit()) best.put(key, result);
                    }
                }
            }
        }
        List<String> report = new ArrayList<>();
        report.add("Sampled price simulation: candidate routes=" + routes.size() + ", budgeted trade steps=" + units + ", profitable routes/modes=" + best.size());
        report.add("Player=" + (options.player() == null ? "configuration eligibility; fresh player counts" : options.player()) + "; quantities=" + options.quantities() + "; stock=" + options.stock());
        report.add("Availability timezone=" + timezone);
        if (truncated) report.add("INCOMPLETE: sampling/time or work budget reached; omitted scenarios may contain other profitable routes.");
        List<Result> findings = best.values().stream().sorted(Comparator.comparingDouble(Result::profit).reversed()).toList();
        for (Result result : findings) {
            String classification = intentional.contains(result.route().key()) ? "INTENTIONAL" : "REVIEW";
            report.add(String.format(Locale.ROOT, "%s %s | %s qty=%d cost=%.6f revenue=%.6f profit=%.6f at=%s stock-used=%d/%d",
                    classification, result.route().key(), result.mode(), result.quantity(), result.cost(), result.revenue(), result.profit(), result.at(), result.buyStock(), result.sellStock()));
            report.add("Conditions: " + PriceSimulation.conditions(result.route()));
        }
        report.add("BATCH uses one buy and one sale at their starting prices; SEQUENTIAL reprices each individual buy and sale and advances configured cooldown time.");
        report.add("Samples cover listed quantities/counters, the next week's availability boundaries and configured campaign boundaries; absence of findings is not proof of no arbitrage.");
        report.add("Assumes sufficient balance/inventory space, any required confirmation, and eligible initial cooldown/last-price history. Permissions and world/level/game-mode conditions must all hold.");
        return new Report(List.copyOf(report), findings, units, truncated);
    }

    void displayReport(CommandSender sender, Report report, Options options, Set<String> intentional,
                       List<String> warnings, Path output, int routes, ZoneId timezone) {
        if (!(sender instanceof Player player)) {
            report.lines().forEach(sender::sendMessage);
            warnings.forEach(sender::sendMessage);
            sender.sendMessage("Full price simulation report: " + output);
            return;
        }
        if (!player.isOnline()) return;
        if (!player.hasPermission("geniusshop.validateprices") && !player.hasPermission("geniusshop.admin")
                && !player.hasPermission("shop.admin") && !player.isOp()) return;
        player.sendMessage(color("&8----- &6&lPrice Check &8-----"));
        String summary = "&7Routes: &f" + routes + " &8| &7Findings: &e" + report.findings().size() + " &8| &7[hover for summary]";
        String details = "&6Simulation summary\n&7Candidate routes: &f" + routes
                + "\n&7Simulated trade steps: &f" + report.steps()
                + "\n&7Profitable routes / modes: &e" + report.findings().size()
                + "\n&7Quantities: &f" + options.quantities() + "\n&7Stock: &f" + options.stock()
                + "\n&7Mode: &f" + options.mode() + "\n&7Availability timezone: &f" + timezone
                + "\n&7Player: &f" + (options.player() == null ? "Configuration eligibility / fresh counts" : options.player())
                + "\n\n&7Batch: one buy and sale at starting prices."
                + "\n&7Sequential: reprice each unit with cooldowns."
                + "\n&7Sampled scenarios assume funds, space and eligibility."
                + "\n&eNo findings does not guarantee no profitable routes."
                + "\n&aNo balances, inventory or stock were changed.";
        sendHover(player, summary, details, null);
        if (report.incomplete()) {
            sendHover(player, "&cINCOMPLETE &8| &7Sampling limit reached [hover]",
                    "&eThe time-sampling or trade-step budget was reached.\n&7Some scenarios were not checked; inspect the full report.", null);
        }
        if (report.findings().isEmpty()) player.sendMessage(color("&7No profitable routes found in the sampled scenarios."));
        for (Result result : report.findings().stream().limit(5).toList()) {
            boolean intended = intentional.contains(result.route().key());
            String item = result.route().buy().item().getMaterial() == null ? result.route().buy().item().getUniqueKey()
                    : result.route().buy().item().getMaterial().name().replace('_', ' ');
            String routeSummary = (intended ? "&aINTENTIONAL" : "&eREVIEW") + " &8| &f" + compact(item)
                    + " &7" + result.quantity() + "x &8| &a+" + plugin.formatCurrency(result.profit())
                    + "\n  &7" + compact(result.route().buy().shop().getKey()) + " &8-> &7" + compact(result.route().sell().shop().getKey())
                    + " &8| &7" + result.mode().name().toLowerCase(Locale.ROOT);
            String routeDetails = "&6" + (intended ? "Intentional profitable route" : "Review profitable route")
                    + "\n&7Buy: &f" + result.route().buy().shop().getKey() + ":" + result.route().buy().item().getUniqueKey()
                    + "\n&7Sell: &f" + result.route().sell().shop().getKey() + ":" + result.route().sell().item().getUniqueKey()
                    + "\n&7Quantity: &e" + result.quantity() + "\n&7Cost: &6" + plugin.formatCurrency(result.cost())
                    + "\n&7Revenue: &a" + plugin.formatCurrency(result.revenue()) + "\n&7Estimated profit: &a" + plugin.formatCurrency(result.profit())
                    + "\n&7Mode: &f" + result.mode() + "\n&7Time: &f" + DATE.format(result.at())
                    + "\n&7Starting stock used: &f" + result.buyStock() + " / " + result.sellStock()
                    + "\n&7Conditions: &f" + PriceSimulation.conditions(result.route())
                    + "\n\n&eClick to copy the intentional-route key.";
            sendHover(player, routeSummary, routeDetails, result.route().key());
        }
        if (report.findings().size() > 5) player.sendMessage(color("&7Showing top 5; &e" + (report.findings().size() - 5) + " &7more findings in the report file."));
        if (!warnings.isEmpty()) {
            String warningDetails = "&6Skipped items / warnings\n&7" + String.join("\n&7", warnings.stream().limit(5).toList());
            if (warnings.size() > 5) warningDetails += "\n&e" + (warnings.size() - 5) + " more in the report file.";
            sendHover(player, "&e" + warnings.size() + " skipped / warnings &7[hover]", warningDetails, null);
        }
        sendHover(player, "&bFull report &7[click to copy filename]",
                "&7Saved to: &f" + output + "\n&eClick to copy the filename.", output.getFileName().toString());
    }

    private static void sendHover(Player player, String text, String details, String copy) {
        TextComponent message = new TextComponent(TextComponent.fromLegacyText(color(text)));
        message.setHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, new Text(TextComponent.fromLegacyText(color(details)))));
        if (copy != null) message.setClickEvent(new ClickEvent(ClickEvent.Action.COPY_TO_CLIPBOARD, copy));
        player.spigot().sendMessage(message);
    }

    private static String compact(String value) {
        return value.length() > 24 ? value.substring(0, 21) + "..." : value;
    }

    private static String color(String value) {
        return ChatColor.translateAlternateColorCodes('&', value);
    }

    private static int count(ShopItem item, Map<String, Integer> stock, String mode) {
        int live = Math.max(0, stock.getOrDefault(item.getUniqueKey(), 0));
        return switch (mode) {
            case "zero" -> 0;
            case "half" -> item.getGlobalLimit() > 0 ? item.getGlobalLimit() / 2 : Math.max(live, 32);
            case "depleted" -> item.getGlobalLimit() > 0 ? item.getGlobalLimit() : Math.max(live, 64);
            case "live" -> live;
            default -> Integer.parseInt(mode);
        };
    }
    private ItemStack template(ShopItem item) {
        if (!blank(item.getItemStackData())) {
            ItemStack serialized = ShopItemUtil.deserializeItemStack(item.getItemStackData());
            if (serialized != null) return serialized;
            throw new IllegalArgumentException("Invalid serialized item-stack; fallback delivery was not simulated");
        }
        return PurchaseMenu.createDeliveryTemplate(item.getMaterial(), item.getSpawnerType(), item.getSpawnerItem(), item.getPotionType(), item.getPotionLevel(),
                item.requiresName() ? item.getName() : null, item.requiresLore() ? item.getLore() : null, item.getEnchantments(),
                item.shouldHideAttributes(), item.shouldHideAdditional(), item.isUnstableTnt(), item.getHeadTexture(), item.getHeadOwner());
    }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
