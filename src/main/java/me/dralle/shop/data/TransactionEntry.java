package me.dralle.shop.data;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record TransactionEntry(UUID id, UUID operationId, Instant timestamp, UUID playerId,
                               String playerName, Type type, String shop, String item,
                               int quantity, double unitPrice, double total) {
    public enum Type { PURCHASE, SALE, WAND_SALE }

    public TransactionEntry {
        Objects.requireNonNull(id);
        Objects.requireNonNull(operationId);
        Objects.requireNonNull(timestamp);
        Objects.requireNonNull(playerId);
        Objects.requireNonNull(playerName);
        Objects.requireNonNull(type);
        Objects.requireNonNull(shop);
        Objects.requireNonNull(item);
        if (timestamp.toEpochMilli() < 0 || quantity <= 0 || !Double.isFinite(unitPrice)
                || !Double.isFinite(total) || unitPrice < 0 || total < 0) {
            throw new IllegalArgumentException("Invalid transaction quantity, timestamp, or price");
        }
    }

    public record Line(String shop, String item, int quantity, double total) {}
}
