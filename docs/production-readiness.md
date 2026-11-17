# Bos Pangan production readiness

## Working branch
- Repository: forbuldozer-eng/Bospangan.com
- Production branch: main
- Working branch: feature/production-readiness-2026
- Production must not be updated until the checks below pass.

## Implemented in this branch
- Standardized canonical host references to https://www.bospangan.com on the homepage, blog index, static category pages, and static article pages.
- Added Open Graph and Twitter Card metadata to those public pages.
- Added homepage LocalBusiness JSON-LD using only the verified business name, website, logo, and city-level service area. No street address, phone number, postal code, or social account was invented.
- Added a permanent apex-host redirect to the www host in Vercel configuration.
- Updated robots.txt and sitemap.xml to the www canonical host.
- Added static asset caching headers.
- Added an affiliate registration page, Supabase Edge Function, database migration, referral click capture, and order attribution plumbing.
- Added a read-only query to identify candidate dummy products.
- Added .gitignore rules for local environment and deployment files.

## Required before production
1. Take and verify a Supabase database backup. The database has not been modified by this branch.
2. Review the read-only dummy-product query results with the owner. Do not delete any row until its dummy status is confirmed.
3. Apply supabase/affiliate.sql to the correct Bos Pangan Supabase project after backup.
4. Deploy the Supabase Edge Function named affiliate and verify its environment variables.
5. Confirm that https://www.bospangan.com is attached and verified in the Vercel project before relying on the redirect.
6. Confirm the Vercel external rewrite to the Supabase Edge Function works for POST requests and preflight requests.
7. Test affiliate registration, approval workflow, click tracking, checkout attribution, and dashboard statistics. New affiliates are pending by default; an admin approval mechanism must be confirmed before inviting partners.
8. Run a production build/test suite. This repository currently has no package.json or existing test workflow, so build/test commands cannot be assumed.
9. Check all public page canonical tags, sitemap URLs, robots.txt, console errors, mobile layout, and Core Web Vitals.
10. Deploy only after all blocking checks pass.

## Known limits
- No Supabase credentials or connected database administration session were available during this repository change. No database backup, migration execution, product deletion, or Edge Function deployment has been performed.
- Domain attachment and DNS status are not established by repository files alone.
- The affiliate dashboard is designed to show aggregate statistics for an active referral ID. The registration status is pending until approved.
- Affiliate attribution is non-blocking: if recording attribution fails, the customer's order still completes.
- The homepage and static content pages were updated. Dynamic template pages (CMS/dashboard and landing-page template) require a separate review of their runtime canonical metadata.
