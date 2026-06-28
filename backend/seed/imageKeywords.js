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
  acs: 'air-conditioner',
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
  'fashion-kids': 'kids-clothing',

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

export const imageKeyword = (slug) => IMAGE_KEYWORDS[slug] || 'product';

/** Deterministic, keyword-matched image URL. `lock` selects a stable photo. */
export const imageUrl = (slug, lock, w = 800, h = 600) =>
  `https://loremflickr.com/${w}/${h}/${encodeURIComponent(imageKeyword(slug))}?lock=${lock}`;
