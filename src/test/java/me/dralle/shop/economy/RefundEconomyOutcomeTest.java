package me.dralle.shop.economy;

import net.milkbowl.vault.economy.Economy;
import net.milkbowl.vault.economy.EconomyResponse;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class RefundEconomyOutcomeTest {
    @Test
    void distinguishesRejectedPaymentFromUncertainOrPartialPayment() throws Exception {
        EconomyHook hook = mock(EconomyHook.class, CALLS_REAL_METHODS);
        Economy provider = mock(Economy.class);
        var field = EconomyHook.class.getDeclaredField("economy");
        field.setAccessible(true);
        field.set(hook, provider);
        Player player = mock(Player.class);
        when(provider.depositPlayer(player, 100)).thenReturn(
                new EconomyResponse(0, 0, EconomyResponse.ResponseType.FAILURE, "rejected"),
                null,
                new EconomyResponse(50, 50, EconomyResponse.ResponseType.FAILURE, "partial"),
                new EconomyResponse(50, 50, EconomyResponse.ResponseType.SUCCESS, null),
                new EconomyResponse(100, 100, EconomyResponse.ResponseType.SUCCESS, null));
        assertFalse(hook.tryDeposit(player, 100).ambiguous());
        assertTrue(hook.tryDeposit(player, 100).ambiguous());
        assertTrue(hook.tryDeposit(player, 100).ambiguous());
        assertTrue(hook.tryDeposit(player, 100).ambiguous());
        var success = hook.tryDeposit(player, 100);
        assertTrue(success.success());
        assertFalse(success.ambiguous());
        when(provider.depositPlayer(player, 100)).thenThrow(new IllegalStateException("unknown result"));
        assertTrue(hook.tryDeposit(player, 100).ambiguous());
    }
}
