package me.dralle.shop.discovery;

import me.dralle.shop.MessageManager;
import me.dralle.shop.ShopManager;
import me.dralle.shop.ShopPlugin;
import me.dralle.shop.data.DataManager;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ItemDiscoveryServiceTest {
    private ShopPlugin plugin;
    private Player player;
    private ItemDiscoveryService service;
    private DataManager data;
    private final Map<String, ShopData> shops = new LinkedHashMap<>();
    private final List<ItemReference> favorites = new ArrayList<>();
    private final Set<String> permissions = new HashSet<>();

    @BeforeEach void setup() {
        plugin = mock(ShopPlugin.class);
        player = mock(Player.class);
        when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        when(player.hasPermission(anyString())).thenAnswer(call -> permissions.contains(call.getArgument(0)));
        permissions.add("geniusshop.use");
        World world = mock(World.class);
        when(world.getName()).thenReturn("world");
        when(player.getWorld()).thenReturn(world);
        ShopManager catalog = mock(ShopManager.class);
        when(plugin.getShopManager()).thenReturn(catalog);
        when(catalog.getShopKeys()).thenAnswer(call -> shops.keySet());
        when(catalog.getShop(anyString())).thenAnswer(call -> shops.get(call.getArgument(0)));
        MessageManager messages = mock(MessageManager.class);
        when(plugin.getMessages()).thenReturn(messages);
        when(messages.getMessage(anyString())).thenAnswer(call -> call.getArgument(0));
        when(messages.resolveConfiguredString(any(), anyString())).thenAnswer(call -> call.getArgument(0) == null ? call.getArgument(1) : call.getArgument(0));
        data = mock(DataManager.class);
        when(plugin.getDataManager()).thenReturn(data);
        when(data.getFavorites(player.getUniqueId())).thenAnswer(call -> List.copyOf(favorites));
        when(data.setFavorite(eq(player.getUniqueId()), any(), anyBoolean())).thenAnswer(call -> {
            ItemReference ref = call.getArgument(1);
            if (call.getArgument(2, Boolean.class)) favorites.add(ref); else favorites.remove(ref);
            return true;
        });
        service = new ItemDiscoveryService(plugin);
    }

    private ShopItem item(Material material, String name, int slot) {
        ShopItem item = mock(ShopItem.class);
        when(item.getMaterial()).thenReturn(material);
        when(item.getName()).thenReturn(name);
        when(item.getSlot()).thenReturn(slot);
        when(item.getUniqueKey()).thenReturn(material.name());
        return item;
    }
    private ShopData shop(String key, ShopItem... items) {
        ShopData shop = mock(ShopData.class);
        when(shop.getKey()).thenReturn(key);
        when(shop.getItems()).thenReturn(List.of(items));
        shops.put(key, shop);
        return shop;
    }

    @Test void searchMatchesFormattedDisplayAndNamespacedMaterialNames() {
        ShopItem sword = item(Material.DIAMOND_SWORD, "<gradient:#ffffff:#000000>&bRoyal Blade</gradient>", 0);
        shop("weapons", sword, item(Material.STONE, "Building Stone", 1));
        for (String query : List.of("royal", "ROYAL blade", "diamond_sword", "minecraft:diamond_sword", "diamond blade")) {
            assertEquals(List.of(sword), service.list(player, ItemDiscoveryService.Mode.SEARCH, query).stream().map(ItemDiscoveryService.Entry::item).toList(), query);
        }
        assertTrue(service.list(player, ItemDiscoveryService.Mode.SEARCH, "iron").isEmpty());
    }

    @Test void inaccessibleShopsItemsAndConditionsNeverAppear() {
        ShopItem allowed = item(Material.STONE, "Allowed", 0);
        ShopItem locked = item(Material.DIAMOND, "Locked", 1);
        when(locked.getPermission()).thenReturn("vip.item");
        ShopItem level = item(Material.EMERALD, "Level", 2);
        when(level.getMinPlayerLevel()).thenReturn(10);
        ShopItem timed = item(Material.GOLD_INGOT, "Timed", 3);
        when(timed.getAvailableTimes()).thenReturn(List.of("00:00-00:00"));
        shop("public", allowed, locked, level);
        ShopData secret = shop("secret", item(Material.NETHER_STAR, "Secret", 0));
        when(secret.getPermission()).thenReturn("vip.shop");
        assertEquals(List.of(allowed), service.list(player, ItemDiscoveryService.Mode.SEARCH, "").stream().map(ItemDiscoveryService.Entry::item).toList());
        permissions.clear();
        assertTrue(service.list(player, ItemDiscoveryService.Mode.SEARCH, "").isEmpty());
    }

    @Test void sameMaterialInDifferentShopsAndSlotsResolvesToTheExactEntry() {
        ShopItem a = item(Material.STONE, "Stone", 2), b = item(Material.STONE, "Stone", 9), c = item(Material.STONE, "Stone", 2);
        shop("a", a, b); shop("b", c);
        ItemReference aRef = ItemReference.of("a", a), bRef = ItemReference.of("a", b), cRef = ItemReference.of("b", c);
        assertNotEquals(aRef, bRef); assertNotEquals(aRef, cRef);
        assertSame(a, service.resolve(player, aRef).item());
        assertSame(b, service.resolve(player, bRef).item());
        assertSame(c, service.resolve(player, cRef).item());
    }

    @Test void priceChangesAndUniqueMovesSurviveButReplacementsAndAmbiguityDoNot() {
        ShopItem original = item(Material.STONE, "Stone", 0);
        shop("a", original);
        ItemReference ref = ItemReference.of("a", original);
        ShopItem moved = item(Material.STONE, "Stone", 8);
        when(moved.getPrice()).thenReturn(100D);
        shop("a", moved);
        assertSame(moved, service.resolve(player, ref).item());
        shop("a", item(Material.DIAMOND, "Different", 0));
        assertNull(service.resolve(player, ref));
        shop("a", moved, item(Material.STONE, "Stone", 9));
        assertNull(service.resolve(player, ref));
        shops.clear();
        assertNull(service.resolve(player, ref));
    }

    @Test void favoritesCanBeRemovedAfterMovingAndRestrictedFavoritesAreRetained() {
        ShopItem original = item(Material.STONE, "Stone", 0);
        ShopData shop = shop("a", original);
        ItemReference ref = ItemReference.of("a", original);
        assertTrue(service.toggleFavorite(player, ref));
        when(shop.getPermission()).thenReturn("vip");
        assertTrue(service.list(player, ItemDiscoveryService.Mode.FAVORITES, "").isEmpty());
        assertEquals(List.of(ref), favorites);
        ShopItem moved = item(Material.STONE, "Stone", 5);
        shop("a", moved);
        assertTrue(service.toggleFavorite(player, ItemReference.of("a", moved)));
        assertTrue(favorites.isEmpty());
    }

    @Test void tradeGuardRejectsRevocationRemovalConditionsAndReloadButResolvesDuplicateKeysCorrectly() {
        ShopItem a = item(Material.STONE, "Stone", 0), b = item(Material.STONE, "Stone", 1);
        ShopData shop = shop("a", a, b);
        service.bindTrade(player, "buy", "a", a);
        assertSame(a, service.transactionItem(player, "buy", "a", "STONE"));
        assertTrue(service.guardTrade(player, "buy", "a", "STONE"));
        when(shop.getPermission()).thenReturn("vip");
        assertFalse(service.guardTrade(player, "buy", "a", "STONE"));
        permissions.add("vip");
        when(a.getMinPlayerLevel()).thenReturn(5);
        assertFalse(service.guardTrade(player, "buy", "a", "STONE"));
        when(player.getLevel()).thenReturn(10);
        assertTrue(service.guardTrade(player, "buy", "a", "STONE"));
        shop("a", a, b);
        assertFalse(service.guardTrade(player, "buy", "a", "STONE"));
        shops.clear();
        assertFalse(service.guardTrade(player, "buy", "a", "STONE"));
        verify(player, atLeastOnce()).closeInventory();
        verifyNoInteractions(data);
    }

    @Test void recentRecordsAreScopedToTheResolvedShopAndVariantsStayDistinct() {
        ShopItem item = item(Material.STONE, "Stone", 0);
        when(item.getVariantKey()).thenReturn("smooth");
        shop("a", item);
        service.recordRecent(player, "a", item);
        verify(data).recordRecentItem(player.getUniqueId(), ItemReference.of("a", item));
        ShopItem variant = item(Material.STONE, "Stone", 0);
        when(variant.getVariantKey()).thenReturn("rough");
        assertNotEquals(ItemReference.of("a", item), ItemReference.of("a", variant));
    }

    @Test void movedRecentReferencesDoNotProduceDuplicateVisibleResults() {
        ShopItem moved = item(Material.STONE, "Stone", 5);
        shop("a", moved);
        ItemReference current = ItemReference.of("a", moved);
        ItemReference previous = new ItemReference("a", current.fingerprint(), 1);
        when(data.getRecentItems(player.getUniqueId())).thenReturn(List.of(current, previous));
        assertEquals(1, service.list(player, ItemDiscoveryService.Mode.RECENT, "").size());
    }
}
