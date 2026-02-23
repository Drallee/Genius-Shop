package me.dralle.shop.api.events;

import me.dralle.shop.model.ShopItem;
import org.bukkit.entity.Player;
import org.bukkit.event.HandlerList;
import org.bukkit.event.player.PlayerEvent;

/**
 * Base class for shop transaction events (Purchase/Sell).
 */
public abstract class ShopTransactionEvent extends PlayerEvent {

    private final ShopItem item;
    private final int amount;
    private final double totalPrice;
    private final String shopKey;

    public ShopTransactionEvent(Player player, ShopItem item, int amount, double totalPrice, String shopKey) {
        super(player);
        this.item = item;
        this.amount = amount;
        this.totalPrice = totalPrice;
        this.shopKey = shopKey;
    }

    public ShopItem getItem() {
        return item;
    }

    public int getAmount() {
        return amount;
    }

    public double getTotalPrice() {
        return totalPrice;
    }

    public String getShopKey() {
        return shopKey;
    }
}
