# Transaction Regression Checklist

Use a disposable server with copied configuration and balances. Back up plugin data and
the economy provider before testing. Never use production balances to simulate failed payments.

## Automated Checks

```text
mvn -B verify
node --test src/test/web/*.test.cjs
node src/test/web/sales-browser-check.cjs
```

`TransactionServiceTest` covers payment, delivery, compensation, thread/reentrancy guards,
price formulas, campaigns, bundles, planned limits, and stock directions. Menu and storage
tests cover full inventories, partial delivery, metadata matching, physical containers,
and supported SmartSpawner storage/locking. These are mocked tests, not a live server run.

Run the Sales browser check after Maven verification, with Playwright installed under
`target/rendering-tools/node_modules`. It serves `target/classes` to exercise the built
resources used by the plugin. `PackagedWebAssetsTest` checks that web assets are copied
without Maven filtering, which would otherwise replace JavaScript templates such as
`${id}` with build properties. Only `plugin.yml` needs build-version filtering.

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

The `integration/shop-testing` branch combines #23, #24, #25, #26, #27, #28, #29, #34,
and #35, including the tested ledger display, debug logging, and packaging fixes.
Built-in purchase, sale, bulk-sale, command,
and wand entry points pass ledger lines into the shared settlement context. The service
records them once after payment and delivery, using the result ID as the ledger operation
ID, before stock updates or success notifications. Financially completed trades remain
recorded if a stock update fails; rejected or compensated trades are not recorded.
Ledger storage failures are logged without retrying payment. Tests cover shared IDs,
multi-shop wand sales, payment/delivery/compensation failures, and stock failures.

The Sales tab from #34 aggregates the completed ledger using these operation IDs.
Verify date/shop/item filters, separate purchase/sale/wand totals, player money flow,
popular items, and buy/sell price history against known trades. Failed attempts must
not change completed-sales metrics. Recheck totals after a full server restart,
including a bulk transaction spanning shops. Purchases are money leaving player
balances; sales and wand sales are money entering them.

Check main-menu preview tooltips (#24), configured availability/reset timezones and
item editor sections (#25), and editor loading/cache behavior (#26) together with Sales.
The shared transaction service and price simulation both use the configured timezone.
For #29, run `/shop validate-prices` with representative quantities, stock counts,
campaign times, and player permissions. Confirm reports distinguish intentional
profitable routes and that balances, inventory, stock, and ledger totals remain unchanged.

For #28, use `/shop refunds list`, `inspect <id>`, and `retry <id>` with an injected
delivery failure followed by a refused refund. The shared transaction ID must match
the recovery case and the player's reference. Verify restart persistence, recorded
recovery actor/time, and that repeated/concurrent retries cannot pay twice. Uncertain
refunds must require provider review before repayment. Failed inventory restoration
must not enqueue an automatic money refund. Ambiguous sale payments must not also
return potentially paid items. Failed/refunded purchases must remain absent from
completed ledger entries and Sales analytics.
