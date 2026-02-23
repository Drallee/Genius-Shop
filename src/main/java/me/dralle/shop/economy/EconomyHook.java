package me.dralle.shop.economy;

import me.dralle.shop.ShopPlugin;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.RegisteredServiceProvider;

public class EconomyHook {

    private final ShopPlugin plugin;
    private Economy economy;

    // Cached symbol logic
    private String overrideSymbol;
    private String fallbackSymbol;

    public EconomyHook(ShopPlugin plugin) {
        this.plugin = plugin;

        // Read config values
        overrideSymbol = plugin.getConfig().getString("eco.override-currency-symbol", "");
        fallbackSymbol = plugin.getConfig().getString("fallback-currency-symbol", "$");

        setupEconomy();
    }

    private void setupEconomy() {
        if (plugin.getServer().getPluginManager().getPlugin("Vault") == null) {
            me.dralle.shop.util.ConsoleLog.warn(plugin, "Vault not found â€” economy features will be limited.");
            return;
        }

        RegisteredServiceProvider<Economy> rsp =
                Bukkit.getServicesManager().getRegistration(Economy.class);
        if (rsp == null) {
            me.dralle.shop.util.ConsoleLog.warn(plugin, "No Vault economy provider found!");
            return;
        }

        economy = rsp.getProvider();
        me.dralle.shop.util.ConsoleLog.info(plugin, "Detected economy provider: " + economy.getName());
    }

    public boolean isReady() {
        return economy != null;
    }

    public double getBalance(Player player) {
        if (!isReady()) return 0;
        return economy.getBalance(player);
    }

    public boolean withdraw(Player player, double amount) {
        if (!isReady()) return false;
        return economy.withdrawPlayer(player, amount).transactionSuccess();
    }

    public void deposit(Player player, double amount) {
        if (!isReady()) return;
        economy.depositPlayer(player, amount);
    }

    /**
     * Gets the name of the economy provider (e.g., "Essentials", "Vault", "None").
     */
    public String getProviderName() {
        if (economy != null) {
            return economy.getName();
        }
        return "None";
    }

    /**
     * Gets the currency symbol (e.g., "$", "â‚¬").
     * Priority:
     * 1. Config Override (if set)
     * 2. Vault (if available) - attempts to parse symbol
     * 3. Fallback (if Vault missing)
     */
    public String getCurrencySymbol() {
        // 1. Config Override
        if (overrideSymbol != null && !overrideSymbol.isEmpty()) {
            return overrideSymbol;
        }

        // 2. Vault
        if (isReady()) {
            try {
                // Attempt to extract symbol from formatted string (e.g. "$1.00" -> "$")
                String formatted = economy.format(0);
                if (formatted != null) {
                    // Remove numbers, dots, commas, and whitespace to isolate the symbol
                    return formatted.replaceAll("[0-9.,\\s]", "");
                }
            } catch (Exception ignored) {}
        }

        // 3. Fallback
        return fallbackSymbol;
    }

    /**
     * Returns the formatted price using:
     *  1. override symbol (if set)
     *  2. Vault's own economy formatting
     *  3. fallback symbol
     */
    public String format(double amount) {

        // If config override is set â†’ always use that
        if (overrideSymbol != null && !overrideSymbol.isEmpty()) {
            return overrideSymbol + trimZeros(amount);
        }

        // If Vault is available â†’ use its format
        if (isReady()) {
            try {
                return economy.format(amount);
            } catch (Exception ignored) {}
        }

        // Fallback
        return fallbackSymbol + trimZeros(amount);
    }

    /**
     * Removes trailing .0 or .00 for cleaner display
     */
    private String trimZeros(double amount) {
        if (amount == (long) amount) {
            return String.format("%d", (long) amount);
        }
        return String.format("%.2f", amount);
    }
}
