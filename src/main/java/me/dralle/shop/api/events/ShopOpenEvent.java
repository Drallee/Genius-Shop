package me.dralle.shop.api.events;

import me.dralle.shop.model.ShopData;
import org.bukkit.entity.Player;
import org.bukkit.event.Cancellable;
import org.bukkit.event.HandlerList;
import org.bukkit.event.player.PlayerEvent;

/**
 * Called when a player attempts to open a shop.
 * Can be cancelled to prevent the shop from opening.
 */
public class ShopOpenEvent extends PlayerEvent implements Cancellable {
    private static final HandlerList HANDLERS = new HandlerList();
    private final ShopData shop;
    private boolean cancelled = false;

    public ShopOpenEvent(Player player, ShopData shop) {
        super(player);
        this.shop = shop;
    }

    public ShopData getShop() {
        return shop;
    }

    @Override
    public boolean isCancelled() {
        return cancelled;
    }

    @Override
    public void setCancelled(boolean cancel) {
        this.cancelled = cancel;
    }

    @Override
    public HandlerList getHandlers() {
        return HANDLERS;
    }

    public static HandlerList getHandlerList() {
        return HANDLERS;
    }
}
