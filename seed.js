import db from './db/connect.js';
import { ready } from './db/connect.js';

// Wait for DB to be ready
await ready;

console.log('🌱 Seeding database with sample data...');

// Sample locations in Vietnam
const locations = [
  {
    name: 'Ben Thanh Market',
    image_url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482',
    latitude: 10.772431,
    longitude: 106.698044,
    description: 'Historic market in the heart of Ho Chi Minh City, featuring local food, souvenirs, and traditional goods.',
    address: 'Lê Lợi, Phường Bến Thành, Quận 1',
    city: 'Ho Chi Minh City',
    opening_hours: '08:00',
    closing_hours: '18:00',
    rating: 4.5,
    review_count: 1250,
    qr_code: 'BENTHANHMARKET001'
  },
  {
    name: 'Independence Palace',
    image_url: 'https://images.unsplash.com/photo-1557750255-c76072a7aad1',
    latitude: 10.777481,
    longitude: 106.695419,
    description: 'Historic landmark and museum showcasing Vietnam\'s history and reunification.',
    address: '135 Nam Kỳ Khởi Nghĩa, Phường Bến Thành, Quận 1',
    city: 'Ho Chi Minh City',
    opening_hours: '07:30',
    closing_hours: '16:00',
    rating: 4.7,
    review_count: 2100,
    qr_code: 'INDEPENDENCE001'
  },
  {
    name: 'Notre-Dame Cathedral Basilica',
    image_url: 'https://images.unsplash.com/photo-1528127269322-539801943592',
    latitude: 10.779738,
    longitude: 106.699092,
    description: 'Beautiful French colonial cathedral built in the late 1800s.',
    address: '01 Công xã Paris, Bến Nghé, Quận 1',
    city: 'Ho Chi Minh City',
    opening_hours: '08:00',
    closing_hours: '11:00',
    rating: 4.6,
    review_count: 3200,
    qr_code: 'NOTREDAME001'
  },
  {
    name: 'War Remnants Museum',
    image_url: 'https://images.unsplash.com/photo-1591258370814-01609b341790',
    latitude: 10.779634,
    longitude: 106.691919,
    description: 'Museum documenting the Vietnam War with historical exhibits and artifacts.',
    address: '28 Võ Văn Tần, Phường 6, Quận 3',
    city: 'Ho Chi Minh City',
    opening_hours: '07:30',
    closing_hours: '18:00',
    rating: 4.8,
    review_count: 5400,
    qr_code: 'WARMUSEUM001'
  },
  {
    name: 'Bitexco Financial Tower',
    image_url: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b',
    latitude: 10.771644,
    longitude: 106.704208,
    description: 'Iconic skyscraper with observation deck offering panoramic city views.',
    address: '36 Hồ Tùng Mậu, Bến Nghé, Quận 1',
    city: 'Ho Chi Minh City',
    opening_hours: '09:30',
    closing_hours: '21:30',
    rating: 4.4,
    review_count: 1800,
    qr_code: 'BITEXCO001'
  },
  {
    name: 'Saigon Central Post Office',
    image_url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482',
    latitude: 10.779971,
    longitude: 106.700089,
    description: 'Historic post office designed by Gustave Eiffel, featuring colonial architecture.',
    address: '2 Công xã Paris, Bến Nghé, Quận 1',
    city: 'Ho Chi Minh City',
    opening_hours: '07:00',
    closing_hours: '19:00',
    rating: 4.5,
    review_count: 2600,
    qr_code: 'POSTOFFICE001'
  }
];

// Sample challenges
const challenges = [
  {
    name: 'Historic District Explorer',
    description: 'Visit 5 historic landmarks in District 1',
    start_date: '2025-11-01',
    end_date: '2025-12-31',
    duration: 7,
    reward_point: 500,
    reward_type: 'points'
  },
  {
    name: 'Weekend Wanderer',
    description: 'Check in at 3 different locations over the weekend',
    start_date: '2025-11-01',
    end_date: '2025-12-31',
    duration: 2,
    reward_point: 300,
    reward_type: 'points'
  },
  {
    name: 'Culture Enthusiast',
    description: 'Visit all museums and cultural sites in the city',
    start_date: '2025-11-01',
    end_date: '2025-12-31',
    duration: 14,
    reward_point: 1000,
    reward_type: 'badge'
  }
];

// Sample rewards
const rewards = [
  {
    name: '10% Off Coffee',
    start_date: '2025-11-01',
    end_date: '2025-12-31',
    description: 'Get 10% discount at participating coffee shops',
    cost: 100,
    expires_at: '2025-12-31',
    point_reward: 0,
    max_uses: 1000,
    per_user_limit: 1
  },
  {
    name: 'Free Museum Entry',
    start_date: '2025-11-01',
    end_date: '2025-12-31',
    description: 'Free entry to War Remnants Museum',
    cost: 500,
    expires_at: '2025-12-31',
    point_reward: 0,
    max_uses: 100,
    per_user_limit: 1
  },
  {
    name: 'Restaurant Voucher',
    start_date: '2025-11-01',
    end_date: '2025-12-31',
    description: '50,000 VND voucher at local restaurants',
    cost: 250,
    expires_at: '2025-12-31',
    point_reward: 0,
    max_uses: 500,
    per_user_limit: 2
  }
];

// Insert locations
const insertLocation = (loc) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO locations (name, image_url, latitude, longitude, description, address, city, opening_hours, closing_hours, rating, review_count, qr_code) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [loc.name, loc.image_url, loc.latitude, loc.longitude, loc.description, loc.address, loc.city, loc.opening_hours, loc.closing_hours, loc.rating, loc.review_count, loc.qr_code],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

// Insert challenge
const insertChallenge = (challenge) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO challenges (name, description, start_date, end_date, duration, reward_point, reward_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [challenge.name, challenge.description, challenge.start_date, challenge.end_date, challenge.duration, challenge.reward_point, challenge.reward_type],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

// Insert reward
const insertReward = (reward) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO rewards (name, start_date, end_date, description, cost, expires_at, point_reward, max_uses, per_user_limit) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reward.name, reward.start_date, reward.end_date, reward.description, reward.cost, reward.expires_at, reward.point_reward, reward.max_uses, reward.per_user_limit],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

try {
  // Insert all locations
  for (const loc of locations) {
    const id = await insertLocation(loc);
    console.log(`✅ Inserted location: ${loc.name} (ID: ${id})`);
  }

  // Insert all challenges
  for (const challenge of challenges) {
    const id = await insertChallenge(challenge);
    console.log(`✅ Inserted challenge: ${challenge.name} (ID: ${id})`);
  }

  // Insert all rewards
  for (const reward of rewards) {
    const id = await insertReward(reward);
    console.log(`✅ Inserted reward: ${reward.name} (ID: ${id})`);
  }

  console.log('\n🎉 Database seeded successfully!');
  console.log(`   - ${locations.length} locations`);
  console.log(`   - ${challenges.length} challenges`);
  console.log(`   - ${rewards.length} rewards`);
  
  process.exit(0);
} catch (err) {
  console.error('❌ Error seeding database:', err);
  process.exit(1);
}
