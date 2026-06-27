/**
 * Bulk product seeder for load/feature testing (sorting, search, filters, map).
 *
 *   npm run seed:bulk            # top up to 5000 published-heavy listings
 *   COUNT=8000 npm run seed:bulk # top up to a custom target
 *   FRESH=1 npm run seed:bulk    # wipe listings/favorites/chats first, then insert COUNT
 *
 * Idempotent by default: it only inserts enough NEW listings to REACH the target,
 * leaving any curated demo data (from `npm run seed`) and its favorites/chats intact.
 * Categories and a pool of seller users are created automatically if missing.
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Listing } from '../src/models/Listing.js';
import { Favorite } from '../src/models/Favorite.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { taxonomy } from './taxonomy.js';

const TARGET = Math.max(1, Number(process.env.COUNT || process.argv[2] || 5000));
const FRESH = process.env.FRESH === '1' || process.env.FRESH === 'true';
const SELLER_COUNT = 50;

// ---- deterministic RNG (mulberry32) so re-runs produce the same data ----
const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rng = mulberry32(20260628);
const rand = () => rng();
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const niceRound = (n) => {
  const step = n < 1000 ? 10 : n < 10000 ? 100 : n < 100000 ? 500 : n < 1000000 ? 1000 : 50000;
  return Math.max(step, Math.round(n / step) * step);
};

// ---- cities (with coordinates for the map feature) ----
const cities = [
  { name: 'Mumbai', lng: 72.8777, lat: 19.076, w: 10 },
  { name: 'Delhi', lng: 77.209, lat: 28.6139, w: 10 },
  { name: 'Bengaluru', lng: 77.5946, lat: 12.9716, w: 10 },
  { name: 'Chennai', lng: 80.2707, lat: 13.0827, w: 8 },
  { name: 'Hyderabad', lng: 78.4867, lat: 17.385, w: 8 },
  { name: 'Pune', lng: 73.8567, lat: 18.5204, w: 7 },
  { name: 'Kolkata', lng: 88.3639, lat: 22.5726, w: 7 },
  { name: 'Ahmedabad', lng: 72.5714, lat: 23.0225, w: 5 },
  { name: 'Jaipur', lng: 75.7873, lat: 26.9124, w: 4 },
  { name: 'Surat', lng: 72.8311, lat: 21.1702, w: 3 },
  { name: 'Lucknow', lng: 80.9462, lat: 26.8467, w: 3 },
  { name: 'Kochi', lng: 76.2673, lat: 9.9312, w: 3 },
  { name: 'Chandigarh', lng: 76.7794, lat: 30.7333, w: 3 },
  { name: 'Indore', lng: 75.8577, lat: 22.7196, w: 3 },
  { name: 'Nagpur', lng: 79.0882, lat: 21.1458, w: 2 },
  { name: 'Coimbatore', lng: 76.9558, lat: 11.0168, w: 2 },
  { name: 'Bhopal', lng: 77.4126, lat: 23.2599, w: 2 },
  { name: 'Visakhapatnam', lng: 83.2185, lat: 17.6868, w: 2 },
  { name: 'Patna', lng: 85.1376, lat: 25.5941, w: 2 },
  { name: 'Vadodara', lng: 73.1812, lat: 22.3072, w: 2 },
  { name: 'Gurugram', lng: 77.0266, lat: 28.4595, w: 3 },
  { name: 'Noida', lng: 77.391, lat: 28.5355, w: 3 },
  { name: 'Mysuru', lng: 76.6394, lat: 12.2958, w: 2 },
  { name: 'Thiruvananthapuram', lng: 76.9366, lat: 8.5241, w: 2 },
  { name: 'Guwahati', lng: 91.7362, lat: 26.1445, w: 2 },
];
const cityBag = cities.flatMap((c) => Array(c.w).fill(c));
const jitter = () => (rand() - 0.5) * 0.08; // ~±4.5km spread within a city

const conditions = ['new', 'used', 'used', 'used', 'refurbished']; // weighted toward used
const condPhrase = {
  new: ['Brand new, sealed pack', 'Unused with bill', 'Fresh piece, never used'],
  used: ['Gently used, great condition', 'Well maintained', 'Lightly used, no issues', 'Single owner'],
  refurbished: ['Professionally refurbished', 'Reconditioned, like new'],
};
const closers = [
  'Genuine buyers only.',
  'Price slightly negotiable.',
  'Pickup preferred.',
  'Reason for sale: upgrading.',
  'Contact for more details.',
  'Delivery can be arranged.',
];

// ---- per-category product catalogue ----
// `models` entries already include the brand (so brand search works and the
// brand+model pairing is always realistic). `items` are generic product names.
const P = {
  cars: { models: ['Maruti Suzuki Swift', 'Maruti Suzuki Baleno', 'Maruti Suzuki Wagon R', 'Hyundai i20', 'Hyundai Creta', 'Hyundai Venue', 'Hyundai Verna', 'Honda City', 'Honda Amaze', 'Toyota Innova Crysta', 'Toyota Fortuner', 'Tata Nexon', 'Tata Altroz', 'Tata Harrier', 'Mahindra XUV700', 'Mahindra Scorpio', 'Kia Seltos', 'Kia Sonet', 'Volkswagen Polo', 'Renault Kwid', 'Skoda Slavia', 'MG Hector', 'Ford EcoSport'], price: [150000, 4500000], year: [2009, 2024] },
  motorcycles: { models: ['Royal Enfield Classic 350', 'Royal Enfield Bullet 350', 'Royal Enfield Meteor 350', 'Bajaj Pulsar 220F', 'Bajaj Pulsar NS200', 'Hero Splendor Plus', 'Hero Passion Pro', 'Honda Shine 125', 'Honda Unicorn', 'TVS Apache RTR 160', 'TVS Raider 125', 'Yamaha FZ-S', 'Yamaha R15', 'KTM Duke 200', 'KTM RC 390', 'Suzuki Gixxer SF'], price: [22000, 350000], year: [2008, 2024] },
  scooters: { models: ['Honda Activa 6G', 'Honda Dio', 'TVS Jupiter 125', 'TVS Ntorq 125', 'Suzuki Access 125', 'Hero Pleasure+', 'Yamaha Ray ZR', 'Ola S1 Pro', 'Ather 450X', 'Bajaj Chetak'], price: [18000, 160000], year: [2010, 2024] },
  bicycles: { models: ['Hero Sprint Pro', 'BTwin Rockrider ST100', 'Firefox Roadeo A75', 'Hercules Roadeo', 'Montra Trance', 'Giant ATX', 'BSA Ladybird'], price: [3000, 65000] },
  'bike-spare-parts': { items: ['Full-face helmet', 'Tubeless tyre set', 'LED headlight assembly', 'Disc brake kit', 'Chain sprocket set', 'Custom seat cover', 'Crash guard', 'Exhaust silencer'], price: [300, 18000] },
  'commercial-other-vehicles': { models: ['Tata Ace Gold', 'Tata 407 Truck', 'Ashok Leyland Dost+', 'Mahindra Bolero Pickup', 'Eicher 1109 Tipper'], price: [200000, 2800000], year: [2010, 2023] },
  'commercial-spare-parts': { items: ['Clutch plate assembly', 'Reconditioned gearbox', 'Leaf spring set', 'Truck radiator', 'Brake drum'], price: [1000, 65000] },

  'mobile-phones': { models: ['Apple iPhone 13', 'Apple iPhone 15 Pro', 'Apple iPhone 14', 'Samsung Galaxy S23', 'Samsung Galaxy A54', 'Samsung Galaxy M34', 'OnePlus 11R', 'OnePlus Nord 3', 'Xiaomi Redmi Note 13', 'Xiaomi 13 Pro', 'Realme Narzo 60', 'Realme 11 Pro', 'Vivo V29', 'Oppo Reno 11', 'Google Pixel 7a', 'Motorola Edge 40', 'Nothing Phone 2'], suffix: ['64GB', '128GB', '256GB', '512GB'], price: [4000, 160000] },
  'mobile-accessories': { items: ['65W fast charger', 'MagSafe wireless charger', 'USB-C braided cable', 'Silicone phone case', '20000mAh power bank', 'Bluetooth earbuds', 'Car phone mount', 'Tempered glass (pack)'], price: [150, 9000] },
  tablets: { models: ['Apple iPad 9th Gen', 'Apple iPad Air', 'Samsung Galaxy Tab S8', 'Samsung Galaxy Tab A8', 'Lenovo Tab M10', 'Xiaomi Pad 6', 'Realme Pad SE'], suffix: ['WiFi', 'WiFi+5G'], price: [8000, 95000] },
  'computers-laptops': { models: ['Apple MacBook Air M2', 'Apple MacBook Pro 14', 'Dell XPS 13', 'Dell Inspiron 15', 'HP Pavilion 15', 'HP Victus 16', 'Lenovo IdeaPad Slim 5', 'Lenovo ThinkPad E14', 'Asus ROG Strix G15', 'Asus VivoBook 15', 'Acer Aspire 7', 'MSI Modern 14'], price: [15000, 260000] },
  'tvs-video-audio': { models: ['Sony Bravia 55" 4K', 'Samsung QLED 50"', 'LG OLED 48"', 'Mi 43" Smart TV', 'OnePlus TV U1S 55"', 'boAt Stone 1200 speaker', 'JBL Party Speaker', 'JBL Soundbar 5.1', 'Sony Soundbar HT-S40R'], price: [2500, 220000] },
  'cameras-lenses': { models: ['Canon EOS 1500D', 'Canon EOS R50', 'Nikon D5600', 'Sony Alpha A6400', 'Sony ZV-E10', 'Fujifilm X-T30 II', 'GoPro Hero 11 Black', 'Canon 50mm f/1.8 lens', 'Nikon 18-140mm lens'], price: [5000, 280000] },
  'games-entertainment': { items: ['PS5 console', 'Xbox Series X', 'Nintendo Switch OLED', 'PS4 Slim + 5 games', 'DualSense controller', 'Meta Quest 2 VR', 'Gaming steering wheel'], price: [3000, 65000] },
  fridges: { models: ['LG Double Door 260L', 'Samsung Side-by-Side 600L', 'Whirlpool Single Door 190L', 'Haier Triple Door 300L', 'Godrej Convertible 340L'], price: [8000, 130000] },
  'computer-accessories': { items: ['Mechanical keyboard (RGB)', 'Wireless mouse', '1080p webcam', '7-in-1 USB-C hub', 'Aluminium laptop stand', 'Wired gaming headset', 'WiFi 6 router'], price: [300, 20000] },
  'hard-disks-printers': { items: ['1TB external HDD', '2TB NVMe SSD', 'HP LaserJet printer', 'Canon Pixma inkjet', '27" IPS monitor', 'Epson EcoTank printer'], price: [1500, 55000] },
  acs: { models: ['Voltas 1.5 Ton Split Inverter', 'LG 1.5 Ton 5-Star', 'Daikin 1 Ton Split', 'Samsung 2 Ton Split', 'Blue Star 1 Ton Window'], price: [12000, 85000] },
  'washing-machines': { models: ['LG Front Load 7kg', 'Samsung Top Load 6.5kg', 'IFB Front Load 8kg', 'Whirlpool Semi-Automatic 8kg', 'Bosch Front Load 8kg Inverter'], price: [7000, 95000] },
  'kitchen-appliances': { items: ['Convection microwave', 'Mixer grinder (750W)', 'Induction cooktop', 'Air fryer 4L', 'Dishwasher 13 place', 'Electric kettle', 'Hand blender', 'Sandwich maker'], price: [500, 70000] },

  'sale-houses-apartments': { items: ['2BHK Apartment', '3BHK Flat', 'Independent Villa', '1BHK Apartment', '4BHK Penthouse', 'Row House'], price: [2500000, 28000000] },
  'rent-houses-apartments': { items: ['2BHK for Rent', '1RK Studio for Rent', '3BHK Furnished for Rent', '1BHK Semi-furnished'], price: [6000, 95000] },
  'lands-plots': { items: ['Residential Plot 1200 sqft', 'Agricultural Land 1 acre', 'Corner Plot 2400 sqft', 'Gated Layout Plot', 'Commercial Plot'], price: [800000, 45000000] },
  'sale-new-projects': { items: ['Under-construction 2BHK', 'Premium 3BHK Project', 'Smart Township Flat', 'Luxury 4BHK Project'], price: [3500000, 32000000] },
  'rent-shops-offices': { items: ['Office Space 800 sqft', 'Retail Shop on Main Road', 'Co-working Desk', 'Showroom 1500 sqft'], price: [10000, 350000] },
  'sale-shops-offices': { items: ['Commercial Shop', 'Office Floor 2000 sqft', 'Warehouse Unit', 'Mall Retail Space'], price: [2000000, 55000000] },
  'pg-guest-houses': { items: ['Single Room PG', 'Shared PG for Men', 'Ladies PG with Food', 'Guest House Room (daily)', 'Working Professionals PG'], price: [4000, 28000] },

  'sofa-dining': { items: ['3-seater fabric sofa', 'L-shaped sofa set', '6-seater dining table', 'Recliner chair', 'Coffee table', 'Wooden sofa cum bed'], price: [3000, 120000] },
  'beds-wardrobes': { items: ['Queen size bed', 'King bed with storage', '3-door wardrobe', 'Bunk bed for kids', 'Dressing table', 'Single bed with mattress'], price: [4000, 110000] },
  'home-decor': { items: ['Framed wall painting', 'Floor lamp', 'Indoor plants set', 'Designer curtains', 'Decorative wall mirror', 'Artificial grass roll'], price: [200, 28000] },
  'kids-furniture': { items: ['Kids study table', 'Baby cot', 'Toddler bunk bed', 'Toy storage rack', 'Kids activity desk'], price: [1000, 42000] },
  'other-household': { items: ['Office desk + chair combo', '5-tier shoe rack', 'Wooden bookshelf', 'Storage cabinet', 'Foldable dining set'], price: [500, 55000] },

  'fashion-men': { items: ['Genuine leather jacket', 'Formal leather shoes', 'Slim-fit denim jeans', 'Cotton shirts (pack of 3)', 'Automatic wrist watch', 'Polarized sunglasses', 'Running shoes'], price: [200, 35000] },
  'fashion-women': { items: ['Designer silk saree', 'Anarkali kurti set', 'Leather handbag', 'Block heels', 'Gold-plated jewellery set', 'Party gown', 'Ethnic lehenga'], price: [300, 65000] },
  'fashion-kids': { items: ['Kids party dress', 'School shoes', 'Winter wear set', 'Baby clothing bundle', 'Kids ethnic wear'], price: [150, 9000] },

  dogs: { items: ['Labrador puppy', 'German Shepherd puppy', 'Golden Retriever puppy', 'Beagle puppy', 'Pug puppy', 'Pomeranian puppy', 'Rottweiler puppy'], price: [5000, 85000] },
  'fishes-aquarium': { items: ['Goldfish set of 6', '2ft aquarium tank', 'Guppy breeding pair', 'Aquarium filter + pump', 'Betta fish with bowl'], price: [200, 26000] },
  'pet-food': { items: ['Dog food 10kg', 'Cat food 7kg', 'Pet grooming shampoo', 'Chew toys bundle', 'Dog harness + leash'], price: [200, 9000] },
  'other-pets': { items: ['Persian cat', 'Lovebirds pair', 'Holland Lop rabbit', 'Hamster with cage', 'Budgerigar parakeet'], price: [500, 42000] },

  books: { items: ['Engineering textbooks bundle', 'UPSC prelims prep set', 'Fiction novels collection', 'Children story books (pack)', 'NEET/JEE guide set', 'CA foundation books'], price: [100, 9000] },
  'gym-fitness': { items: ['Motorized treadmill', 'Adjustable dumbbells (pair)', 'Exercise spin cycle', 'Home gym multi-station', 'Yoga mat + accessories kit', 'Weight bench'], price: [500, 130000] },
  'musical-instruments': { items: ['Acoustic guitar', '61-key keyboard', 'Tabla set with bag', 'Violin (4/4)', 'Electronic drum kit', 'Cajon box', 'Ukulele'], price: [800, 95000] },
  'sports-equipment': { items: ['Full cricket kit', 'Badminton rackets (pair)', 'Football size 5', 'Skateboard', 'Carrom board', 'Table tennis set', 'Cricket bat (English willow)'], price: [200, 32000] },
  'other-hobbies': { items: ['DSLR tripod', 'Painting easel set', 'Premium chess board', 'Beginner telescope', 'RC racing car', 'Drone with camera'], price: [300, 60000] },
};

// Jobs & services read differently (salary / service fee); keep their semantics distinct.
const JOB_SLUGS = new Set(['data-entry', 'sales-marketing', 'bpo', 'driver', 'office-assistant', 'delivery', 'teacher', 'cook', 'receptionist', 'operator', 'it-engineer', 'hotel-travel', 'accountant', 'warehouse', 'designer', 'security-guards', 'other-jobs']);
const SERVICE_SLUGS = new Set(['education', 'tours-travel', 'electronics-repair', 'health-beauty', 'home-renovation', 'cleaning', 'legal', 'packers-movers', 'other-services']);
const jobPrefix = ['Hiring', 'Urgent opening', 'Job opening', 'Walk-in interview', 'Now hiring'];
const jobExtra = ['Freshers welcome', 'Experienced preferred', 'Immediate joining', 'Full-time role', 'Part-time available', 'Attractive incentives'];
const servicePrefix = ['Professional', 'Affordable', 'Trusted', 'Expert', '24x7', 'Doorstep'];

const cleanRole = (name) => name.replace(/\s*&\s*/g, ' / ').replace(/:.*/, '').trim();

const makeProduct = (slug, catName) => {
  if (JOB_SLUGS.has(slug)) {
    const role = cleanRole(catName);
    return {
      title: `${pick(jobPrefix)}: ${role}`.slice(0, 140),
      description: `${pick(jobPrefix)} for ${role}. ${pick(jobExtra)}. Salary as per experience and skills. Apply with your resume.`,
      price: niceRound(randInt(9000, 120000)),
      condition: 'new',
    };
  }
  if (SERVICE_SLUGS.has(slug)) {
    const role = cleanRole(catName);
    return {
      title: `${pick(servicePrefix)} ${role} Services`.slice(0, 140),
      description: `${pick(servicePrefix)} ${role.toLowerCase()} services with verified professionals. Transparent pricing and on-time delivery.`,
      price: niceRound(randInt(200, 50000)),
      condition: 'new',
    };
  }

  const t = P[slug];
  const condition = pick(conditions);
  let title;
  let feature;
  if (t && t.models) {
    const model = pick(t.models);
    const yr = t.year ? ` ${randInt(t.year[0], t.year[1])}` : '';
    const suf = t.suffix ? ` ${pick(t.suffix)}` : '';
    title = `${model}${suf}${yr}`;
    feature = `${model}${suf} in excellent working condition`;
  } else if (t && t.items) {
    const item = pick(t.items);
    title = item;
    feature = `${item} available`;
  } else {
    // generic fallback keeps the title related to the category for filter/search
    const item = pick(['for sale', 'available', 'in great shape', 'best price']);
    title = `${catName} ${item}`;
    feature = `${catName} ${item}`;
  }
  const [min, max] = (t && t.price) || [200, 50000];
  return {
    title: title.slice(0, 140),
    description: `${pick(condPhrase[condition])}. ${feature}. ${pick(closers)}`,
    price: niceRound(randInt(min, max)),
    condition,
  };
};

const pickStatus = () => {
  const r = rand();
  if (r < 0.86) return 'published';
  if (r < 0.94) return 'sold';
  if (r < 0.985) return 'draft';
  return 'disabled';
};

const pickViews = () => (chance(0.12) ? randInt(500, 9000) : randInt(0, 480));

const SELLER_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Pari', 'Anika', 'Navya', 'Riya', 'Myra', 'Sara', 'Kabir', 'Dev', 'Farhan', 'Imran', 'Neha', 'Pooja', 'Sneha', 'Kiran', 'Manish', 'Suresh'];
const SURNAMES = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Khan', 'Singh', 'Gupta', 'Das', 'Mehta', 'Rao', 'Joshi', 'Bose', 'Pillai'];

async function ensureCategories() {
  let order = 0;
  for (const parent of taxonomy) {
    order += 1;
    const pDoc = await Category.findOneAndUpdate(
      { slug: parent.slug },
      { $setOnInsert: { name: parent.name, slug: parent.slug, icon: parent.icon, order } },
      { upsert: true, new: true }
    );
    let childOrder = 0;
    for (const child of parent.children || []) {
      childOrder += 1;
      await Category.findOneAndUpdate(
        { slug: child.slug },
        { $setOnInsert: { name: child.name, slug: child.slug, parent: pDoc._id, order: childOrder } },
        { upsert: true, new: true }
      );
    }
  }
  return Category.find().lean();
}

async function ensureSellers() {
  const existing = await User.find().select('_id').lean();
  const sellers = existing.map((u) => u._id);
  for (let i = 1; i <= SELLER_COUNT; i += 1) {
    const email = `seller${String(i).padStart(2, '0')}@syt.test`;
    let user = await User.findOne({ email }).select('_id');
    if (!user) {
      user = await User.create({
        name: `${pick(SELLER_NAMES)} ${pick(SURNAMES)}`,
        email,
        password: 'password123',
        location: pick(cities).name,
        phone: `+9198${randInt(10000000, 99999999)}`,
      });
    }
    sellers.push(user._id);
  }
  return sellers;
}

async function run() {
  console.log(`[seed-bulk] connecting to ${config.mongoUri}`);
  await mongoose.connect(config.mongoUri);

  if (FRESH) {
    console.log('[seed-bulk] FRESH=1 — clearing listings, favorites, conversations, messages...');
    await Promise.all([
      Listing.deleteMany({}),
      Favorite.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
    ]);
  }

  console.log('[seed-bulk] ensuring categories...');
  const cats = await ensureCategories();
  const byId = new Map(cats.map((c) => [String(c._id), c]));
  const childIds = new Set(cats.filter((c) => c.parent).map((c) => String(c.parent)));
  // assignable = leaf categories: every child, plus any parent that has no children
  const assignable = cats.filter((c) => c.parent || !childIds.has(String(c._id)));
  console.log(`[seed-bulk] ${cats.length} categories, ${assignable.length} assignable (leaf) categories`);

  console.log(`[seed-bulk] ensuring ${SELLER_COUNT} sellers...`);
  const sellers = await ensureSellers();

  const existingCount = await Listing.countDocuments();
  const toCreate = Math.max(0, TARGET - existingCount);
  console.log(`[seed-bulk] existing listings: ${existingCount}; target: ${TARGET}; to create: ${toCreate}`);
  if (toCreate === 0) {
    console.log('[seed-bulk] target already met — nothing to insert. Use FRESH=1 or a higher COUNT to add more.');
    await mongoose.disconnect();
    return;
  }

  const now = Date.now();
  const DAY = 86400000;
  let made = 0;
  const perCat = {};

  for (let batchStart = 0; batchStart < toCreate; batchStart += 500) {
    const batch = [];
    const end = Math.min(batchStart + 500, toCreate);
    for (let i = batchStart; i < end; i += 1) {
      const cat = pick(assignable);
      const parentSlug = cat.parent ? byId.get(String(cat.parent))?.slug : cat.slug;
      const prod = makeProduct(cat.slug, cat.name);
      const city = pick(cityBag);
      const status = pickStatus();
      const boosted = status === 'published' && chance(0.08);
      const created = new Date(now - randInt(0, 365) * DAY - randInt(0, DAY - 1));
      const imgCount = randInt(1, 4);
      const images = Array.from({ length: imgCount }, (_, k) => ({
        url: `https://picsum.photos/seed/syt-${made + i}-${k}/800/600`,
        key: `syt-${made + i}-${k}`,
      }));

      const doc = {
        seller: pick(sellers),
        title: prod.title,
        description: prod.description,
        category: cat._id,
        price: prod.price,
        currency: 'INR',
        condition: prod.condition,
        location: city.name,
        images,
        status,
        boosted,
        views: pickViews(),
        createdAt: created,
        updatedAt: created,
      };
      if (boosted) doc.boostExpiresAt = new Date(now + randInt(1, 30) * DAY);
      // ~90% get map coordinates; the rest exercise the "no pin" fallback
      if (chance(0.9)) {
        doc.geo = { type: 'Point', coordinates: [city.lng + jitter(), city.lat + jitter()] };
      }
      batch.push(doc);
      perCat[parentSlug] = (perCat[parentSlug] || 0) + 1;
    }
    // timestamps:false lets our explicit createdAt/updatedAt stand (spread for sort tests)
    const inserted = await Listing.insertMany(batch, { ordered: false, timestamps: false });
    made += inserted.length;
    process.stdout.write(`\r[seed-bulk] inserted ${made}/${toCreate}`);
  }
  process.stdout.write('\n');

  const total = await Listing.countDocuments();
  const published = await Listing.countDocuments({ status: 'published' });
  const withGeo = await Listing.countDocuments({ geo: { $exists: true } });
  console.log('[seed-bulk] done.');
  console.log(`  total listings:     ${total}`);
  console.log(`  published:          ${published}`);
  console.log(`  with map coords:    ${withGeo}`);
  console.log('  by top-level category:');
  Object.entries(perCat)
    .sort((a, b) => b[1] - a[1])
    .forEach(([slug, n]) => console.log(`    ${slug.padEnd(22)} ${n}`));
  console.log('  sample seller login: seller01@syt.test / password123');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[seed-bulk] error:', err);
  process.exit(1);
});
