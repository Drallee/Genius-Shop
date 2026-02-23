package me.dralle.shop.model;

public class ShopCampaign {

    private final String key;
    private final String name;
    private final String start;
    private final String end;
    private final String timezone;
    private final double buyMultiplier;
    private final double sellMultiplier;

    public ShopCampaign(String key, String name, String start, String end, String timezone, double buyMultiplier, double sellMultiplier) {
        this.key = key != null ? key : "";
        this.name = name != null ? name : "";
        this.start = start != null ? start : "";
        this.end = end != null ? end : "";
        this.timezone = timezone != null ? timezone : "";
        this.buyMultiplier = buyMultiplier;
        this.sellMultiplier = sellMultiplier;
    }

    public String getKey() {
        return key;
    }

    public String getName() {
        return name;
    }

    public String getStart() {
        return start;
    }

    public String getEnd() {
        return end;
    }

    public String getTimezone() {
        return timezone;
    }

    public double getBuyMultiplier() {
        return buyMultiplier;
    }

    public double getSellMultiplier() {
        return sellMultiplier;
    }
}
