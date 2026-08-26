/*
 * Regenerates the JOURNEY_DATA block inside index.html from content.md.
 *
 *   node build.mjs                              # default password
 *   PASSWORD='our-day' node build.mjs           # custom password
 *   SHOW_DRAFTS=true node build.mjs             # include unpublished chapters
 *
 * The rest of the site (styles, scripts) lives inline inside index.html and
 * needs no build step — refresh the browser after editing it directly.
 */

import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const contentFile = path.join(root, "content.md");
const photosRoot = path.join(root, "photos");
const indexFile = path.join(root, "index.html");
const includeDrafts = process.env.SHOW_DRAFTS === "true";
const password = process.env.PASSWORD || "august29";
const passwordHint =
  process.env.PASSWORD_HINT || "The date our story became ours.";

const supportedExts = /\.(jpe?g|png|webp|heic|heif|avif)$/i;

/* ------------------------------------------------------------------ *
 * Front-matter parser (shared for both `site` and `chapter` blocks)  *
 * ------------------------------------------------------------------ */

function parseValue(key, rawValue) {
  const value = rawValue.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (key === "images" || key === "orientations") {
    if (!value) return [];
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  if (key === "locations") {
    return value.split("|").map((item) => item.trim());
  }
  return value.replace(/^["']|["']$/g, "");
}

function parseBlock(source, label) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/);
  if (!match) {
    throw new Error(`${label}: expected front matter wrapped in ---`);
  }
  const metadata = {};
  for (const [lineIndex, line] of match[1].split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator === -1) {
      throw new Error(`${label} line ${lineIndex + 2}: expected "key: value"`);
    }
    const key = line.slice(0, separator).trim();
    metadata[key] = parseValue(key, line.slice(separator + 1));
  }
  return { ...metadata, body: (match[2] || "").trim() };
}

function titleCase(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* ------------------------------------------------------------------ *
 * Validation                                                          *
 * ------------------------------------------------------------------ */

function validateChapter(chapter, label, previousDate) {
  for (const field of ["id", "date", "caption", "body"]) {
    if (typeof chapter[field] !== "string" || !chapter[field].trim()) {
      throw new Error(`${label}: "${field}" must be a non-empty string`);
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapter.id)) {
    throw new Error(`${label}: "id" must be a lowercase slug (e.g. the-beginning)`);
  }
  const timestamp = Date.parse(`${chapter.date}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label}: "${chapter.date}" is not a valid ISO date`);
  }
  if (timestamp < previousDate) {
    throw new Error(`${label}: chapter dates must remain chronological`);
  }

  const orientations = chapter.orientations ?? [];
  const images = chapter.images ?? [];
  const hasImages = images.length > 0;

  if (orientations.length > 0) {
    if (hasImages && images.length !== orientations.length) {
      throw new Error(
        `${label}: images count (${images.length}) must match orientations count (${orientations.length})`,
      );
    }
    for (const orientation of orientations) {
      if (!["portrait", "landscape", "auto"].includes(orientation)) {
        throw new Error(`${label}: orientation must be portrait, landscape, or auto`);
      }
    }
  } else if (!hasImages) {
    orientations.push("landscape");
  }

  for (const filename of images) {
    if (!supportedExts.test(filename)) {
      throw new Error(
        `${label}: "${filename}" is not a supported image type (jpg, jpeg, png, webp, heic, heif, avif)`,
      );
    }
  }

  return timestamp;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const sha256Hex = (value) => createHash("sha256").update(String(value)).digest("hex");

/* ------------------------------------------------------------------ *
 * Build                                                               *
 * ------------------------------------------------------------------ */

async function build() {
  const raw = await readFile(contentFile, "utf8");
  const blocks = raw
    .split(/\n===\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    throw new Error("content.md contains no blocks");
  }

  let site = null;
  const chapters = [];
  let previousDate = Number.NEGATIVE_INFINITY;
  const seenIds = new Set();

  for (let index = 0; index < blocks.length; index += 1) {
    const label = `content.md block #${index + 1}`;
    const parsed = parseBlock(blocks[index], label);
    const type = parsed.type || "chapter";

    if (type === "site") {
      if (site) throw new Error(`${label}: only one "type: site" block is allowed`);
      const { body: _ignored, type: _ignored2, ...siteFields } = parsed;
      site = siteFields;
      continue;
    }

    if (type !== "chapter") {
      throw new Error(`${label}: unknown block type "${type}" (expected site or chapter)`);
    }

    const chapter = parsed;
    previousDate = validateChapter(chapter, label, previousDate);

    if (seenIds.has(chapter.id)) {
      throw new Error(`${label}: duplicate id "${chapter.id}"`);
    }
    seenIds.add(chapter.id);

    if (!chapter.published && !includeDrafts) continue;

    const images = chapter.images ?? [];
    const hasImages = images.length > 0;
    let resolvedImages = [];
    let placeholder = true;

    if (hasImages) {
      const missingFiles = [];
      for (const filename of images) {
        const filePath = path.join(photosRoot, chapter.id, filename);
        if (!(await fileExists(filePath))) {
          missingFiles.push(`photos/${chapter.id}/${filename}`);
        }
      }
      if (missingFiles.length > 0) {
        console.warn(
          `  ⚠  ${label} (${chapter.id}): missing photo files — ${missingFiles.join(", ")}`,
        );
        console.warn(`     → falling back to placeholder images for this chapter`);
      } else {
        resolvedImages = images.map(
          (filename) => `photos/${chapter.id}/${filename}`,
        );
        placeholder = false;
      }
    }

    let orientations = chapter.orientations ?? [];
    if (orientations.length === 0) {
      const slotCount = resolvedImages.length || 1;
      orientations = Array.from({ length: slotCount }, () => "auto");
    }

    chapters.push({
      id: chapter.id,
      order: chapters.length + 1,
      title: chapter.title || titleCase(chapter.id),
      date: chapter.date,
      locations: chapter.locations ?? [],
      caption: chapter.caption,
      body: chapter.body,
      orientations,
      images: resolvedImages,
      placeholder,
      published: Boolean(chapter.published),
    });
  }

  if (!site) throw new Error("content.md must include one `type: site` block");
  if (chapters.length === 0) throw new Error("No chapters are available to generate.");

  const bundle = {
    generatedAt: new Date().toISOString(),
    passwordHash: sha256Hex(password),
    passwordHint,
    site,
    chapters,
  };

  const dataJs = `window.JOURNEY_DATA = ${JSON.stringify(bundle, null, 2)};`;

  /* Inject the data block between the fixed markers in index.html. This
     is the only edit build.mjs makes — CSS and app code stay untouched. */
  const html = await readFile(indexFile, "utf8");
  const markerPattern =
    /(\/\*__JOURNEY_DATA_BEGIN__\*\/)[\s\S]*?(\/\*__JOURNEY_DATA_END__\*\/)/;
  if (!markerPattern.test(html)) {
    throw new Error(
      "index.html is missing the /*__JOURNEY_DATA_BEGIN__*/ … /*__JOURNEY_DATA_END__*/ markers",
    );
  }
  const nextHtml = html.replace(
    markerPattern,
    `$1\n${dataJs}\n$2`,
  );
  await writeFile(indexFile, nextHtml);

  const real = chapters.filter((ch) => !ch.placeholder).length;
  const demo = chapters.filter((ch) => ch.placeholder).length;

  console.log(
    `Injected JOURNEY_DATA into index.html — ${chapters.length} chapters (${real} with photos, ${demo} placeholder).`,
  );
  console.log(
    `Password hash embedded for: ${password === "august29" ? "august29 (default)" : "(from PASSWORD env)"}`,
  );
}

build().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
