# Little Lingo

Static English-learning platform for GitHub Pages: https://TarasMaks.github.io/LittleLingo/

Includes pre-A1 through C2 lessons, grammar guides, stories, history-based practice, spaced vocabulary recall, specialist domains, and a 100,000-entry frequency atlas. Ukrainian dictionary meanings cover approximately 17,000 atlas entries, with authored explanations for common function words. Missing translations are explicitly marked. Passing the included exercises is not CEFR certification or evidence of knowing every word at a level.

## Run locally

Requires Node 24 and npm.

```sh
npm ci
npm run dev
```

Open the displayed URL under `/LittleLingo/`. Run `npm test` and `npm run build` to validate, or `npm run preview` to serve the production build.

## Deployment

In repository Settings → Pages, select **GitHub Actions** as the source. Pushes to `main` build and deploy `dist` using `.github/workflows/pages.yml`. No API keys or backend services are required. The Vite base path is `/LittleLingo/`; update it if the repository name changes.

## Learning data

Progress, preferences, vocabulary history and teacher-created stories stay in this browser's local storage. They are not synced across devices. The parent & teacher area provides JSON backup and restore. Clearing browser data removes local progress; keep backups privately because they contain learner responses. The adult PIN is a local convenience lock, not a secure account or identity system. The earlier hosted site's database is not copied automatically.

LLM features are deferred. Adaptive practice uses deterministic review rules and checked questions. Speaking recordings stay on the current page and are not uploaded.

## Vocabulary sources

The frequency atlas includes source/license metadata and accompanying notices in `public`. Ukrainian dictionary mappings are adapted from [dmklinger/ukrainian](https://github.com/dmklinger/ukrainian), under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); see `public/lexicon/UKRAINIAN-SOURCES.txt`. Their adaptation retains that license. Automatically generated, unreviewed translation suggestions are not included.
