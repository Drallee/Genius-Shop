package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Utility class for validating time-based shop restrictions.
 */
public class TimeRestrictionUtil {

    /**
     * Check if a shop is currently available based on time restrictions.
     * @param restrictions List of time restriction strings from config
     * @return true if shop is available (or no restrictions), false otherwise
     */
    public static boolean isShopAvailable(List<String> restrictions) {
        if (restrictions == null || restrictions.isEmpty()) {
            return true; // No restrictions = always available
        }

        LocalDate now = LocalDate.now();
        LocalTime timeNow = LocalTime.now();
        DayOfWeek dayOfWeek = now.getDayOfWeek();

        // All restrictions must pass (AND logic)
        for (String restriction : restrictions) {
            if (restriction == null || restriction.trim().isEmpty()) continue;
            
            restriction = restriction.trim();

            // Check for time range (HH:mm-HH:mm or HH:mmAM-HH:mmPM)
            if (restriction.matches("\\d{1,2}:\\d{2}(AM|PM|am|pm)?-\\d{1,2}:\\d{2}(AM|PM|am|pm)?")) {
                if (!checkTimeRange(restriction, timeNow)) {
                    return false;
                }
            }
            // Check for date range (yyyy-MM-dd to yyyy-MM-dd)
            else if (restriction.contains(" to ")) {
                if (!checkDateRange(restriction, now)) {
                    return false;
                }
            }
            // Check for day of week (MONDAY, FRIDAY-SUNDAY, etc.)
            else if (restriction.matches("(?i)[A-Z]+(-[A-Z]+)?")) {
                if (!checkDayOfWeek(restriction, dayOfWeek)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Check if current time is within time range (e.g., "13:00-17:00" or "1:00PM-5:00PM")
     */
    private static boolean checkTimeRange(String restriction, LocalTime now) {
        try {
            String[] parts = restriction.split("-");
            LocalTime start = parseTime(parts[0]);
            LocalTime end = parseTime(parts[1]);

            // Handle ranges that cross midnight
            if (end.isBefore(start)) {
                return !now.isBefore(start) || !now.isAfter(end);
            } else {
                return !now.isBefore(start) && !now.isAfter(end);
            }
        } catch (Exception e) {
            return true; // Invalid format = ignore restriction
        }
    }

    /**
     * Parse time string supporting both 24-hour (13:00) and 12-hour (1:00PM) formats
     */
    private static LocalTime parseTime(String timeStr) throws DateTimeParseException {
        timeStr = timeStr.trim();
        
        // Check for AM/PM format
        if (timeStr.toUpperCase().endsWith("AM") || timeStr.toUpperCase().endsWith("PM")) {
            boolean isPM = timeStr.toUpperCase().endsWith("PM");
            String timeWithoutPeriod = timeStr.substring(0, timeStr.length() - 2).trim();
            
            String[] parts = timeWithoutPeriod.split(":");
            int hour = Integer.parseInt(parts[0]);
            int minute = Integer.parseInt(parts[1]);
            
            // Convert to 24-hour format
            if (isPM && hour != 12) {
                hour += 12;
            } else if (!isPM && hour == 12) {
                hour = 0; // 12 AM = 00:00
            }
            
            return LocalTime.of(hour, minute);
        } else {
            // 24-hour format
            return LocalTime.parse(timeStr, DateTimeFormatter.ofPattern("H:mm"));
        }
    }

    /**
     * Check if current date is within date range (e.g., "2024-10-01 to 2024-10-31")
     */
    private static boolean checkDateRange(String restriction, LocalDate now) {
        try {
            String[] parts = restriction.split(" to ");
            LocalDate start = LocalDate.parse(parts[0].trim());
            LocalDate end = LocalDate.parse(parts[1].trim());

            return !now.isBefore(start) && !now.isAfter(end);
        } catch (DateTimeParseException e) {
            return true; // Invalid format = ignore restriction
        }
    }

    /**
     * Format time restrictions into a human-readable string.
     * @param restrictions List of time restriction strings
     * @param plugin Plugin instance to get configurable messages
     * @return Formatted string like "Friday-Sunday, 10:00-22:00"
     */
    public static String formatAvailableTimes(List<String> restrictions, ShopPlugin plugin) {
        if (restrictions == null || restrictions.isEmpty()) {
            // Use configurable message for always-available shops
            return plugin.getMessages().getMessage("shop-always-available");
        }

        StringBuilder formatted = new StringBuilder();
        for (int i = 0; i < restrictions.size(); i++) {
            String restriction = restrictions.get(i).trim();
            
            if (i > 0) {
                formatted.append(", ");
            }
            
            // Format based on type
            if (restriction.matches("\\d{1,2}:\\d{2}(AM|PM|am|pm)?-\\d{1,2}:\\d{2}(AM|PM|am|pm)?")) {
                // Time range - preserve original format (24h or AM/PM)
                formatted.append(restriction);
            } else if (restriction.contains(" to ")) {
                // Date range - format according to user preference
                formatted.append(formatDateRange(restriction, plugin));
            } else if (restriction.matches("(?i)[A-Z]+(-[A-Z]+)?")) {
                // Day of week - capitalize properly
                String[] parts = restriction.split("-");
                if (parts.length == 2) {
                    formatted.append(capitalizeFirst(parts[0]))
                            .append("-")
                            .append(capitalizeFirst(parts[1]));
                } else {
                    formatted.append(capitalizeFirst(restriction));
                }
            } else {
                formatted.append(restriction);
            }
        }
        
        return formatted.toString();
    }

    /**
     * Format a date range according to user's configured format
     */
    private static String formatDateRange(String restriction, ShopPlugin plugin) {
        try {
            String[] parts = restriction.split(" to ");
            if (parts.length != 2) return restriction;
            
            // Parse dates in ISO format (yyyy-MM-dd)
            LocalDate startDate = LocalDate.parse(parts[0].trim());
            LocalDate endDate = LocalDate.parse(parts[1].trim());
            
            // Get user's preferred format from config
            String dateFormat = plugin.getConfig().getString("date-format", "MMM dd yyyy");
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern(dateFormat);
            
            // Format both dates
            String formattedStart = startDate.format(formatter);
            String formattedEnd = endDate.format(formatter);
            
            return formattedStart + " to " + formattedEnd;
        } catch (Exception e) {
            // If formatting fails, return original
            return restriction;
        }
    }

    /**
     * Capitalize first letter, lowercase rest
     */
    private static String capitalizeFirst(String str) {
        if (str == null || str.isEmpty()) return str;
        return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
    }

    /**
     * Check if current day matches day restriction (e.g., "MONDAY" or "FRIDAY-SUNDAY")
     */
    private static boolean checkDayOfWeek(String restriction, DayOfWeek now) {
        try {
            restriction = restriction.toUpperCase();
            
            if (restriction.contains("-")) {
                // Range like "FRIDAY-SUNDAY"
                String[] parts = restriction.split("-");
                DayOfWeek start = DayOfWeek.valueOf(parts[0]);
                DayOfWeek end = DayOfWeek.valueOf(parts[1]);

                // Handle ranges that wrap around the week
                if (end.getValue() < start.getValue()) {
                    return now.getValue() >= start.getValue() || now.getValue() <= end.getValue();
                } else {
                    return now.getValue() >= start.getValue() && now.getValue() <= end.getValue();
                }
            } else {
                // Single day like "MONDAY"
                DayOfWeek target = DayOfWeek.valueOf(restriction);
                return now == target;
            }
        } catch (IllegalArgumentException e) {
            return true; // Invalid day name = ignore restriction
        }
    }
}
