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

```bash
cd capture
bun install                 # or npm install
npx playwright install chromium   # first time only
APP_URL=<app address> GUIDE_EMAIL=<demo account> GUIDE_PASSWORD=<password> \
  npx playwright test --config capture.config.ts             # all pages
  npx playwright test --config capture.config.ts 06-chart    # one page
```

Look at every new picture before committing it.

## Publishing

Every push to `main` runs `.github/workflows/pages.yml`, which builds with `mkdocs build --strict` and publishes
to GitHub Pages. One-time setup: **Settings › Pages › Build and deployment › Source: GitHub Actions**.
