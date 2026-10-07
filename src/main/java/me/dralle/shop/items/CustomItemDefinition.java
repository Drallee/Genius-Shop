package me.dralle.shop.items;

import org.bukkit.Material;

import java.util.List;
import java.util.Map;

public record CustomItemDefinition(String id, boolean enabled, Material material, String name,
                                   List<String> lore, Map<String, Integer> enchantments, String permission,
                                   long cooldownMillis, int maxUses, Map<String, ItemAction> actions) {
    public enum ActionType { SELL_CONTAINER, OPEN_MAIN_MENU, OPEN_SHOP, OPEN_BULK_SELL_MENU, COMMAND }

    public record ItemAction(ActionType type, String shop, double multiplier, boolean useCampaigns,
                             List<String> commands, boolean console) {}
}
