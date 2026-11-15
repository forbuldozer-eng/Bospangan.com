# Bos Pangan CMS — Fresh Vercel and Supabase Setup

Bos Pangan uses a new Vercel project and a new, dedicated Supabase project. Do not reconnect this repository to any previous Vercel or Supabase project.

## CMS roles

Bos Pangan separates customer accounts from CMS access:

- **Customer**: can maintain their own profile and read only their own order history. Customers cannot access CMS, manage products, change order/payment status, or read other customers' data.
- **Super Admin**: full CMS access, store settings, tax defaults, notification settings, and Admin access management.
- **Admin**: product catalog, product images, orders, special transactions, and campaign management.

Public website sign-up assigns only the `customer` role. The fixed sign-up marker can never grant Admin or Super Admin. Auth users created manually in Supabase start unassigned until the Super Admin grants a role.

## 1. Create the new Supabase project

1. Create a new Supabase project dedicated to Bos Pangan.
2. Copy the Project URL and Publishable key from the new project's API settings.
3. Do not reuse any URL, API key, database, Auth user, or Storage bucket from an older project.

## 2. Configure the frontend

The website reads its public Supabase configuration from `auth-config.js`:

- `SUPABASE_URL`: the new Project URL.
- `SUPABASE_ANON_KEY`: the new Publishable key (`sb_publishable_...`).

The new Bos Pangan Project URL and Publishable key are already configured in this repository. This file is browser-side configuration; never put a Supabase Secret key or service-role key in it.

## 3. Initialize the new database

Open SQL Editor in the **new** Supabase project and run these files in this exact order:

1. `supabase/schema.sql` — profiles, role checks, CMS access-control functions, and Auth profile trigger.
2. `supabase/commerce-backend.sql` — products, product image Storage, tax settings, regular and special orders, email/push campaign tables, and audit log.
3. `supabase/checkout.sql` — secure server-side checkout, stock reservation, rate limiting, and public tax lookup.
4. `supabase/customer-accounts.sql` — customer role, customer-only profile enrollment, own-order and own-order-item read policies, and secure order-to-account linking.

The customer migration must be run after the checkout migration. It is safe to re-run.

## 4. Create the first Super Admin

1. In Supabase, open **Authentication → Users → Add user**.
2. Create the owner account with the email forbuldozer@gmail.com and set a secure password.
3. Open `supabase/bootstrap-super-admin.sql` in this repository.
4. Run the script in the new project's SQL Editor. It is configured for the first owner account, forbuldozer@gmail.com.
5. Confirm the verification query returns that account with role `super_admin`.

The bootstrap SQL must be run manually by the project owner. Do not expose elevated credentials or assign roles from browser JavaScript.

## 5. Create additional Admin accounts

1. In Supabase, open **Authentication → Users → Add user** and create the new Admin account.
2. The database trigger creates the user's profile with no CMS access.
3. Sign in to the Bos Pangan website with the Super Admin account and open **Dashboard CMS → Pengelolaan Akun Admin**.
4. Change the new account's access to **Admin**.

The Super Admin can later revoke Admin access from the same panel. An Admin cannot grant or revoke roles, and the Super Admin account is protected from changes in the panel.

Keep **Allow new users to sign up** enabled so customers can create website accounts. Keep email confirmation enabled where practical and configure the Supabase Auth Site URL as `https://www.bospangan.com`. Add these redirect URLs to the Auth URL allowlist:

- `https://www.bospangan.com/**`
- `https://bospangan.com/**`

Customer sign-ups receive only the customer role. Create CMS users separately from Supabase Authentication → Users, then grant Admin access through the Super Admin panel. Never expose database secret/service-role keys in browser code.

## 6. Create a new Vercel project

1. Import only `forbuldozer-eng/Bospangan.com` into a **new** Vercel project.
2. Use `main` as the Production Branch.
3. Do not connect the previous Vercel project.
4. After the new Supabase database is ready, deploy the website and test customer sign-up/login, CMS login, product creation, image upload, tax settings, orders, and special transactions.
5. Connect the custom domain only after the new deployment has been tested.

## 7. Server-side secrets and Edge Functions

Open **Supabase → Edge Functions → Secrets** in the new project. Add custom secrets only here; never put provider keys in frontend files, GitHub, SQL, screenshots, or chat.

For transactional order email, set:

- `RESEND_API_KEY` — a Resend API key with Sending access, preferably restricted to the verified Bos Pangan sending domain.
- `EMAIL_FROM` — a sender identity on the verified domain, for example `Bos Pangan <pesanan@bospangan.com>`. Use this only after Resend shows `bospangan.com` as verified for sending.

The `create-order` function reads the built-in `SUPABASE_URL` and the project's default server secret key from `SUPABASE_SECRET_KEYS.default`. It supports the legacy `SUPABASE_SERVICE_ROLE_KEY` as a fallback, but do not put any Supabase secret/service-role key in browser code.

The function optionally reads `ALLOWED_ORIGINS` (plural, comma-separated origins). The code already includes `https://bospangan.com`, `https://www.bospangan.com`, and the current Vercel production hostname by default; add a custom origin only when needed.

For browser push, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` only after the push workflow is configured.

Deploy the Edge Functions to the new project:

```sh
supabase functions deploy create-order
supabase functions deploy send-product-campaign
```

## 8. Enable owner order-email notifications

1. In Resend → Domains, confirm `bospangan.com` has a **Verified** sending status. If not, add the exact DKIM/SPF records displayed by Resend to the authoritative DNS zone at Domainesia. Do not replace existing Vercel A/CNAME records; add Resend records alongside them. Add the optional DMARC TXT record separately.
2. In Resend → API Keys, create a dedicated key with **Sending access** and domain restriction if available. Copy it once; it starts with `re_`.
3. In Supabase → Edge Functions → Secrets, save `RESEND_API_KEY` and `EMAIL_FROM` using the values described above.
4. Sign in to `https://bospangan.com/cms/` as Super Admin. Open **Pengaturan**, enter the owner notification email, leave **Aktifkan notifikasi email** checked, and save.
5. Place a low-value test order after the configuration is ready. The order email should arrive at the owner address. Check **Email & Push → Log notifikasi email pesanan** in the CMS for delivery status.
6. If an email shows failed, inspect the recorded provider error in the CMS log and correct the sender/domain/API-key configuration before trying another order.

Orders created before the Resend secrets and owner email are configured are not automatically resent by the current checkout request. The new configuration applies to subsequent orders. Do not use a real customer's order to test the email service.

## Important operational notes

- Keep all secret/service-role keys and email provider keys in server-side secrets only.
- A fresh Supabase project starts with an empty database, users, and Storage. Previous products, orders, users, and media are not transferred.
- Customer, Admin, and Super Admin permissions are enforced by database functions and Row Level Security, not only by hidden frontend controls.
- Customer order history works only for orders that were placed while signed in (or securely linked using the order email that matches the authenticated account). Older guest orders remain guest orders.
- Confirm applicable tax rates with the business's tax advisor before enabling production transactions.
- Verify the email sender domain before sending campaigns.
- Scheduled campaign records require a separate scheduled dispatcher (for example, Supabase Cron) to send automatically.
- Browser push requires a service worker and explicit customer permission.
