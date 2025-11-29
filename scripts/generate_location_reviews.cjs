const fs = require('fs');
const path = require('path');

const archiveDir = path.join(__dirname, 'db_exports', 'archive');
const usersPath = path.join(archiveDir, 'users.csv');
const locationsPath = path.join(archiveDir, 'locations.csv');
const outPath = path.join(archiveDir, 'location_reviews.csv');

// CLI args: --append, --count N, --fix-existing, --dry-run, --allow-low, --low-count N
const argv = process.argv.slice(2);
const append = argv.includes('--append');
const fixExisting = argv.includes('--fix-existing');
const dryRun = argv.includes('--dry-run');
const allowLow = argv.includes('--allow-low');
let lowCountArg = null;
let countArg = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--count' && i + 1 < argv.length) {
    countArg = parseInt(argv[i + 1], 10);
  } else if (a.startsWith('--count=')) {
    countArg = parseInt(a.split('=')[1], 10);
  } else if (a === '--low-count' && i + 1 < argv.length) {
    lowCountArg = parseInt(argv[i + 1], 10);
  } else if (a.startsWith('--low-count=')) {
    lowCountArg = parseInt(a.split('=')[1], 10);
  }
}

function readCSV(p){
  const txt = fs.readFileSync(p, 'utf8');
  const lines = txt.split(/\r?\n/).filter(Boolean);
  if(lines.length === 0) return {header:[], rows:[]};
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(l => {
    // naive split that keeps quoted commas (basic)
    const cols = [];
    let cur = '';
    let inQuote = false;
    for(let i=0;i<l.length;i++){
      const ch = l[i];
      if(ch === '"') { inQuote = !inQuote; continue; }
      if(ch === ',' && !inQuote){ cols.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur);
    return cols;
  });
  return {header, rows};
}

const usersCSV = readCSV(usersPath);
const locCSV = readCSV(locationsPath);

// Ensure numeric IDs only
const userIds = usersCSV.rows
  .map(r => parseInt(r[0], 10))
  .filter(n => Number.isFinite(n) && n > 0);

const locRows = locCSV.rows
  .map(r => {
    const idInt = parseInt(r[0], 10);
    if (!Number.isFinite(idInt) || idInt <= 0) return null;
    const name = r[1] || '';
    const category = (r[2] || '').toLowerCase();
    const type = (r[3] || '').toLowerCase();
    const catKey = `${category} ${type}`.trim();
    return { id: String(idInt), idInt, name, category, type, catKey };
  })
  .filter(Boolean);

if(userIds.length === 0 || locRows.length === 0){
  console.error('Missing users or locations CSV content');
  process.exit(1);
}

const defaultTotal = Math.max(2000, Math.min(6000, Math.floor(locRows.length * 10)));
const totalReviews = Number.isFinite(countArg) && countArg > 0 ? countArg : (append ? 2000 : defaultTotal);

function quoteCsv(s){
  if(s == null) return '""';
  const safe = String(s).replace(/"/g, '""');
  return '"' + safe + '"';
}

const templates = {
  food: [
    'Delicious and well-seasoned. Portions are generous and service is friendly.',
    'Tasty dishes with good balance. A pleasant dining experience.',
    'Fresh ingredients and nice presentation. Will come back for more.',
    'Great flavors, though the wait can be long during peak hours.'
  ],
  cafe: [
    'Cozy atmosphere and well-brewed coffee. Perfect for working or chatting.',
    'Nice interior and friendly staff. The drinks are consistently good.',
    'A photogenic cafe with solid pastries and great coffee.'
  ],
  entertainment: [
    'Super fun and full of activities. Great for groups and kids.',
    'A lively place with many attractions. Expect crowds on weekends.',
    'Good facilities and friendly staff. Plenty to do for a full day.'
  ],
  shopping: [
    'Large mall with many options and a clean environment.',
    'Good variety of stores and eateries. Busy on weekends but overall pleasant.'
  ],
  attraction: [
    'Beautiful spot with interesting features — great for photos.',
    'Informative and well-maintained. Worth a visit if you are nearby.',
    'A memorable place with good facilities and clear signage.'
  ],
  park: [
    'Lovely green space, perfect for morning walks and relaxation.',
    'A peaceful park with well-kept paths and benches.'
  ],
  museum: [
    'Rich exhibits and clear explanations. Great for history lovers.',
    'Informative and thoughtfully curated displays.'
  ],
  religious: [
    'Beautiful architecture and serene atmosphere. Very calming.',
    'A spiritual and historic place — respectful and well-kept.'
  ],
  beach: [
    'Nice beach with good views and seafood nearby. A pleasant day out.',
    'Sandy shore and clear views. Ideal for a relaxed beach trip.'
  ],
  default: [
    'Nice place, we enjoyed our visit.',
    'Pleasant experience overall — would recommend to others.'
  ]
};

// Negative / neutral templates for low ratings (1-2 stars) to make them believable
const negativeTemplates = {
  food: [
    'Food was bland and portions felt small for the price.',
    'Service was slow and dishes arrived lukewarm.',
    'Menu looked promising but flavors were disappointing.'
  ],
  cafe: [
    'Coffee tasted burnt and seating was cramped.',
    'Uncomfortable chairs and the drinks were watery.',
    'Atmosphere was nice but service was inattentive.'
  ],
  entertainment: [
    'Few activities were open and staff seemed overwhelmed.',
    'Overpriced for what was available, lines were very long.',
    'Facilities felt poorly maintained compared to expectations.'
  ],
  shopping: [
    'Limited store variety and several areas were closed.',
    'Crowded and difficult to navigate; not many interesting shops.'
  ],
  attraction: [
    'Area was under renovation and not much to see.',
    'Expected more detail and maintenance; felt neglected.'
  ],
  park: [
    'Park was littered and pathways uneven.',
    'Not many shaded areas and facilities looked worn.'
  ],
  museum: [
    'Exhibits were sparse and descriptions unclear.',
    'Small collection; finished quickly and felt underwhelming.'
  ],
  religious: [
    'Crowded and noisy; couldn’t appreciate the architecture.',
    'Area seemed poorly maintained compared to other sites.'
  ],
  beach: [
    'Water was murky and a lot of trash on the sand.',
    'Facilities were closed and limited shade available.'
  ],
  default: [
    'Experience did not match the reviews; a bit disappointing.',
    'Not great overall; expected more based on description.'
  ]
};

function pickTemplate(cat, rating){
  const c = (cat || '').toLowerCase();
  const isLow = rating <= 2;
  const source = isLow ? negativeTemplates : templates;
  // More specific first to avoid misclassification
  if(c.includes('cafe') || c.includes('coffee')) return source.cafe[Math.floor(Math.random()*source.cafe.length)];
  if(c.includes('restaurant') || c.includes('food') || c.includes('eatery')) return source.food[Math.floor(Math.random()*source.food.length)];
  if(c.includes('entertainment') || c.includes('fun') || c.includes('active') || c.includes('amusement')) return source.entertainment[Math.floor(Math.random()*source.entertainment.length)];
  if(c.includes('shopping') || c.includes('mall') || c.includes('market')) return source.shopping[Math.floor(Math.random()*source.shopping.length)];
  if(c.includes('attraction') || c.includes('landmark') || c.includes('viewpoint') || c.includes('cultural')) return source.attraction[Math.floor(Math.random()*source.attraction.length)];
  if(c.includes('park') || c.includes('nature') || c.includes('zoo')) return source.park[Math.floor(Math.random()*source.park.length)];
  if(c.includes('museum')) return source.museum[Math.floor(Math.random()*source.museum.length)];
  if(c.includes('religious') || c.includes('temple') || c.includes('church') || c.includes('pagoda')) return source.religious[Math.floor(Math.random()*source.religious.length)];
  if(c.includes('beach')) return source.beach[Math.floor(Math.random()*source.beach.length)];
  return source.default[Math.floor(Math.random()*source.default.length)];
}

// Rating distribution. If allowLow is true include 1-2 star (~20% combined)
function ratingFromIndex(i){
  const r = (i * 7) % 100;
  if (!allowLow) {
    if (r < 15) return 3;     // ~15%
    if (r < 60) return 5;     // ~45%
    return 4;                  // ~40%
  } else {
    if (r < 10) return 1;     // 0-9 => 10%
    if (r < 25) return 2;     // 10-24 => 15%
    if (r < 40) return 3;     // 25-39 => 15%
    if (r < 70) return 4;     // 40-69 => 30%
    return 5;                 // 70-99 => 30%
  }
}

function pad(n){ return n.toString().padStart(2,'0'); }

function buildRows(startId, n, offset){
  const rows = [];
  for(let i=1;i<=n;i++){
    const idx = i + (offset||0);
    const user = userIds[(idx * 13) % userIds.length];
    const loc = locRows[(idx * 29) % locRows.length];
    const rating = ratingFromIndex(idx);
    const comment = pickTemplate(loc.catKey || loc.category || loc.type || loc.name || '', rating);
    const year = 2023 + ((idx*17) % 3); // 2023-2025
    const month = 1 + ((idx*3) % 12);
    const day = 1 + ((idx*5) % 28);
    const hour = 8 + ((idx*7) % 12);
    const minute = (idx*11) % 60;
    const created_at = `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:00`;
    const row = [startId + (i-1), user, loc.idInt, rating, quoteCsv(comment), created_at];
    rows.push(row.join(','));
  }
  return rows;
}

function hashStringToIndex(s, mod){
  let h = 0;
  const str = String(s || '');
  for(let i=0;i<str.length;i++){
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0; // 32-bit
  }
  if (mod <= 0) return 0;
  const idx = Math.abs(h) % mod;
  return idx;
}

function isClearlyPositive(comment){
  const c = (comment || '').toLowerCase();
  const positives = [
    'nice','great','good','love','amazing','cozy','lovely','beautiful','tasty','delicious','recommend','recommended','pleasant','enjoy','enjoyable','friendly','clean','wonderful','perfect'
  ];
  return positives.some(k => c.includes(k));
}

function clampRating(r){
  const n = Number.parseInt(r, 10);
  if (!Number.isFinite(n)) return 4;
  return Math.max(1, Math.min(5, n));
}

function fixExistingCSV(){
  if (!fs.existsSync(outPath)) {
    console.error('No existing file to fix at', outPath);
    process.exit(1);
  }
  const existing = readCSV(outPath);
  if (!existing.rows || existing.rows.length === 0) {
    console.log('No rows to fix in', outPath);
    return;
  }
  let fixedUser = 0, fixedLoc = 0, adjustedRating = 0, total = 0;
  const lines = ['id,user_id,location_id,rating,comment,created_at'];
  for (let i = 0; i < existing.rows.length; i++) {
    const r = existing.rows[i];
    // Expect: id,user_id,location_id,rating,comment,created_at
    const id = Number.parseInt(r[0], 10);
    let userId = Number.parseInt(r[1], 10);
    let locId = Number.parseInt(r[2], 10);
    let rating = clampRating(r[3]);
    const comment = r[4] || '';
    const createdAt = r[5] || '';

    if (!Number.isFinite(userId) || userId <= 0) {
      // Stable fallback based on row index
      userId = userIds[(i * 13) % userIds.length];
      fixedUser++;
    }
    if (!Number.isFinite(locId) || locId <= 0) {
      // Stable fallback based on comment hash, then row index if needed
      const idxByHash = hashStringToIndex(comment, locRows.length);
      const chosen = locRows[idxByHash] || locRows[(i * 29) % locRows.length];
      locId = chosen.idInt;
      fixedLoc++;
    }
    if (rating < 3 && isClearlyPositive(comment)) {
      rating = 4; // lift obviously positive comments to at least 4
      adjustedRating++;
    }

    lines.push([id, userId, locId, rating, quoteCsv(comment), createdAt].join(','));
    total++;
  }

  if (dryRun) {
    console.log('[DRY-RUN] Would rewrite', total, 'rows. Fixes -> user_id:', fixedUser, 'location_id:', fixedLoc, 'rating:', adjustedRating);
    return;
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('Fixed existing CSV at', outPath, '| rows:', total, '| user_id fixed:', fixedUser, '| location_id fixed:', fixedLoc, '| ratings adjusted:', adjustedRating);
}

if (fixExisting) {
  fixExistingCSV();
} else if (append && fs.existsSync(outPath)) {
  const existing = readCSV(outPath);
  let lastId = 0;
  for (const r of existing.rows) {
    const v = parseInt(r[0], 10);
    if (Number.isFinite(v) && v > lastId) lastId = v;
  }
  const rows = buildRows(lastId + 1, totalReviews, existing.rows.length);
  const prefix = existing.rows.length > 0 ? '\n' : '';
  fs.appendFileSync(outPath, prefix + rows.join('\n'), 'utf8');
  console.log('Appended', totalReviews, 'reviews to', outPath, '(last id ->', lastId + totalReviews, ')');
} else {
  const lines = ['id,user_id,location_id,rating,comment,created_at'];
  const rows = buildRows(1, totalReviews, 0);
  fs.writeFileSync(outPath, lines.join('\n') + '\n' + rows.join('\n'), 'utf8');
  console.log('Wrote', totalReviews, 'reviews to', outPath);
}
