import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  makeUser,
  makeListing,
  authedState,
  screen,
  within,
  waitFor,
  userEvent,
} from '@/test/utils';

// ---- mocks ----
vi.mock('@/services/listingService', () => ({
  listingApi: {
    list: vi.fn(),
    mine: vi.fn(),
    get: vi.fn(),
    similar: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    toggleBoost: vi.fn(),
  },
  categoryApi: { list: vi.fn() },
}));

vi.mock('@/services/favoriteService', () => ({
  favoriteApi: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
}));

vi.mock('@/services/messageService', () => ({
  messageApi: {
    conversations: vi.fn(),
    start: vi.fn(),
    messages: vi.fn(),
    send: vi.fn(),
    markRead: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Stub the heavy leaflet-backed map so we can assert it renders with the right coords.
vi.mock('@/components/map/ListingMap', () => ({
  ListingMap: (p: any) => (
    <div data-testid="listing-map" data-lat={p.lat} data-lng={p.lng}>
      {p.label}
    </div>
  ),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...((await orig()) as object),
  useNavigate: () => navigate,
}));

import { listingApi } from '@/services/listingService';
import { favoriteApi } from '@/services/favoriteService';
import { messageApi } from '@/services/messageService';
import toast from 'react-hot-toast';
import ListingDetails from './ListingDetails';

// ---- helpers ----
const ok = (data: any) => ({ data, meta: {}, message: 'OK' });

const renderDetails = (id: string, opts: { preloadedState?: any } = {}) =>
  renderWithProviders(<ListingDetails />, {
    route: `/listings/${id}`,
    path: '/listings/:id',
    ...opts,
  });

const setGet = (listing: any, isFavorite = false) =>
  (listingApi.get as any).mockResolvedValue(ok({ listing, isFavorite }));

const setSimilar = (items: any[] = []) =>
  (listingApi.similar as any).mockResolvedValue(ok({ items }));

beforeEach(() => {
  vi.clearAllMocks();
  setSimilar([]);
});

describe('ListingDetails', () => {
  it('renders title, price, description, location and seller info after load', async () => {
    const seller = makeUser({ name: 'Jane Seller' });
    const listing = makeListing({
      seller,
      title: 'Vintage Camera',
      price: 4500,
      description: 'Barely used vintage camera with case.',
      location: 'Mumbai',
    });
    setGet(listing, false);

    renderDetails(listing._id);

    // wait for load (Loader replaced by content)
    expect(await screen.findByText('Vintage Camera')).toBeInTheDocument();
    // description
    expect(screen.getByText('Barely used vintage camera with case.')).toBeInTheDocument();
    // price number (currency symbol stripped by source, digits + grouping remain)
    expect(screen.getByText(/4,500/)).toBeInTheDocument();
    // location appears (price-meta + posted-in both render it)
    expect(screen.getAllByText('Mumbai').length).toBeGreaterThan(0);
    // seller name
    expect(screen.getByText('Jane Seller')).toBeInTheDocument();
    // seller link to profile
    const sellerLink = screen.getByText('Jane Seller').closest('a')!;
    expect(sellerLink).toHaveAttribute('href', `/users/${seller._id}`);
    // get called with the route id
    expect(listingApi.get).toHaveBeenCalledWith(listing._id);
  });

  it('shows the ListingMap only when the listing has geo coordinates', async () => {
    const listing = makeListing({
      title: 'Mapped Item',
      location: 'Bengaluru',
      geo: { type: 'Point', coordinates: [77.5946, 12.9716] },
    });
    setGet(listing, false);

    renderDetails(listing._id);
    await screen.findByText('Mapped Item');

    const map = screen.getByTestId('listing-map');
    expect(map).toBeInTheDocument();
    // GeoJSON is [lng, lat]; source passes lat=coords[1], lng=coords[0]
    expect(map).toHaveAttribute('data-lat', '12.9716');
    expect(map).toHaveAttribute('data-lng', '77.5946');
    expect(map).toHaveAttribute('data-lat', '12.9716');
    expect(map.textContent).toContain('Bengaluru');
  });

  it('does not show the ListingMap when geo is absent', async () => {
    const listing = makeListing({ title: 'No Geo Item', geo: null });
    setGet(listing, false);

    renderDetails(listing._id);
    await screen.findByText('No Geo Item');

    expect(screen.queryByTestId('listing-map')).not.toBeInTheDocument();
  });

  it('gallery prev/next controls change the active image', async () => {
    const user = userEvent.setup();
    const listing = makeListing({
      title: 'Multi Image',
      images: [
        { url: 'http://example.com/1.jpg', key: '1' },
        { url: 'http://example.com/2.jpg', key: '2' },
        { url: 'http://example.com/3.jpg', key: '3' },
      ],
    });
    setGet(listing, false);

    renderDetails(listing._id);
    await screen.findByText('Multi Image');

    const cover = () => screen.getByAltText('Multi Image') as HTMLImageElement;
    // counter starts at 1 / 3, first image shown
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(cover().src).toBe('http://example.com/1.jpg');

    await user.click(screen.getByLabelText('Next image'));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(cover().src).toBe('http://example.com/2.jpg');

    await user.click(screen.getByLabelText('Previous image'));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(cover().src).toBe('http://example.com/1.jpg');

    // wraps around backwards to last image
    await user.click(screen.getByLabelText('Previous image'));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(cover().src).toBe('http://example.com/3.jpg');
  });

  it('does not render gallery nav controls for a single image', async () => {
    const listing = makeListing({
      title: 'Single Image',
      images: [{ url: 'http://example.com/only.jpg', key: 'only' }],
    });
    setGet(listing, false);

    renderDetails(listing._id);
    await screen.findByText('Single Image');

    expect(screen.queryByLabelText('Next image')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Previous image')).not.toBeInTheDocument();
  });

  it('favorite toggle (logged in) calls favoriteApi.add then favoriteApi.remove', async () => {
    const user = userEvent.setup();
    const me = makeUser({ name: 'Logged In' });
    const listing = makeListing({ title: 'Fav Item', seller: makeUser({ name: 'Other Seller' }) });
    setGet(listing, false); // starts unfavorited
    (favoriteApi.add as any).mockResolvedValue(ok({}));
    (favoriteApi.remove as any).mockResolvedValue(ok({}));

    renderDetails(listing._id, { preloadedState: authedState(me) });
    await screen.findByText('Fav Item');

    // starts as "Save listing"
    const saveBtn = screen.getByLabelText('Save listing');
    await user.click(saveBtn);
    expect(favoriteApi.add).toHaveBeenCalledWith(listing._id);

    // now the label flips to "Remove from favorites"
    const removeBtn = await screen.findByLabelText('Remove from favorites');
    await user.click(removeBtn);
    expect(favoriteApi.remove).toHaveBeenCalledWith(listing._id);
  });

  it('"Chat with seller" (logged in non-owner) calls messageApi.start and navigates to the conversation', async () => {
    const user = userEvent.setup();
    const me = makeUser({ name: 'Buyer' });
    const listing = makeListing({ title: 'Chat Item', seller: makeUser({ name: 'Seller Sam' }) });
    setGet(listing, false);
    (messageApi.start as any).mockResolvedValue(
      ok({ conversation: { _id: 'conv_123' }, message: { _id: 'm1' } })
    );

    renderDetails(listing._id, { preloadedState: authedState(me) });
    await screen.findByText('Chat Item');

    await user.click(screen.getByRole('button', { name: /chat with seller/i }));

    await waitFor(() =>
      expect(messageApi.start).toHaveBeenCalledWith({
        listingId: listing._id,
        message: 'Hi! Is this still available?',
      })
    );
    expect(toast.success).toHaveBeenCalledWith('Message sent');
    expect(navigate).toHaveBeenCalledWith('/chat/conv_123');
  });

  it('owner sees an "Edit listing" affordance and no chat form', async () => {
    const owner = makeUser({ name: 'Owner Olive' });
    const listing = makeListing({ title: 'Owned Item', seller: owner });
    setGet(listing, false);

    renderDetails(listing._id, { preloadedState: authedState(owner) });
    await screen.findByText('Owned Item');

    const editBtn = screen.getByRole('button', { name: /edit listing/i });
    expect(editBtn).toBeInTheDocument();

    // owner does not see the contact form / chat button
    expect(screen.queryByRole('button', { name: /chat with seller/i })).not.toBeInTheDocument();

    // clicking edit navigates to the post edit route
    await userEvent.click(editBtn);
    expect(navigate).toHaveBeenCalledWith(`/post/${listing._id}`);
  });

  it('logged-out user clicking favorite opens the auth modal (no api call)', async () => {
    const user = userEvent.setup();
    const listing = makeListing({ title: 'Guest Fav' });
    setGet(listing, false);

    const { store } = renderDetails(listing._id);
    await screen.findByText('Guest Fav');

    expect(store.getState().ui.authModal.open).toBe(false);

    await user.click(screen.getByLabelText('Save listing'));

    expect(store.getState().ui.authModal.open).toBe(true);
    expect(store.getState().ui.authModal.mode).toBe('login');
    expect(favoriteApi.add).not.toHaveBeenCalled();
  });

  it('logged-out user clicking "Chat with seller" opens the auth modal (no api call)', async () => {
    const user = userEvent.setup();
    const listing = makeListing({ title: 'Guest Chat' });
    setGet(listing, false);

    const { store } = renderDetails(listing._id);
    await screen.findByText('Guest Chat');

    await user.click(screen.getByRole('button', { name: /chat with seller/i }));

    expect(store.getState().ui.authModal.open).toBe(true);
    expect(store.getState().ui.authModal.mode).toBe('login');
    expect(messageApi.start).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders similar listings when the similar endpoint returns items', async () => {
    const listing = makeListing({ title: 'Has Similar' });
    setGet(listing, false);
    setSimilar([
      makeListing({ title: 'Similar One' }),
      makeListing({ title: 'Similar Two' }),
    ]);

    renderDetails(listing._id);
    await screen.findByText('Has Similar');

    expect(await screen.findByText('Similar listings')).toBeInTheDocument();
    expect(screen.getByText('Similar One')).toBeInTheDocument();
    expect(screen.getByText('Similar Two')).toBeInTheDocument();
  });

  it('renders an existing favorite state as "Remove from favorites" and toggles to add', async () => {
    const user = userEvent.setup();
    const me = makeUser({ name: 'Buyer' });
    const listing = makeListing({ title: 'Already Fav', seller: makeUser() });
    setGet(listing, true); // starts favorited
    (favoriteApi.remove as any).mockResolvedValue(ok({}));

    renderDetails(listing._id, { preloadedState: authedState(me) });
    await screen.findByText('Already Fav');

    await user.click(screen.getByLabelText('Remove from favorites'));
    expect(favoriteApi.remove).toHaveBeenCalledWith(listing._id);
    // flips back to save
    expect(await screen.findByLabelText('Save listing')).toBeInTheDocument();
  });

  it('on a get error, shows a toast and navigates home', async () => {
    (listingApi.get as any).mockRejectedValue({ message: 'boom' });

    renderDetails('missing-id');

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(toast.error).toHaveBeenCalled();
  });

  it('shows the Featured badge for a boosted listing', async () => {
    const listing = makeListing({
      title: 'Boosted Item',
      boosted: true,
      images: [
        { url: 'http://example.com/1.jpg', key: '1' },
        { url: 'http://example.com/2.jpg', key: '2' },
      ],
    });
    setGet(listing, false);

    renderDetails(listing._id);
    await screen.findByText('Boosted Item');

    expect(screen.getByText(/Featured/)).toBeInTheDocument();
  });
});
