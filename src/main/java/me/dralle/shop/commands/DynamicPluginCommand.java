package me.dralle.shop.commands;

import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.plugin.Plugin;

import java.util.List;

public class DynamicPluginCommand extends Command {
    private final Plugin owner;
    private final TabExecutor executor;

    public DynamicPluginCommand(String name, Plugin owner, TabExecutor executor, String description, String usage, List<String> aliases) {
        super(name, description == null ? "" : description, usage == null ? "/" + name : usage, aliases == null ? List.of() : aliases);
        this.owner = owner;
        this.executor = executor;
    }

    @Override
    public boolean execute(CommandSender sender, String commandLabel, String[] args) {
        if (!owner.isEnabled()) return false;
        return executor.onCommand(sender, this, commandLabel, args);
    }

    @Override
    public List<String> tabComplete(CommandSender sender, String alias, String[] args) {
        List<String> completions = executor.onTabComplete(sender, this, alias, args);
        return completions != null ? completions : List.of();
    }
}
