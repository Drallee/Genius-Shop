package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.util.ShopItemUtil;
import org.bukkit.Material;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;

import java.util.*;

public record ShopLayout(int rows, List<Integer> contentSlots, List<Integer> emptySlots, Map<Control, Integer> controls, Map<String, Object> appearance) {
    public static FileConfiguration settings(FileConfiguration shared, org.bukkit.configuration.ConfigurationSection override) {
        var result = new org.bukkit.configuration.file.YamlConfiguration();
        shared.getValues(true).forEach((path, value) -> {
            if (!(value instanceof org.bukkit.configuration.ConfigurationSection)) result.set(path, value);
        });
        if (override != null) override.getValues(true).forEach((path, value) -> {
            if (!(value instanceof org.bukkit.configuration.ConfigurationSection)) {
                result.set(path.startsWith("buttons.") ? "gui." + path.substring(8) : "gui.layout." + path, value);
            }
        });
        return result;
    }

    public static ShopLayout forShop(FileConfiguration shared, me.dralle.shop.model.ShopData shop, boolean discovery) {
        return of(settings(shared, shop.getLayout()), shop.getRows(), discovery);
    }

    public static ShopLayout forDiscovery(FileConfiguration shared, me.dralle.shop.discovery.ItemDiscoveryService.Mode mode) {
        var override = shared.getConfigurationSection("gui.discovery." + mode.name().toLowerCase(Locale.ROOT));
        return of(settings(shared, override), 5, true);
    }

    private FileConfiguration config() {
        var result = new org.bukkit.configuration.file.YamlConfiguration();
        appearance.forEach(result::set);
        return result;
    }
    public enum Control {
        SEARCH("search-button", Material.COMPASS, "discovery.search", 0),
        FAVORITES("favorites-button", Material.NETHER_STAR, "discovery.favorites", 1),
        RECENT("recent-button", Material.CLOCK, "discovery.recent", 2),
        PREVIOUS("prev-button", Material.GRAY_DYE, "menus.gui-settings.prev-button.name", 3),
        BACK("back-button", Material.ENDER_CHEST, "menus.gui-settings.back-button.name", 4),
        NEXT("next-button", Material.LIME_DYE, "menus.gui-settings.next-button.name", 5);

        final String key;
        final Material material;
        final String name;
        final int offset;
        Control(String key, Material material, String name, int offset) {
            this.key = key; this.material = material; this.name = name; this.offset = offset;
        }
        public String path() { return "gui." + key; }
    }

    public static ShopLayout of(FileConfiguration config, int shopRows, boolean discovery) {
        int configured = config.getInt("gui.layout.rows", 0);
        int rows = configured >= 1 && configured <= 6 ? configured : Math.min(6, Math.max(1, shopRows) + 1);
        int size = rows * 9;
        Map<Control, Integer> controls = new LinkedHashMap<>();
        for (Control control : Control.values()) {
            if (control.offset < 3 && !discovery || !config.getBoolean(control.path() + ".enabled", true)) continue;
            int slot = config.getInt(control.path() + ".slot", -1);
            if (slot < 0 || slot >= size) slot = size - 9 + control.offset;
            if (!controls.containsValue(slot)) controls.put(control, slot);
        }
        List<Integer> requested = config.getIntegerList("gui.layout.content-slots");
        List<Integer> empty = new ArrayList<>(config.getIntegerList("gui.layout.empty-slots").stream()
                .filter(slot -> slot >= 0 && slot < size && !controls.containsValue(slot)).distinct().toList());
        LinkedHashSet<Integer> content = new LinkedHashSet<>();
        if (requested.isEmpty()) {
            for (int slot = 0; slot < Math.max(1, rows - 1) * 9; slot++) if (!controls.containsValue(slot) && !empty.contains(slot)) content.add(slot);
        } else for (int slot : requested) if (slot >= 0 && slot < size && !controls.containsValue(slot) && !empty.contains(slot)) content.add(slot);
        if (content.isEmpty()) for (int slot = 0; slot < size; slot++) if (!controls.containsValue(slot) && !empty.contains(slot)) content.add(slot);
        if (content.isEmpty()) for (int slot = 0; slot < size; slot++) if (!controls.containsValue(slot)) {
            empty.remove(Integer.valueOf(slot));
            content.add(slot);
            break;
        }
        Map<String, Object> appearance = new LinkedHashMap<>();
        config.getValues(true).forEach((path, value) -> {
            if (!(value instanceof org.bukkit.configuration.ConfigurationSection)) appearance.put(path, value);
        });
        return new ShopLayout(rows, List.copyOf(content), List.copyOf(empty), Collections.unmodifiableMap(controls), Collections.unmodifiableMap(appearance));
    }

    public int size() { return rows * 9; }
    public int capacity() { return contentSlots.size(); }
    public int slot(Control control) { return controls.getOrDefault(control, -1); }
    public Control controlAt(int slot) {
        return controls.entrySet().stream().filter(entry -> entry.getValue() == slot).map(Map.Entry::getKey).findFirst().orElse(null);
    }

    public static ItemStack button(ShopPlugin plugin, Control control) {
        return item(plugin, plugin.getMenuManager().getGuiSettingsConfig(), control.path(), control.material, control.name);
    }

    public ItemStack configuredButton(ShopPlugin plugin, Control control) {
        return item(plugin, config(), control.path(), control.material, control.name);
    }

    public void fill(ShopPlugin plugin, Inventory inventory) {
        var config = config();
        ItemStack filler = config.getBoolean("gui.layout.filler.enabled", false)
                ? item(plugin, config, "gui.layout.filler", Material.YELLOW_STAINED_GLASS_PANE, " ") : null;
        String mode = config.getString("gui.layout.empty-area", "air");
        ItemStack placeholder = mode.equals("filler") ? filler : mode.equals("item") && config.getBoolean("gui.layout.empty-item.enabled", true)
                ? item(plugin, config, "gui.layout.empty-item", Material.GRAY_STAINED_GLASS_PANE, " ") : null;
        for (int slot = 0; slot < Math.min(size(), inventory.getSize()); slot++) {
            if (emptySlots.contains(slot) || controls.containsValue(slot)) continue;
            ItemStack background = contentSlots.contains(slot) ? placeholder : filler;
            if (background != null) inventory.setItem(slot, background.clone());
        }
    }

    private static ItemStack item(ShopPlugin plugin, FileConfiguration config, String path, Material fallback, String fallbackName) {
        Material material = ShopItemUtil.getMaterial(config.getString(path + ".material"), fallback);
        if (!material.isItem() || material.isAir()) material = fallback;
        String name = plugin.getMessages().resolveConfigString(config, path + ".name", fallbackName);
        List<String> lore = plugin.getMessages().resolveConfigStringList(config, path + ".lore");
        ItemStack item = ShopItemUtil.create(material, Math.max(1, Math.min(64, config.getInt(path + ".amount", 1))), name, lore);
        var meta = item.getItemMeta();
        if (meta != null) {
            if (config.getBoolean(path + ".hide-attributes", true)) meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
            if (config.getBoolean(path + ".hide-additional", true)) meta.addItemFlags(ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
            if (config.getBoolean(path + ".hide-enchants", false)) meta.addItemFlags(ItemFlag.HIDE_ENCHANTS);
            item.setItemMeta(meta);
        }
        return item;
    }

    public static List<String> validate(FileConfiguration config, int shopRows) {
        List<String> errors = new ArrayList<>();
        Object rawRows = config.get("gui.layout.rows");
        if (rawRows != null && (!(rawRows instanceof Number number) || number.doubleValue() != number.intValue() || number.intValue() < 0 || number.intValue() > 6)) errors.add("gui.layout.rows must be 0 (automatic) or 1-6");
        ShopLayout layout = of(config, shopRows, true);
        Set<Integer> reserved = new HashSet<>();
        for (Control control : Control.values()) {
            if (!config.getBoolean(control.path() + ".enabled", true)) continue;
            Object raw = config.get(control.path() + ".slot");
            int slot = config.getInt(control.path() + ".slot", -1);
            if (raw != null && (!(raw instanceof Number number) || number.doubleValue() != number.intValue() || slot < -1 || slot >= layout.size())) errors.add(control.path() + ".slot must be -1 (automatic) or within the inventory");
            int resolved = slot < 0 || slot >= layout.size() ? layout.size() - 9 + control.offset : slot;
            if (!reserved.add(resolved)) errors.add("gui: multiple navigation/discovery buttons use slot " + resolved);
            validateItem(config, control.path(), errors);
        }
        Object rawSlots = config.get("gui.layout.content-slots");
        if (rawSlots != null && !(rawSlots instanceof List<?>)) errors.add("gui.layout.content-slots must be a list");
        if (rawSlots instanceof List<?> slots) {
            Set<Integer> seen = new HashSet<>();
            for (Object value : slots) {
                if (!(value instanceof Number number) || number.doubleValue() != number.intValue() || number.intValue() < 0 || number.intValue() >= layout.size()) errors.add("gui.layout.content-slots contains an invalid slot");
                else if (!seen.add(number.intValue()) || reserved.contains(number.intValue())) errors.add("gui.layout.content-slots overlaps a button or contains a duplicate slot: " + value);
            }
        }
        if (config.getBoolean("gui.layout.filler.enabled", false)) validateItem(config, "gui.layout.filler", errors);
        if (!List.of("air", "filler", "item").contains(config.getString("gui.layout.empty-area", "air"))) errors.add("gui.layout.empty-area must be air, filler, or item");
        if (config.getString("gui.layout.empty-area", "air").equals("item")) validateItem(config, "gui.layout.empty-item", errors);
        Object rawEmpty = config.get("gui.layout.empty-slots");
        if (rawEmpty != null && !(rawEmpty instanceof List<?>)) errors.add("gui.layout.empty-slots must be a list");
        if (rawEmpty instanceof List<?> slots) {
            Set<Integer> seen = new HashSet<>();
            for (Object value : slots) {
                if (!(value instanceof Number number) || number.doubleValue() != number.intValue() || number.intValue() < 0 || number.intValue() >= layout.size()) errors.add("gui.layout.empty-slots contains an invalid slot");
                else if (!seen.add(number.intValue()) || reserved.contains(number.intValue()) || config.getIntegerList("gui.layout.content-slots").contains(number.intValue())) errors.add("gui.layout.empty-slots overlaps an item/button or contains a duplicate: " + value);
            }
            if (seen.size() + reserved.size() >= layout.size()) errors.add("gui.layout must contain at least one item slot");
        }
        if (layout.capacity() == 0) errors.add("gui.layout must contain at least one item slot");
        return errors;
    }

    private static void validateItem(FileConfiguration config, String path, List<String> errors) {
        if (config.contains(path + ".material")) {
            Material material = Material.matchMaterial(config.getString(path + ".material", ""));
            if (material == null || !material.isItem() || material.isAir()) errors.add(path + ".material must be a valid item material");
        }
        if (config.contains(path + ".amount")) {
            Object amount = config.get(path + ".amount");
            if (!(amount instanceof Number number) || number.doubleValue() != number.intValue() || number.intValue() < 1 || number.intValue() > 64) errors.add(path + ".amount must be an integer between 1 and 64");
        }
    }
}
