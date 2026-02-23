package me.dralle.shop.metrics;

import org.bstats.bukkit.Metrics;

public class MetricsWrapper {

    private final Metrics metrics;

    public MetricsWrapper(Metrics metrics) {
        this.metrics = metrics;
    }

    public Metrics getMetrics() {
        return metrics;
    }
}
