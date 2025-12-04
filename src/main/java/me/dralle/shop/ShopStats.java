package me.dralle.shop;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;

public final class ShopStats {

    private static final ConcurrentMap<String, AtomicInteger> OPENS = new ConcurrentHashMap<>();

    private ShopStats() {
        // utility class
    }

    public static void incrementOpens(String shopKey) {
        if (shopKey == null) return;
        OPENS.computeIfAbsent(shopKey, k -> new AtomicInteger(0)).incrementAndGet();
    }

    public static int getOpens(String shopKey) {
        if (shopKey == null) return 0;
        AtomicInteger ai = OPENS.get(shopKey);
        return ai != null ? ai.get() : 0;
    }
}
