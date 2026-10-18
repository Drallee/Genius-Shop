package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.data.TransactionEntry;
import me.dralle.shop.data.TransactionLedger;
import net.md_5.bungee.api.chat.ClickEvent;
import net.md_5.bungee.api.chat.HoverEvent;
import net.md_5.bungee.api.chat.TextComponent;
import net.md_5.bungee.api.chat.hover.content.Text;
import org.bukkit.ChatColor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.logging.Level;

public final class TransactionLedgerCommand {
    private static final Set<String> FILTERS = Set.of("player", "shop", "item", "type", "from", "to", "page");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss 'UTC'").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter SHORT_DATE = DateTimeFormatter.ofPattern("dd MMM HH:mm:ss 'UTC'", Locale.ENGLISH).withZone(ZoneOffset.UTC);
    private final ShopPlugin plugin;

    public TransactionLedgerCommand(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    public boolean execute(CommandSender sender, String[] args) {
        if (!canRead(sender)) {
            sender.sendMessage(plugin.getMessages().getMessage("no-permission"));
            return true;
        }
        final TransactionLedger.Query query;
        try {
            query = parse(args);
        } catch (IllegalArgumentException failure) {
            sender.sendMessage(color("&cInvalid ledger filter: &f" + failure.getMessage()));
            sender.sendMessage(color("&7/shop ledger [player=name-or-uuid] [shop=key] [item=key] [type=PURCHASE|SALE|WAND_SALE] [from=YYYY-MM-DD] [to=YYYY-MM-DD] [page=1]"));
            return true;
        }
        // SQLite queries run off the server thread; messages return to the server thread.
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                List<TransactionEntry> entries = plugin.getTransactionLedger().search(query);
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    if (!canRead(sender) || (sender instanceof org.bukkit.entity.Player player && !player.isOnline())) return;
                    sender.sendMessage(color("&8----- &6&lTransaction Ledger &8| &7Page &f" + (query.offset() / 10 + 1) + " &8-----"));
                    if (entries.isEmpty()) sender.sendMessage(color("&7No matching transactions."));
                    else if (sender instanceof Player) sender.sendMessage(color("&7Hover for full details. Click to copy the record ID."));
                    for (TransactionEntry entry : entries.stream().limit(10).toList()) {
                        displayEntry(sender, entry);
                    }
                    if (entries.size() > 10) sender.sendMessage(color("&eMore results: &7repeat the filters with &fpage=" + (query.offset() / 10 + 2)));
                });
            } catch (Exception failure) {
                plugin.getLogger().log(Level.WARNING, "Failed to search transaction ledger", failure);
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    if (canRead(sender)) sender.sendMessage(color("&cTransaction ledger unavailable. &7Check the server log."));
                });
            }
        });
        return true;
    }

    private void displayEntry(CommandSender sender, TransactionEntry entry) {
        String type = switch (entry.type()) {
            case PURCHASE -> "&6BUY";
            case SALE -> "&aSELL";
            case WAND_SALE -> "&bWAND SALE";
        };
        String summary = color(type + " &8| &f" + entry.playerName() + " &8| &e" + entry.quantity()
                + "x &f" + compact(entry.item()) + "\n"
                + "  &a" + plugin.formatCurrency(entry.total()) + " &7total &8| &7"
                + plugin.formatCurrency(entry.unitPrice()) + " each\n"
                + "  &7" + (entry.shop().isEmpty() ? "No shop" : compact(entry.shop())) + " &8| &7"
                + SHORT_DATE.format(entry.timestamp()) + " &8| #" + entry.id().toString().substring(0, 8));
        String details = color("&6Transaction details\n&7Type: &f" + entry.type()
                + "\n&7Player: &f" + entry.playerName() + "\n&7Player UUID: &f" + entry.playerId()
                + "\n&7Shop: &f" + entry.shop() + "\n&7Item: &f" + entry.item()
                + "\n&7Quantity: &e" + entry.quantity()
                + "\n&7Unit price: &a" + plugin.formatCurrency(entry.unitPrice())
                + "\n&7Total: &a" + plugin.formatCurrency(entry.total())
                + "\n&7Time: &f" + DATE.format(entry.timestamp())
                + "\n&7Record ID: &f" + entry.id() + "\n&7Operation ID: &f" + entry.operationId()
                + "\n\n&eClick to copy the record ID.");
        if (sender instanceof Player player) {
            TextComponent message = new TextComponent(TextComponent.fromLegacyText(summary));
            message.setHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, new Text(TextComponent.fromLegacyText(details))));
            message.setClickEvent(new ClickEvent(ClickEvent.Action.COPY_TO_CLIPBOARD, entry.id().toString()));
            player.spigot().sendMessage(message);
        } else {
            sender.sendMessage(summary);
            sender.sendMessage(color("  &8Record: " + entry.id() + " | Operation: " + entry.operationId()
                    + "\n  Player UUID: " + entry.playerId() + " | Shop: " + entry.shop() + " | Item: " + entry.item()
                    + " | Time: " + DATE.format(entry.timestamp())));
        }
        sender.sendMessage("");
    }

    private static String compact(String value) {
        return value.length() > 28 ? value.substring(0, 25) + "..." : value;
    }

    private static String color(String value) {
        return ChatColor.translateAlternateColorCodes('&', value);
    }

    private static boolean canRead(CommandSender sender) {
        return sender.hasPermission("geniusshop.ledger") || sender.hasPermission("geniusshop.admin")
                || sender.hasPermission("shop.admin") || sender.isOp();
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
