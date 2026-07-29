import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Listing } from '../src/models/Listing.js';
import { Favorite } from '../src/models/Favorite.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { taxonomy } from './taxonomy.js';
import { IMAGE_VARIANTS, imageUrlVariant } from './imageKeywords.js';

// Gallery built only from a category's verified keyword pool (IMAGE_VARIANTS).
// LoremFlickr ANDs comma-separated tags and silently serves a RANDOM photo when
// a tag (or combo) has no matches, so free-form keywords are banned here — an
// unlisted keyword throws at seed time instead of quietly seeding junk images.
// Each shot is [keyword, lock]; a lock deterministically pins one photo, and
// these locks were hand-picked by reviewing the actual thumbnails, because even
// verified tags hide off-topic photos at some locks (Flickr's "iphone" tag is
// mostly photos TAKEN WITH an iPhone; "office" is full of embroidered patches).
// `slug` picks the keyword pool and may differ from the listing's category when
// the product is more specific (e.g. headphones sold under tvs-video-audio).
const photos = (slug, shots) =>
  shots.map(([keyword, lock]) => {
    const k = (IMAGE_VARIANTS[slug] || []).indexOf(keyword);
    if (k === -1) {
      throw new Error(`[seed] "${keyword}" is not a verified image keyword for "${slug}"`);
    }
    return { url: imageUrlVariant(slug, k, lock) };
  });

// Approximate city centres ([lng, lat]) for sample data; each listing gets a
// small deterministic offset so same-city pins don't stack on one spot.
const cityCoords = {
  Mumbai: [72.8777, 19.076],
  Bengaluru: [77.5946, 12.9716],
  Delhi: [77.209, 28.6139],
  Chennai: [80.2707, 13.0827],
};

const geoFor = (location, i) => {
  const base = cityCoords[location];
  if (!base) return undefined;
  const jitter = (n) => ((n % 41) - 20) / 1000; // ±0.02° ≈ 2 km
  return {
    type: 'Point',
    coordinates: [base[0] + jitter(i * 13 + 7), base[1] + jitter(i * 29 + 11)],
  };
};

const usersData = [
  {
    name: 'Admin',
    email: 'admin@syt.local',
    password: 'admin1234',
    role: 'admin',
    location: 'Mumbai',
    phone: '+910000000000',
  },
  {
    name: 'Aisha Khan',
    email: 'aisha@example.com',
    password: 'password123',
    location: 'Bengaluru',
    phone: '+919876543210',
  },
  {
    name: 'Rahul Sharma',
    email: 'rahul@example.com',
    password: 'password123',
    location: 'Delhi',
    phone: '+919876500001',
  },
  {
    name: 'Priya Iyer',
    email: 'priya@example.com',
    password: 'password123',
    location: 'Chennai',
    phone: '+919876500002',
  },
];

const buildListings = (users, cats) => {
  const cat = (slug) => cats.find((c) => c.slug === slug)._id;
  const u = (i) => users[i]._id;
  return [
    {
      seller: u(1), title: 'Honda Activa 6G - 2022, Single owner',
      description: 'Excellent condition, all papers clear. Single owner, garage parked.',
      category: cat('scooters'), price: 75000, location: 'Bengaluru', condition: 'used',
      status: 'published', boosted: true,
      images: photos('scooters', [['scooter', 12], ['vespa', 3], ['scooter', 3], ['vespa', 11], ['vespa', 7]]),
    },
    {
      seller: u(2), title: 'MacBook Pro 14" M2 (2023) - 16GB/512GB',
      description: 'Barely used, with charger and original box. Battery cycle count under 50.',
      category: cat('computers-laptops'), price: 145000, location: 'Delhi', condition: 'used',
      status: 'published', boosted: true,
      images: photos('computers-laptops', [['macbook', 201], ['laptop', 1], ['keyboard', 2], ['laptop', 7]]),
    },
    {
      seller: u(3), title: '2BHK Apartment for Rent - Adyar',
      description: 'Spacious 2BHK with covered parking, 24x7 water, gated community.',
      category: cat('rent-houses-apartments'), price: 32000, location: 'Chennai', condition: 'new',
      status: 'published',
      images: photos('rent-houses-apartments', [['apartment', 3], ['apartment', 21], ['bedroom', 9], ['balcony', 305], ['apartment', 2]]),
    },
    {
      seller: u(1), title: 'IKEA Sofa - 3 Seater, Grey',
      description: 'IKEA Friheten 3-seater, 1 year used. Clean, no stains. Pickup only.',
      category: cat('sofa-dining'), price: 18000, location: 'Bengaluru', condition: 'used',
      status: 'published',
      images: photos('sofa-dining', [['sofa', 9], ['sofa', 7], ['couch', 3], ['armchair', 403]]),
    },
    {
      seller: u(2), title: 'iPhone 13 Pro - 128GB Sierra Blue',
      description: 'In warranty till Aug. With box, charger and screen guard already applied.',
      category: cat('mobile-phones'), price: 62000, location: 'Delhi', condition: 'used',
      status: 'published',
      images: photos('mobile-phones', [['smartphone', 11], ['smartphone', 18], ['smartphone', 14], ['smartphone', 9]]),
    },
    {
      seller: u(3), title: 'Royal Enfield Classic 350 (2020)',
      description: '18k km driven, full service history. New tyres fitted last month.',
      category: cat('motorcycles'), price: 135000, location: 'Chennai', condition: 'used',
      status: 'published',
      images: photos('motorcycles', [['motorbike', 7], ['motorbike', 21], ['motorcycle', 2], ['motorcycle', 9], ['motorcycle', 21]]),
    },
    {
      seller: u(1), title: 'Sony WH-1000XM5 Headphones',
      description: 'Wireless ANC headphones, used <3 months. With case.',
      category: cat('tvs-video-audio'), price: 22000, location: 'Bengaluru', condition: 'used',
      status: 'published',
      // headphones under tvs-video-audio: borrow the mobile-accessories pool,
      // whose verified keywords match the product better than TV/speaker shots
      images: photos('mobile-accessories', [['earphones', 702], ['earphones', 9], ['earphones', 14], ['earphones', 21]]),
    },
    {
      seller: u(2), title: 'Treadmill - Powermax MFT-2200',
      description: 'Foldable home treadmill, lightly used. Perfect for daily walks/runs.',
      category: cat('gym-fitness'), price: 24000, location: 'Delhi', condition: 'used',
      status: 'published',
      images: photos('gym-fitness', [['treadmill', 14], ['treadmill', 9], ['gym', 9], ['dumbbell', 2]]),
    },
    {
      seller: u(3), title: 'Engineering textbooks bundle',
      description: 'Set of 8 BE/BTech textbooks, mostly CSE. Highlights but no torn pages.',
      category: cat('books'), price: 1200, location: 'Chennai', condition: 'used',
      status: 'published',
      images: photos('books', [['bookshelf', 5], ['library', 2], ['books', 21], ['books', 9]]),
    },
    {
      seller: u(1), title: 'Golden Retriever Puppy - 2 months',
      description: 'KCI registered, vaccinated, dewormed. Genuine buyers only.',
      category: cat('dogs'), price: 28000, location: 'Bengaluru', condition: 'new',
      status: 'published',
      images: photos('dogs', [['puppy', 1001], ['dog', 14], ['puppy', 3], ['puppy', 5], ['dog', 2]]),
    },
    {
      seller: u(2), title: 'Office desk + ergonomic chair combo',
      description: 'Work-from-home setup. Both items for one price.',
      category: cat('other-household'), price: 9500, location: 'Delhi', condition: 'used',
      status: 'published',
      // desk/office keywords live in the rent-shops-offices pool, which fits
      // this WFH-setup listing better than generic other-household furniture
      images: photos('rent-shops-offices', [['desk', 11], ['desk', 9], ['desk', 5], ['coworking', 2]]),
    },
    {
      seller: u(3), title: 'Maruti Swift VXI 2019 - Petrol',
      description: 'First owner, 42k km, full insurance valid. Service done last month.',
      category: cat('cars'), price: 525000, location: 'Chennai', condition: 'used',
      status: 'published',
      images: photos('cars', [['hatchback', 1201], ['car-interior', 21], ['hatchback', 3], ['car', 9], ['car-interior', 14]]),
    },
  ];
};

async function run() {
  if (config.env === 'production') {
    throw new Error(
      '[seed] refusing to run against NODE_ENV=production — this script deletes ' +
        'every User/Category/Listing/Favorite/Conversation/Message document.'
    );
  }

  console.log('[seed] connecting to', config.mongoUri);
  await mongoose.connect(config.mongoUri);

  console.log('[seed] clearing collections...');
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Listing.deleteMany({}),
    Favorite.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
  ]);

  console.log('[seed] inserting categories...');
  const cats = [];
  let order = 0;
  for (const parent of taxonomy) {
    order += 1;
    const parentDoc = await Category.create({
      name: parent.name, slug: parent.slug, icon: parent.icon, order,
    });
    cats.push(parentDoc);
    let childOrder = 0;
    for (const child of parent.children || []) {
      childOrder += 1;
      const childDoc = await Category.create({
        name: child.name, slug: child.slug, parent: parentDoc._id, order: childOrder,
      });
      cats.push(childDoc);
    }
  }
  console.log(`[seed] inserted ${cats.length} categories (${taxonomy.length} parents)`);

  console.log('[seed] inserting users...');
  const users = [];
  for (const data of usersData) {
    users.push(await User.create(data));
  }

  console.log('[seed] inserting listings...');
  const listings = await Listing.insertMany(
    buildListings(users, cats).map((l, i) => ({ ...l, geo: geoFor(l.location, i) }))
  );

  console.log('[seed] adding sample favorite + chat...');
  await Favorite.create({ user: users[2]._id, listing: listings[0]._id });

  const convo = await Conversation.create({
    listing: listings[1]._id,
    participants: [users[3]._id, users[2]._id],
    unread: { [users[2]._id]: 0, [users[3]._id]: 0 },
  });
  const msg = await Message.create({
    conversation: convo._id,
    sender: users[3]._id,
    body: 'Hi, is the MacBook still available?',
  });
  convo.lastMessage = msg._id;
  convo.lastMessageAt = msg.createdAt;
  await convo.save();

  console.log('[seed] done');
  console.log('  admin:  admin@syt.local / admin1234');
  console.log('  user:   aisha@example.com / password123');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] error:', err);
  process.exit(1);
});
