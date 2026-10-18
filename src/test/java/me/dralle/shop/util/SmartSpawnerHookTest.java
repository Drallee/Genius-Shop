package me.dralle.shop.util;

import org.bukkit.Material;
import org.bukkit.entity.EntityType;
import org.bukkit.inventory.ItemStack;
import org.junit.jupiter.api.Test;

import java.lang.reflect.InvocationTargetException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SmartSpawnerHookTest {
    public interface CreationApi {
        ItemStack createSpawnerItem(EntityType type);
        ItemStack createItemSpawnerItem(Material material);
    }

    public interface InspectionApi {
        boolean isItemSpawner(ItemStack item);
        boolean isSmartSpawner(ItemStack item);
        Material getItemSpawnerMaterial(ItemStack item);
        EntityType getSpawnerEntityType(ItemStack item);
    }

    @Test
    void readsNativeItemSpawnerBeforeMobFallback() throws Exception {
        InspectionApi api = mock(InspectionApi.class);
        ItemStack item = spawner();
        when(api.isItemSpawner(item)).thenReturn(true);
        when(api.getItemSpawnerMaterial(item)).thenReturn(Material.DIAMOND);
        assertEquals(new SmartSpawnerHook.Identity(true, "ITEM:DIAMOND"), SmartSpawnerHook.identify(InspectionApi.class, api, item));
        verify(api, never()).getSpawnerEntityType(any());
        verify(api, never()).isSmartSpawner(any());
    }

    @Test
    void readsNativeMobAndLeavesUnmanagedItemsForVanillaMatching() throws Exception {
        InspectionApi api = mock(InspectionApi.class);
        ItemStack item = spawner();
        when(api.isSmartSpawner(item)).thenReturn(true);
        when(api.getSpawnerEntityType(item)).thenReturn(EntityType.COW);
        assertEquals(new SmartSpawnerHook.Identity(true, "COW"), SmartSpawnerHook.identify(InspectionApi.class, api, item));
        when(api.isSmartSpawner(item)).thenReturn(false);
        assertEquals(new SmartSpawnerHook.Identity(false, null), SmartSpawnerHook.identify(InspectionApi.class, api, item));
    }

    @Test
    void unreadableManagedItemsNeverFallBackToVanillaIdentity() throws Exception {
        InspectionApi api = mock(InspectionApi.class);
        ItemStack item = spawner();
        when(api.isItemSpawner(item)).thenReturn(true);
        assertEquals(new SmartSpawnerHook.Identity(true, null), SmartSpawnerHook.identify(InspectionApi.class, api, item));
        assertEquals(new SmartSpawnerHook.Identity(true, null), SmartSpawnerHook.identify(InspectionApi.class, null, item));
    }

    @Test
    void createsMobSpawnerUsingNormalizedEntityType() throws Exception {
        CreationApi api = mock(CreationApi.class);
        ItemStack item = spawner();
        when(api.createSpawnerItem(EntityType.RAVAGER)).thenReturn(item);

        assertSame(item, create(api, " ravager ", null));
        verify(api).createSpawnerItem(EntityType.RAVAGER);
        verifyNoMoreInteractions(api);
    }

    @Test
    void itemSpawnerTakesPriorityAndPreservesReturnedItem() throws Exception {
        CreationApi api = mock(CreationApi.class);
        ItemStack item = spawner();
        when(api.createItemSpawnerItem(Material.DIAMOND)).thenReturn(item);

        assertSame(item, create(api, "ZOMBIE", " diamond "));
        verify(api).createItemSpawnerItem(Material.DIAMOND);
        verifyNoMoreInteractions(api);
    }

    @Test
    void unavailableApiFailsInsteadOfCreatingVanillaSpawner() {
        assertThrows(IllegalStateException.class, () -> create(null, "ZOMBIE", null));
    }

    @Test
    void invalidTypeFailsBeforeCallingApi() {
        CreationApi api = mock(CreationApi.class);
        assertThrows(IllegalArgumentException.class, () -> create(api, "not-a-mob", null));
        assertThrows(IllegalArgumentException.class, () -> create(api, null, "not-an-item"));
        verifyNoInteractions(api);
    }

    @Test
    void nullOrNonSpawnerResultFailsForRefund() {
        CreationApi api = mock(CreationApi.class);
        assertThrows(IllegalStateException.class, () -> create(api, "ZOMBIE", null));
        ItemStack wrongItem = mock(ItemStack.class);
        when(wrongItem.getType()).thenReturn(Material.STONE);
        when(api.createSpawnerItem(EntityType.ZOMBIE)).thenReturn(wrongItem);
        assertThrows(IllegalStateException.class, () -> create(api, "ZOMBIE", null));
    }

    @Test
    void unexpectedApiQuantityFailsInsteadOfOverDelivering() {
        CreationApi api = mock(CreationApi.class);
        ItemStack item = spawner();
        when(item.getAmount()).thenReturn(2);
        when(api.createSpawnerItem(EntityType.ZOMBIE)).thenReturn(item);
        assertThrows(IllegalStateException.class, () -> create(api, "ZOMBIE", null));
    }

    @Test
    void apiExceptionPropagatesForRefund() {
        CreationApi api = mock(CreationApi.class);
        when(api.createSpawnerItem(EntityType.ZOMBIE)).thenThrow(new IllegalArgumentException("unsupported mob"));
        InvocationTargetException failure = assertThrows(InvocationTargetException.class,
                () -> create(api, "ZOMBIE", null));
        assertEquals("unsupported mob", failure.getCause().getMessage());
    }

    private ItemStack create(CreationApi api, String type, String item) throws ReflectiveOperationException {
        return SmartSpawnerHook.createSpawnerItem(CreationApi.class, api, type, item);
    }

    private ItemStack spawner() {
        ItemStack item = mock(ItemStack.class);
        when(item.getType()).thenReturn(Material.SPAWNER);
        when(item.getAmount()).thenReturn(1);
        return item;
    }
}
