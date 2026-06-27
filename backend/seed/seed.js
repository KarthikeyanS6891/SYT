import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Listing } from '../src/models/Listing.js';
import { Favorite } from '../src/models/Favorite.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { taxonomy } from './taxonomy.js';

const img = (keywords, seed, w = 800, h = 600) =>
  `https://loremflickr.com/${w}/${h}/${encodeURIComponent(keywords)}?lock=${seed}`;

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
      images: [
        { url: img('scooter,honda,activa', 101) },
        { url: img('scooter,parked,street', 102) },
        { url: img('scooter,dashboard,speedometer', 103) },
        { url: img('scooter,side,profile', 104) },
        { url: img('scooter,helmet,riding', 105) },
      ],
    },
    {
      seller: u(2), title: 'MacBook Pro 14" M2 (2023) - 16GB/512GB',
      description: 'Barely used, with charger and original box. Battery cycle count under 50.',
      category: cat('computers-laptops'), price: 145000, location: 'Delhi', condition: 'used',
      status: 'published', boosted: true,
      images: [
        { url: img('macbook,laptop,apple', 201) },
        { url: img('laptop,workspace,desk', 202) },
        { url: img('macbook,keyboard,closeup', 203) },
        { url: img('laptop,screen,display', 204) },
        { url: img('macbook,box,packaging', 205) },
      ],
    },
    {
      seller: u(3), title: '2BHK Apartment for Rent - Adyar',
      description: 'Spacious 2BHK with covered parking, 24x7 water, gated community.',
      category: cat('rent-houses-apartments'), price: 32000, location: 'Chennai', condition: 'new',
      status: 'published',
      images: [
        { url: img('apartment,building,modern', 301) },
        { url: img('living,room,interior', 302) },
        { url: img('bedroom,interior,modern', 303) },
        { url: img('kitchen,modular,interior', 304) },
        { url: img('balcony,view,apartment', 305) },
      ],
    },
    {
      seller: u(1), title: 'IKEA Sofa - 3 Seater, Grey',
      description: 'IKEA Friheten 3-seater, 1 year used. Clean, no stains. Pickup only.',
      category: cat('sofa-dining'), price: 18000, location: 'Bengaluru', condition: 'used',
      status: 'published',
      images: [
        { url: img('sofa,couch,grey,living-room', 401) },
        { url: img('sofa,fabric,texture', 402) },
        { url: img('sofa,cushion,detail', 403) },
        { url: img('living,room,minimalist', 404) },
      ],
    },
    {
      seller: u(2), title: 'iPhone 13 Pro - 128GB Sierra Blue',
      description: 'In warranty till Aug. With box, charger and screen guard already applied.',
      category: cat('mobile-phones'), price: 62000, location: 'Delhi', condition: 'used',
      status: 'published',
      images: [
        { url: img('iphone,smartphone,blue', 501) },
        { url: img('iphone,box,unboxing', 502) },
        { url: img('iphone,camera,closeup', 503) },
        { url: img('iphone,screen,apps', 504) },
        { url: img('smartphone,charger,accessories', 505) },
      ],
    },
    {
      seller: u(3), title: 'Royal Enfield Classic 350 (2020)',
      description: '18k km driven, full service history. New tyres fitted last month.',
      category: cat('motorcycles'), price: 135000, location: 'Chennai', condition: 'used',
      status: 'published',
      images: [
        { url: img('motorcycle,royal-enfield,bike', 601) },
        { url: img('motorbike,classic,vintage', 602) },
        { url: img('motorcycle,engine,detail', 603) },
        { url: img('motorbike,headlight,chrome', 604) },
        { url: img('motorcycle,road,riding', 605) },
      ],
    },
    {
      seller: u(1), title: 'Sony WH-1000XM5 Headphones',
      description: 'Wireless ANC headphones, used <3 months. With case.',
      category: cat('tvs-video-audio'), price: 22000, location: 'Bengaluru', condition: 'used',
      status: 'published',
      images: [
        { url: img('headphones,sony,wireless', 701) },
        { url: img('headphones,black,studio', 702) },
        { url: img('headphones,case,travel', 703) },
        { url: img('headphones,music,listening', 704) },
      ],
    },
    {
      seller: u(2), title: 'Treadmill - Powermax MFT-2200',
      description: 'Foldable home treadmill, lightly used. Perfect for daily walks/runs.',
      category: cat('gym-fitness'), price: 24000, location: 'Delhi', condition: 'used',
      status: 'published',
      images: [
        { url: img('treadmill,gym,fitness', 801) },
        { url: img('treadmill,home,running', 802) },
        { url: img('treadmill,console,display', 803) },
        { url: img('treadmill,folded,storage', 804) },
      ],
    },
    {
      seller: u(3), title: 'Engineering textbooks bundle',
      description: 'Set of 8 BE/BTech textbooks, mostly CSE. Highlights but no torn pages.',
      category: cat('books'), price: 1200, location: 'Chennai', condition: 'used',
      status: 'published',
      images: [
        { url: img('books,textbook,study', 901) },
        { url: img('books,stack,library', 902) },
        { url: img('book,pages,reading', 903) },
        { url: img('engineering,books,desk', 904) },
      ],
    },
    {
      seller: u(1), title: 'Golden Retriever Puppy - 2 months',
      description: 'KCI registered, vaccinated, dewormed. Genuine buyers only.',
      category: cat('dogs'), price: 28000, location: 'Bengaluru', condition: 'new',
      status: 'published',
      images: [
        { url: img('golden-retriever,puppy,dog', 1001) },
        { url: img('puppy,playing,grass', 1002) },
        { url: img('golden-retriever,cute,paws', 1003) },
        { url: img('puppy,sleeping,cute', 1004) },
        { url: img('dog,outdoor,happy', 1005) },
      ],
    },
    {
      seller: u(2), title: 'Office desk + ergonomic chair combo',
      description: 'Work-from-home setup. Both items for one price.',
      category: cat('other-household'), price: 9500, location: 'Delhi', condition: 'used',
      status: 'published',
      images: [
        { url: img('office,desk,chair,workspace', 1101) },
        { url: img('ergonomic,chair,office', 1102) },
        { url: img('home,office,setup', 1103) },
        { url: img('desk,monitor,workspace', 1104) },
      ],
    },
    {
      seller: u(3), title: 'Maruti Swift VXI 2019 - Petrol',
      description: 'First owner, 42k km, full insurance valid. Service done last month.',
      category: cat('cars'), price: 525000, location: 'Chennai', condition: 'used',
      status: 'published',
      images: [
        { url: img('hatchback,car,red', 1201) },
        { url: img('car,interior,dashboard', 1202) },
        { url: img('car,steering,wheel', 1203) },
        { url: img('car,seats,leather', 1204) },
        { url: img('car,back,trunk', 1205) },
      ],
    },
  ];
};

async function run() {
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
