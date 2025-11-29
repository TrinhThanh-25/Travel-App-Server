#!/usr/bin/env node
// generate_location_reviews.js
// Reads users.csv and locations.csv from the archive folder and writes many
// synthetic, category-appropriate reviews to scripts/db_exports/archive/location_reviews.csv

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, './db_exports/archive');
const USERS_CSV = path.join(BASE, 'users.csv');
const LOCATIONS_CSV = path.join(BASE, 'locations.csv');
const OUTPUT_CSV = path.join(BASE, 'location_reviews.csv');

function splitLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      res.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  res.push(cur);
  return res;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  while (lines.length && lines[0].trim() === '') lines.shift();
  if (!lines.length) return { header: [], rows: [] };
  const header = splitLine(lines.shift());
  const rows = lines.filter(l => l.trim() !== '').map(l => {
    const arr = splitLine(l);
    const obj = {};
    header.forEach((h, i) => { obj[h.trim()] = arr[i] !== undefined ? arr[i] : ''; });
    return obj;
  });
  return { header, rows };
}

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function weightedRating() {
  // Favor 4-5 stars but include some negatives
  const r = Math.random();
  if (r < 0.05) return 1;
  if (r < 0.15) return 2;
  if (r < 0.35) return 3;
  if (r < 0.75) return 4;
  return 5;
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString();
}

// Templates by high-level category/type & name heuristics
const TEMPLATES = {
  church: [
    "Beautiful architecture and peaceful atmosphere. Great for reflection.",
    "Stunning stained glass and calm surroundings. A must-see for architecture lovers.",
    "Lovely service and friendly staff. Very peaceful place.",
    "Historic and well-maintained. The guide was informative.",
    "Well-preserved, but it can get crowded during holidays."
  ],
  food: [
    "Delicious food and friendly staff. Highly recommended!",
    "Amazing flavors, portion sizes were generous.",
    "Tasty dishes but a bit pricey for the location.",
    "Good variety on the menu, service was a little slow.",
    "Great for casual dinners — will come back."
  ],
  cinema: [
    "Great screens and sound. Seats were comfortable.",
    "Good movie selection and clean halls.",
    "Sound was slightly muffled but overall a good experience.",
    "Friendly staff and quick ticketing. Popcorn was fresh.",
    "Seats could be cleaner but screens are excellent."
  ],
  museum: [
    "Informative exhibits and friendly guides. Worth the visit!",
    "Well-curated displays; the audio tour helped a lot.",
    "Lots of interesting artifacts, could use clearer signage.",
    "Great for families and students. Interactive sections were fun.",
    "A bit small but very high quality and well-explained."
  ],
  nature: [
    "Beautiful scenery and well-kept paths. Perfect for a morning walk.",
    "Peaceful and green — ideal for family picnics.",
    "Clean area and friendly staff. Lots of shade spots.",
    "Great birdwatching and photo spots."
  ],
  entertainment: [
    "Lots of fun attractions and activities for all ages.",
    "Great for families; some rides had long queues though.",
    "Well-maintained and staff were helpful.",
    "A fun day out, but expect some crowds on weekends.",
    "Good mix of attractions, prices are reasonable."
  ],
  active: [
    "Excellent facilities and helpful instructors.",
    "Safe and well-equipped. Recommended for beginners.",
    "Good place to train and meet coaches.",
    "Quality equipment and responsive staff."
  ],
  waterpark: [
    "Fun slides and clean pools. Great for hot days.",
    "Lifeguards were attentive, but it was a bit crowded.",
    "Perfect for families though a little pricey for food inside.",
    "Good attractions and safe pools for kids."
  ],
  default: [
    "Nice place and well-managed.",
    "Had a great time, staff were very friendly.",
    "Good experience overall. Would visit again.",
    "Crowded but enjoyable."
  ]
};

function classifyLocation(loc) {
  const name = (loc.name || '').toLowerCase();
  const cat = (loc.category || '').toLowerCase();
  const type = (loc.type || '').toLowerCase();
  if (name.includes('nhà thờ') || name.includes('church') || name.includes('cathedral') || name.includes('temple') || name.includes('pagoda')) return 'church';
  if (name.includes('restaurant') || name.includes('cafe') || name.includes('bar') || name.includes('food') || name.includes('bistro') || name.includes('pho') || name.includes('quán')) return 'food';
  if (cat.includes('entertainment') || type.includes('fun')) return 'entertainment';
  if (cat.includes('nature') || name.includes('park') || name.includes('garden') || cat.includes('park')) return 'nature';
  if (type.includes('mystery') || name.toLowerCase().includes('escape') || name.toLowerCase().includes('xscape')) return 'museum';
  if (name.toLowerCase().includes('cinema') || name.toLowerCase().includes('cinema') || name.toLowerCase().includes('cgv')) return 'cinema';
  if (type.includes('active') || cat.includes('active') || name.toLowerCase().includes('club') || name.toLowerCase().includes('gym') || name.toLowerCase().includes('archery') || name.toLowerCase().includes('bowling')) return 'active';
  if (name.toLowerCase().includes('zoo') || name.toLowerCase().includes('botanical') || cat.includes('nature')) return 'nature';
  if (name.toLowerCase().includes('water') || name.toLowerCase().includes('aqua') || name.toLowerCase().includes('waterpark')) return 'waterpark';
  return 'default';
}

function generateCommentFor(loc) {
  const cls = classifyLocation(loc);
  const pool = TEMPLATES[cls] || TEMPLATES.default;
  let base = randomChoice(pool);
  // Add short modifiers to diversify and match rating tone
  const extrasPositive = [
    'Friendly staff and clean environment.',
    'Great value for money.',
    'Perfect for a weekend outing.',
    'Loved the atmosphere.',
    'Highly recommended.'
  ];
  const extrasNeutral = [
    'It was okay for the price.',
    'Could be better organized.',
    'Expect some queues during weekends.',
    'Parking can be limited.'
  ];
  const extrasNegative = [
    'Service was slow.',
    'Too crowded and noisy.',
    'Place needs better maintenance.',
    'Not worth the price in my opinion.'
  ];

  const rating = weightedRating();
  if (rating >= 4) base += ' ' + randomChoice(extrasPositive);
  else if (rating === 3) base += ' ' + randomChoice(extrasNeutral);
  else base += ' ' + randomChoice(extrasNegative);
  return { text: base, rating };
}

function main() {
  if (!fs.existsSync(USERS_CSV)) {
    console.error('Users CSV not found at', USERS_CSV);
    process.exit(1);
  }
  if (!fs.existsSync(LOCATIONS_CSV)) {
    console.error('Locations CSV not found at', LOCATIONS_CSV);
    process.exit(1);
  }

  const usersText = fs.readFileSync(USERS_CSV, 'utf8');
  const locText = fs.readFileSync(LOCATIONS_CSV, 'utf8');
  const users = parseCSV(usersText).rows;
  const locations = parseCSV(locText).rows;

  if (!users.length || !locations.length) {
    console.error('No users or locations parsed. Aborting.');
    process.exit(1);
  }

  const userIds = users.map(u => parseInt(u.id, 10)).filter(Boolean);
  const locMap = locations.map(l => ({ id: parseInt(l.id, 10), name: l.name, category: l.category, type: l.type }));

  const totalReviews = Math.max(2000, Math.min(6000, Math.floor(locMap.length * 30)));
  console.log('Generating', totalReviews, 'reviews for', locMap.length, 'locations and', userIds.length, 'users');

  const lines = [];
  lines.push('id,user_id,location_id,rating,comment,created_at');
  let id = 1;
  const start = new Date(2022, 0, 1);
  const end = new Date();

  // Ensure each location has at least a few reviews
  for (const loc of locMap) {
    const perLoc = randInt(3, 10);
    for (let i = 0; i < perLoc; i++) {
      const user_id = randomChoice(userIds);
      const { text, rating } = generateCommentFor(loc);
      const created_at = randomDate(start, end);
      const comment = '"' + text.replace(/"/g, '""') + '"';
      lines.push([id, user_id, loc.id, rating, comment, created_at].join(','));
      id++;
    }
  }

  // Now add random reviews up to totalReviews
  while (id <= totalReviews) {
    const loc = randomChoice(locMap);
    const user_id = randomChoice(userIds);
    const { text, rating } = generateCommentFor(loc);
    const created_at = randomDate(start, end);
    const comment = '"' + text.replace(/"/g, '""') + '"';
    lines.push([id, user_id, loc.id, rating, comment, created_at].join(','));
    id++;
  }

  fs.writeFileSync(OUTPUT_CSV, lines.join('\n'), 'utf8');
  console.log('Wrote', (id - 1), 'reviews to', OUTPUT_CSV);
  // Show a short sample
  console.log('Sample lines (first 6):');
  console.log(lines.slice(0, 7).join('\n'));
}

main();
