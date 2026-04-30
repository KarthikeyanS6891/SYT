import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Listing } from '../src/models/Listing.js';
import { Favorite } from '../src/models/Favorite.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';

const categoriesData = [
  { name: 'Vehicles', slug: 'vehicles', icon: '🚗', order: 1 },
  { name: 'Electronics', slug: 'electronics', icon: '💻', order: 2 },
  { name: 'Real Estate', slug: 'real-estate', icon: '🏠', order: 3 },
  { name: 'Furniture', slug: 'furniture', icon: '🛋️', order: 4 },
  { name: 'Fashion', slug: 'fashion', icon: '👗', order: 5 },
  { name: 'Books', slug: 'books', icon: '📚', order: 6 },
  { name: 'Sports', slug: 'sports', icon: '⚽', order: 7 },
  { name: 'Jobs', slug: 'jobs', icon: '💼', order: 8 },
  { name: 'Services', slug: 'services', icon: '🛠️', order: 9 },
  { name: 'Pets', slug: 'pets', icon: '🐾', order: 10 },
];

const img = (keywords, seed, w = 800, h = 600) =>
  `https://loremflickr.com/${w}/${h}/${encodeURIComponent(keywords)}?lock=${seed}`;

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
      category: cat('vehicles'), price: 75000, location: 'Bengaluru', condition: 'used',
      status: 'published', boosted: true,
      images: [
        { url: img('scooter,honda,activa', 101) },
        { url: img('scooter,parked', 102) },
      ],
    },
    {
      seller: u(2), title: 'MacBook Pro 14" M2 (2023) - 16GB/512GB',
      description: 'Barely used, with charger and original box. Battery cycle count under 50.',
      category: cat('electronics'), price: 145000, location: 'Delhi', condition: 'used',
      status: 'published', boosted: true,
      images: [
        { url: img('macbook,laptop,apple', 201) },
        { url: img('laptop,workspace', 202) },
      ],
    },
    {
      seller: u(3), title: '2BHK Apartment for Rent - Adyar',
      description: 'Spacious 2BHK with covered parking, 24x7 water, gated community.',
      category: cat('real-estate'), price: 32000, location: 'Chennai', condition: 'new',
      status: 'published',
      images: [
        { url: img('apartment,building,modern', 301) },
        { url: img('living,room,interior', 302) },
      ],
    },
    {
      seller: u(1), title: 'IKEA Sofa - 3 Seater, Grey',
      description: 'IKEA Friheten 3-seater, 1 year used. Clean, no stains. Pickup only.',
      category: cat('furniture'), price: 18000, location: 'Bengaluru', condition: 'used',
      status: 'published',
      images: [{ url: img('sofa,couch,grey,living-room', 401) }],
    },
    {
      seller: u(2), title: 'iPhone 13 Pro - 128GB Sierra Blue',
      description: 'In warranty till Aug. With box, charger and screen guard already applied.',
      category: cat('electronics'), price: 62000, location: 'Delhi', condition: 'used',
      status: 'published',
      images: [
        { url: img('iphone,smartphone,blue', 501) },
        { url: img('iphone,box,unboxing', 502) },
      ],
    },
    {
      seller: u(3), title: 'Royal Enfield Classic 350 (2020)',
      description: '18k km driven, full service history. New tyres fitted last month.',
      category: cat('vehicles'), price: 135000, location: 'Chennai', condition: 'used',
      status: 'published',
      images: [
        { url: img('motorcycle,royal-enfield,bike', 601) },
        { url: img('motorbike,classic', 602) },
      ],
    },
    {
      seller: u(1), title: 'Sony WH-1000XM5 Headphones',
      description: 'Wireless ANC headphones, used <3 months. With case.',
      category: cat('electronics'), price: 22000, location: 'Bengaluru', condition: 'used',
      status: 'published',
      images: [{ url: img('headphones,sony,wireless', 701) }],
    },
    {
      seller: u(2), title: 'Treadmill - Powermax MFT-2200',
      description: 'Foldable home treadmill, lightly used. Perfect for daily walks/runs.',
      category: cat('sports'), price: 24000, location: 'Delhi', condition: 'used',
      status: 'published',
      images: [{ url: img('treadmill,gym,fitness', 801) }],
    },
    {
      seller: u(3), title: 'Engineering textbooks bundle',
      description: 'Set of 8 BE/BTech textbooks, mostly CSE. Highlights but no torn pages.',
      category: cat('books'), price: 1200, location: 'Chennai', condition: 'used',
      status: 'published',
      images: [{ url: img('books,textbook,study', 901) }],
    },
    {
      seller: u(1), title: 'Golden Retriever Puppy - 2 months',
      description: 'KCI registered, vaccinated, dewormed. Genuine buyers only.',
      category: cat('pets'), price: 28000, location: 'Bengaluru', condition: 'new',
      status: 'published',
      images: [{ url: img('golden-retriever,puppy,dog', 1001) }],
    },
    {
      seller: u(2), title: 'Office desk + ergonomic chair combo',
      description: 'Work-from-home setup. Both items for one price.',
      category: cat('furniture'), price: 9500, location: 'Delhi', condition: 'used',
      status: 'published',
      images: [{ url: img('office,desk,chair,workspace', 1101) }],
    },
    {
      seller: u(3), title: 'Maruti Swift VXI 2019 - Petrol',
      description: 'First owner, 42k km, full insurance valid. Service done last month.',
      category: cat('vehicles'), price: 525000, location: 'Chennai', condition: 'used',
      status: 'published',
      images: [
        { url: img('hatchback,car,red', 1201) },
        { url: img('car,interior,dashboard', 1202) },
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
  const cats = await Category.insertMany(categoriesData);

  console.log('[seed] inserting users...');
  const users = [];
  for (const data of usersData) {
    users.push(await User.create(data));
  }

  console.log('[seed] inserting listings...');
  const listings = await Listing.insertMany(buildListings(users, cats));

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
