package me.dralle.shop.data;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.discovery.ItemReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.*;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PlayerItemHistoryTest {
    @TempDir Path root;
    private final UUID player = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();

    private DataManager open() {
        ShopPlugin plugin = mock(ShopPlugin.class);
        when(plugin.getDataFolder()).thenReturn(root.toFile());
        when(plugin.getLogger()).thenReturn(Logger.getLogger("history-test"));
        return new DataManager(plugin);
    }

    private ItemReference item(int index) { return new ItemReference("blocks", "%064x".formatted(index), index); }

    @Test void favoritesAreIdempotentIsolatedAndPersistWithoutAShutdownFlush() {
        DataManager data = open();
        try {
            assertTrue(data.setFavorite(player, item(1), true));
            assertTrue(data.setFavorite(player, item(1), true));
            assertTrue(data.setFavorite(other, item(2), true));
            DataManager reopened = open();
            try {
                assertEquals(List.of(item(1)), reopened.getFavorites(player));
                assertEquals(List.of(item(2)), reopened.getFavorites(other));
            } finally { reopened.close(); }
            assertTrue(data.setFavorite(player, item(1), false));
            assertTrue(data.getFavorites(player).isEmpty());
            assertEquals(List.of(item(2)), data.getFavorites(other));
        } finally { data.close(); }
    }

    @Test void recentItemsAreDeduplicatedOrderedBoundedAndPersistAcrossRestart() {
        DataManager data = open();
        for (int i = 0; i < 40; i++) data.recordRecentItem(player, item(i));
        data.recordRecentItem(player, item(12));
        data.recordRecentItem(other, item(0));
        assertEquals(DataManager.MAX_RECENT_ITEMS, data.getRecentItems(player).size());
        assertEquals(item(12), data.getRecentItems(player).getFirst());
        assertEquals(item(39), data.getRecentItems(player).get(1));
        data.close();
        DataManager reopened = open();
        try {
            assertEquals(item(12), reopened.getRecentItems(player).getFirst());
            assertEquals(30, reopened.getRecentItems(player).size());
            assertEquals(List.of(item(0)), reopened.getRecentItems(other));
            assertTrue(reopened.clearPersonalItems(player, false));
            assertTrue(reopened.getRecentItems(player).isEmpty());
            assertEquals(List.of(item(0)), reopened.getRecentItems(other));
        } finally { reopened.close(); }
    }

    @Test void favoriteLimitAndClearingDoNotAffectStockOrOtherPlayers() {
        DataManager data = open();
        try {
            data.incrementGlobalCount("stone", 7);
            for (int i = 0; i < DataManager.MAX_FAVORITES; i++) assertTrue(data.setFavorite(player, item(i), true));
            assertFalse(data.setFavorite(player, item(101), true));
            assertTrue(data.setFavorite(player, item(0), true));
            assertTrue(data.setFavorite(other, item(101), true));
            assertTrue(data.clearPersonalItems(player, true));
            assertTrue(data.getFavorites(player).isEmpty());
            assertEquals(List.of(item(101)), data.getFavorites(other));
            assertEquals(7, data.getGlobalCount("stone"));
            assertTrue(data.setFavorite(player, item(101), true));
        } finally { data.close(); }
    }

    @Test void closedStorageFailsGracefullyWithoutReportingASuccessfulFavoriteSave() {
        DataManager data = open(); data.close();
        assertFalse(data.setFavorite(player, item(1), true));
        assertFalse(data.clearPersonalItems(player, true));
        assertTrue(data.getFavorites(player).isEmpty());
        assertDoesNotThrow(() -> data.recordRecentItem(player, item(1)));
    }
}
