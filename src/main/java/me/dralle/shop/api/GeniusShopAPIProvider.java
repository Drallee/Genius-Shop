package me.dralle.shop.api;

/**
 * Provider class for the Genius-Shop API.
 * Other plugins should use this to get the API instance.
 */
public final class GeniusShopAPIProvider {

    private static GeniusShopAPI api;

    private GeniusShopAPIProvider() {}

    /**
     * Gets the Genius-Shop API instance.
     * @return The API instance, or null if not initialized
     */
    public static GeniusShopAPI getAPI() {
        return api;
    }

    /**
     * Sets the API instance. Internal use only.
     * @param instance The API implementation
     */
    public static void setAPI(GeniusShopAPI instance) {
        api = instance;
    }
}
