#!/usr/bin/env node
/**
 * Validate image URLs in a CSV and write a cleaned copy replacing non-200 URLs
 * with a safe placeholder. Also normalizes simple lat/long formatting issues
 * (trim spaces and trailing commas). Designed for the project's archive CSV.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify/sync');
const http = require('http');
const https = require('https');

const INPUT = path.resolve(__dirname, 'db_exports/archive/locations.csv');
const OUTPUT = path.resolve(__dirname, 'db_exports/archive/locations.cleaned.csv');
const PLACEHOLDER = 'https://via.placeholder.com/800x600?text=Image+Unavailable';

function headRequest(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.request(url, { method: 'HEAD' }, (res) => {
        // Some servers don't support HEAD properly; fall back to GET if needed
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ ok: true, code: res.statusCode });
        } else {
          resolve({ ok: false, code: res.statusCode || 0 });
        }
        res.resume();
      });
      req.on('error', () => resolve({ ok: false, code: 0 }));
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve({ ok: false, code: 0 });
      });
      req.end();
    } catch (e) {
      resolve({ ok: false, code: 0 });
    }
  });
}

function normalizeCoord(value) {
  if (value == null) return value;
  let s = String(value).trim();
  // remove wrapping quotes or stray commas like "106.633528,"
  s = s.replace(/^["']+|["']+$/g, '');
  s = s.replace(/,$/, '');
  // if multiple dots found (e.g., 10.791.858.651...), keep first dot and remove others
  const dotCount = (s.match(/\./g) || []).length;
  if (dotCount > 1) {
    const firstDotIdx = s.indexOf('.');
    const before = s.slice(0, firstDotIdx + 1);
    const after = s.slice(firstDotIdx + 1).replace(/\./g, '');
    s = before + after;
  }
  // Attempt numeric parse
  const n = Number(s);
  if (Number.isFinite(n)) return String(n);
  return s; // leave as-is if still not parseable
}

(async function main() {
  const input = fs.createReadStream(INPUT);
  const records = [];
  const parser = input.pipe(parse({ columns: true, skip_empty_lines: true }));
  for await (const rec of parser) {
    records.push(rec);
  }

  // Validate images in small parallel batches to avoid too many sockets
  const CONCURRENCY = 8;
  async function processBatch(batch) {
    return Promise.all(
      batch.map(async (rec) => {
        const url = (rec.image_url || '').trim();
        let fixedUrl = url;
        if (!/^https?:\/\//i.test(fixedUrl) || fixedUrl.length < 10) {
          fixedUrl = PLACEHOLDER;
        } else {
          const { ok } = await headRequest(fixedUrl);
          if (!ok) fixedUrl = PLACEHOLDER;
        }
        // Normalize coordinates
        rec.latitude = normalizeCoord(rec.latitude);
        rec.longtitude = normalizeCoord(rec.longtitude);
        // Assign possibly updated image
        rec.image_url = fixedUrl;
        return rec;
      })
    );
  }

  const cleaned = [];
  for (let i = 0; i < records.length; i += CONCURRENCY) {
    const batch = records.slice(i, i + CONCURRENCY);
    const out = await processBatch(batch);
    cleaned.push(...out);
  }

  // Write cleaned CSV
  const header = Object.keys(cleaned[0] || {});
  const csv = stringify(cleaned, { header: true, columns: header });
  fs.writeFileSync(OUTPUT, csv);
  console.log(`Wrote cleaned CSV: ${OUTPUT} (rows: ${cleaned.length})`);
})();
