package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.data.RefundRecovery;
import net.md_5.bungee.api.chat.ClickEvent;
import net.md_5.bungee.api.chat.HoverEvent;
import net.md_5.bungee.api.chat.TextComponent;
import net.md_5.bungee.api.chat.hover.content.Text;
import org.bukkit.ChatColor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.time.Instant;
import java.util.Arrays;
import java.util.UUID;
import java.util.logging.Level;

public final class RefundRecoveryCommand {
    private final ShopPlugin plugin;
    public RefundRecoveryCommand(ShopPlugin plugin) { this.plugin = plugin; }

    public boolean execute(CommandSender sender, String[] args) {
        if (!sender.hasPermission("geniusshop.refunds") && !sender.hasPermission("geniusshop.admin")
                && !sender.hasPermission("shop.admin") && !sender.isOp()) {
            sender.sendMessage(plugin.getMessages().getMessage("no-permission"));
            return true;
        }
        try {
            String action = args.length > 1 ? args[1].toLowerCase(java.util.Locale.ROOT) : "list";
            if (action.equals("list")) {
                if (args.length > 3) throw new IllegalArgumentException("Too many arguments");
                int page = args.length == 3 ? Integer.parseInt(args[2]) : 1;
                var cases = plugin.getRefundRecovery().list(page);
                send(sender, "&8----- &6&lRefund Recovery &8| &7Page &f" + page + " &8-----");
                for (var entry : cases) displayCase(sender, entry);
                if (cases.isEmpty()) send(sender, "&7No unresolved refunds.");
                else if (sender instanceof Player) send(sender, "&7Hover for details; click a case to inspect it.");
            } else if (action.equals("inspect") && args.length == 3) {
                var entry = plugin.getRefundRecovery().get(UUID.fromString(args[2]));
                if (entry == null) { send(sender, "&cRefund not found."); return true; }
                send(sender, "&6&lRefund Details &7[hover for full history]");
                displayCase(sender, entry);
            } else if (action.equals("retry") && args.length == 3) {
                UUID id = UUID.fromString(args[2]);
                var entry = plugin.getRefundRecovery().get(id);
                if (entry == null) { send(sender, "&cRefund not found."); return true; }
                var player = plugin.getServer().getPlayer(entry.playerId());
                if (player == null) { send(sender, "&eThe player must be online to retry this refund."); return true; }
                var result = plugin.getRefundRecovery().retry(id, player, actor(sender), plugin.getEconomy());
                send(sender, result.success() ? "&aRefund recovered: &f" + id : "&cRefund not completed: &f" + result.errorMessage());
            } else if (action.equals("review") && args.length >= 5) {
                boolean paid = args[3].equalsIgnoreCase("paid");
                if (!paid && !args[3].equalsIgnoreCase("unpaid")) throw new IllegalArgumentException("Review outcome must be paid or unpaid");
                boolean changed = plugin.getRefundRecovery().review(UUID.fromString(args[2]), paid, actor(sender), String.join(" ", Arrays.copyOfRange(args, 4, args.length)));
                send(sender, changed ? "&aProvider review saved. &7" + (paid ? "Case closed without another payment." : "Case is pending and may be retried.") : "&eOnly REVIEW cases can be reviewed.");
            } else throw new IllegalArgumentException("Unknown refund command");
        } catch (IllegalArgumentException failure) {
            send(sender, "&cInvalid refund command: &f" + failure.getMessage());
            send(sender, "&7/shop refunds list [page] | inspect <id> | retry <id> | review <id> <paid|unpaid> <provider-check-note>");
        } catch (Exception failure) {
            plugin.getLogger().log(Level.SEVERE, "Refund recovery command failed", failure);
            send(sender, "&cRefund state could not be saved. &7Inspect the case and server log before retrying.");
        }
        return true;
    }

    private void displayCase(CommandSender sender, RefundRecovery.Case entry) {
        String statusColor = switch (entry.status()) {
            case PENDING -> "&e";
            case REFUNDING -> "&b";
            case REVIEW -> "&c";
            case RECOVERED -> "&a";
        };
        String details = "&6Refund Details\n&7Status: " + statusColor + entry.status()
                + "\n&7Reference: &f" + entry.transactionId() + "\n&7Player UUID: &f" + entry.playerId()
                + "\n&7Amount: &a" + plugin.formatCurrency(entry.amount())
                + "\n&7Created: &f" + Instant.ofEpochMilli(entry.created())
                + "\n&7Updated: &f" + Instant.ofEpochMilli(entry.updated())
                + "\n&7Attempts: &f" + entry.attempts() + "\n&7Last actor: &f" + (entry.attemptedBy() == null ? "None" : entry.attemptedBy())
                + "\n&7Reason: &f" + entry.reason();
        if (entry.completed() != null) details += "\n&7Recovered: &f" + Instant.ofEpochMilli(entry.completed()) + " by " + entry.completedBy();
        if (entry.reviewNote() != null) details += "\n&7Review: &f" + entry.reviewNote();
        if (sender instanceof Player player) {
            String name = plugin.getServer().getOfflinePlayer(entry.playerId()).getName();
            String summary = statusColor + entry.status() + " &8| &f" + (name == null ? "Unknown player" : name)
                    + " &8| &a" + plugin.formatCurrency(entry.amount()) + " &8| #" + entry.transactionId().toString().substring(0, 8);
            TextComponent message = new TextComponent(TextComponent.fromLegacyText(color(summary)));
            message.setHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, new Text(TextComponent.fromLegacyText(color(details)))));
            message.setClickEvent(new ClickEvent(ClickEvent.Action.SUGGEST_COMMAND, "/shop refunds inspect " + entry.transactionId()));
            player.spigot().sendMessage(message);
        } else send(sender, details);
    }

    private static void send(CommandSender sender, String message) {
        sender.sendMessage(color(message));
    }

    private static String color(String message) {
        return ChatColor.translateAlternateColorCodes('&', message);
    }

    private String actor(CommandSender sender) {
        return sender instanceof org.bukkit.entity.Player player ? player.getUniqueId() + " (" + player.getName() + ")" : sender.getName();
    }
}
