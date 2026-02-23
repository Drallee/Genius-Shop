package me.dralle.shop.config;

public record ValidationMessage(Severity severity, String location, String message) {
    public enum Severity {
        INFO,
        WARNING,
        ERROR
    }
}

