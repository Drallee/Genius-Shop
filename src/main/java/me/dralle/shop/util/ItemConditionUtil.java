package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopItem;
import org.bukkit.GameMode;
import org.bukkit.entity.Player;

import java.util.List;
import java.util.Locale;

public final class ItemConditionUtil {

    private ItemConditionUtil() {}

    public record ConditionResult(boolean allowed, String message) {
        public static ConditionResult ok() {
            return new ConditionResult(true, null);
        }
    }

    public static ConditionResult check(ShopPlugin plugin, Player player, ShopItem item) {
        if (player == null || item == null) return ConditionResult.ok();

        if (item.getMinPlayerLevel() > 0 && player.getLevel() < item.getMinPlayerLevel()) {
            return new ConditionResult(false, plugin.getMessages().getMessage("condition-level-min")
                    .replace("%level%", String.valueOf(item.getMinPlayerLevel())));
        }
        if (item.getMaxPlayerLevel() > 0 && player.getLevel() > item.getMaxPlayerLevel()) {
            return new ConditionResult(false, plugin.getMessages().getMessage("condition-level-max")
                    .replace("%level%", String.valueOf(item.getMaxPlayerLevel())));
        }

        String world = player.getWorld().getName();
        List<String> allowedWorlds = item.getAllowedWorlds();
        if (allowedWorlds != null && !allowedWorlds.isEmpty()) {
            boolean matched = allowedWorlds.stream().anyMatch(w -> w != null && w.equalsIgnoreCase(world));
            if (!matched) {
                return new ConditionResult(false, plugin.getMessages().getMessage("condition-world-not-allowed"));
            }
        }

        List<String> deniedWorlds = item.getDeniedWorlds();
        if (deniedWorlds != null && !deniedWorlds.isEmpty()) {
            boolean denied = deniedWorlds.stream().anyMatch(w -> w != null && w.equalsIgnoreCase(world));
            if (denied) {
                return new ConditionResult(false, plugin.getMessages().getMessage("condition-world-denied"));
            }
        }

        String requiredGamemode = item.getRequiredGamemode();
        if (requiredGamemode != null && !requiredGamemode.isBlank()) {
            String gmUpper = requiredGamemode.trim().toUpperCase(Locale.ROOT);
            try {
                GameMode expected = GameMode.valueOf(gmUpper);
                if (player.getGameMode() != expected) {
                    return new ConditionResult(false, plugin.getMessages().getMessage("condition-gamemode-required")
                            .replace("%gamemode%", expected.name()));
                }
            } catch (IllegalArgumentException ignored) {
                // Invalid config value -> ignore silently to avoid hard-breaking shops.
            }
        }

        return ConditionResult.ok();
    }
}

