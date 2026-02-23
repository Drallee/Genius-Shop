package me.dralle.shop.api.events;

import me.dralle.shop.model.ShopItem;
import org.bukkit.entity.Player;
import org.bukkit.event.HandlerList;

/**
 * Called after a player successfully purchases an item from a shop.
 */
public class ShopPurchaseEvent extends ShopTransactionEvent {
    private static final HandlerList HANDLERS = new HandlerList();

    public ShopPurchaseEvent(Player player, ShopItem item, int amount, double totalPrice, String shopKey) {
        super(player, item, amount, totalPrice, shopKey);
    }

    @Override
    public HandlerList getHandlers() {
        return HANDLERS;
    }

    public static HandlerList getHandlerList() {
        return HANDLERS;
    }
}
