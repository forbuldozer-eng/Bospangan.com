# Bos Pangan — Staging and HPP verification

## Safety boundary

- Do not merge this branch into `main` during development.
- Do not run the inventory migration against the production Supabase project.
- Do not run `supabase db push`, `supabase link`, or any Vercel deployment command as part of this verification.
- The repository's current `supabase/config.toml` project ID is not a staging credential. Do not treat it as permission to connect to production.
- The Vercel preview hostname deliberately renders the HPP module in read-only placeholder mode and does not query Supabase.

## Database prerequisite order

On an isolated Supabase local stack or a separately created staging project, first apply the repository's core SQL in the order already documented by the project:

1. `supabase/schema.sql`
2. `supabase/commerce-backend.sql`
3. `supabase/checkout.sql`
4. `supabase/order-cancellation.sql`
5. `supabase/inventory-hpp-moving-average.sql`

Apply any other existing CMS/customer migrations required by the staging copy before testing the dashboard. Do not apply this SQL to production.

After the HPP migration, run:

- `supabase/tests/inventory-hpp.test.sql`

The test file checks the moving-average arithmetic and invalid negative opening quantity. It is a database test script; it has not been run in this environment because no isolated Supabase database connection or staging credentials are available.

## Manual end-to-end scenario

Use a disposable product and supplier in staging:

1. Create supplier `SUP-HPP-TEST`.
2. Create a product with stock 100 kg and set its verified opening HPP to Rp10,000/kg.
3. Create a purchase for 50 kg at Rp12,000/kg with Rp100,000 additional freight.
4. Receive the purchase. Landed unit cost should be Rp14,000/kg; resulting stock 150 kg; moving average should be Rp11,333.33/kg.
5. Create a regular checkout for 10 kg. Stock should reduce to 140 kg; the order item must retain the Rp11,333.33/kg cost snapshot; the stock ledger must contain one `sale_out` movement.
6. Receive another 50 kg at Rp12,000/kg with Rp100,000 freight. Verify the new moving average using the recorded balance and landed unit cost.
7. Cancel the eligible unpaid order. The existing cancellation trigger restores 10 kg; the HPP return trigger records one `sale_return` movement and values the returned units at their original cost snapshot.
8. Record a partial supplier payment. Verify `amount_paid`, `balance_due`, and `payment_status`; then settle the remaining balance.
9. Verify the financial report's HPP and gross profit against the order-item snapshots. Older orders without a cost snapshot must remain marked incomplete; do not invent historical HPP.

## Expected controls

- Public catalog reads `products` only. HPP is stored in `product_inventory_costs`, whose RLS policy permits reads only to admins.
- No authenticated browser role receives direct insert/update/delete privileges on private cost or ledger tables. Mutations use admin-checked RPCs.
- Checkout snapshots average cost and records stock-out in the same transaction as order creation.
- Cancellation stock restoration is followed by a return movement and moving-average revaluation.
- Draft purchase orders do not change stock or HPP until the receive action succeeds.
- A purchase cannot be received against existing stock whose opening HPP has not been valued.

## Verification status

Static repository review and source-level checks only. SQL execution, Supabase RLS verification, browser integration testing, and end-to-end checkout tests remain pending until an isolated local/staging database is available. No Vercel deployment was initiated by this work.
