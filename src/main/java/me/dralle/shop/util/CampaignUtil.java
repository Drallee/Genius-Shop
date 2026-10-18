package me.dralle.shop.util;

import me.dralle.shop.model.ShopCampaign;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

public final class CampaignUtil {

    private static final DateTimeFormatter[] SUPPORTED_FORMATS = new DateTimeFormatter[] {
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")
    };

    private CampaignUtil() {}

    public static boolean isCampaignActive(ShopItem item) {
        return isCampaignActive(item, Instant.now());
    }

    public static boolean isCampaignActive(ShopItem item, Instant now) {
        if (item == null || !item.isCampaignEnabled()) return false;

        ZoneId zone = parseZone(item.getCampaignTimezone());
        Instant start = parseDateTime(item.getCampaignStart(), zone);
        Instant end = parseDateTime(item.getCampaignEnd(), zone);

        if (start != null && now.isBefore(start)) return false;
        if (end != null && now.isAfter(end)) return false;
        return start != null || end != null;
    }

    public static double getActiveBuyMultiplier(ShopItem item) {
        if (!isCampaignActive(item)) return 1.0D;
        double m = item.getCampaignBuyMultiplier();
        return m > 0D ? m : 1.0D;
    }

    public static double getActiveSellMultiplier(ShopItem item) {
        if (!isCampaignActive(item)) return 1.0D;
        double m = item.getCampaignSellMultiplier();
        return m > 0D ? m : 1.0D;
    }

    public static double getActiveBuyMultiplier(ShopData shop, ShopItem item) {
        ShopCampaign resolved = resolveCampaign(shop, item);
        if (resolved == null) return 1.0D;
        double m = resolved.getBuyMultiplier();
        return m > 0D ? m : 1.0D;
    }

    public static double getActiveSellMultiplier(ShopData shop, ShopItem item) {
        ShopCampaign resolved = resolveCampaign(shop, item);
        if (resolved == null) return 1.0D;
        double m = resolved.getSellMultiplier();
        return m > 0D ? m : 1.0D;
    }

    public static double applyBuyCampaign(ShopItem item, double price) {
        return price * getActiveBuyMultiplier(item);
    }

    public static double applySellCampaign(ShopItem item, double price) {
        return price * getActiveSellMultiplier(item);
    }

    public static double applyBuyCampaign(ShopData shop, ShopItem item, double price) {
        return price * getActiveBuyMultiplier(shop, item);
    }

    public static double applySellCampaign(ShopData shop, ShopItem item, double price) {
        return price * getActiveSellMultiplier(shop, item);
    }

    public static ShopCampaign resolveCampaign(ShopData shop, ShopItem item) {
        return resolveCampaign(shop, item, Instant.now());
    }

    public static ShopCampaign resolveCampaign(ShopData shop, ShopItem item, Instant now) {
        if (item != null && item.isCampaignEnabled() && isCampaignActive(item, now)) {
            return new ShopCampaign(
                    "inline-item",
                    item.getCampaignName(),
                    item.getCampaignStart(),
                    item.getCampaignEnd(),
                    item.getCampaignTimezone(),
                    item.getCampaignBuyMultiplier(),
                    item.getCampaignSellMultiplier()
            );
        }

        if (shop != null && item != null && item.getCampaignKey() != null && !item.getCampaignKey().isBlank()) {
            ShopCampaign c = shop.getCampaigns() != null ? shop.getCampaigns().get(item.getCampaignKey()) : null;
            if (c != null && isCampaignActive(c, now)) {
                return c;
            }
        }

        if (shop != null && shop.getCampaignKey() != null && !shop.getCampaignKey().isBlank()) {
            ShopCampaign c = shop.getCampaigns() != null ? shop.getCampaigns().get(shop.getCampaignKey()) : null;
            if (c != null && isCampaignActive(c, now)) {
                return c;
            }
        }

        return null;
    }

    public static boolean isCampaignActive(ShopCampaign campaign) {
        return isCampaignActive(campaign, Instant.now());
    }

    public static java.util.List<Instant> boundaries(ShopData shop, ShopItem item) {
        java.util.List<ShopCampaign> campaigns = new java.util.ArrayList<>();
        if (shop != null && shop.getCampaigns() != null) campaigns.addAll(shop.getCampaigns().values());
        if (item != null && item.isCampaignEnabled()) campaigns.add(new ShopCampaign("inline", "", item.getCampaignStart(),
                item.getCampaignEnd(), item.getCampaignTimezone(), 1, 1));
        java.util.List<Instant> times = new java.util.ArrayList<>();
        for (ShopCampaign campaign : campaigns) {
            ZoneId zone = parseZone(campaign.getTimezone());
            Instant start = parseDateTime(campaign.getStart(), zone), end = parseDateTime(campaign.getEnd(), zone);
            if (start != null) { times.add(start.minusSeconds(1)); times.add(start); }
            if (end != null) { times.add(end); times.add(end.plusSeconds(1)); }
        }
        return times;
    }

    public static boolean isCampaignActive(ShopCampaign campaign, Instant now) {
        if (campaign == null) return false;
        ZoneId zone = parseZone(campaign.getTimezone());
        Instant start = parseDateTime(campaign.getStart(), zone);
        Instant end = parseDateTime(campaign.getEnd(), zone);

        if (start != null && now.isBefore(start)) return false;
        if (end != null && now.isAfter(end)) return false;
        return start != null || end != null;
    }

    private static Instant parseDateTime(String raw, ZoneId zone) {
        if (raw == null || raw.isBlank()) return null;
        String input = raw.trim();

        try {
            return Instant.parse(input);
        } catch (DateTimeParseException ignored) {}

        for (DateTimeFormatter fmt : SUPPORTED_FORMATS) {
            try {
                LocalDateTime ldt = LocalDateTime.parse(input, fmt);
                return ldt.atZone(zone).toInstant();
            } catch (DateTimeParseException ignored) {}
        }
        return null;
    }

    private static ZoneId parseZone(String zoneRaw) {
        if (zoneRaw == null || zoneRaw.isBlank()) return ZoneId.systemDefault();
        try {
            return ZoneId.of(zoneRaw.trim());
        } catch (Exception ignored) {
            return ZoneId.systemDefault();
        }
    }
}
