package me.dralle.shop.stock;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Month;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;

public class StockResetRule {

    public enum Type {
        NONE,
        HOURLY,
        MINUTE_INTERVAL,
        SECOND_INTERVAL,
        DAILY,
        WEEKLY,
        MONTHLY,
        YEARLY,
        ONCE
    }

    private final boolean enabled;
    private final Type type;
    private final ZoneId zoneId;
    private final LocalTime time;
    private final DayOfWeek dayOfWeek;
    private final int dayOfMonth;
    private final Month month;
    private final int monthDay;
    private final LocalDateTime onceAt;
    private final int interval;

    public StockResetRule(
            boolean enabled,
            Type type,
            ZoneId zoneId,
            LocalTime time,
            DayOfWeek dayOfWeek,
            int dayOfMonth,
            Month month,
            int monthDay,
            LocalDateTime onceAt,
            int interval
    ) {
        this.enabled = enabled;
        this.type = type;
        this.zoneId = zoneId;
        this.time = time;
        this.dayOfWeek = dayOfWeek;
        this.dayOfMonth = dayOfMonth;
        this.month = month;
        this.monthDay = monthDay;
        this.onceAt = onceAt;
        this.interval = Math.max(1, interval);
    }

    public boolean isEnabled() {
        return enabled && type != Type.NONE;
    }

    public Type getType() {
        return type;
    }

    public boolean shouldReset(long lastRunEpochMillis, Instant nowInstant) {
        if (!isEnabled()) return false;

        ZonedDateTime now = ZonedDateTime.ofInstant(nowInstant, zoneId);
        ZonedDateTime scheduled = getMostRecentScheduledTime(now);
        if (scheduled == null) return false;

        long scheduledEpoch = scheduled.toInstant().toEpochMilli();
        return nowInstant.toEpochMilli() >= scheduledEpoch && lastRunEpochMillis < scheduledEpoch;
    }

    public Instant getNextResetInstant(Instant nowInstant, long lastRunEpochMillis) {
        if (!isEnabled()) return null;

        ZonedDateTime now = ZonedDateTime.ofInstant(nowInstant, zoneId);
        ZonedDateTime next = getNextScheduledTime(now, lastRunEpochMillis);
        return next != null ? next.toInstant() : null;
    }

    public static String formatCountdown(Instant now, Instant target) {
        if (now == null || target == null) return "";
        long seconds = Math.max(0, Duration.between(now, target).getSeconds());

        if (seconds < 60) return seconds + " second" + (seconds == 1 ? "" : "s");
        long minutes = seconds / 60;
        if (minutes < 60) return minutes + " minute" + (minutes == 1 ? "" : "s");
        long hours = minutes / 60;
        if (hours < 24) return hours + " hour" + (hours == 1 ? "" : "s");
        long days = hours / 24;
        if (days < 30) return days + " day" + (days == 1 ? "" : "s");
        long months = days / 30;
        if (months < 12) return months + " month" + (months == 1 ? "" : "s");
        long years = months / 12;
        return years + " year" + (years == 1 ? "" : "s");
    }

    private ZonedDateTime getNextScheduledTime(ZonedDateTime now, long lastRunEpochMillis) {
        switch (type) {
            case HOURLY:
                return nextHourly(now);
            case MINUTE_INTERVAL:
                return nextMinuteInterval(now);
            case SECOND_INTERVAL:
                return nextSecondInterval(now);
            case DAILY:
                return nextDaily(now);
            case WEEKLY:
                return nextWeekly(now);
            case MONTHLY:
                return nextMonthly(now);
            case YEARLY:
                return nextYearly(now);
            case ONCE:
                if (onceAt == null) return null;
                ZonedDateTime once = onceAt.atZone(zoneId);
                return lastRunEpochMillis >= once.toInstant().toEpochMilli() ? null : once;
            default:
                return null;
        }
    }

    private ZonedDateTime getMostRecentScheduledTime(ZonedDateTime now) {
        switch (type) {
            case HOURLY:
                return previousHourly(now);
            case MINUTE_INTERVAL:
                return previousMinuteInterval(now);
            case SECOND_INTERVAL:
                return previousSecondInterval(now);
            case DAILY:
                return previousDaily(now);
            case WEEKLY:
                return previousWeekly(now);
            case MONTHLY:
                return previousMonthly(now);
            case YEARLY:
                return previousYearly(now);
            case ONCE:
                if (onceAt == null) return null;
                return onceAt.atZone(zoneId);
            default:
                return null;
        }
    }

    private ZonedDateTime previousHourly(ZonedDateTime now) {
        ZonedDateTime candidate = now.withMinute(time.getMinute()).withSecond(time.getSecond()).withNano(0);
        if (now.isBefore(candidate)) {
            candidate = candidate.minusHours(1);
        }
        return candidate;
    }

    private ZonedDateTime previousMinuteInterval(ZonedDateTime now) {
        long intervalSeconds = Math.max(1, interval) * 60L;
        long scheduledEpoch = Math.floorDiv(now.toEpochSecond(), intervalSeconds) * intervalSeconds;
        return ZonedDateTime.ofInstant(Instant.ofEpochSecond(scheduledEpoch), zoneId).withNano(0);
    }

    private ZonedDateTime previousSecondInterval(ZonedDateTime now) {
        long intervalSeconds = Math.max(1, interval);
        long scheduledEpoch = Math.floorDiv(now.toEpochSecond(), intervalSeconds) * intervalSeconds;
        return ZonedDateTime.ofInstant(Instant.ofEpochSecond(scheduledEpoch), zoneId).withNano(0);
    }

    private ZonedDateTime previousDaily(ZonedDateTime now) {
        ZonedDateTime candidate = now.withHour(time.getHour()).withMinute(time.getMinute()).withSecond(time.getSecond()).withNano(0);
        if (now.isBefore(candidate)) {
            candidate = candidate.minusDays(1);
        }
        return candidate;
    }

    private ZonedDateTime previousWeekly(ZonedDateTime now) {
        DayOfWeek day = dayOfWeek != null ? dayOfWeek : DayOfWeek.MONDAY;
        ZonedDateTime candidate = now.with(TemporalAdjusters.previousOrSame(day))
                .withHour(time.getHour()).withMinute(time.getMinute()).withSecond(time.getSecond()).withNano(0);
        if (now.isBefore(candidate)) {
            candidate = candidate.minusWeeks(1);
        }
        return candidate;
    }

    private ZonedDateTime previousMonthly(ZonedDateTime now) {
        int dom = dayOfMonth > 0 ? dayOfMonth : 1;
        int safeDom = Math.min(dom, now.toLocalDate().lengthOfMonth());
        ZonedDateTime candidate = now.withDayOfMonth(safeDom)
                .withHour(time.getHour()).withMinute(time.getMinute()).withSecond(time.getSecond()).withNano(0);
        if (now.isBefore(candidate)) {
            candidate = candidate.minusMonths(1);
            int adjusted = Math.min(dom, candidate.toLocalDate().lengthOfMonth());
            candidate = candidate.withDayOfMonth(adjusted)
                    .withHour(time.getHour()).withMinute(time.getMinute()).withSecond(time.getSecond()).withNano(0);
        }
        return candidate;
    }

    private ZonedDateTime previousYearly(ZonedDateTime now) {
        Month m = month != null ? month : Month.JANUARY;
        int d = monthDay > 0 ? monthDay : 1;

        LocalDate thisYearBase = LocalDate.of(now.getYear(), m, 1);
        int safeDay = Math.min(d, thisYearBase.lengthOfMonth());
        ZonedDateTime candidate = ZonedDateTime.of(
                LocalDate.of(now.getYear(), m, safeDay),
                LocalTime.of(time.getHour(), time.getMinute(), time.getSecond()),
                zoneId
        );

        if (now.isBefore(candidate)) {
            LocalDate prevYearBase = LocalDate.of(now.getYear() - 1, m, 1);
            int prevSafeDay = Math.min(d, prevYearBase.lengthOfMonth());
            candidate = ZonedDateTime.of(
                    LocalDate.of(now.getYear() - 1, m, prevSafeDay),
                    LocalTime.of(time.getHour(), time.getMinute(), time.getSecond()),
                    zoneId
            );
        }
        return candidate;
    }

    private ZonedDateTime nextHourly(ZonedDateTime now) {
        ZonedDateTime candidate = now.withMinute(time.getMinute()).withSecond(time.getSecond()).withNano(0);
        if (now.isAfter(candidate)) {
            candidate = candidate.plusHours(1);
        }
        return candidate;
    }

    private ZonedDateTime nextMinuteInterval(ZonedDateTime now) {
        long intervalSeconds = Math.max(1, interval) * 60L;
        long nowSec = now.toEpochSecond();
        long remainder = Math.floorMod(nowSec, intervalSeconds);
        long nextEpoch = remainder == 0 ? nowSec : nowSec + (intervalSeconds - remainder);
        return ZonedDateTime.ofInstant(Instant.ofEpochSecond(nextEpoch), zoneId).withNano(0);
    }

    private ZonedDateTime nextSecondInterval(ZonedDateTime now) {
        long intervalSeconds = Math.max(1, interval);
        long nowSec = now.toEpochSecond();
        long remainder = Math.floorMod(nowSec, intervalSeconds);
        long nextEpoch = remainder == 0 ? nowSec : nowSec + (intervalSeconds - remainder);
        return ZonedDateTime.ofInstant(Instant.ofEpochSecond(nextEpoch), zoneId).withNano(0);
    }

    private ZonedDateTime nextDaily(ZonedDateTime now) {
        ZonedDateTime candidate = now.withHour(time.getHour()).withMinute(time.getMinute()).withSecond(time.getSecond()).withNano(0);
        if (now.isAfter(candidate)) {
            candidate = candidate.plusDays(1);
        }
        return candidate;
    }

    private ZonedDateTime nextWeekly(ZonedDateTime now) {
        DayOfWeek day = dayOfWeek != null ? dayOfWeek : DayOfWeek.MONDAY;
        ZonedDateTime candidate = now.with(TemporalAdjusters.nextOrSame(day))
                .withHour(time.getHour()).withMinute(time.getMinute()).withSecond(time.getSecond()).withNano(0);
        if (now.isAfter(candidate)) {
            candidate = candidate.plusWeeks(1);
        }
        return candidate;
    }

    private ZonedDateTime nextMonthly(ZonedDateTime now) {
        int dom = dayOfMonth > 0 ? dayOfMonth : 1;
        int safeDom = Math.min(dom, now.toLocalDate().lengthOfMonth());
        ZonedDateTime candidate = now.withDayOfMonth(safeDom)
                .withHour(time.getHour()).withMinute(time.getMinute()).withSecond(time.getSecond()).withNano(0);
        if (now.isAfter(candidate)) {
            candidate = candidate.plusMonths(1);
            int adjusted = Math.min(dom, candidate.toLocalDate().lengthOfMonth());
            candidate = candidate.withDayOfMonth(adjusted)
                    .withHour(time.getHour()).withMinute(time.getMinute()).withSecond(time.getSecond()).withNano(0);
        }
        return candidate;
    }

    private ZonedDateTime nextYearly(ZonedDateTime now) {
        Month m = month != null ? month : Month.JANUARY;
        int d = monthDay > 0 ? monthDay : 1;

        LocalDate thisYearBase = LocalDate.of(now.getYear(), m, 1);
        int safeDay = Math.min(d, thisYearBase.lengthOfMonth());
        ZonedDateTime candidate = ZonedDateTime.of(
                LocalDate.of(now.getYear(), m, safeDay),
                LocalTime.of(time.getHour(), time.getMinute(), time.getSecond()),
                zoneId
        );

        if (now.isAfter(candidate)) {
            LocalDate nextYearBase = LocalDate.of(now.getYear() + 1, m, 1);
            int nextSafeDay = Math.min(d, nextYearBase.lengthOfMonth());
            candidate = ZonedDateTime.of(
                    LocalDate.of(now.getYear() + 1, m, nextSafeDay),
                    LocalTime.of(time.getHour(), time.getMinute(), time.getSecond()),
                    zoneId
            );
        }
        return candidate;
    }
}
