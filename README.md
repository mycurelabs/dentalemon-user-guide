# Dentalemon User Guide

Step-by-step guides for dentists using Dentalemon, published with GitHub Pages:
<https://mycurelabs.github.io/dentalemon-user-guide/>

Built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/). Pages are plain Markdown in `docs/`.

## Edit and preview locally

```bash
python3 -m venv .venv          # or: uv venv .venv
.venv/bin/pip install -r requirements.txt   # or: uv pip install -r requirements.txt
.venv/bin/mkdocs serve         # http://127.0.0.1:8000, reloads on save
.venv/bin/mkdocs build --strict  # what the publish workflow runs; fails on broken links or images
```

## Writing a page

Copy `docs/_template.md` (it's left out of the site) and add the page to `nav` in `mkdocs.yml`.
The rules are at the top of the template: exact on-screen words in **bold**, one action per step,
a "You should see" line per step, alt text on every picture, and only what the app does today.

## Screenshots

Pictures live in `docs/assets/<page>/` as `.webp` files, taken at iPad landscape size (1180×820, 2x).
They come from the scripts in `capture/`, which drive a running copy of the app filled with
**made-up demo data**. This repository is public: never capture real patients, real clinics,
staff emails, server addresses or developer tools.

The scripts run in WebKit (Safari's engine) as an 11" iPad in landscape, with touch. They reuse the
app's own end-to-end helpers (sign-in, patients, encounters, charges, the tooth-entry wizard)
straight from a checkout of the app's monorepo, so they need that checkout and its installed packages.

```bash
cd capture
bun install                                   # sharp, for WebP
./link-app.sh /path/to/monobase-mycure        # use that checkout's Playwright (one shared copy)
node_modules/.bin/playwright install webkit   # first time only

export APP_URL=<app address> APP_DIR=/path/to/monobase-mycure/apps/dentalemon
export GUIDE_EMAIL=<demo account> GUIDE_PASSWORD=<password>
node_modules/.bin/playwright test --config capture.config.ts             # all pages
node_modules/.bin/playwright test --config capture.config.ts 06-chart    # one page
```

Look at every new picture before committing it.

## Checking the site

`capture/site/` holds a few checks on the guide itself, such as the light and dark switch in the top bar.
Run them against `mkdocs serve`:

```bash
cd capture
node_modules/.bin/playwright test --config site.config.ts
```

## Publishing

Every push to `main` runs `.github/workflows/pages.yml`, which builds with `mkdocs build --strict` and publishes
to GitHub Pages. One-time setup: **Settings › Pages › Build and deployment › Source: GitHub Actions**.
