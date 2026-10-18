# Check the unified History workspace

Use a Today-enabled staging organization and existing CEO/Farm Manager test accounts. Do not create or correct real records just to test browsing.

1. Open `/app/history`. Daily records and the last 30 Addis Ababa operating days are the defaults. History and Reports should be visible in the sidebar.
2. Switch record type and 7/30/90-day ranges. Only relevant warehouse/subtype filters should appear. Changing farm/house clears incompatible child choices.
3. Scroll down and select **View details**. Details expand directly below that record on desktop and tablets, without jumping to the top. Selecting another record closes the previous detail; clicking the selected record again closes it.
4. Reload, use browser Back/Forward, and open a copied History URL. Filters and the selected record should survive. An unavailable record must not silently become a different selection.
5. Where offered, inspect **Request a correction** without submitting. It should target the exact source record. **Back to History** restores filters and selection; existing approval rules remain in force.
6. Open Flocks, expand a profile, then choose **History**. Its flock and reporting period should be retained. Reports opens the existing reporting workspace; totals/calculations are unchanged.
7. Switch to Amharic. Check labels, Ethiopian-calendar dates, long notes, keyboard focus and tablet portrait/landscape. User-entered names/notes stay unchanged.
8. Disconnect. History should show its online-only message and hide protected details without changing Today drafts. Reconnect and refresh.

Farm Managers must see only currently authorized farms and effective warehouse scope. Historical dates never restore a revoked assignment. Disabled organizations and Admin keep their previous navigation.

Automated local checks: `node scripts/test-history-browser.mjs`, `npm test`, `npm run typecheck`, focused ESLint and strict OpenSpec validation. The staging release gate includes `tests/browser/history-staging.spec.ts`; use the GitHub staging environment credentials, never passwords pasted into chat.
