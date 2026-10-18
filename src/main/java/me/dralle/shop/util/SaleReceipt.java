package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopItem;
import net.md_5.bungee.api.chat.HoverEvent;
import net.md_5.bungee.api.chat.TextComponent;
import net.md_5.bungee.api.chat.hover.content.Text;
import org.bukkit.entity.Player;

import java.util.LinkedHashMap;
import java.util.List;

public final class SaleReceipt {
    private SaleReceipt() {}

    public record Line(String shop, String itemKey, String name, int quantity, double total) {}

    public static Line line(String shop, ShopItem item, int quantity, double total) {
        String name = item.getName();
        if (name == null || name.isBlank()) name = item.getMaterial().name();
        if (item.isSpawner()) {
            String type = item.getSpawnerItem() == null || item.getSpawnerItem().isBlank()
                    ? item.getSpawnerType() : "ITEM:" + item.getSpawnerItem();
            if (type != null && !type.isBlank()) name += " (" + type + ")";
        }
        return new Line(shop, item.getUniqueKey(), name, quantity, total);
    }

    public static void send(ShopPlugin plugin, Player player, String message, List<Line> lines) {
        TextComponent component = new TextComponent(TextComponent.fromLegacyText(ShopItemUtil.color(message)));
        component.setHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, new Text(TextComponent.fromLegacyText(tooltip(plugin, lines)))));
        player.spigot().sendMessage(component);
    }

    static String tooltip(ShopPlugin plugin, List<Line> lines) {
        record Key(String shop, String itemKey, String name) {}
        var grouped = new LinkedHashMap<Key, Line>();
        for (Line line : lines) {
            var key = new Key(line.shop(), line.itemKey(), line.name());
            grouped.merge(key, line, (previous, next) -> new Line(previous.shop(), previous.itemKey(), previous.name(),
                    previous.quantity() + next.quantity(), previous.total() + next.total()));
        }
        StringBuilder details = new StringBuilder("&6&lSale Receipt");
        int displayed = 0;
        for (Line line : grouped.values()) {
            if (displayed++ >= 12) break;
            details.append("\n&e").append(line.quantity()).append("x &f").append(line.name())
                    .append(" &8[&7").append(line.shop()).append("&8]")
                    .append("\n  &a").append(plugin.formatCurrency(line.total()))
                    .append(" &7(&f").append(plugin.formatCurrency(line.total() / line.quantity())).append(" &7/item average)");
        }
        if (grouped.size() > 12) details.append("\n&7+ ").append(grouped.size() - 12).append(" more item types");
        details.append("\n\n&7Items: &f").append(lines.stream().mapToInt(Line::quantity).sum())
                .append("\n&7Total paid: &a").append(plugin.formatCurrency(lines.stream().mapToDouble(Line::total).sum()));
        return ShopItemUtil.color(details.toString());
    }
}
