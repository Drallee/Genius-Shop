package me.dralle.shop.config;

import me.dralle.shop.model.ShopData;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class CompiledShopCatalog {
    private final Map<String, ShopData> shops;
    private final List<ValidationMessage> validationMessages;
    private final Instant compiledAt;

    public CompiledShopCatalog(Map<String, ShopData> shops, List<ValidationMessage> validationMessages, Instant compiledAt) {
        this.shops = Collections.unmodifiableMap(new LinkedHashMap<>(shops));
        this.validationMessages = List.copyOf(validationMessages);
        this.compiledAt = compiledAt;
    }

    public Map<String, ShopData> shops() {
        return shops;
    }

    public List<ValidationMessage> validationMessages() {
        return validationMessages;
    }

    public Instant compiledAt() {
        return compiledAt;
    }
}

