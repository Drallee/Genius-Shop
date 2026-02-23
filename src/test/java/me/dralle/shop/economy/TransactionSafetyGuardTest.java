package me.dralle.shop.economy;

import me.dralle.shop.MessageManager;
import me.dralle.shop.ShopPlugin;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TransactionSafetyGuardTest {

    @Test
    void rejectsInvalidValuesEvenWhenOptionalSafetyDisabled() {
        YamlConfiguration cfg = new YamlConfiguration();
        cfg.set("economy-safety.enabled", false);
        ShopPlugin plugin = mockPlugin(cfg);
        Player player = mockPlayer("Alex");

        TransactionSafetyGuard.GuardResult result = TransactionSafetyGuard.validateTransaction(
                plugin, player, TransactionSafetyGuard.ACTION_BUY, "shop_a", "item_a", Material.DIAMOND, 1,
                Double.NaN, 100D, Double.NaN, false, 0D, 0D
        );

        assertFalse(result.allowed(), "NaN money values must always be rejected.");
    }

    @Test
    void enforcesFinalFloorAndCeilingServerSide() {
        YamlConfiguration cfg = new YamlConfiguration();
        cfg.set("economy-safety.enabled", true);
        ShopPlugin plugin = mockPlugin(cfg);
        Player player = mockPlayer("Steve");

        TransactionSafetyGuard.GuardResult belowMin = TransactionSafetyGuard.validateTransaction(
                plugin, player, TransactionSafetyGuard.ACTION_BUY, "shop_a", "item_b", Material.DIAMOND, 4,
                9.99D, 10D, 39.96D, true, 10D, 50D
        );
        TransactionSafetyGuard.GuardResult aboveMax = TransactionSafetyGuard.validateTransaction(
                plugin, player, TransactionSafetyGuard.ACTION_BUY, "shop_a", "item_c", Material.DIAMOND, 4,
                50.01D, 10D, 200.04D, true, 10D, 50D
        );

        assertFalse(belowMin.allowed(), "Price below min-price must be rejected.");
        assertFalse(aboveMax.allowed(), "Price above max-price must be rejected.");
    }

    @Test
    void enforcesStepChangeAntiSpike() {
        YamlConfiguration cfg = new YamlConfiguration();
        cfg.set("economy-safety.enabled", true);
        cfg.set("economy-safety.anti-spike.enabled", true);
        cfg.set("economy-safety.anti-spike.max-step-change-ratio", 0.5D); // max 50%
        ShopPlugin plugin = mockPlugin(cfg);
        Player player = mockPlayer("Casey");

        String itemKey = "anti_spike_item";
        TransactionSafetyGuard.rememberSuccessfulUnitPrice(TransactionSafetyGuard.ACTION_BUY, itemKey, 100D);

        TransactionSafetyGuard.GuardResult jumpResult = TransactionSafetyGuard.validateTransaction(
                plugin, player, TransactionSafetyGuard.ACTION_BUY, "shop_a", itemKey, Material.EMERALD, 1,
                170D, 100D, 170D, true, 1D, 1000D
        );

        assertFalse(jumpResult.allowed(), "Large step-change should be rejected by anti-spike.");
    }

    @Test
    void largePurchaseConfirmationRequiresSecondClick() {
        YamlConfiguration cfg = new YamlConfiguration();
        cfg.set("economy-safety.enabled", true);
        cfg.set("economy-safety.large-purchase-confirmation.enabled", true);
        cfg.set("economy-safety.large-purchase-confirmation.threshold", 1000D);
        cfg.set("economy-safety.large-purchase-confirmation.timeout-seconds", 10L);
        ShopPlugin plugin = mockPlugin(cfg);
        Player player = mockPlayer("Jordan");

        TransactionSafetyGuard.GuardResult first = TransactionSafetyGuard.requireLargePurchaseConfirmation(
                plugin, player, "item_confirm", Material.DIAMOND_BLOCK, 64, 2500D
        );
        TransactionSafetyGuard.GuardResult second = TransactionSafetyGuard.requireLargePurchaseConfirmation(
                plugin, player, "item_confirm", Material.DIAMOND_BLOCK, 64, 2500D
        );

        assertFalse(first.allowed(), "First large purchase attempt should request confirmation.");
        assertTrue(second.allowed(), "Second matching click within timeout should pass.");
    }

    private ShopPlugin mockPlugin(YamlConfiguration cfg) {
        ShopPlugin plugin = mock(ShopPlugin.class);
        MessageManager messages = mock(MessageManager.class);
        when(plugin.getConfig()).thenReturn(cfg);
        when(plugin.getMessages()).thenReturn(messages);
        when(messages.getMessage(anyString())).thenAnswer(inv -> inv.getArgument(0));
        when(plugin.formatCurrency(anyDouble())).thenAnswer(invocation -> "$" + invocation.getArgument(0));
        return plugin;
    }

    private Player mockPlayer(String name) {
        Player player = mock(Player.class);
        when(player.getName()).thenReturn(name);
        when(player.getUniqueId()).thenReturn(UUID.nameUUIDFromBytes(name.getBytes()));
        return player;
    }
}
