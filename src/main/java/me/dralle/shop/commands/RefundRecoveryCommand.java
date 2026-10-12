package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import org.bukkit.command.CommandSender;

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
                sender.sendMessage("Unresolved refunds, page " + page);
                for (var entry : cases) sender.sendMessage(entry.transactionId() + " | " + entry.status() + " | " + entry.playerId() + " | " + plugin.formatCurrency(entry.amount()));
                if (cases.isEmpty()) sender.sendMessage("No unresolved refunds.");
            } else if (action.equals("inspect") && args.length == 3) {
                var entry = plugin.getRefundRecovery().get(UUID.fromString(args[2]));
                if (entry == null) { sender.sendMessage("Refund not found."); return true; }
                sender.sendMessage(entry.transactionId() + " | " + entry.status() + " | " + entry.playerId() + " | " + plugin.formatCurrency(entry.amount()));
                sender.sendMessage("Created: " + Instant.ofEpochMilli(entry.created()) + "; updated: " + Instant.ofEpochMilli(entry.updated()));
                sender.sendMessage("Attempts: " + entry.attempts() + "; last actor: " + entry.attemptedBy() + "; reason: " + entry.reason());
                if (entry.completed() != null) sender.sendMessage("Recovered: " + Instant.ofEpochMilli(entry.completed()) + " by " + entry.completedBy());
                if (entry.reviewNote() != null) sender.sendMessage("Review: " + entry.reviewNote());
            } else if (action.equals("retry") && args.length == 3) {
                UUID id = UUID.fromString(args[2]);
                var entry = plugin.getRefundRecovery().get(id);
                if (entry == null) { sender.sendMessage("Refund not found."); return true; }
                var player = plugin.getServer().getPlayer(entry.playerId());
                if (player == null) { sender.sendMessage("The player must be online to retry this refund."); return true; }
                var result = plugin.getRefundRecovery().retry(id, player, actor(sender), plugin.getEconomy());
                sender.sendMessage(result.success() ? "Refund recovered: " + id : "Refund not completed: " + result.errorMessage());
            } else if (action.equals("review") && args.length >= 5) {
                boolean paid = args[3].equalsIgnoreCase("paid");
                if (!paid && !args[3].equalsIgnoreCase("unpaid")) throw new IllegalArgumentException("Review outcome must be paid or unpaid");
                boolean changed = plugin.getRefundRecovery().review(UUID.fromString(args[2]), paid, actor(sender), String.join(" ", Arrays.copyOfRange(args, 4, args.length)));
                sender.sendMessage(changed ? "Provider review saved. " + (paid ? "Case closed without another payment." : "Case is pending and may be retried.") : "Only REVIEW cases can be reviewed.");
            } else throw new IllegalArgumentException("Unknown refund command");
        } catch (IllegalArgumentException failure) {
            sender.sendMessage("Invalid refund command: " + failure.getMessage());
            sender.sendMessage("/shop refunds list [page] | inspect <id> | retry <id> | review <id> <paid|unpaid> <provider-check-note>");
        } catch (Exception failure) {
            plugin.getLogger().log(Level.SEVERE, "Refund recovery command failed", failure);
            sender.sendMessage("Refund state could not be saved. Inspect the case and server log before retrying.");
        }
        return true;
    }

    private String actor(CommandSender sender) {
        return sender instanceof org.bukkit.entity.Player player ? player.getUniqueId() + " (" + player.getName() + ")" : sender.getName();
    }
}
