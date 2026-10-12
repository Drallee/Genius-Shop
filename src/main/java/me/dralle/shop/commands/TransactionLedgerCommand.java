package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.data.TransactionEntry;
import me.dralle.shop.data.TransactionLedger;
import org.bukkit.command.CommandSender;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.logging.Level;

public final class TransactionLedgerCommand {
    private static final Set<String> FILTERS = Set.of("player", "shop", "item", "type", "from", "to", "page");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss 'UTC'").withZone(ZoneOffset.UTC);
    private final ShopPlugin plugin;

    public TransactionLedgerCommand(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    public boolean execute(CommandSender sender, String[] args) {
        if (!sender.hasPermission("geniusshop.ledger") && !sender.hasPermission("geniusshop.admin")
                && !sender.hasPermission("shop.admin") && !sender.isOp()) {
            sender.sendMessage(plugin.getMessages().getMessage("no-permission"));
            return true;
        }
        final TransactionLedger.Query query;
        try {
            query = parse(args);
        } catch (IllegalArgumentException failure) {
            sender.sendMessage("Invalid ledger filter: " + failure.getMessage());
            sender.sendMessage("/shop ledger [player=name-or-uuid] [shop=key] [item=key] [type=PURCHASE|SALE|WAND_SALE] [from=YYYY-MM-DD] [to=YYYY-MM-DD] [page=1]");
            return true;
        }
        // SQLite queries run off the server thread; messages return to the server thread.
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                List<TransactionEntry> entries = plugin.getTransactionLedger().search(query);
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    sender.sendMessage("Transaction ledger, page " + (query.offset() / 10 + 1) + " (UTC)");
                    if (entries.isEmpty()) sender.sendMessage("No matching transactions.");
                    for (TransactionEntry entry : entries.stream().limit(10).toList()) {
                        sender.sendMessage(entry.id() + " | " + DATE.format(entry.timestamp()) + " | " + entry.type());
                        sender.sendMessage(entry.playerName() + " (" + entry.playerId() + ") | " + entry.shop() + " | " + entry.item());
                        sender.sendMessage(entry.quantity() + " x " + plugin.formatCurrency(entry.unitPrice()) + " = " + plugin.formatCurrency(entry.total()));
                    }
                    if (entries.size() > 10) sender.sendMessage("More results: repeat the filters with page=" + (query.offset() / 10 + 2));
                });
            } catch (Exception failure) {
                plugin.getLogger().log(Level.WARNING, "Failed to search transaction ledger", failure);
                plugin.getServer().getScheduler().runTask(plugin, () -> sender.sendMessage("Transaction ledger unavailable. Check the server log."));
            }
        });
        return true;
    }

    public static TransactionLedger.Query parse(String[] args) {
        Map<String, String> values = new HashMap<>();
        for (int i = 1; i < args.length; i++) {
            int separator = args[i].indexOf('=');
            if (separator <= 0 || separator == args[i].length() - 1) throw new IllegalArgumentException("Expected key=value");
            String key = args[i].substring(0, separator).toLowerCase(Locale.ROOT);
            String value = args[i].substring(separator + 1);
            if (!FILTERS.contains(key) || values.putIfAbsent(key, value) != null) throw new IllegalArgumentException("Unknown or repeated filter " + key);
        }
        int page = Integer.parseInt(values.getOrDefault("page", "1"));
        if (page < 1 || page > 1000000) throw new IllegalArgumentException("Page must be between 1 and 1000000");
        TransactionEntry.Type type = values.containsKey("type")
                ? TransactionEntry.Type.valueOf(values.get("type").toUpperCase(Locale.ROOT)) : null;
        try {
            return new TransactionLedger.Query(values.get("player"), values.get("shop"), values.get("item"), type,
                    date(values.get("from"), false), date(values.get("to"), true), 11, (page - 1) * 10);
        } catch (java.time.DateTimeException | ArithmeticException failure) {
            throw new IllegalArgumentException("Use YYYY-MM-DD or an ISO UTC timestamp", failure);
        }
    }

    private static Instant date(String value, boolean endOfDay) {
        if (value == null) return null;
        if (value.length() == 10) {
            LocalDate day = LocalDate.parse(value);
            return (endOfDay ? day.plusDays(1) : day).atStartOfDay().toInstant(ZoneOffset.UTC);
        }
        return Instant.parse(value);
    }
}
