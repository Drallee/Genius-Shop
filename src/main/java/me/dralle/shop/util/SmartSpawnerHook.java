package me.dralle.shop.util;

import org.bukkit.Material;
import org.bukkit.entity.EntityType;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;

import java.util.Locale;

public final class SmartSpawnerHook {
    private SmartSpawnerHook() {
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
