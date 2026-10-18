package me.dralle.shop.util;

import org.bukkit.Material;
import org.bukkit.Bukkit;
import org.bukkit.entity.EntityType;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;

import java.util.Locale;

public final class SmartSpawnerHook {
    public record Identity(boolean managed, String type) {}
    private SmartSpawnerHook() {
    }

    public static Identity identify(ItemStack item) {
        if (item == null || item.getType() != Material.SPAWNER || Bukkit.getServer() == null) return new Identity(false, null);
        Plugin plugin = Bukkit.getPluginManager().getPlugin("SmartSpawner");
        if (plugin == null || !plugin.isEnabled()) plugin = Bukkit.getPluginManager().getPlugin("SmartSpawners");
        if (plugin == null || !plugin.isEnabled()) return new Identity(false, null);
        try {
            ClassLoader loader = plugin.getClass().getClassLoader();
            Class<?> provider = Class.forName("github.nighter.smartspawner.api.SmartSpawnerProvider", true, loader);
            Class<?> apiType = Class.forName("github.nighter.smartspawner.api.SmartSpawnerAPI", true, loader);
            Object api = provider.getMethod("getAPI").invoke(null);
            return identify(apiType, api, item);
        } catch (ReflectiveOperationException | RuntimeException | LinkageError failure) {
            return new Identity(true, null);
        }
    }

    static Identity identify(Class<?> apiType, Object api, ItemStack item) throws ReflectiveOperationException {
        if (api == null) return new Identity(true, null);
        if (Boolean.TRUE.equals(apiType.getMethod("isItemSpawner", ItemStack.class).invoke(api, item))) {
            Object material = apiType.getMethod("getItemSpawnerMaterial", ItemStack.class).invoke(api, item);
            return new Identity(true, material instanceof Material type ? "ITEM:" + type.name() : null);
        }
        if (Boolean.TRUE.equals(apiType.getMethod("isSmartSpawner", ItemStack.class).invoke(api, item))) {
            Object entity = apiType.getMethod("getSpawnerEntityType", ItemStack.class).invoke(api, item);
            return new Identity(true, entity instanceof EntityType type ? type.name() : null);
        }
        return new Identity(false, null);
    }

    public static ItemStack createSpawnerItem(Plugin plugin, String spawnerType, String spawnerItem) {
        try {
            // Load through SmartSpawner so the integration remains optional.
            ClassLoader loader = plugin.getClass().getClassLoader();
            Class<?> provider = Class.forName("github.nighter.smartspawner.api.SmartSpawnerProvider", true, loader);
            Class<?> apiType = Class.forName("github.nighter.smartspawner.api.SmartSpawnerAPI", true, loader);
            Object api = provider.getMethod("getAPI").invoke(null);
            return createSpawnerItem(apiType, api, spawnerType, spawnerItem);
        } catch (ReflectiveOperationException | LinkageError ex) {
            throw new IllegalStateException("SmartSpawner creation API is unavailable or failed", ex);
        }
    }

    static ItemStack createSpawnerItem(Class<?> apiType, Object api, String spawnerType, String spawnerItem)
            throws ReflectiveOperationException {
        if (api == null) {
            throw new IllegalStateException("SmartSpawner API is not ready");
        }

        Object result;
        if (spawnerItem != null && !spawnerItem.isBlank()) {
            Material material = Material.valueOf(spawnerItem.trim().toUpperCase(Locale.ROOT));
            result = apiType.getMethod("createItemSpawnerItem", Material.class).invoke(api, material);
        } else {
            EntityType entity = EntityType.valueOf(spawnerType.trim().toUpperCase(Locale.ROOT));
            result = apiType.getMethod("createSpawnerItem", EntityType.class).invoke(api, entity);
        }

        if (!(result instanceof ItemStack item) || item.getType() != Material.SPAWNER || item.getAmount() != 1) {
            throw new IllegalStateException("SmartSpawner API did not return a single spawner item");
        }
        return item;
    }
}
