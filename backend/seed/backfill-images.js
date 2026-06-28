/**
 * Re-point auto-seeded listing images to category-matched pictures.
 *
 *   npm run seed:images
 *
 * The original bulk seeder used random picsum photos. This updates those listings
 * in place (preserving _id, favorites, chats) so each picture matches its
 * category — cars show cars, dogs show dogs, etc. It only touches listings whose
 * images are the auto-generated picsum ones, leaving curated/user listings alone.
 * Idempotent: re-running re-derives the same URLs.
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Category } from '../src/models/Category.js';
import { Listing } from '../src/models/Listing.js';
import { imageUrl, imageKeyword } from './imageKeywords.js';

// Stable per-listing seed so each listing keeps consistent images across runs.
const lockFor = (id, k) => {
  const hex = String(id).slice(-8);
  return (parseInt(hex, 16) % 1000000) + k * 17 + 1;
};

async function run() {
  console.log(`[backfill-images] connecting to ${config.mongoUri}`);
  await mongoose.connect(config.mongoUri);

  const cats = await Category.find().select('_id slug').lean();
  const slugById = new Map(cats.map((c) => [String(c._id), c.slug]));

  // Only the seeder's random picsum images; leave curated and user uploads alone.
  const targets = await Listing.find({ 'images.url': /picsum\.photos/ })
    .select('_id category images')
    .lean();
  console.log(`[backfill-images] ${targets.length} seeded listings to re-image`);

  if (targets.length === 0) {
    console.log('[backfill-images] nothing to do.');
    await mongoose.disconnect();
    return;
  }

  const ops = [];
  const perKeyword = {};
  for (const l of targets) {
    const slug = slugById.get(String(l.category)) || 'other-services';
    const count = Math.max(1, (l.images || []).length);
    const images = Array.from({ length: count }, (_, k) => ({
      url: imageUrl(slug, lockFor(l._id, k)),
      key: `img-${slug}-${lockFor(l._id, k)}`,
    }));
    ops.push({ updateOne: { filter: { _id: l._id }, update: { $set: { images } } } });
    const kw = imageKeyword(slug);
    perKeyword[kw] = (perKeyword[kw] || 0) + 1;
  }

  let done = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const res = await Listing.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    done += res.modifiedCount ?? 0;
    process.stdout.write(`\r[backfill-images] updated ${done}/${ops.length}`);
  }
  process.stdout.write('\n');

  console.log('[backfill-images] done. Sample of images now used by keyword:');
  Object.entries(perKeyword)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([kw, n]) => console.log(`    ${kw.padEnd(18)} ${n}`));

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[backfill-images] error:', err);
  process.exit(1);
});
