package me.dralle.shop.data;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface ShopStateRepository {
    int getPlayerCount(UUID uuid, String itemKey);
    void incrementPlayerCount(UUID uuid, String itemKey, int amount);
    int getGlobalCount(String itemKey);
    void incrementGlobalCount(String itemKey, int amount);
    Map<String, Integer> getAllGlobalCounts();
    List<DataManager.PlayerCountEntry> getAllPlayerCountEntries();
    List<DataManager.GlobalCountEntry> getAllGlobalCountEntries();
    List<DataManager.StockResetEntry> getAllStockResetEntries();
    void setPlayerCount(String uuid, String itemKey, int value, boolean saveNow);
    void setGlobalCount(String itemKey, int value, boolean saveNow);
    void resetGlobalCount(String itemKey, boolean saveNow);
    long getLastStockReset(String resetId);
    void setLastStockResetStored(String storedResetId, long epochMillis, boolean saveNow);
    void setLastStockReset(String resetId, long epochMillis, boolean saveNow);
    void removePlayerCount(String uuid, String itemKey);
    void removeGlobalCount(String itemKey);
    void removeStockReset(String storedResetId);
    void save();
    void close();
}

