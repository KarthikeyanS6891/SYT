// Single source of truth for the category tree, shared by seed.js and seed-bulk.js.
export const taxonomy = [
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
