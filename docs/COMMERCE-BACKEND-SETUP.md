# Bos Pangan Commerce Backend — Fresh Environment Setup

This repository is intended to run with a **new, dedicated Bos Pangan Supabase project** and a **new Vercel project**. Do not reconnect this repository to any previous Supabase or Vercel project.

## Included in this repository

- Role model and member/affiliate foundation.
- Product catalog with SKU, categories, stock, price, product-level tax, image URLs, and YouTube URL.
- Product image storage policies.
- Regular orders and special/quotation transactions.
- Order tax snapshots and store-level default tax settings.
- Owner order notification queue.
- Opt-in product email/push campaign foundation.
- Admin audit log and browser push subscription storage.
- Supabase Edge Functions for order creation and product campaigns.

## 1. Create a new Supabase project

1. Create a new Supabase project dedicated to Bos Pangan.
2. Record its Project URL and Publishable key from the new project's API settings.
3. Do not copy or reuse any URL, API key, database, auth users, or storage bucket from an older project.

## 2. Configure the website

Edit `auth-config.js` and replace the placeholders with values from the new Supabase project:

- `SUPABASE_URL`: the new Project URL.
- `SUPABASE_ANON_KEY`: the new Publishable key (or legacy anon/public key).

This file is loaded by browser JavaScript. Never put a Supabase secret key or service-role key in it.

## 3. Initialize the new database

Use the SQL Editor of the **new** Supabase project.

1. Run `supabase/schema.sql` first.
2. Review and apply `supabase/commerce-backend.sql` after the base schema.
3. Review the additional affiliate payout migrations (`affiliate-withdrawals.sql`, `commission-payout.sql`, and `affiliate-withdrawal-enhancements.sql`) against the new schema before applying them. Apply them only after their referenced tables and functions exist.

Run and verify migrations in a fresh test project before using the production database.

## 4. Authentication setup

In the new Supabase project's Authentication settings, configure the production website URL and allowed redirect URLs for the new Vercel deployment and, later, the Bos Pangan custom domain. Enable only the sign-in providers that Bos Pangan will use.

Register the first owner account after the new website is connected. The migrated repository currently does not contain the dedicated `initial-super-admin.sql` bootstrap file, so first-super-admin provisioning must be prepared and reviewed as a separate database migration before admin operations are enabled. Do not grant elevated roles from browser code.

## 5. Edge Function secrets

Set these secrets in the new Supabase project only:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose it to the browser)
- `ALLOWED_ORIGIN` (the new Vercel deployment origin)
- `RESEND_API_KEY` (when email delivery is enabled)
- `EMAIL_FROM` (verified sender address)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (when browser push is enabled)

Deploy the Edge Functions to the new Supabase project:

```sh
supabase functions deploy create-order
supabase functions deploy send-product-campaign
```

## 6. Create a new Vercel project

Import only `forbuldozer-eng/Bospangan.com` into a new Vercel project. Do not connect the previous Vercel project. Configure the new project's domain and environment according to the new deployment. After changing `auth-config.js` to the new Supabase values, redeploy and test the authentication, catalog, orders, admin dashboard, and Edge Functions.

## Operational security notes

- Keep Supabase secret/service-role keys and email provider keys in server-side secrets only.
- Never commit private API keys, passwords, or service-role credentials.
- A fresh Supabase project starts with an empty database, users, and storage; old customer, product, order, and affiliate records are not automatically transferred.
- Confirm tax rates with the business's tax advisor before enabling production transactions.
- Verify the email sender domain before sending campaigns.
- Scheduled campaign records require a separate scheduled dispatcher (for example, Supabase Cron) to send automatically.
- Browser push also requires a service worker and explicit customer permission.
