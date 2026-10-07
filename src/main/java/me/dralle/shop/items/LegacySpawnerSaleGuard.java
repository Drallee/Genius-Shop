package me.dralle.shop.items;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.event.Cancellable;
import org.bukkit.event.Event;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;
import java.util.concurrent.locks.Lock;

/** Older native sales release their locks during async calculation; reject stale snapshots before payment. */
final class LegacySpawnerSaleGuard {
    private static final Map<Plugin, Plugin> INSTALLED = new WeakHashMap<>();

    private LegacySpawnerSaleGuard() {}

    static void install(Plugin owner, Plugin smartSpawner, Object manager, Class<? extends Event> eventType)
            throws ReflectiveOperationException {
        if (INSTALLED.get(smartSpawner) == owner) return;
        Method location = eventType.getMethod("getLocation");
        Method items = eventType.getMethod("getItems");
        Method lookup = manager.getClass().getMethod("getSpawnerByLocation", Location.class);
        Bukkit.getPluginManager().registerEvent(eventType, new Listener() {}, EventPriority.HIGHEST,
                (listener, event) -> {
                    Cancellable sale = (Cancellable) event;
                    try {
                        Object spawner = lookup.invoke(manager, location.invoke(event));
                        if (spawner == null || !hasStoredItems(spawner, (List<?>) items.invoke(event))) sale.setCancelled(true);
                    } catch (ReflectiveOperationException | RuntimeException | LinkageError ex) {
                        sale.setCancelled(true);
                        owner.getLogger().warning("Rejected a legacy SmartSpawner sale: " + ex.getMessage());
                    }
                }, owner, true);
        INSTALLED.put(smartSpawner, owner);
    }

    static boolean hasStoredItems(Object spawner, List<?> sold) throws ReflectiveOperationException {
        if (sold == null || sold.isEmpty()) return false;
        Object inventoryLock = call(spawner, "getInventoryLock");
        if (!(inventoryLock instanceof Lock lock) || !lock.tryLock()) return false;
        try {
            Object inventory = call(spawner, "getVirtualInventory");
            Map<?, ?> stored = (Map<?, ?>) call(inventory, "getConsolidatedItems");
            List<ItemStack> templates = new ArrayList<>();
            List<Long> available = new ArrayList<>();
            for (var entry : stored.entrySet()) {
                if (!(entry.getValue() instanceof Long count) || count < 0) return false;
                templates.add((ItemStack) call(entry.getKey(), "getTemplate"));
                available.add(count);
            }
            for (Object value : sold) {
                if (!(value instanceof ItemStack item) || item.getAmount() <= 0) return false;
                boolean matched = false;
                for (int index = 0; index < templates.size(); index++) {
                    if (!templates.get(index).isSimilar(item)) continue;
                    long remaining = available.get(index) - item.getAmount();
                    if (remaining < 0) return false;
                    available.set(index, remaining);
                    matched = true;
                    break;
                }
                if (!matched) return false;
            }
            return true;
        } finally { lock.unlock(); }
    }

    private static Object call(Object target, String method) throws ReflectiveOperationException {
        return target.getClass().getMethod(method).invoke(target);
    }
}
