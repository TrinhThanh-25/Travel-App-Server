#!/usr/bin/env node
/**
 * Validate image URLs in location_images.csv and write a cleaned copy.
 * - Trim trailing commas from url cells
 * - Ensure http(s) scheme and a reasonable length
 * - HEAD request; if not 2xx/3xx, replace with placeholder
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify/sync');
const http = require('http');
const https = require('https');

const INPUT = path.resolve(__dirname, 'db_exports/archive/location_images.csv');
const OUTPUT = path.resolve(__dirname, 'db_exports/archive/location_images.cleaned.csv');
const PLACEHOLDER = 'https://via.placeholder.com/800x600?text=Image+Unavailable';

function headRequest(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.request(url, { method: 'HEAD' }, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ ok: true, code: res.statusCode });
        } else {
          resolve({ ok: false, code: res.statusCode || 0 });
        }
        res.resume();
      });
      req.on('error', () => resolve({ ok: false, code: 0 }));
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, code: 0 }); });
      req.end();
    } catch {
      resolve({ ok: false, code: 0 });
    }
  });
}

(async function main() {
  const input = fs.createReadStream(INPUT);
  const records = [];
  const parser = input.pipe(parse({ columns: true, skip_empty_lines: true, relax_column_count: true }));
  for await (const rec of parser) {
    records.push(rec);
  }

  const CONCURRENCY = 8;
  async function processBatch(batch) {
    return Promise.all(batch.map(async (rec) => {
      let url = (rec.url || '').trim().replace(/,+$/,'');
      if (!/^https?:\/\//i.test(url) || url.length < 10) {
        url = PLACEHOLDER;
      } else {
        const { ok } = await headRequest(url);
        if (!ok) url = PLACEHOLDER;
      }
      rec.url = url;
      return rec;
    }));
  }

  const cleaned = [];
  for (let i = 0; i < records.length; i += CONCURRENCY) {
    const batch = records.slice(i, i + CONCURRENCY);
    const out = await processBatch(batch);
    cleaned.push(...out);
  }

  const header = Object.keys(cleaned[0] || {});
  const csv = stringify(cleaned, { header: true, columns: header });
  fs.writeFileSync(OUTPUT, csv);
  console.log(`Wrote cleaned CSV: ${OUTPUT} (rows: ${cleaned.length})`);
})();
