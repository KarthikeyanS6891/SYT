import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Listing } from '../src/models/Listing.js';
import { Favorite } from '../src/models/Favorite.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';

const taxonomy = [
  { name: 'Cars', slug: 'cars', icon: '🚗', children: [] },
  {
    name: 'Bikes', slug: 'bikes', icon: '🏍️',
    children: [
      { name: 'Motorcycles', slug: 'motorcycles' },
      { name: 'Scooters', slug: 'scooters' },
      { name: 'Bike Spare Parts', slug: 'bike-spare-parts' },
      { name: 'Bicycles', slug: 'bicycles' },
    ],
  },
  {
    name: 'Properties', slug: 'properties', icon: '🏢',
    children: [
      { name: 'For Sale: Houses & Apartments', slug: 'sale-houses-apartments' },
      { name: 'For Rent: Houses & Apartments', slug: 'rent-houses-apartments' },
      { name: 'Lands & Plots', slug: 'lands-plots' },
      { name: 'For Sale: New Projects & Properties', slug: 'sale-new-projects' },
      { name: 'For Rent: Shops & Offices', slug: 'rent-shops-offices' },
      { name: 'For Sale: Shops & Offices', slug: 'sale-shops-offices' },
      { name: 'PG & Guest Houses', slug: 'pg-guest-houses' },
    ],
  },
  {
    name: 'Electronics & Appliances', slug: 'electronics-appliances', icon: '📺',
    children: [
      { name: 'TVs, Video - Audio', slug: 'tvs-video-audio' },
      { name: 'Kitchen & Other Appliances', slug: 'kitchen-appliances' },
      { name: 'Computers & Laptops', slug: 'computers-laptops' },
      { name: 'Cameras & Lenses', slug: 'cameras-lenses' },
      { name: 'Games & Entertainment', slug: 'games-entertainment' },
      { name: 'Fridges', slug: 'fridges' },
      { name: 'Computer Accessories', slug: 'computer-accessories' },
      { name: 'Hard Disks, Printers & Monitors', slug: 'hard-disks-printers' },
      { name: 'ACs', slug: 'acs' },
      { name: 'Washing Machines', slug: 'washing-machines' },
    ],
  },
  {
    name: 'Mobiles', slug: 'mobiles', icon: '📱',
    children: [
      { name: 'Mobile Phones', slug: 'mobile-phones' },
      { name: 'Accessories', slug: 'mobile-accessories' },
      { name: 'Tablets', slug: 'tablets' },
    ],
  },
  {
    name: 'Commercial Vehicles & Spares', slug: 'commercial-vehicles', icon: '🚙',
    children: [
      { name: 'Commercial & Other Vehicles', slug: 'commercial-other-vehicles' },
      { name: 'Commercial Spare Parts', slug: 'commercial-spare-parts' },
    ],
  },
  {
    name: 'Jobs', slug: 'jobs', icon: '💼',
    children: [
      { name: 'Data entry & Back office', slug: 'data-entry' },
      { name: 'Sales & Marketing', slug: 'sales-marketing' },
      { name: 'BPO & Telecaller', slug: 'bpo' },
      { name: 'Driver', slug: 'driver' },
      { name: 'Office Assistant', slug: 'office-assistant' },
      { name: 'Delivery & Collection', slug: 'delivery' },
      { name: 'Teacher', slug: 'teacher' },
      { name: 'Cook', slug: 'cook' },
      { name: 'Receptionist & Front office', slug: 'receptionist' },
      { name: 'Operator & Technician', slug: 'operator' },
      { name: 'IT Engineer & Developer', slug: 'it-engineer' },
      { name: 'Hotel & Travel Executive', slug: 'hotel-travel' },
      { name: 'Accountant', slug: 'accountant' },
      { name: 'Warehouse Staff', slug: 'warehouse' },
      { name: 'Designer', slug: 'designer' },
      { name: 'Security Guards', slug: 'security-guards' },
      { name: 'Other Jobs', slug: 'other-jobs' },
    ],
  },
  {
    name: 'Furniture', slug: 'furniture', icon: '🛋️',
    children: [
      { name: 'Sofa & Dining', slug: 'sofa-dining' },
      { name: 'Beds & Wardrobes', slug: 'beds-wardrobes' },
      { name: 'Home Decor & Garden', slug: 'home-decor' },
      { name: 'Kids Furniture', slug: 'kids-furniture' },
      { name: 'Other Household Items', slug: 'other-household' },
    ],
  },
  {
    name: 'Fashion', slug: 'fashion', icon: '👗',
    children: [
      { name: 'Men', slug: 'fashion-men' },
      { name: 'Women', slug: 'fashion-women' },
      { name: 'Kids', slug: 'fashion-kids' },
    ],
  },
  {
    name: 'Pets', slug: 'pets', icon: '🐾',
    children: [
      { name: 'Fishes & Aquarium', slug: 'fishes-aquarium' },
      { name: 'Pet Food & Accessories', slug: 'pet-food' },
      { name: 'Dogs', slug: 'dogs' },
      { name: 'Other Pets', slug: 'other-pets' },
    ],
  },
  {
    name: 'Books, Sports & Hobbies', slug: 'books-sports-hobbies', icon: '🎻',
    children: [
      { name: 'Books', slug: 'books' },
      { name: 'Gym & Fitness', slug: 'gym-fitness' },
      { name: 'Musical Instruments', slug: 'musical-instruments' },
      { name: 'Sports Equipment', slug: 'sports-equipment' },
      { name: 'Other Hobbies', slug: 'other-hobbies' },
    ],
  },
  {
    name: 'Services', slug: 'services', icon: '🛠️',
    children: [
      { name: 'Education & Classes', slug: 'education' },
      { name: 'Tours & Travel', slug: 'tours-travel' },
      { name: 'Electronics Repair & Services', slug: 'electronics-repair' },
      { name: 'Health & Beauty', slug: 'health-beauty' },
      { name: 'Home Renovation & Repair', slug: 'home-renovation' },
      { name: 'Cleaning & Pest Control', slug: 'cleaning' },
      { name: 'Legal & Documentation Services', slug: 'legal' },
      { name: 'Packers & Movers', slug: 'packers-movers' },
      { name: 'Other Services', slug: 'other-services' },
    ],
  },
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
      category: cat('scooters'), price: 75000, location: 'Bengaluru', condition: 'used',
      status: 'published', boosted: true,
      images: [
        { url: img('scooter,honda,activa', 101) },
        { url: img('scooter,parked', 102) },
      ],
    },
    {
      seller: u(2), title: 'MacBook Pro 14" M2 (2023) - 16GB/512GB',
      description: 'Barely used, with charger and original box. Battery cycle count under 50.',
      category: cat('computers-laptops'), price: 145000, location: 'Delhi', condition: 'used',
      status: 'published', boosted: true,
      images: [
        { url: img('macbook,laptop,apple', 201) },
        { url: img('laptop,workspace', 202) },
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
      ],
    },
    {
      seller: u(1), title: 'IKEA Sofa - 3 Seater, Grey',
      description: 'IKEA Friheten 3-seater, 1 year used. Clean, no stains. Pickup only.',
      category: cat('sofa-dining'), price: 18000, location: 'Bengaluru', condition: 'used',
      status: 'published',
      images: [{ url: img('sofa,couch,grey,living-room', 401) }],
    },
    {
      seller: u(2), title: 'iPhone 13 Pro - 128GB Sierra Blue',
      description: 'In warranty till Aug. With box, charger and screen guard already applied.',
      category: cat('mobile-phones'), price: 62000, location: 'Delhi', condition: 'used',
      status: 'published',
      images: [
        { url: img('iphone,smartphone,blue', 501) },
        { url: img('iphone,box,unboxing', 502) },
      ],
    },
    {
      seller: u(3), title: 'Royal Enfield Classic 350 (2020)',
      description: '18k km driven, full service history. New tyres fitted last month.',
      category: cat('motorcycles'), price: 135000, location: 'Chennai', condition: 'used',
      status: 'published',
      images: [
        { url: img('motorcycle,royal-enfield,bike', 601) },
        { url: img('motorbike,classic', 602) },
      ],
    },
    {
      seller: u(1), title: 'Sony WH-1000XM5 Headphones',
      description: 'Wireless ANC headphones, used <3 months. With case.',
      category: cat('tvs-video-audio'), price: 22000, location: 'Bengaluru', condition: 'used',
      status: 'published',
      images: [{ url: img('headphones,sony,wireless', 701) }],
    },
    {
      seller: u(2), title: 'Treadmill - Powermax MFT-2200',
      description: 'Foldable home treadmill, lightly used. Perfect for daily walks/runs.',
      category: cat('gym-fitness'), price: 24000, location: 'Delhi', condition: 'used',
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
      category: cat('dogs'), price: 28000, location: 'Bengaluru', condition: 'new',
      status: 'published',
      images: [{ url: img('golden-retriever,puppy,dog', 1001) }],
    },
    {
      seller: u(2), title: 'Office desk + ergonomic chair combo',
      description: 'Work-from-home setup. Both items for one price.',
      category: cat('other-household'), price: 9500, location: 'Delhi', condition: 'used',
      status: 'published',
      images: [{ url: img('office,desk,chair,workspace', 1101) }],
    },
    {
      seller: u(3), title: 'Maruti Swift VXI 2019 - Petrol',
      description: 'First owner, 42k km, full insurance valid. Service done last month.',
      category: cat('cars'), price: 525000, location: 'Chennai', condition: 'used',
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
