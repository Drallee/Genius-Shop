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
            if (restriction.matches("\\d{1,2}:\\d{2}(?i)(AM|PM)?-\\d{1,2}:\\d{2}(?i)(AM|PM)?")) {
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
            // Check for year (e.g., "2026" or "2025-2027" or "2025, 2027")
            else if (restriction.matches("[\\d\\s,-]+")) {
                // Potential year or day of month - check format more carefully
                if (restriction.matches("(\\d{4}(-\\d{4})?)(\\s*,\\s*(\\d{4}(-\\d{4})?))*")) {
                    if (!checkYear(restriction, now.getYear())) {
                        return false;
                    }
                } else if (restriction.matches("(\\d{1,2}(-\\d{1,2})?)(\\s*,\\s*(\\d{1,2}(-\\d{1,2})?))*")) {
                    if (!checkDayOfMonth(restriction, now.getDayOfMonth())) {
                        return false;
                    }
                }
            }
            // Check for month (e.g., "October" or "Jan-Mar" or "Jan, Mar")
            else if (isMonthRestriction(restriction)) {
                if (!checkMonth(restriction, now.getMonthValue())) {
                    return false;
                }
            }
            // Check for day of week (MONDAY, FRIDAY-SUNDAY, mon, tue-wed, etc.)
            else if (restriction.matches("(?i)([a-z]{3,}(-[a-z]{3,})?)(\\s*,\\s*([a-z]{3,}(-[a-z]{3,})?))*")) {
                if (!checkDayOfWeek(restriction, dayOfWeek)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Validate a list of time restrictions and return a list of invalid ones.
     * @param restrictions List of strings to validate
     * @return List of invalid restriction strings with error details
     */
    public static List<String> validateRestrictions(List<String> restrictions) {
        List<String> invalid = new java.util.ArrayList<>();
        if (restrictions == null) return invalid;

        for (String restriction : restrictions) {
            if (restriction == null || restriction.trim().isEmpty()) continue;
            restriction = restriction.trim();

            if (restriction.matches("\\d{1,2}:\\d{2}(?i)(AM|PM)?-\\d{1,2}:\\d{2}(?i)(AM|PM)?")) {
                try {
                    String[] parts = restriction.split("-");
                    parseTime(parts[0]);
                    parseTime(parts[1]);
                } catch (Exception e) {
                    invalid.add(restriction + " (Invalid time format: " + e.getMessage() + ")");
                }
            } else if (restriction.contains(" to ")) {
                try {
                    String[] parts = restriction.split(" to ");
                    if (parts.length != 2) {
                        invalid.add(restriction + " (Date range must be 'yyyy-MM-dd to yyyy-MM-dd')");
                    } else {
                        LocalDate.parse(parts[0].trim());
                        LocalDate.parse(parts[1].trim());
                    }
                } catch (DateTimeParseException e) {
                    invalid.add(restriction + " (Invalid date format: use yyyy-MM-dd)");
                }
            } else if (isMonthRestriction(restriction)) {
                try {
                    for (String part : restriction.split(",")) {
                        String[] subparts = part.trim().split("-");
                        parseMonth(subparts[0]);
                        if (subparts.length == 2) {
                            parseMonth(subparts[1]);
                        }
                    }
                } catch (IllegalArgumentException e) {
                    invalid.add(restriction + " (Invalid month)");
                }
            } else if (restriction.matches("(?i)([a-z]{3,}(-[a-z]{3,})?)(\\s*,\\s*([a-z]{3,}(-[a-z]{3,})?))*")) {
                try {
                    for (String part : restriction.split(",")) {
                        String[] subparts = part.trim().split("-");
                        parseDayOfWeek(subparts[0]);
                        if (subparts.length == 2) {
                            parseDayOfWeek(subparts[1]);
                        }
                    }
                } catch (IllegalArgumentException e) {
                    invalid.add(restriction + " (Invalid day of week)");
                }
            } else if (restriction.matches("(\\d{4}(-\\d{4})?)(\\s*,\\s*(\\d{4}(-\\d{4})?))*")) {
                // Year validation
            } else if (restriction.matches("(\\d{1,2}(-\\d{1,2})?)(\\s*,\\s*(\\d{1,2}(-\\d{1,2})?))*")) {
                // Day of month validation
                try {
                    for (String part : restriction.split(",")) {
                        String[] subparts = part.trim().split("-");
                        int d1 = Integer.parseInt(subparts[0]);
                        if (d1 < 1 || d1 > 31) invalid.add(restriction + " (Invalid day: 1-31)");
                        if (subparts.length == 2) {
                            int d2 = Integer.parseInt(subparts[1]);
                            if (d2 < 1 || d2 > 31) invalid.add(restriction + " (Invalid day: 1-31)");
                        }
                    }
                } catch (NumberFormatException e) {
                    invalid.add(restriction + " (Invalid number)");
                }
            } else {
                invalid.add(restriction + " (Unrecognized format)");
            }
        }
        return invalid;
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
            // Log once via validation, then ignore here
            return true;
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
        } catch (Exception e) {
            // Log once via validation, then ignore here
            return true;
        }
    }

    /**
     * Format time restrictions into a human-readable string.
     * @param restrictions List of time restriction strings
     * @param plugin Plugin instance to get configurable messages
     * @return Formatted string like "2025 and 2026 during December between 13th and 25th"
     */
    public static String formatAvailableTimes(List<String> restrictions, ShopPlugin plugin) {
        if (restrictions == null || restrictions.isEmpty()) {
            return plugin.getMessages().getMessage("shop-always-available");
        }

        List<String> years = new java.util.ArrayList<>();
        List<String> months = new java.util.ArrayList<>();
        List<String> daysOfMonth = new java.util.ArrayList<>();
        List<String> daysOfWeek = new java.util.ArrayList<>();
        List<String> times = new java.util.ArrayList<>();
        List<String> dateRanges = new java.util.ArrayList<>();
        List<String> others = new java.util.ArrayList<>();

        String rangeSeparator = plugin.getMessages().getMessage("time-range-separator");
        if (rangeSeparator.isEmpty()) rangeSeparator = "-";
        String listSeparator = plugin.getMessages().getMessage("and");
        if (listSeparator.isEmpty()) listSeparator = " and ";

        for (String restriction : restrictions) {
            restriction = restriction.trim();
            if (restriction.matches("\\d{1,2}:\\d{2}(?i)(AM|PM)?-\\d{1,2}:\\d{2}(?i)(AM|PM)?")) {
                times.add(restriction.replace("-", rangeSeparator));
            } else if (restriction.contains(" to ")) {
                dateRanges.add(formatDateRange(restriction, plugin));
            } else if (restriction.matches("(\\d{4}(-\\d{4})?)(\\s*,\\s*(\\d{4}(-\\d{4})?))*")) {
                years.add(formatList(restriction, rangeSeparator, listSeparator, null, plugin));
            } else if (restriction.matches("(\\d{1,2}(-\\d{1,2})?)(\\s*,\\s*(\\d{1,2}(-\\d{1,2})?))*")) {
                daysOfMonth.add(formatDayOfMonthList(restriction, rangeSeparator, listSeparator, plugin));
            } else if (restriction.matches("(?i)([a-z]{3,}(-[a-z]{3,})?)(\\s*,\\s*([a-z]{3,}(-[a-z]{3,})?))*")) {
                String dayRangeSeparator = plugin.getMessages().getMessage("day-range-separator");
                if (dayRangeSeparator.isEmpty()) dayRangeSeparator = rangeSeparator;
                daysOfWeek.add(formatList(restriction, dayRangeSeparator, listSeparator, "day", plugin));
            } else if (isMonthRestriction(restriction)) {
                months.add(formatList(restriction, rangeSeparator, listSeparator, "month", plugin));
            } else {
                others.add(restriction);
            }
        }

        StringBuilder sb = new StringBuilder();
        String and = plugin.getMessages().getMessage("and");
        String during = plugin.getMessages().getMessage("during");
        String between = plugin.getMessages().getMessage("between");
        String on = plugin.getMessages().getMessage("on");
        String in = plugin.getMessages().getMessage("in");
        
        String lineBreak = plugin.getMessages().getMessage("line-break").replace("\\n", "\n");
        if (lineBreak.isEmpty()) lineBreak = " ";

        String inTheMonthOf = plugin.getMessages().getMessage("in-the-month-of");
        if (inTheMonthOf.isEmpty()) inTheMonthOf = " in the month of ";

        // Helper to append groups with proper spacing/newlines
        // Order: Years, DaysOfWeek, Months, DaysOfMonth, Times, DateRanges, Others
        if (!years.isEmpty()) {
            sb.append(String.join(and, years));
        }

        if (!daysOfWeek.isEmpty()) {
            if (sb.length() > 0) {
                if (lineBreak.equals(" ")) {
                    sb.append(on.startsWith(" ") ? "" : " ").append(on.trim()).append(" ");
                } else {
                    sb.append(lineBreak).append(on.trim()).append(" ");
                }
            } else {
                sb.append(on.trim()).append(" ");
            }
            sb.append(String.join(and, daysOfWeek));
        }

        if (!months.isEmpty()) {
            if (sb.length() > 0) {
                if (lineBreak.equals(" ")) {
                    if (!daysOfWeek.isEmpty()) {
                        sb.append(inTheMonthOf);
                    } else {
                        sb.append(during.startsWith(" ") ? "" : " ").append(during.trim()).append(" ");
                    }
                } else {
                    sb.append(lineBreak).append(during.trim()).append(" ");
                }
            } else {
                sb.append(during.trim()).append(" ");
            }
            sb.append(String.join(and, months));
        }

        if (!daysOfMonth.isEmpty()) {
            if (sb.length() > 0) sb.append(lineBreak);
            if (lineBreak.equals(" ")) {
                sb.append(between.startsWith(" ") ? "" : " ").append(between.trim()).append(" ");
            } else {
                sb.append(between.trim()).append(" ");
            }
            sb.append(String.join(and, daysOfMonth));
        }

        if (!times.isEmpty()) {
            if (sb.length() > 0) sb.append(lineBreak);
            if (lineBreak.equals(" ")) {
                sb.append(between.startsWith(" ") ? "" : " ").append(between.trim()).append(" ");
            } else {
                sb.append(between.trim()).append(" ");
            }
            sb.append(String.join(and, times));
        }

        for (String dr : dateRanges) {
            if (sb.length() > 0) sb.append(lineBreak.equals(" ") ? ", " : lineBreak);
            sb.append(dr);
        }

        for (String other : others) {
            if (sb.length() > 0) sb.append(lineBreak.equals(" ") ? ", " : lineBreak);
            sb.append(other);
        }

        return sb.toString().trim();
    }

    private static String formatDayOfMonthList(String restriction, String rangeSep, String listSep, ShopPlugin plugin) {
        String[] parts = restriction.split(",");
        StringBuilder formatted = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) formatted.append(listSep);
            String part = parts[i].trim();
            if (part.contains("-")) {
                String[] subparts = part.split("-");
                formatted.append(getDayWithSuffix(subparts[0], plugin))
                        .append(rangeSep)
                        .append(getDayWithSuffix(subparts[1], plugin));
            } else {
                formatted.append(getDayWithSuffix(part, plugin));
            }
        }
        return formatted.toString();
    }

    private static String getDayWithSuffix(String dayStr, ShopPlugin plugin) {
        try {
            int day = Integer.parseInt(dayStr);
            String suffixKey;
            if (day >= 11 && day <= 13) {
                suffixKey = "day-suffix-th";
            } else {
                switch (day % 10) {
                    case 1: suffixKey = "day-suffix-st"; break;
                    case 2: suffixKey = "day-suffix-nd"; break;
                    case 3: suffixKey = "day-suffix-rd"; break;
                    default: suffixKey = "day-suffix-th"; break;
                }
            }
            return day + plugin.getMessages().getMessage(suffixKey);
        } catch (Exception e) {
            return dayStr;
        }
    }

    /**
     * Translate a day name or abbreviation using the current language file.
     */
    private static String translateDay(String day, ShopPlugin plugin) {
        String key = day.trim().toLowerCase();
        String translated = plugin.getMessages().getMessage("days." + key);
        
        // If not found in the language file, fall back to capitalized original
        if (translated == null || translated.isEmpty() || translated.equals(plugin.getMessages().color(plugin.getMessagesConfig().getString("messages.days." + key, ""))) && translated.isEmpty()) {
             return capitalizeFirst(day);
        }
        return translated;
    }

    /**
     * Format a date range according to user's configured format and translate months
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
            
            // Format both dates and translate
            String formattedStart = formatDateLocalized(startDate, dateFormat, plugin);
            String formattedEnd = formatDateLocalized(endDate, dateFormat, plugin);
            
            String dateSeparator = plugin.getMessages().getMessage("date-range-separator");
            if (dateSeparator.isEmpty()) dateSeparator = " to ";
            
            return formattedStart + dateSeparator + formattedEnd;
        } catch (Exception e) {
            // If formatting fails, return original
            return restriction;
        }
    }

    /**
     * Format a date and manually translate month names.
     */
    private static String formatDateLocalized(LocalDate date, String format, ShopPlugin plugin) {
        String formatted = date.format(DateTimeFormatter.ofPattern(format, java.util.Locale.ENGLISH));
        
        // Translate full month names
        for (java.time.Month month : java.time.Month.values()) {
            String monthName = month.name().toLowerCase();
            String translated = plugin.getMessages().getMessage("months." + monthName);
            if (!translated.isEmpty()) {
                formatted = formatted.replace(capitalizeFirst(monthName), translated);
            }
        }
        
        // Translate short month names
        String[] shortMonths = {"jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"};
        for (String sm : shortMonths) {
            String key = sm;
            if (sm.equals("may")) key = "may_short"; // avoid conflict with full name if same
            
            String translated = plugin.getMessages().getMessage("months." + key);
            if (!translated.isEmpty()) {
                // We need to be careful with replacing short names to not overwrite parts of other words
                // But since we use capitalizeFirst for short months usually, it's safer.
                formatted = formatted.replace(capitalizeFirst(sm), translated);
            }
        }
        
        return formatted;
    }

    /**
     * Capitalize first letter, lowercase rest
     */
    private static String capitalizeFirst(String str) {
        if (str == null || str.isEmpty()) return str;
        return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
    }

    /**
     * Parse day of week string supporting both full names and 3-letter abbreviations, case-insensitive.
     */
    private static DayOfWeek parseDayOfWeek(String dayStr) {
        dayStr = dayStr.trim().toUpperCase();
        
        // Try full name first
        try {
            return DayOfWeek.valueOf(dayStr);
        } catch (IllegalArgumentException ignored) {}

        // Try 3-letter abbreviations
        switch (dayStr) {
            case "MON": return DayOfWeek.MONDAY;
            case "TUE": return DayOfWeek.TUESDAY;
            case "WED": return DayOfWeek.WEDNESDAY;
            case "THU": return DayOfWeek.THURSDAY;
            case "FRI": return DayOfWeek.FRIDAY;
            case "SAT": return DayOfWeek.SATURDAY;
            case "SUN": return DayOfWeek.SUNDAY;
            default:
                throw new IllegalArgumentException("Unknown day of week: " + dayStr);
        }
    }

    private static boolean checkYear(String restriction, int currentYear) {
        try {
            for (String part : restriction.split(",")) {
                part = part.trim();
                if (part.contains("-")) {
                    String[] parts = part.split("-");
                    int start = Integer.parseInt(parts[0]);
                    int end = Integer.parseInt(parts[1]);
                    if (currentYear >= start && currentYear <= end) return true;
                } else {
                    if (currentYear == Integer.parseInt(part)) return true;
                }
            }
            return false;
        } catch (Exception e) {
            return true;
        }
    }

    private static boolean checkDayOfMonth(String restriction, int currentDay) {
        try {
            for (String part : restriction.split(",")) {
                part = part.trim();
                if (part.contains("-")) {
                    String[] parts = part.split("-");
                    int start = Integer.parseInt(parts[0]);
                    int end = Integer.parseInt(parts[1]);
                    if (currentDay >= start && currentDay <= end) return true;
                } else {
                    if (currentDay == Integer.parseInt(part)) return true;
                }
            }
            return false;
        } catch (Exception e) {
            return true;
        }
    }

    private static boolean isMonthRestriction(String restriction) {
        String month = "(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)";
        String pattern = "(?i)" + month + "(-" + month + ")?";
        return restriction.matches(pattern + "(\\s*,\\s*" + pattern + ")*");
    }

    private static boolean checkMonth(String restriction, int currentMonth) {
        try {
            for (String part : restriction.split(",")) {
                part = part.trim();
                if (part.contains("-")) {
                    String[] subparts = part.split("-");
                    int start = parseMonth(subparts[0]);
                    int end = parseMonth(subparts[1]);
                    if (end < start) {
                        if (currentMonth >= start || currentMonth <= end) return true;
                    } else {
                        if (currentMonth >= start && currentMonth <= end) return true;
                    }
                } else {
                    if (currentMonth == parseMonth(part)) return true;
                }
            }
            return false;
        } catch (Exception e) {
            return true;
        }
    }

    private static boolean checkDayOfWeek(String restriction, DayOfWeek now) {
        try {
            for (String part : restriction.split(",")) {
                part = part.trim();
                if (part.contains("-")) {
                    // Range like "FRIDAY-SUNDAY" or "fri-sun"
                    String[] subparts = part.split("-");
                    DayOfWeek start = parseDayOfWeek(subparts[0]);
                    DayOfWeek end = parseDayOfWeek(subparts[1]);

                    // Handle ranges that wrap around the week
                    if (end.getValue() < start.getValue()) {
                        if (now.getValue() >= start.getValue() || now.getValue() <= end.getValue()) return true;
                    } else {
                        if (now.getValue() >= start.getValue() && now.getValue() <= end.getValue()) return true;
                    }
                } else {
                    // Single day like "MONDAY" or "mon"
                    DayOfWeek target = parseDayOfWeek(part);
                    if (now == target) return true;
                }
            }
            return false;
        } catch (Exception e) {
            // Log once via validation, then ignore here
            return true;
        }
    }

    private static int parseMonth(String monthStr) {
        monthStr = monthStr.trim().toUpperCase();
        try {
            return java.time.Month.valueOf(monthStr).getValue();
        } catch (IllegalArgumentException ignored) {}

        switch (monthStr) {
            case "JAN": return 1;
            case "FEB": return 2;
            case "MAR": return 3;
            case "APR": return 4;
            case "MAY": return 5;
            case "JUN": return 6;
            case "JUL": return 7;
            case "AUG": return 8;
            case "SEP": return 9;
            case "OCT": return 10;
            case "NOV": return 11;
            case "DEC": return 12;
            default:
                throw new IllegalArgumentException("Unknown month: " + monthStr);
        }
    }

    private static String translateMonth(String month, ShopPlugin plugin) {
        String key = month.trim().toLowerCase();
        // Special case for 'may' to avoid conflict if user wants a different short name
        if (key.equals("may")) {
            String shortMay = plugin.getMessages().getMessage("months.may_short");
            if (!shortMay.isEmpty()) return shortMay;
        }
        
        String translated = plugin.getMessages().getMessage("months." + key);
        if (translated == null || translated.isEmpty() || (translated.equals(plugin.getMessages().color(plugin.getMessagesConfig().getString("messages.months." + key, ""))) && translated.isEmpty())) {
            return capitalizeFirst(month);
        }
        return translated;
    }

    private static String formatList(String restriction, String rangeSep, String listSep, String type, ShopPlugin plugin) {
        String[] parts = restriction.split(",");
        StringBuilder formatted = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) formatted.append(listSep);
            String part = parts[i].trim();
            if (part.contains("-")) {
                String[] subparts = part.split("-");
                formatted.append(translatePart(subparts[0], type, plugin))
                        .append(rangeSep)
                        .append(translatePart(subparts[1], type, plugin));
            } else {
                formatted.append(translatePart(part, type, plugin));
            }
        }
        return formatted.toString();
    }

    private static String translatePart(String part, String type, ShopPlugin plugin) {
        if ("day".equals(type)) return translateDay(part, plugin);
        if ("month".equals(type)) return translateMonth(part, plugin);
        return part;
    }
}
