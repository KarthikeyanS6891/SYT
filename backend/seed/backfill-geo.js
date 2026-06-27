import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Listing } from '../src/models/Listing.js';

// Adds geo coordinates to listings that have a location text but no pin.
// Known cities resolve from the table below; anything else falls back to
// OpenStreetMap's Nominatim geocoder (rate-limited to 1 request/second
// per its usage policy). Run with: npm run seed:geo

const cityCoords = {
  mumbai: [72.8777, 19.076],
  bengaluru: [77.5946, 12.9716],
  bangalore: [77.5946, 12.9716],
  delhi: [77.209, 28.6139],
  chennai: [80.2707, 13.0827],
  hyderabad: [78.4867, 17.385],
  kolkata: [88.3639, 22.5726],
  pune: [73.8567, 18.5204],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const geocode = async (location) => {
  const lower = location.toLowerCase();
  for (const [city, coords] of Object.entries(cityCoords)) {
    if (lower.includes(city)) return coords;
  }
  await sleep(1100);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(location)}`,
    { headers: { 'User-Agent': 'syt-marketplace-seed/1.0' } }
  );
  if (!res.ok) return null;
  const [hit] = await res.json();
  return hit ? [Number(hit.lon), Number(hit.lat)] : null;
};

async function run() {
  console.log('[backfill-geo] connecting to', config.mongoUri);
  await mongoose.connect(config.mongoUri);

  const missing = await Listing.find({
    $or: [{ geo: { $exists: false } }, { geo: null }],
  });
  console.log(`[backfill-geo] ${missing.length} listing(s) without coordinates`);

  let updated = 0;
  for (const listing of missing) {
    const coords = await geocode(listing.location);
    if (!coords) {
      console.log(`  skip  "${listing.title}" — could not geocode "${listing.location}"`);
      continue;
    }
    await Listing.updateOne(
      { _id: listing._id },
      { $set: { geo: { type: 'Point', coordinates: coords } } }
    );
    updated += 1;
    console.log(`  pin   "${listing.title}" → ${listing.location} [${coords[1]}, ${coords[0]}]`);
  }

  console.log(`[backfill-geo] done, ${updated} updated`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[backfill-geo] error:', err);
  process.exit(1);
});
