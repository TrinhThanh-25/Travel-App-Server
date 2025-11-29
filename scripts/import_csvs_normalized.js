#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'

function readCSVLines(file) {
  const txt = fs.readFileSync(file, 'utf8')
  return txt.split(/\r?\n/).filter(Boolean)
}

function parseCSVWithHeader(lines) {
  // normalize header by stripping any prefix up to last '/'
  const headerLine = lines[0]
  const headers = headerLine.split(',').map(h => h.trim().replace(/^.*\//, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = []
    let cur = ''
    let inQuotes = false
    const line = lines[i]
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        if (inQuotes && line[j+1] === '"') { cur += '"'; j++; continue }
        inQuotes = !inQuotes
        continue
      }
      if (ch === ',' && !inQuotes) { cols.push(cur); cur = ''; continue }
      cur += ch
    }
    cols.push(cur)
    const obj = {}
    for (let k = 0; k < headers.length; k++) {
      obj[headers[k]] = cols[k] !== undefined ? cols[k].trim() : ''
    }
    rows.push(obj)
  }
  return rows
}

function writeTempJson(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-'))
  const file = path.join(dir, 'data.json')
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
  return file
}

function runUpsert(dbPath, table, jsonFile) {
  console.log(`Upsert table='${table}' from '${jsonFile}' into ${dbPath}`)
  const res = spawnSync(process.execPath, ['scripts/upsert_from_json.js', dbPath, table, jsonFile], { stdio: 'inherit' })
  if (res.error) throw res.error
  if (res.status !== 0) throw new Error(`Upsert exited ${res.status}`)
}

function importCsvFile(dbPath, csvPath) {
  const name = path.basename(csvPath).replace(/\.csv$/i, '')
  // Use the CSV filename (without extension) as the target table name to match DB
  const table = name
  try {
    const lines = readCSVLines(csvPath)
    if (lines.length <= 1) { console.log('Empty CSV, skip', csvPath); return }
    const rows = parseCSVWithHeader(lines)
    const tmp = writeTempJson(rows)
    runUpsert(dbPath, table, tmp)
  } catch (err) {
    console.error('Error importing', csvPath, err && err.message ? err.message : err)
  }
}

function walkAndImport(dbPath, dir) {
  if (!fs.existsSync(dir)) return
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.csv'))
  for (const f of files) {
    const full = path.join(dir, f)
    importCsvFile(dbPath, full)
  }
}

// CLI
const argv = process.argv.slice(2)
if (argv.length === 0) {
  console.log('Usage: node scripts/import_csvs_normalized.js --db <dbPath> [--dirs dir1,dir2]')
  process.exit(1)
}
let dbPath = null
let dirs = [path.join('scripts','db_exports'), path.join('scripts','db_exports','archive')]
for (let i=0;i<argv.length;i++){
  if (argv[i] === '--db') dbPath = argv[++i]
  if (argv[i] === '--dirs') dirs = argv[++i].split(',').map(s=>s.trim())
}
if (!dbPath) { console.error('Missing --db'); process.exit(2) }

console.log('Importing CSVs (normalized headers) into', dbPath)
for (const d of dirs) {
  const full = path.resolve(d)
  console.log('Scanning', full)
  walkAndImport(dbPath, full)
}

console.log('Done')
