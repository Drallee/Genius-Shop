package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.data.RefundRecovery;
import me.dralle.shop.economy.EconomyHook;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class RefundRecoveryCommandTest {
    @Test
    void unauthorizedSenderCannotReadOrRetryRefunds() {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        CommandSender sender = mock(CommandSender.class);
        when(plugin.getMessages().getMessage("no-permission")).thenReturn("denied");
        new RefundRecoveryCommand(plugin).execute(sender, new String[]{"refunds", "retry", UUID.randomUUID().toString()});
        verify(sender).sendMessage("denied");
        verify(plugin, never()).getRefundRecovery();
        verify(plugin, never()).getEconomy();
    }

    @ParameterizedTest
    @ValueSource(strings = {"geniusshop.refunds", "geniusshop.admin", "shop.admin", "op"})
    void permittedSenderCanListCases(String permission) throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        CommandSender sender = mock(CommandSender.class);
        if (permission.equals("op")) when(sender.isOp()).thenReturn(true);
        else when(sender.hasPermission(permission)).thenReturn(true);
        when(plugin.getRefundRecovery().list(1)).thenReturn(java.util.List.of());
        new RefundRecoveryCommand(plugin).execute(sender, new String[]{"refunds"});
        verify(sender).sendMessage("No unresolved refunds.");
    }

    @Test
    void retryRequiresOnlinePlayerAndUsesSavedAmountAndActor() throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        CommandSender sender = mock(CommandSender.class);
        when(sender.hasPermission("geniusshop.refunds")).thenReturn(true);
        when(sender.getName()).thenReturn("CONSOLE");
        UUID id = UUID.randomUUID(), uuid = UUID.randomUUID();
        when(plugin.getRefundRecovery().get(id)).thenReturn(new RefundRecovery.Case(id, uuid, 100, "failed", RefundRecovery.Status.PENDING, 1, 1, 1, "automatic", null, null, null));
        when(plugin.getServer().getPlayer(uuid)).thenReturn(null);
        var command = new RefundRecoveryCommand(plugin);
        String[] args = {"refunds", "retry", id.toString()};
        assertTrue(command.execute(sender, args));
        verify(plugin.getRefundRecovery(), never()).retry(any(), any(), any(), any());
        Player player = mock(Player.class);
        when(plugin.getServer().getPlayer(uuid)).thenReturn(player);
        when(plugin.getRefundRecovery().retry(id, player, "CONSOLE", plugin.getEconomy())).thenReturn(new EconomyHook.EconomyOperationResult(true, null));
        command.execute(sender, args);
        verify(plugin.getRefundRecovery()).retry(id, player, "CONSOLE", plugin.getEconomy());
        verify(sender).sendMessage("Refund recovered: " + id);
    }

    @Test
    void reviewRequiresAnExplicitOutcomeAndNoteAndDoesNotPay() throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        CommandSender sender = mock(CommandSender.class);
        when(sender.isOp()).thenReturn(true);
        when(sender.getName()).thenReturn("CONSOLE");
        UUID id = UUID.randomUUID();
        var command = new RefundRecoveryCommand(plugin);
        command.execute(sender, new String[]{"refunds", "review", id.toString(), "unpaid"});
        verify(plugin.getRefundRecovery(), never()).review(any(), anyBoolean(), any(), any());
        command.execute(sender, new String[]{"refunds", "review", id.toString(), "unpaid", "Provider", "logs", "checked"});
        verify(plugin.getRefundRecovery()).review(id, false, "CONSOLE", "Provider logs checked");
        verify(plugin, never()).getEconomy();
    }
}
