package me.dralle.shop.gui;

import me.dralle.shop.util.ShopItemUtil;
import org.bukkit.Material;
import org.bukkit.block.CreatureSpawner;
import org.bukkit.entity.EntityType;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.BlockStateMeta;

public class SpawnerPlaceListener implements Listener {

    @EventHandler
    public void onPlace(BlockPlaceEvent e) {
        ItemStack item = e.getItemInHand();
        if (item.getType() != Material.SPAWNER) return;
        
        if (!(item.getItemMeta() instanceof BlockStateMeta)) return;
        BlockStateMeta meta = (BlockStateMeta) item.getItemMeta();
        
        // Get the entity type from the item using ShopItemUtil
        String typeName = ShopItemUtil.getSpawnerType(item);
        if (typeName == null) return;

        try {
            EntityType type = EntityType.valueOf(typeName.toUpperCase());
            
            // If the placed block is a spawner, update it
            if (e.getBlockPlaced().getState() instanceof CreatureSpawner) {
                CreatureSpawner placedSpawner = (CreatureSpawner) e.getBlockPlaced().getState();
                placedSpawner.setSpawnedType(type);
                placedSpawner.update();
            }
        } catch (Exception ignored) {
        }
    }
}
