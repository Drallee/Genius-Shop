package me.dralle.shop.data;

import me.dralle.shop.ShopPlugin;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.UUID;

public class DataManager {

    private final ShopPlugin plugin;
    private final File dataFile;
    private FileConfiguration dataConfig;

    public DataManager(ShopPlugin plugin) {
        this.plugin = plugin;
        this.dataFile = new File(plugin.getDataFolder(), "data.yml");
        load();
    }

    public void load() {
        if (!dataFile.exists()) {
            try {
                dataFile.createNewFile();
            } catch (IOException e) {
                plugin.getLogger().severe("Could not create data.yml!");
            }
        }
        dataConfig = YamlConfiguration.loadConfiguration(dataFile);
    }

    public void save() {
        try {
            dataConfig.save(dataFile);
        } catch (IOException e) {
            plugin.getLogger().severe("Could not save data.yml!");
        }
    }

    public int getPlayerCount(UUID uuid, String itemKey) {
        return dataConfig.getInt("players." + uuid.toString() + "." + itemKey, 0);
    }

    public void incrementPlayerCount(UUID uuid, String itemKey, int amount) {
        int current = getPlayerCount(uuid, itemKey);
        dataConfig.set("players." + uuid.toString() + "." + itemKey, current + amount);
        save();
    }

    public int getGlobalCount(String itemKey) {
        return dataConfig.getInt("global." + itemKey, 0);
    }

    public void incrementGlobalCount(String itemKey, int amount) {
        int current = getGlobalCount(itemKey);
        dataConfig.set("global." + itemKey, current + amount);
        save();
    }
}
