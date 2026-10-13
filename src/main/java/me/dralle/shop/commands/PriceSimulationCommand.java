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
import org.bukkit.Material;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.util.*;
import java.util.logging.Level;

public final class PriceSimulationCommand {
    private final ShopPlugin plugin;
    public PriceSimulationCommand(ShopPlugin plugin) { this.plugin = plugin; }
    public record Options(String player, Instant at, List<Integer> quantities, String stock, String mode) {}

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
            sender.sendMessage("Invalid simulation options: " + failure.getMessage());
            sender.sendMessage("/shop validate-prices [player=name] [at=ISO-instant] [quantities=1,16,64] [stock=all|live|zero|half|depleted|count] [mode=both|batch|sequential]");
            return true;
        }
        Player player = options.player() == null ? null : plugin.getServer().getPlayerExact(options.player());
        if (options.player() != null && player == null) { sender.sendMessage("Simulation player must be online."); return true; }
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
        var output = plugin.getDataFolder().toPath().resolve("price-validation-" + UUID.randomUUID() + ".txt");
        sender.sendMessage("Simulating " + routes.size() + " matching routes using copied counters; no trades will execute.");
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                List<String> report = run(routes, stock, counts, resets, options, safety, intentional, budget);
                report.addAll(warnings);
                Files.write(output, report, StandardCharsets.UTF_8);
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    report.stream().limit(25).forEach(sender::sendMessage);
                    sender.sendMessage("Full price simulation report: " + output.getFileName());
                });
            } catch (Exception failure) {
                plugin.getLogger().log(Level.WARNING, "Price simulation failed", failure);
                plugin.getServer().getScheduler().runTask(plugin, () -> sender.sendMessage("Price simulation failed; check server log."));
            }
        });
        return true;
    }

    public static List<String> run(List<Route> routes, Map<String, Integer> stock, Map<String, Integer> counts, List<Reset> resets,
                                   Options options, Safety safety, Set<String> intentional, long budget) {
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
                    times.addAll(ShopTimeUtil.simulationTimes(offer.shop().getAvailableTimes(), anchor));
                    times.addAll(ShopTimeUtil.simulationTimes(offer.item().getAvailableTimes(), anchor));
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
                    Result result = PriceSimulation.simulate(route, quantity, at, mode, buyStock, sellStock, counts, bindings, safety);
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
        if (truncated) report.add("INCOMPLETE: sampling/time or work budget reached; omitted scenarios may contain other profitable routes.");
        for (Result result : best.values().stream().sorted(Comparator.comparingDouble(Result::profit).reversed()).toList()) {
            String classification = intentional.contains(result.route().key()) ? "INTENTIONAL" : "REVIEW";
            report.add(String.format(Locale.ROOT, "%s %s | %s qty=%d cost=%.6f revenue=%.6f profit=%.6f at=%s stock-used=%d/%d",
                    classification, result.route().key(), result.mode(), result.quantity(), result.cost(), result.revenue(), result.profit(), result.at(), result.buyStock(), result.sellStock()));
            report.add("Conditions: " + PriceSimulation.conditions(result.route()));
        }
        report.add("BATCH uses one buy and one sale at their starting prices; SEQUENTIAL reprices each individual buy and sale and advances configured cooldown time.");
        report.add("Samples cover listed quantities/counters, the next week's availability boundaries and configured campaign boundaries; absence of findings is not proof of no arbitrage.");
        report.add("Assumes sufficient balance/inventory space, any required confirmation, and eligible initial cooldown/last-price history. Permissions and world/level/game-mode conditions must all hold.");
        return report;
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
