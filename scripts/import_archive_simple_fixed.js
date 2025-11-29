#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'

function readCSV(csvPath){
  const text = fs.readFileSync(csvPath,'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  if(lines.length===0) return { headers:[], rows:[] }
  const headers = lines[0].split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(h=>h.trim())
  const rows = lines.slice(1).map(l=>{
    const cols = l.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
    const obj = {}
    for(let i=0;i<headers.length;i++) obj[headers[i]] = cols[i] !== undefined ? cols[i].trim().replace(/^\"|\"$/g,'') : ''
    return obj
  })
  return { headers, rows }
}

function writeTempJson(data){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'imp-'))
  const file = path.join(dir,'data.json')
  fs.writeFileSync(file, JSON.stringify(data,null,2),'utf8')
  return file
}

function runUpsert(dbPath, table, jsonFile){
  console.log(`Upserting ${table} from ${jsonFile} into ${dbPath}`)
  const res = spawnSync(process.execPath, [path.join('scripts','upsert_from_json.js'), dbPath, table, jsonFile], { stdio: 'inherit' })
  if(res.error) throw res.error
  if(res.status !== 0) throw new Error(`Upsert CLI exited with status ${res.status}`)
}

function normalizeMotorbikes(csvPath){
  const { headers, rows } = readCSV(csvPath)
  const out = rows.map(r=>{
    const obj = {}
    for(const h of Object.keys(r)){
      const short = h.split('/').pop()
      obj[short] = r[h] === '' ? null : r[h]
    }
    // map camelCase CSV headers to snake_case DB columns
    const mapped = {
      id: obj.id || null,
      name: obj.name || null,
      image_url: obj.imageUrl || obj.image_url || null,
      brake_type: obj.brakeType || obj.brake_type || null,
      power: obj.power || null,
      year: obj.year ? Number(obj.year) : null,
      engine_volume: obj.engineVolume || obj.engine_volume || null,
      license_required: (obj.licenseRequired !== undefined) ? (String(obj.licenseRequired).toLowerCase() === 'true' ? 1 : 0) : null,
      model3d_url: obj.model3dUrl || obj.model3d_url || null,
      price_per_hour: obj.pricePerHour ? Number(obj.pricePerHour) : null,
      available: (obj.available !== undefined) ? (String(obj.available).toLowerCase() === 'true' ? 1 : 0) : null
    }
    return mapped
  })
  return out
}

function normalizeShops(csvPath){
  const { headers, rows } = readCSV(csvPath)
  const out = rows.map(r=>{
  const obj = { galleryImages: [], motorbikes: [], userReviews: [] }
    // collect grouped fields
    for(const h of Object.keys(r)){
      const parts = h.split('/')
      if(parts[1] === 'galleryImages'){
        obj.galleryImages.push(r[h])
        continue
      }
      if(parts[1] === 'motorbikes'){
        obj.motorbikes.push(r[h])
        continue
      }
      if(parts[1] === 'owner'){
        obj.owner = obj.owner || {}
        obj.owner[parts[2]] = r[h]
        continue
      }
      if(parts[1] === 'userReviews'){
        const idx = Number(parts[2])
        obj.userReviews[idx] = obj.userReviews[idx] || {}
        obj.userReviews[idx][parts[3]] = r[h]
        continue
      }
      // default: shops/<field>
      const short = parts.pop()
      obj[short] = r[h]
    }
  // cleanup empty arrays
  obj.galleryImages = obj.galleryImages.filter(x=>x && x.length)
  obj.motorbikes = obj.motorbikes.filter(x=>x && x.length)
  obj.userReviews = (obj.userReviews || []).filter(x=>x && Object.keys(x).length)
    // coerce numeric fields
    if('latitude' in obj) obj.latitude = obj.latitude ? Number(obj.latitude) : null
    if('longitude' in obj) obj.longitude = obj.longitude ? Number(obj.longitude) : null
    if('rating' in obj) obj.rating = obj.rating ? Number(obj.rating) : null
    if('ratingCount' in obj) obj.ratingCount = obj.ratingCount ? Number(obj.ratingCount) : null
    // map to renting_shop columns (snake_case)
    // Map to explicit CSV-indexed columns so DB columns match Shops.csv directly
    const mapped = {
      id: obj.id || null,
      name: obj.name || null,
      address: obj.address || null,
      description: obj.description || null,
      latitude: obj.latitude,
      longitude: obj.longitude,
      rating: obj.rating,
      ratingCount: obj.ratingCount,
      imageUrl: obj.imageUrl || obj.image_url || null,
      // galleryImages indexed columns
      galleryImages_0: obj.galleryImages[0] || null,
      galleryImages_1: obj.galleryImages[1] || null,
      // owner fields
      owner_id: obj.owner && obj.owner.id ? obj.owner.id : null,
      owner_name: obj.owner && obj.owner.name ? obj.owner.name : null,
      owner_email: obj.owner && obj.owner.email ? obj.owner.email : null,
      owner_phoneNumber: obj.owner && obj.owner.phoneNumber ? obj.owner.phoneNumber : null,
      owner_profileImageUrl: obj.owner && obj.owner.profileImageUrl ? obj.owner.profileImageUrl : null,
      // motorbikes indexed
      motorbikes_0: obj.motorbikes[0] || null,
      motorbikes_1: obj.motorbikes[1] || null,
      motorbikes_2: obj.motorbikes[2] || null,
      motorbikes_3: obj.motorbikes[3] || null,
      motorbikes_4: obj.motorbikes[4] || null,
      motorbikes_5: obj.motorbikes[5] || null,
      motorbikes_6: obj.motorbikes[6] || null,
      // userReviews indexed
      userReviews_0_userName: (obj.userReviews[0] && obj.userReviews[0].userName) || null,
      userReviews_0_userAvatarUrl: (obj.userReviews[0] && obj.userReviews[0].userAvatarUrl) || null,
      userReviews_0_rating: (obj.userReviews[0] && obj.userReviews[0].rating) || null,
      userReviews_0_comment: (obj.userReviews[0] && obj.userReviews[0].comment) || null,
      userReviews_1_userName: (obj.userReviews[1] && obj.userReviews[1].userName) || null,
      userReviews_1_userAvatarUrl: (obj.userReviews[1] && obj.userReviews[1].userAvatarUrl) || null,
      userReviews_1_rating: (obj.userReviews[1] && obj.userReviews[1].rating) || null,
      userReviews_1_comment: (obj.userReviews[1] && obj.userReviews[1].comment) || null
    }
    return mapped
  })
  return out
}

async function main(){
  try{
    const base = path.resolve('scripts','db_exports','archive')
    const db = path.resolve('travel_app.db')
    const bikesCsv = path.join(base, 'Motorbikes.csv')
    const shopsCsv = path.join(base,'Shops.csv')
    if(!fs.existsSync(bikesCsv) || !fs.existsSync(shopsCsv)){
      console.error('Required archive CSVs not found:', bikesCsv, shopsCsv)
      process.exit(2)
    }

    const bikes = normalizeMotorbikes(bikesCsv)
    const shops = normalizeShops(shopsCsv)

    // Ensure array-like fields are stored as JSON strings so SQLite preserves structure
    const shopsForImport = shops.map(s => ({
      ...s,
      galleryImages: (s.galleryImages && s.galleryImages.length) ? JSON.stringify(s.galleryImages) : JSON.stringify([]),
      motorbikes: (s.motorbikes && s.motorbikes.length) ? JSON.stringify(s.motorbikes) : JSON.stringify([]),
      userReviews: (s.userReviews && s.userReviews.length) ? JSON.stringify(s.userReviews) : JSON.stringify([])
    }))

    const bikesFile = writeTempJson(bikes)
    const shopsFile = writeTempJson(shopsForImport)

    // upsert users from shops.owner if needed
    // create users array
    const owners = []
    for(const s of shops){
      if(s.owner && s.owner.id){
        owners.push({ id: s.owner.id, username: s.owner.name || null, email: s.owner.email || null, phone: s.owner.phoneNumber || null, avatar_url: s.owner.profileImageUrl || null })
      }
    }
    if(owners.length>0){
      const ownersFile = writeTempJson(owners)
      runUpsert(db, 'users', ownersFile)
    }

    // Upsert into the newly-created archive-style tables
    runUpsert(db, 'Motorbikes', bikesFile)
    runUpsert(db, 'Shops', shopsFile)

    // Also import Rentals and favorites from archive (normalized)
    const rentalsCsv = path.join(base, 'Rentals.csv')
    const favoritesCsv = path.join(base, 'favorites.csv')
    if (fs.existsSync(rentalsCsv)) {
      const rentals = readCSV(rentalsCsv).rows.map(r => {
        const obj = {}
        for (const h of Object.keys(r)) {
          const short = h.split('/').pop()
          obj[short] = r[h] === '' ? null : r[h]
        }
        return {
          id: obj.id || null,
          userEmail: obj.userEmail || null,
          bikeId: obj.bikeId || null,
          shopId: obj.shopId || null,
          rentalStart: obj.rentalStart || null,
          expectedReturn: obj.expectedReturn || null,
          isReturned: obj.isReturned ? (String(obj.isReturned).toLowerCase() === 'true' ? 1 : 0) : null,
          actualReturn: obj.actualReturn || null,
          totalCost: obj.totalCost ? Number(obj.totalCost) : null,
          isPaid: obj.isPaid ? (String(obj.isPaid).toLowerCase() === 'true' ? 1 : 0) : null
        }
      })
      const rentalsFile = writeTempJson(rentals)
      runUpsert(db, 'Rentals', rentalsFile)
    }

    if (fs.existsSync(favoritesCsv)) {
      const fav = readCSV(favoritesCsv).rows.map(r => {
        const obj = {}
        for (const h of Object.keys(r)) {
          const short = h.split('/').pop()
          obj[short] = r[h] === '' ? null : r[h]
        }
        return {
          id: obj.id || null,
          userEmail: obj.userEmail || null,
          itemId: obj.itemId || null,
          type: obj.type || null,
          createdAt: obj.createdAt || null
        }
      })
      const favFile = writeTempJson(fav)
      runUpsert(db, 'favorites', favFile)
    }

    console.log('Simple archive import complete')
  }catch(err){
    console.error('Import error', err && err.message ? err.message : err)
    process.exit(1)
  }
}

// If this file is executed directly (node scripts/import_archive_simple.js), run main()
try{
  const scriptPath = new URL(import.meta.url).pathname
  if(process.argv[1] === scriptPath){
    // run and don't await (main handles its own exits)
    main()
  }
}catch(e){
  // best-effort; fall back to calling main when unsure
  // (safe because main() exits the process when done)
  if(process.argv[1] && process.argv[1].endsWith('import_archive_simple.js')) main()
}

export { readCSV }

// If this file was invoked as `node scripts/import_archive_simple_fixed.js` (relative argv), run main
if(process.argv && process.argv[1] && process.argv[1].endsWith('import_archive_simple_fixed.js')){
  main()
}
