package me.dralle.shop.util;

import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class YamlUtil {

    public static YamlConfiguration loadUtf8(File file) {
        YamlConfiguration config = new YamlConfiguration();
        try (InputStreamReader reader = new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8)) {
            config.load(reader);
        } catch (IOException | InvalidConfigurationException e) {
            e.printStackTrace();
        }
        return config;
    }

    public static void saveUtf8(YamlConfiguration config, File file) throws IOException {
        try (java.io.OutputStreamWriter writer = new java.io.OutputStreamWriter(new java.io.FileOutputStream(file), StandardCharsets.UTF_8)) {
            writer.write(config.saveToString());
        }
    }
}
