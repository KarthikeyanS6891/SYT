// Lightweight mock of the SYT backend API for visual preview only.
// Serves /api/v1/categories, /listings, /listings/:id, /listings/:id/similar, /search/suggest
import http from 'node:http';
import { URL } from 'node:url';

const PORT = 5050;

const cats = [
  { name: 'Cars', slug: 'cars', icon: '🚗' },
  { name: 'Bikes', slug: 'bikes', icon: '🏍️' },
  { name: 'Properties', slug: 'properties', icon: '🏢' },
  { name: 'Electronics & Appliances', slug: 'electronics-appliances', icon: '📺' },
  { name: 'Mobiles', slug: 'mobiles', icon: '📱' },
  { name: 'Furniture', slug: 'furniture', icon: '🛋️' },
  { name: 'Fashion', slug: 'fashion', icon: '👗' },
  { name: 'Jobs', slug: 'jobs', icon: '💼' },
  { name: 'Books, Sports & Hobbies', slug: 'books-sports', icon: '📚' },
  { name: 'Pets', slug: 'pets', icon: '🐶' },
].map((c, i) => ({ _id: `cat${i + 1}`, parent: null, order: i, ...c }));

// a few children for the mega menu
const children = [
  ['cat2', ['Motorcycles', 'Scooters', 'Bicycles', 'Bike Spare Parts']],
  ['cat3', ['For Sale: Houses & Apartments', 'For Rent: Houses & Apartments', 'Lands & Plots', 'PG & Guest Houses']],
  ['cat4', ['TVs, Video - Audio', 'Computers & Laptops', 'Kitchen & Other Appliances', 'Cameras & Lenses', 'ACs']],
  ['cat5', ['Mobile Phones', 'Tablets', 'Accessories']],
  ['cat6', ['Sofa & Dining', 'Beds & Wardrobes', 'Home Decor & Garden']],
  ['cat7', ['Men', 'Women', 'Kids']],
].flatMap(([parent, names], gi) =>
  names.map((name, i) => ({
    _id: `sub${gi}-${i}`,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    parent,
    order: i,
  }))
);

const categories = [...cats, ...children];

const titles = [
  ['Maruti Swift VXI 2019, single owner, 34k km', 485000, 'cat1', 'Chennai', 'used'],
  ['Hyundai i20 Sportz 2021 — showroom condition', 720000, 'cat1', 'Coimbatore', 'used'],
  ['Royal Enfield Classic 350, 2022, mint', 165000, 'cat2', 'Madurai', 'used'],
  ['Honda Activa 6G, 2023, under warranty', 78000, 'cat2', 'Chennai', 'used'],
  ['2BHK apartment for rent near IT park', 18500, 'cat3', 'Bengaluru', 'used'],
  ['Premium villa plot 1200 sqft, DTCP approved', 2650000, 'cat3', 'Coimbatore', 'new'],
  ['Sony Bravia 55" 4K Google TV, 1 yr old', 42999, 'cat4', 'Chennai', 'used'],
  ['MacBook Air M2 13" 8/256, AppleCare till 2027', 82500, 'cat4', 'Bengaluru', 'refurbished'],
  ['LG 260L double-door fridge, frost free', 16500, 'cat4', 'Trichy', 'used'],
  ['iPhone 14 Pro 128GB Deep Purple, 89% battery', 61999, 'cat5', 'Chennai', 'used'],
  ['Samsung Galaxy S23 Ultra 256GB with cover', 68000, 'cat5', 'Hyderabad', 'used'],
  ['OnePlus Pad 8/128 with stylus, sealed', 28999, 'cat5', 'Bengaluru', 'new'],
  ['L-shaped fabric sofa, 3 months old', 24500, 'cat6', 'Chennai', 'used'],
  ['Sheesham wood queen bed with storage', 19999, 'cat6', 'Coimbatore', 'used'],
  ['Study table + ergonomic chair combo', 7500, 'cat6', 'Madurai', 'used'],
  ['Canon EOS R50 kit lens, 3k shutter count', 55000, 'cat4', 'Chennai', 'used'],
  ['Designer silk saree collection — festive', 3499, 'cat7', 'Kanchipuram', 'new'],
  ['Trek mountain bike 29er, disc brakes', 32000, 'cat2', 'Bengaluru', 'used'],
  ['Golden retriever puppies, KCI registered', 15000, 'cat10', 'Chennai', 'new'],
  ['Cricket kit — SG bat, pads, full set', 5800, 'cat9', 'Trichy', 'used'],
  ['PS5 slim disc edition + 2 controllers', 44999, 'cat4', 'Hyderabad', 'used'],
  ['Antique brass lamp set (pair)', 4200, 'cat6', 'Thanjavur', 'used'],
  ['Bajaj Pulsar NS200, 2021, well maintained', 98000, 'cat2', 'Salem', 'used'],
  ['Office space 800 sqft for rent, main road', 35000, 'cat3', 'Chennai', 'used'],
];

const now = Date.now();
const listings = titles.map(([title, price, category, location, condition], i) => ({
  _id: `l${i + 1}`,
  seller: { _id: 'u1', name: 'Karthik S', role: 'user', createdAt: new Date(now - 400 * 864e5).toISOString(), updatedAt: new Date().toISOString(), location, email: 'k@example.com' },
  title,
  description:
    'Genuine listing in great condition. Reason for sale: upgrading. Price slightly negotiable for serious buyers. ' +
    'All original accessories and bills available. Inspection welcome — meet at a safe public place.',
  category: categories.find((c) => c._id === category) || categories[0],
  price,
  currency: 'INR',
  condition,
  location,
  images: [0, 1, 2].map((n) => ({ url: `https://picsum.photos/seed/syt${i}-${n}/800/600` })),
  status: 'published',
  boosted: i % 7 === 0,
  isBoostActive: i % 7 === 0,
  views: 40 + ((i * 37) % 900),
  isFavorite: i % 5 === 1,
  geo: { type: 'Point', coordinates: [80.27 + i * 0.01, 13.08 - i * 0.008] },
  createdAt: new Date(now - (i + 1) * 11 * 36e5).toISOString(),
  updatedAt: new Date(now - i * 5 * 36e5).toISOString(),
}));

const me = {
  _id: 'u1', name: 'Karthik S', email: 'k@example.com', role: 'user',
  location: 'Chennai', phone: '9876543210',
  createdAt: new Date(now - 400 * 864e5).toISOString(), updatedAt: new Date().toISOString(),
};
const other = { ...me, _id: 'u2', name: 'Priya R', email: 'p@example.com' };
const tokens = { accessToken: 'mock-access', refreshToken: 'mock-refresh' };

const mkMsg = (i, sender, body, convId) => ({
  _id: `m${convId}-${i}`, conversation: convId, sender, body, readBy: [],
  createdAt: new Date(now - (20 - i) * 6e5).toISOString(),
  updatedAt: new Date(now - (20 - i) * 6e5).toISOString(),
});
const conversations = [0, 1, 2].map((i) => {
  const id = `c${i + 1}`;
  const msgs = [
    mkMsg(1, other, 'Hi! Is this still available?', id),
    mkMsg(2, me, 'Yes, it is. Want to see it this weekend?', id),
    mkMsg(3, other, 'Sure — does the price have any flex?', id),
    mkMsg(4, me, 'A little, for a quick close.', id),
  ];
  return {
    _id: id, listing: listings[i * 3], participants: [me, other],
    lastMessage: msgs[msgs.length - 1],
    lastMessageAt: msgs[msgs.length - 1].createdAt,
    unread: { u1: i === 0 ? 2 : 0 },
    __msgs: msgs,
  };
});

const send = (res, data, meta) => {
  const body = JSON.stringify({ success: true, message: 'OK', data, ...(meta ? { meta } : {}) });
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = url.pathname;

    if (p === '/api/v1/categories') return send(res, { items: categories });

    // --- auth ---
    if (p === '/api/v1/auth/login' || p === '/api/v1/auth/register')
      return send(res, { user: me, ...tokens });
    if (p === '/api/v1/auth/refresh') return send(res, { ...tokens });
    if (p === '/api/v1/auth/me') return send(res, { user: me });
    if (p === '/api/v1/auth/logout') return send(res, {});
    if (p === '/api/v1/users/me' || p === '/api/v1/users/me/password')
      return send(res, { user: me });
    const pubUser = p.match(/^\/api\/v1\/users\/(\w+)$/);
    if (pubUser) return send(res, { user: { _id: pubUser[1], name: 'Priya R', location: 'Chennai', createdAt: me.createdAt } });

    // --- favorites ---
    if (p === '/api/v1/favorites') {
      if (req.method === 'GET') {
        const favs = listings.filter((l) => l.isFavorite);
        return send(res, { items: favs }, { page: 1, limit: 50, total: favs.length, pages: 1 });
      }
      return send(res, {});
    }
    if (p.startsWith('/api/v1/favorites/')) return send(res, {});

    // --- my listings ---
    if (p === '/api/v1/listings/mine') {
      const mine = listings.slice(0, 6);
      return send(res, { items: mine }, { page: 1, limit: 20, total: mine.length, pages: 1 });
    }

    // --- messages ---
    if (p === '/api/v1/messages/conversations') {
      if (req.method === 'POST')
        return send(res, { conversation: conversations[0], message: conversations[0].__msgs[0] });
      return send(res, { items: conversations.map(({ __msgs, ...c }) => c) });
    }
    const convMsgs = p.match(/^\/api\/v1\/messages\/conversations\/(\w+)$/);
    if (convMsgs) {
      const c = conversations.find((x) => x._id === convMsgs[1]) || conversations[0];
      const { __msgs, ...conv } = c;
      return send(res, { conversation: conv, items: __msgs });
    }
    if (/^\/api\/v1\/messages\/conversations\/\w+\/(read|messages)$/.test(p)) {
      const c = conversations[0];
      return send(res, { message: mkMsg(99, me, 'ok', c._id) });
    }

    // --- admin ---
    if (p === '/api/v1/admin/stats')
      return send(res, { users: 128, listings: 5024, published: 4310, disabled: 14 });
    if (p === '/api/v1/admin/users')
      return send(res, { items: [me, other, { ...other, _id: 'u3', name: 'Arun V', disabled: true }] }, { page: 1, limit: 20, total: 3, pages: 1 });
    if (p === '/api/v1/admin/listings')
      return send(res, { items: listings.slice(0, 8) }, { page: 1, limit: 20, total: 8, pages: 1 });

    if (p === '/api/v1/listings') {
      let items = [...listings];
      const q = url.searchParams.get('q')?.toLowerCase();
      const cat = url.searchParams.get('category');
      const sort = url.searchParams.get('sort');
      if (q) items = items.filter((l) => l.title.toLowerCase().includes(q));
      if (cat) items = items.filter((l) => l.category._id === cat || l.category.parent === cat);
      if (sort === 'price_asc') items.sort((a, b) => a.price - b.price);
      if (sort === 'price_desc') items.sort((a, b) => b.price - a.price);
      const page = Number(url.searchParams.get('page') || 1);
      const limit = Number(url.searchParams.get('limit') || 12);
      const total = items.length;
      const paged = items.slice((page - 1) * limit, page * limit);
      return send(res, { items: paged }, { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
    }

    const similar = p.match(/^\/api\/v1\/listings\/(\w+)\/similar$/);
    if (similar) return send(res, { items: listings.slice(0, 4) });

    const one = p.match(/^\/api\/v1\/listings\/(\w+)$/);
    if (one) {
      const listing = listings.find((l) => l._id === one[1]) || listings[0];
      return send(res, { listing, isFavorite: !!listing.isFavorite });
    }

    if (p === '/api/v1/search/suggest') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const matched = listings.filter((l) => l.title.toLowerCase().includes(q)).slice(0, 6);
      return send(res, {
        categories: categories.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 3),
        listings: matched.map(({ _id, title, price, currency, images, location, category }) => ({
          _id, title, price, currency, images, location,
          category: { _id: category._id, name: category.name, slug: category.slug },
        })),
        total: matched.length,
      });
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Not found (mock)' }));
  })
  .listen(PORT, () => console.log(`mock api on :${PORT}`));
