# Bos Pangan CMS — Fresh Vercel and Supabase Setup

Bos Pangan uses a new Vercel project and a new, dedicated Supabase project. Do not reconnect this repository to any previous Vercel or Supabase project.

## CMS roles

The CMS has exactly two privileged roles:

- **Super Admin**: full CMS access, store settings, tax defaults, notification settings, and Admin access management.
- **Admin**: product catalog, product images, orders, special transactions, and campaign management.

A new Supabase Auth user is created with **no CMS role**. The Super Admin must explicitly grant Admin access. No public registration is provided by the website login.

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

1. `supabase/schema.sql` — profiles, role checks, access-control functions, and Auth profile trigger.
2. `supabase/commerce-backend.sql` — products, product image Storage, tax settings, regular and special orders, email/push campaign tables, and audit log.

No additional migrations are needed beyond these two SQL files.

## 4. Create the first Super Admin

1. In Supabase, open **Authentication → Users → Add user**.
2. Create the owner account using an email address you control and set a secure password.
3. Open `supabase/bootstrap-super-admin.sql` in this repository.
4. Replace `YOUR_SUPER_ADMIN_EMAIL` with the exact owner email, then run the script in the new project's SQL Editor.
5. Confirm the verification query returns that account with role `super_admin`.

The bootstrap SQL must be run manually by the project owner. Do not expose elevated credentials or assign roles from browser JavaScript.

## 5. Create additional Admin accounts

1. In Supabase, open **Authentication → Users → Add user** and create the new Admin account.
2. The database trigger creates the user's profile with no CMS access.
3. Sign in to the Bos Pangan website with the Super Admin account and open **Dashboard CMS → Pengelolaan Akun Admin**.
4. Change the new account's access to **Admin**.

The Super Admin can later revoke Admin access from the same panel. An Admin cannot grant or revoke roles, and the Super Admin account is protected from changes in the panel.

For security, disable public sign-ups in Supabase Authentication settings. Create CMS accounts only from the Supabase Auth dashboard, then grant Admin access through the CMS.

## 6. Create a new Vercel project

1. Import only `forbuldozer-eng/Bospangan.com` into a **new** Vercel project.
2. Use `main` as the Production Branch.
3. Do not connect the previous Vercel project.
4. After the new Supabase database is ready, deploy the website and test Admin login, product creation, image upload, tax settings, orders, and special transactions.
5. Connect the custom domain only after the new deployment has been tested.

## 7. Server-side secrets and Edge Functions

Set these secrets only in the new Supabase project:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (the new Publishable key)
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose to the browser)
- `ALLOWED_ORIGIN` (the new Vercel deployment origin)
- `RESEND_API_KEY` (when email delivery is enabled)
- `EMAIL_FROM` (verified sender address)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (when browser push is enabled)

Deploy the Edge Functions to the new project:

```sh
supabase functions deploy create-order
supabase functions deploy send-product-campaign
```

## Important operational notes

- Keep all secret/service-role keys and email provider keys in server-side secrets only.
- A fresh Supabase project starts with an empty database, users, and Storage. Previous products, orders, users, and media are not transferred.
- Admin and Super Admin access is enforced by database functions and Row Level Security, not only by hidden frontend controls.
- Confirm applicable tax rates with the business's tax advisor before enabling production transactions.
- Verify the email sender domain before sending campaigns.
- Scheduled campaign records require a separate scheduled dispatcher (for example, Supabase Cron) to send automatically.
- Browser push requires a service worker and explicit customer permission.
