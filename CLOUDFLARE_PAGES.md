# Cloudflare Pages SEO build

This repository is a static HTML/CSS/JavaScript site. Cloudflare Pages must run the TKPI SEO generator during every deployment so the clean detail URLs and sitemap are rebuilt from the source dataset.

## Pages build settings

- Framework preset: None
- Build command: `node scripts/build-tkpi-seo.mjs`
- Build output directory: `.` (repository root)
- Root directory: repository root
- Production branch: keep the existing production branch setting; use branch previews to validate this change before any production cutover.

The build command creates one static HTML page for each TKPI 2017 food record under `/nutrisi/tkpi-2017/pangan/<slug>/`, then regenerates `/sitemap.xml` using the canonical `https://www.bospangan.com` host. Entries without source composition-page data or nutrient values remain accessible but receive `noindex` and are excluded from the sitemap.

## Validation before production

1. Confirm the Cloudflare Pages build completes and logs the generated-page and sitemap counts.
2. Open the TKPI 2017 directory and test several food detail links, including a simple name and a name containing punctuation/diacritics.
3. Confirm each detail page returns HTML with a unique title, meta description, self-referencing canonical, and visible nutrition table.
4. Confirm `https://www.bospangan.com/sitemap.xml` contains the generated detail URLs and `robots.txt` references that sitemap.
5. Confirm the sitemap only contains canonical, indexable URLs and has no duplicate locations.
6. Test the homepage, CMS login, customer login, catalog, blog and landing-page routes.
7. Check browser console and network errors.

Do not change DNS, production routing, or the live domain as part of this code change. Promote the Cloudflare Pages build only after preview validation and explicit approval.

## Supabase

The frontend public URL and publishable key remain in `auth-config.js`. Never put a Supabase secret/service-role key in browser code.
