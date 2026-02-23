package me.dralle.shop.api;

import me.dralle.shop.model.ShopItem;

/**
 * Represents a resolved price lookup result for a shop item.
 */
public class PriceLookupResult {

    private final String shopKey;
    private final ShopItem shopItem;
    private final double price;

    public PriceLookupResult(String shopKey, ShopItem shopItem, double price) {
        this.shopKey = shopKey;
        this.shopItem = shopItem;
        this.price = price;
    }

    public String getShopKey() {
        return shopKey;
    }

    public ShopItem getShopItem() {
        return shopItem;
    }

    public double getPrice() {
        return price;
    }
}
