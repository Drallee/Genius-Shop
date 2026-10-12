package me.dralle.shop.economy;

import me.dralle.shop.ShopPlugin;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class TransactionSafetyGuardTest {
    @ParameterizedTest
    @CsvSource({
            "0.5, 8600, false",
            "1.5, 8600, true",
            "1.5, 12900, true",
            "1.5, 12901, false",
            "1.5, 40650, false",
            "5, 40650, true",
            "5, 43001, false",
            "0, 40650, true"
    })
    void checksConfiguredBaseMultiplier(double multiplier, double currentPrice, boolean allowed) {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        Player player = mock(Player.class);
        YamlConfiguration config = new YamlConfiguration();
        config.set("economy-safety.anti-spike.max-base-multiplier", multiplier);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getMessages().getMessage(anyString())).thenReturn("blocked");
        when(plugin.formatCurrency(anyDouble())).thenReturn("money");

        for (String action : new String[]{TransactionSafetyGuard.ACTION_BUY, TransactionSafetyGuard.ACTION_SELL}) {
            for (int quantity : new int[]{1, 71}) {
                var result = TransactionSafetyGuard.validateTransaction(plugin, player, action,
                        "ores", "iron-block", Material.IRON_BLOCK, quantity, currentPrice,
                        8600D, currentPrice * quantity, true, 0D, 0D);
                assertEquals(allowed, result.allowed(), action + ", quantity=" + quantity);
            }
        }
    }
}
