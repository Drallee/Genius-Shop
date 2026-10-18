# Transaction Regression Checklist

Use a disposable server with copied configuration and balances. Back up plugin data and
the economy provider before testing. Never use production balances to simulate failed payments.

## Automated Checks

```text
mvn -B verify
node --test src/test/web/*.test.cjs
```

`TransactionServiceTest` covers payment, delivery, compensation, thread/reentrancy guards,
price formulas, campaigns, bundles, planned limits, and stock directions. Menu and storage
tests cover full inventories, partial delivery, metadata matching, physical containers,
and supported SmartSpawner storage/locking. These are mocked tests, not a live server run.

## Server Matrix

| Path | Successful Trade | Failure Cases |
| --- | --- | --- |
| Purchase menu | Single item, multiple stacks, bundle, campaign/formula, exported/custom item, command-only purchase | Insufficient funds, full inventory, revoked shop/item permission, conditions, player/global limit, failed withdrawal, delivery/command exception |
| Sell menu / Sell All button | Ordinary items, bundles, spawners, potions, enchantments, required name/lore, armor/offhand matching | Missing/stale items, refused deposit, unavailable economy, full stock, limits |
| Bulk-sell menu | Multiple item types and repeated stacks of the same item; unsold remainders returned once | Repeated stacks cannot exceed one shared limit, refused deposit restores every source slot, no success events/counts on failure |
| Command sell-all | Whole inventory and shop-restricted command, partial sale against limits | Unknown shop, denied permissions/conditions, cooldown, refused deposit, inventory restored |
| Container wand | Chest/container items, multiplier, campaign enabled/disabled, remaining wand uses | Cancelled approval, changed source, refused deposit, no wand-use consumption for failed sale |
| SmartSpawner wand | Supported native storage versions, very large virtual quantities, viewer refresh and persisted state | Native cancellation/price override, stale quantity, locked source, refused deposit, lock release and exact restoration |

For each successful trade compare the actual balance delta, exact source/destination
quantity, player count, stock/dynamic count, completed event, webhook, and metrics. For
every failed trade verify no success event/count update and no item or balance duplication.
Restart the server and verify persisted state. Test cooldown and large-purchase confirmation.

Use a test-only economy provider/storage adapter to inject refusal or exceptions. Verify
`COMPENSATED` means the restoration/refund succeeded. `COMPENSATION_FAILED` or
`COMPLETED_WITH_ERRORS` requires manual review using the logged transaction ID, player,
amount, and context. Do not retry a payment to repair an uncertain provider outcome.

## Combined Branch Testing

The issue #27 branch integrates #23 and #35. Built-in purchase, sale, bulk-sale, command,
and wand entry points pass ledger lines into the shared settlement context. The service
records them once after payment and delivery, using the result ID as the ledger operation
ID, before stock updates or success notifications. Financially completed trades remain
recorded if a stock update fails; rejected or compensated trades are not recorded.
Ledger storage failures are logged without retrying payment. Tests cover shared IDs,
multi-shop wand sales, payment/delivery/compensation failures, and stock failures.

When integrating analytics from #34, use the same settlement result and operation ID.
Re-run ledger and analytics tests, including a bulk transaction spanning shops.

Test editor branches together separately for save conflicts, drafts, permissions, tutorial,
and rendering behavior. Passing standalone feature tests does not establish merged behavior.
