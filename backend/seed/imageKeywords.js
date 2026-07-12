// Maps each leaf category slug to an image search keyword so seeded listings get
// pictures that match the product (cars show cars, dogs show dogs, etc.).
// Images come from LoremFlickr, which serves keyword-tagged photos and is
// deterministic per `lock` value (so the same listing always gets the same image).
export const IMAGE_KEYWORDS = {
  // Vehicles
  cars: 'car',
  motorcycles: 'motorcycle',
  scooters: 'scooter',
  bicycles: 'bicycle',
  'bike-spare-parts': 'motorcycle-parts',
  'commercial-other-vehicles': 'truck',
  'commercial-spare-parts': 'truck-engine',

  // Properties
  'sale-houses-apartments': 'house',
  'rent-houses-apartments': 'apartment',
  'lands-plots': 'land',
  'sale-new-projects': 'building',
  'rent-shops-offices': 'office',
  'sale-shops-offices': 'shop',
  'pg-guest-houses': 'hostel',

  // Electronics & appliances
  'tvs-video-audio': 'television',
  'kitchen-appliances': 'kitchen-appliance',
  'computers-laptops': 'laptop',
  'cameras-lenses': 'camera',
  'games-entertainment': 'videogame',
  fridges: 'refrigerator',
  'computer-accessories': 'keyboard',
  'hard-disks-printers': 'printer',
  acs: 'air-conditioner,air-conditioning',
  'washing-machines': 'washing-machine',

  // Mobiles
  'mobile-phones': 'smartphone',
  'mobile-accessories': 'headphones',
  tablets: 'ipad',

  // Jobs (workplace-themed imagery)
  'data-entry': 'office',
  'sales-marketing': 'marketing',
  bpo: 'callcenter',
  driver: 'driver',
  'office-assistant': 'office',
  delivery: 'delivery',
  teacher: 'teacher',
  cook: 'chef',
  receptionist: 'reception',
  operator: 'factory',
  'it-engineer': 'programming',
  'hotel-travel': 'hotel',
  accountant: 'accounting',
  warehouse: 'warehouse',
  designer: 'design',
  'security-guards': 'security',
  'other-jobs': 'office',

  // Furniture
  'sofa-dining': 'sofa',
  'beds-wardrobes': 'bed',
  'home-decor': 'interior',
  'kids-furniture': 'nursery',
  'other-household': 'furniture',

  // Fashion
  'fashion-men': 'menswear',
  'fashion-women': 'fashion',
  'fashion-kids': 'baby-clothes',

  // Pets
  dogs: 'dog',
  'fishes-aquarium': 'aquarium',
  'pet-food': 'pet',
  'other-pets': 'cat',

  // Books, sports & hobbies
  books: 'books',
  'gym-fitness': 'gym',
  'musical-instruments': 'guitar',
  'sports-equipment': 'sports',
  'other-hobbies': 'hobby',

  // Services
  education: 'classroom',
  'tours-travel': 'travel',
  'electronics-repair': 'repair',
  'health-beauty': 'salon',
  'home-renovation': 'renovation',
  cleaning: 'cleaning',
  legal: 'law',
  'packers-movers': 'moving-boxes',
  'other-services': 'tools',
};

// Per-category keyword variants: the k-th photo of a listing uses the k-th
// keyword, so a post's gallery shows different-but-relevant shots (a car ad
// gets exterior/sedan/SUV/interior pictures instead of five near-identical
// ones). Every keyword is independently relevant to its category; the first
// entry is always the base keyword above. Repeats are fine — a different
// `lock` already yields a different photo for the same keyword.
//
// LoremFlickr silently falls back to a RANDOM photo when a tag has no
// matches, so only tags whose thumbnails were visually spot-checked (or
// ubiquitous Flickr tags) belong here. Known-bad/sparse tags: hvac, cctv,
// crib, handyman, toolbox, kidswear, mobile-phone, paperwork, courier,
// parcel, crane, stereo, arcade, controller, gamepad, police, housekeeping,
// carpentry, charger, gadget, webcam, courthouse. A comma means AND on
// LoremFlickr (photo must carry every tag) — only combos verified non-empty
// belong here; an empty intersection silently degrades to random photos.
export const IMAGE_VARIANTS = {
  // Vehicles
  cars: ['car', 'sedan', 'suv', 'hatchback', 'car-interior'],
  motorcycles: ['motorcycle', 'motorbike', 'biker', 'motorcycle', 'motorbike'],
  scooters: ['scooter', 'vespa', 'scooter', 'vespa', 'scooter'],
  bicycles: ['bicycle', 'cycling', 'mountain-bike', 'bicycle', 'cycling'],
  'bike-spare-parts': ['motorcycle-parts', 'helmet', 'motorcycle-engine', 'motorcycle-parts', 'motorcycle'],
  'commercial-other-vehicles': ['truck', 'lorry', 'van', 'tractor', 'truck'],
  'commercial-spare-parts': ['truck-engine', 'engine', 'truck', 'engine', 'truck-engine'],

  // Properties
  'sale-houses-apartments': ['house', 'villa', 'bungalow', 'living-room', 'kitchen'],
  'rent-houses-apartments': ['apartment', 'living-room', 'bedroom', 'kitchen', 'balcony'],
  'lands-plots': ['land', 'farmland', 'field', 'meadow', 'land'],
  'sale-new-projects': ['building', 'construction', 'skyscraper', 'architecture', 'building'],
  'rent-shops-offices': ['office', 'coworking', 'workspace', 'desk', 'office'],
  'sale-shops-offices': ['shop', 'storefront', 'retail', 'boutique', 'shop'],
  'pg-guest-houses': ['hostel', 'dormitory', 'bedroom', 'hostel', 'guesthouse'],

  // Electronics & appliances
  'tvs-video-audio': ['television', 'tv', 'speaker', 'television', 'speaker'],
  'kitchen-appliances': ['kitchen-appliance', 'microwave', 'blender', 'kitchen', 'kitchen-appliance'],
  'computers-laptops': ['laptop', 'macbook', 'computer', 'keyboard', 'laptop'],
  'cameras-lenses': ['camera', 'dslr', 'camera-lens', 'photographer', 'photography'],
  'games-entertainment': ['videogame', 'playstation', 'xbox', 'gaming', 'videogame'],
  fridges: ['refrigerator', 'fridge', 'kitchen', 'refrigerator', 'fridge'],
  'computer-accessories': ['keyboard', 'computer', 'laptop', 'monitor', 'keyboard'],
  'hard-disks-printers': ['printer', 'harddrive', 'monitor', 'computer', 'printer'],
  acs: ['air-conditioner,air-conditioning', 'air-conditioning', 'air-conditioner', 'air-conditioner,air-conditioning', 'air-conditioning'],
  'washing-machines': ['washing-machine', 'laundry', 'laundromat', 'washing-machine', 'laundry'],

  // Mobiles
  'mobile-phones': ['smartphone', 'iphone', 'smartphone', 'iphone', 'smartphone'],
  'mobile-accessories': ['headphones', 'earphones', 'smartwatch', 'headphones', 'earphones'],
  tablets: ['ipad', 'tablet', 'ipad', 'tablet', 'ipad'],

  // Jobs (workplace-themed imagery)
  'data-entry': ['office', 'typing', 'computer', 'office', 'desk'],
  'sales-marketing': ['marketing', 'presentation', 'meeting', 'handshake', 'office'],
  bpo: ['callcenter', 'headset', 'office', 'callcenter', 'computer'],
  driver: ['driver', 'taxi', 'driving', 'car', 'driver'],
  'office-assistant': ['office', 'desk', 'meeting', 'documents', 'office'],
  delivery: ['delivery', 'package', 'delivery', 'boxes', 'delivery'],
  teacher: ['teacher', 'classroom', 'teaching', 'blackboard', 'school'],
  cook: ['chef', 'cooking', 'kitchen', 'restaurant', 'chef'],
  receptionist: ['reception', 'office', 'lobby', 'reception', 'hotel'],
  operator: ['factory', 'machinery', 'industrial', 'workshop', 'factory'],
  'it-engineer': ['programming', 'coding', 'computer', 'developer', 'software'],
  'hotel-travel': ['hotel', 'resort', 'travel', 'lobby', 'hotel'],
  accountant: ['accounting', 'calculator', 'finance', 'documents', 'office'],
  warehouse: ['warehouse', 'forklift', 'logistics', 'boxes', 'warehouse'],
  designer: ['design', 'designer', 'sketch', 'studio', 'creative'],
  'security-guards': ['security', 'surveillance', 'security', 'surveillance', 'security'],
  'other-jobs': ['office', 'work', 'meeting', 'office', 'teamwork'],

  // Furniture
  'sofa-dining': ['sofa', 'couch', 'dining-table', 'living-room', 'armchair'],
  'beds-wardrobes': ['bed', 'bedroom', 'wardrobe', 'mattress', 'bed'],
  'home-decor': ['interior', 'decor', 'lamp', 'houseplant', 'vase'],
  'kids-furniture': ['nursery', 'baby', 'playroom', 'toys', 'nursery'],
  'other-household': ['furniture', 'bookshelf', 'desk', 'cabinet', 'shelf'],

  // Fashion
  'fashion-men': ['menswear', 'suit', 'shoes', 'watch', 'shirt'],
  'fashion-women': ['fashion', 'dress', 'sari', 'saree', 'handbag'],
  'fashion-kids': ['baby-clothes', 'children', 'baby-clothes', 'kids-clothing,children', 'baby-clothes'],

  // Pets
  dogs: ['dog', 'puppy', 'dog', 'puppy', 'dog'],
  'fishes-aquarium': ['aquarium', 'fish', 'goldfish', 'fish-tank', 'aquarium'],
  'pet-food': ['pet', 'dog', 'cat', 'pet', 'dog'],
  'other-pets': ['cat', 'rabbit', 'parrot', 'hamster', 'kitten'],

  // Books, sports & hobbies
  books: ['books', 'library', 'bookshelf', 'reading', 'books'],
  'gym-fitness': ['gym', 'dumbbell', 'treadmill', 'fitness', 'workout'],
  'musical-instruments': ['guitar', 'piano', 'violin', 'drums', 'saxophone'],
  'sports-equipment': ['sports', 'cricket', 'football', 'badminton', 'tennis'],
  'other-hobbies': ['hobby', 'chess', 'telescope', 'drone', 'painting'],

  // Services
  education: ['classroom', 'books', 'studying', 'teacher', 'classroom'],
  'tours-travel': ['travel', 'beach', 'mountains', 'luggage', 'passport'],
  'electronics-repair': ['repair', 'soldering', 'electronics', 'workshop', 'repair'],
  'health-beauty': ['salon', 'spa', 'makeup', 'haircut', 'massage'],
  'home-renovation': ['renovation', 'construction', 'tools', 'paint', 'construction'],
  cleaning: ['cleaning', 'vacuum', 'mop', 'cleaning', 'laundry'],
  legal: ['law', 'lawyer', 'documents', 'law', 'office'],
  'packers-movers': ['moving-boxes', 'boxes', 'cardboard', 'moving-boxes', 'truck'],
  'other-services': ['tools', 'workshop', 'repair', 'tools', 'workshop'],
};

export const imageKeyword = (slug) => IMAGE_KEYWORDS[slug] || 'product';

/** k-th relevant keyword for a category (falls back to the base keyword). */
export const imageVariant = (slug, k) => {
  const variants = IMAGE_VARIANTS[slug];
  if (!variants || variants.length === 0) return imageKeyword(slug);
  return variants[k % variants.length];
};

/** Deterministic, keyword-matched image URL. `lock` selects a stable photo. */
export const imageUrl = (slug, lock, w = 800, h = 600) =>
  `https://loremflickr.com/${w}/${h}/${encodeURIComponent(imageKeyword(slug))}?lock=${lock}`;

/** Like imageUrl, but the k-th photo of a listing gets a different relevant angle. */
export const imageUrlVariant = (slug, k, lock, w = 800, h = 600) =>
  `https://loremflickr.com/${w}/${h}/${encodeURIComponent(imageVariant(slug, k))}?lock=${lock}`;
