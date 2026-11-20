# Cloudflare Pages alternative deployment

This repository is a static HTML/CSS/JavaScript site. Keep the existing Vercel project and production domain unchanged while validating Cloudflare Pages on its generated `*.pages.dev` preview URL.

## Pages build settings

- Framework preset: None
- Build command: leave blank
- Build output directory: repository root (`/` or `.`, depending on dashboard validation)
- Root directory: repository root

The root `_redirects` file preserves only the remaining dynamic landing-page and nutrition detail URL patterns using Cloudflare Pages internal rewrites.

## Validation before any DNS or production cutover

1. Confirm the Pages build completes.
2. Test the homepage, CMS login, customer login, product catalog, and category routes.
3. Test at least one published landing-page slug and one nutrition detail route.
4. Test Supabase auth, reads, and writes against the configured project.
5. Check browser console and network errors.
6. Only consider a production domain change after explicit approval and successful tests. Do not change DNS as part of this alternative setup.

## Supabase

The frontend public URL and publishable key remain in `auth-config.js`. The CLI project ID in `supabase/config.toml` is aligned to the same project. Never put a Supabase secret/service-role key in browser code.
