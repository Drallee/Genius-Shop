package me.dralle.shop.commands;

import java.util.List;

public class CustomCommandLoadResult {
    private final List<CustomCommandDefinition> commands;
    private final List<String> errors;
    private final int disabledCount;

    public CustomCommandLoadResult(List<CustomCommandDefinition> commands, List<String> errors, int disabledCount) {
        this.commands = commands != null ? List.copyOf(commands) : List.of();
        this.errors = errors != null ? List.copyOf(errors) : List.of();
        this.disabledCount = disabledCount;
    }

    public List<CustomCommandDefinition> getCommands() {
        return commands;
    }

    public List<String> getErrors() {
        return errors;
    }

    public int getDisabledCount() {
        return disabledCount;
    }
}
