# August, then always

A private, cinematic first-year relationship journey covering August 29th, 2025 through August 29th, 2026.

Six files, no framework, no npm packages at runtime. Serve the folder anywhere static (Vercel, Netlify, GitHub Pages, S3, or `python3 -m http.server`).

## Files

```
first-year/
├── index.html          HTML + inline CSS + inline JS + injected data
├── heic-to.min.js      vendored iOS HEIC/HEIF decoder (browser-only)
├── content.md          site copy + every chapter, one file
├── build.mjs           regenerates the data block inside index.html
├── README.md
├── .gitignore
└── photos/
    └── <chapter-id>/   drop real photos here (one folder per chapter)
```

## Run locally

Node.js 20+ is only needed for the build script — the runtime uses only the browser.

```bash
cd first-year
node build.mjs                    # regenerates the JOURNEY_DATA in index.html
python3 -m http.server 8080       # serves at http://localhost:8080
```

Open <http://localhost:8080>. The unlock view appears first.

Local default password:

```text
august29
```

Local shortcuts (only work on `localhost` / `127.0.0.1`):

- `?peek=1` — bypass the unlock (development only).
- `?open=1` — skip the camera intro animation.
- `?skipIntro=1` — same, with the normal fade.
- `?scene=<chapter-id>` — jump straight to a chapter for screenshots.

## Choose your own password

Only the SHA-256 hash is embedded in `index.html`.

```bash
PASSWORD='our-day' PASSWORD_HINT='The month we started' node build.mjs
```

## Edit the story

All content lives in one file: **`content.md`**. It has one `type: site` block for global copy, then one `type: chapter` block per chapter, separated by lines containing only `===`.

```markdown
---
type: site
siteTitle: August, then always
startDate: 2025-08-29
endDate: 2026-08-29
eyebrow: OUR FIRST YEAR
openingLine: Somewhere between the long drives and ordinary days, we became home.
...
---

===

---
type: chapter
id: the-beginning
title: The Beginning
date: 2025-08-29
locations: The places where it began
caption: The day a quiet conversation changed the shape of everything.
images: photo-1.jpg, sunset.heic
published: true
---
Your chapter text goes here. One medium paragraph works best.

===

---
type: chapter
id: next-chapter
title: Next Chapter
date: 2025-10-12
...
```

After any content change: `node build.mjs`.

### Chapter fields

| Field          | Purpose                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`           | Lowercase slug — used as HTML id and photos folder name.                                                   |
| `title`        | Display title. Falls back to title-casing the `id` if omitted.                                             |
| `date`         | ISO date, e.g. `2025-08-29`. Rendered as "August 29th, 2025".                                              |
| `locations`    | One or more locations, separated by `\|`.                                                                  |
| `caption`      | Short caption placed on the photo stack.                                                                   |
| `images`       | Comma-separated filenames of photos in `photos/<id>/`. Leave empty for demo art.                          |
| `orientations` | *Optional*. One `portrait`, `landscape`, or `auto` per image. Omit to auto-detect from the real photo.    |
| `published`    | `true` to include; `false` hides unless `SHOW_DRAFTS=true node build.mjs`.                                 |
| Body text      | The chapter reflection (one medium paragraph, after the closing `---`).                                    |

## Adding photos

1. Drop your photos into `photos/<chapter-id>/`:

```
photos/
  the-beginning/
    first-date.jpg
    walking-home.heic
  the-long-way-home/
    road-trip.jpg
    sunset.heic
```

2. List those filenames in the chapter's `images:` field:

```markdown
---
type: chapter
id: the-beginning
...
images: first-date.jpg, walking-home.heic
---
```

(No `orientations:` line needed — the frames re-shape to the actual photo aspect at load time.)

3. Run `node build.mjs`. It validates every listed file exists in `photos/<id>/` and embeds the paths into `index.html`.

If a photo is missing, the build prints a warning and that chapter falls back to generated placeholder art — it won't break the site.

**Photo tips:**
- Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, and iOS `.heic` / `.heif`.
- HEIC/HEIF from iPhone work out of the box — decoded to JPEG in the browser via the bundled `heic-to.min.js`. No conversion needed.
- Photo frames auto-adjust to each image's real aspect ratio, so you don't have to declare `portrait` / `landscape`.
- Resize to ~1600 px on the longest edge for best performance (HEIC files can be 3–5 MB).
- No spaces in filenames (use dashes).

## Adding a new chapter

Add a new `===`-separated `type: chapter` block to `content.md`. Rules:
- `id` must be unique across all chapters.
- `date` must be chronologically after the previous chapter.
- If you supply an `orientations:` line, the count must match `images:`. Otherwise omit it.

Then `node build.mjs`.

## Finale

The site ends at "our story is still being written" until the anniversary. To publish the finale, set in the `type: site` block:

```yaml
finalePublished: true
```

Then `node build.mjs`.

## Editing the app itself

CSS, unlock logic, and journey renderer all live inline inside `index.html`:

- Everything under `<style>…</style>` is the design system.
- Everything under the final `<script>…</script>` block is the runtime app (an IIFE for the unlock flow, then another IIFE for the journey renderer).
- The `<script src="heic-to.min.js" defer></script>` line pulls in the vendored HEIC decoder. Don't inline it — it's ~3 MB.
- The `/*__JOURNEY_DATA_BEGIN__*/ … /*__JOURNEY_DATA_END__*/` markers are the only region `build.mjs` rewrites. Anything outside those markers is safe to edit by hand.

## Deploy

Any static host. Two examples:

**Vercel** — push this folder to a private repo, import into Vercel, set the Root Directory to `first-year`, no build command needed (or `node build.mjs` if you want Vercel to regenerate the data on push).

**Any local network** —

```bash
python3 -m http.server 8080
```

Then share the URL. `sessionStorage` remembers the unlock only until the browser tab closes.

## Security notes

- The password is checked in the browser against a SHA-256 hash embedded in `index.html`. Enough to block casual link-sharing; not high-assurance storage.
- Journey content is inlined in the page, so it's present once the site loads. The password gate hides it from the UI, not from a DevTools-savvy inspector.
- No analytics, third-party requests, or external fonts. Nothing leaves the browser.
