package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.file.Files;

public class YamlUtil {

    public static YamlConfiguration loadUtf8(File file) {
        YamlConfiguration config = new YamlConfiguration();
        try {
            String source = Files.readString(file.toPath(), StandardCharsets.UTF_8);
            if (file.getParentFile() != null && file.getParentFile().getName().equals("languages")) source = normalizeLegacyLanguage(source);
            config.loadFromString(source);
        } catch (IOException | InvalidConfigurationException e) {
            ShopPlugin plugin = ShopPlugin.getInstance();
            if (plugin != null) {
                ConsoleLog.error(plugin, "Failed to load YAML file '" + file.getName() + "': " + e.getMessage(), e);
            } else {
                e.printStackTrace();
            }
        }
        return config;
    }

    public static String normalizeLegacyLanguage(String source) {
        if (!java.util.regex.Pattern.compile("[\\u0080-\\u0084\\u0086-\\u009f]").matcher(source).find()) return source;
        StringBuilder repaired = new StringBuilder();
        for (int index = 0; index < source.length();) {
            int first = legacyByte(source.charAt(index));
            int length = first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
            if (length > 0 && index + length <= source.length()) {
                byte[] bytes = new byte[length];
                bytes[0] = (byte) first;
                boolean valid = true;
                for (int offset = 1; offset < length; offset++) {
                    int next = legacyByte(source.charAt(index + offset));
                    if (next < 0x80 || next > 0xbf) { valid = false; break; }
                    bytes[offset] = (byte) next;
                }
                if (valid) {
                    try {
                        repaired.append(StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)));
                        index += length;
                        continue;
                    } catch (CharacterCodingException ignored) { }
                }
            }
            repaired.append(source.charAt(index++));
        }
        return repaired.toString();
    }

    private static int legacyByte(char value) {
        if (value <= 0xff) return value;
        Charset legacy = Charset.forName("windows-1252");
        for (int code = 0x80; code <= 0x9f; code++) {
            String decoded = new String(new byte[]{(byte) code}, legacy);
            if (decoded.charAt(0) == value && value != '\ufffd') return code;
        }
        return -1;
    }

    public static void saveUtf8(YamlConfiguration config, File file) throws IOException {
        try (java.io.OutputStreamWriter writer = new java.io.OutputStreamWriter(new java.io.FileOutputStream(file), StandardCharsets.UTF_8)) {
            writer.write(config.saveToString());
        }
    }
}
