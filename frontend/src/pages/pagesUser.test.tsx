import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  makeUser,
  makeListing,
  authedState,
  screen,
  waitFor,
  userEvent,
} from '@/test/utils';

// ---- module mocks ----
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/services/favoriteService', () => ({
  favoriteApi: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
}));

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

vi.mock('@/services/userService', () => ({
  userApi: { getPublicProfile: vi.fn() },
}));

// react-router-dom: keep real module (MemoryRouter/Routes) but stub useNavigate.
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...((await orig()) as any),
  useNavigate: () => navigate,
}));

// api.ts: keep real unwrap/errorMessage but stub the default axios instance.
vi.mock('@/services/api', async (orig) => {
  const actual: any = await orig();
  const api: any = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
  return { ...actual, default: api };
});

import toast from 'react-hot-toast';
import { favoriteApi } from '@/services/favoriteService';
import { listingApi } from '@/services/listingService';
import { userApi } from '@/services/userService';
import api from '@/services/api';

import Favorites from './Favorites';
import MyListings from './MyListings';
import Profile from './Profile';
import PublicProfile from './PublicProfile';

const meta = (over: Partial<{ page: number; pages: number; total: number; limit: number }> = {}) => ({
  page: 1,
  pages: 1,
  total: 1,
  limit: 12,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  navigate.mockReset();
  // jsdom does not implement confirm; default to true unless a test overrides.
  vi.stubGlobal('confirm', vi.fn(() => true));
});

// =====================================================================
// Favorites
// =====================================================================
describe('Favorites', () => {
  it('shows a loader, then renders the favorited listings from favoriteApi.list', async () => {
    (favoriteApi.list as any).mockResolvedValue({
      data: { items: [makeListing({ title: 'Saved Bike', isFavorite: true })] },
      meta: meta(),
      message: 'OK',
    });

    renderWithProviders(<Favorites />, { preloadedState: authedState() });

    expect(screen.getByRole('heading', { name: 'Favorites' })).toBeInTheDocument();
    expect(await screen.findByText('Saved Bike')).toBeInTheDocument();
    // It requests up to 50 favorites.
    expect(favoriteApi.list).toHaveBeenCalledWith({ limit: 50 });
  });

  it('renders the empty-state text when there are no favorites', async () => {
    (favoriteApi.list as any).mockResolvedValue({
      data: { items: [] },
      meta: meta({ total: 0 }),
      message: 'OK',
    });

    renderWithProviders(<Favorites />, { preloadedState: authedState() });

    expect(
      await screen.findByText("You haven't saved any listings yet.")
    ).toBeInTheDocument();
  });

  it('toasts an error when the list call rejects', async () => {
    (favoriteApi.list as any).mockRejectedValue({ message: 'boom' });

    renderWithProviders(<Favorites />, { preloadedState: authedState() });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('boom'));
  });

  it('unfavoriting a listing calls favoriteApi.remove and drops it from the grid', async () => {
    const listing = makeListing({ title: 'Drop Me', isFavorite: true });
    (favoriteApi.list as any).mockResolvedValue({
      data: { items: [listing] },
      meta: meta(),
      message: 'OK',
    });
    (favoriteApi.remove as any).mockResolvedValue({ data: {}, meta: {}, message: 'OK' });

    renderWithProviders(<Favorites />, { preloadedState: authedState() });

    await screen.findByText('Drop Me');
    const favBtn = screen.getByRole('button', { name: /toggle favorite/i });
    await userEvent.click(favBtn);

    await waitFor(() => expect(favoriteApi.remove).toHaveBeenCalledWith(listing._id));
    await waitFor(() => expect(screen.queryByText('Drop Me')).not.toBeInTheDocument());
  });
});

// =====================================================================
// MyListings
// =====================================================================
describe('MyListings', () => {
  it('loads the current user listings via listingApi.mine and renders them', async () => {
    (listingApi.mine as any).mockResolvedValue({
      data: {
        items: [
          makeListing({ title: 'My Sofa', status: 'published', views: 7, boosted: false }),
        ],
      },
      meta: meta(),
      message: 'OK',
    });

    renderWithProviders(<MyListings />, { preloadedState: authedState() });

    expect(screen.getByRole('heading', { name: 'My Listings' })).toBeInTheDocument();
    expect(await screen.findByText('My Sofa')).toBeInTheDocument();
    // status badge + views badge
    expect(screen.getByText('published')).toBeInTheDocument();
    expect(screen.getByText('7 views')).toBeInTheDocument();
    // first load uses no status filter, limit 50
    expect(listingApi.mine).toHaveBeenCalledWith({ status: undefined, limit: 50 });
  });

  it('renders an empty state with a link to post when there are no listings', async () => {
    (listingApi.mine as any).mockResolvedValue({
      data: { items: [] },
      meta: meta({ total: 0 }),
      message: 'OK',
    });

    renderWithProviders(<MyListings />, { preloadedState: authedState() });

    expect(await screen.findByText(/No listings yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Post your first ad/i })).toBeInTheDocument();
  });

  it('clicking a status filter refetches with that status', async () => {
    (listingApi.mine as any).mockResolvedValue({
      data: { items: [] },
      meta: meta({ total: 0 }),
      message: 'OK',
    });

    renderWithProviders(<MyListings />, { preloadedState: authedState() });
    await screen.findByText(/No listings yet/i);

    await userEvent.click(screen.getByRole('button', { name: 'Drafts' }));

    await waitFor(() =>
      expect(listingApi.mine).toHaveBeenLastCalledWith({ status: 'draft', limit: 50 })
    );
  });

  it('deleting a listing confirms, calls listingApi.remove, toasts and removes the row', async () => {
    const listing = makeListing({ title: 'Delete Target' });
    (listingApi.mine as any).mockResolvedValue({
      data: { items: [listing] },
      meta: meta(),
      message: 'OK',
    });
    (listingApi.remove as any).mockResolvedValue({ data: {}, meta: {}, message: 'OK' });

    renderWithProviders(<MyListings />, { preloadedState: authedState() });
    await screen.findByText('Delete Target');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(globalThis.confirm).toHaveBeenCalled();
    await waitFor(() => expect(listingApi.remove).toHaveBeenCalledWith(listing._id));
    expect(toast.success).toHaveBeenCalledWith('Deleted');
    await waitFor(() => expect(screen.queryByText('Delete Target')).not.toBeInTheDocument());
  });

  it('does NOT delete when the confirm dialog is cancelled', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const listing = makeListing({ title: 'Keep Me' });
    (listingApi.mine as any).mockResolvedValue({
      data: { items: [listing] },
      meta: meta(),
      message: 'OK',
    });

    renderWithProviders(<MyListings />, { preloadedState: authedState() });
    await screen.findByText('Keep Me');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(listingApi.remove).not.toHaveBeenCalled();
    expect(screen.getByText('Keep Me')).toBeInTheDocument();
  });

  it('boosting a listing calls toggleBoost, toasts and swaps in the returned listing', async () => {
    const listing = makeListing({ title: 'Boost Me', boosted: false });
    const boosted = { ...listing, boosted: true };
    (listingApi.mine as any).mockResolvedValue({
      data: { items: [listing] },
      meta: meta(),
      message: 'OK',
    });
    (listingApi.toggleBoost as any).mockResolvedValue({
      data: { listing: boosted },
      meta: {},
      message: 'OK',
    });

    renderWithProviders(<MyListings />, { preloadedState: authedState() });
    await screen.findByText('Boost Me');

    await userEvent.click(screen.getByRole('button', { name: 'Boost' }));

    await waitFor(() => expect(listingApi.toggleBoost).toHaveBeenCalledWith(listing._id));
    expect(toast.success).toHaveBeenCalledWith('Boosted!');
    // The action button now reads "Unboost" and a Boosted badge appears.
    expect(await screen.findByRole('button', { name: 'Unboost' })).toBeInTheDocument();
    expect(screen.getByText('★ Boosted')).toBeInTheDocument();
  });
});

// =====================================================================
// Profile
// =====================================================================
describe('Profile', () => {
  // The Input component renders an unassociated <label> (no htmlFor), so
  // getByLabelText cannot match. Query inputs by their `name` attribute.
  const field = (container: HTMLElement, name: string) =>
    container.querySelector<HTMLInputElement>(`[name="${name}"]`)!;

  it('renders the current user info from the store', () => {
    const { container } = renderWithProviders(<Profile />, {
      preloadedState: authedState({ name: 'Alice Wonder', email: 'alice@syt.dev' }),
    });

    expect(screen.getByRole('heading', { name: 'Alice Wonder' })).toBeInTheDocument();
    expect(screen.getByText('alice@syt.dev')).toBeInTheDocument();
    // Profile tab form is shown by default with the name prefilled.
    expect(field(container, 'name')).toHaveValue('Alice Wonder');
  });

  it('renders nothing when there is no authenticated user', () => {
    const { container } = renderWithProviders(<Profile />);
    expect(container).toBeEmptyDOMElement();
  });

  it('saving the profile patches /users/me and dispatches setUser', async () => {
    const updated = makeUser({ name: 'Alice Renamed', email: 'alice@syt.dev' });
    (api.patch as any).mockResolvedValue({
      data: { data: { user: updated }, meta: {}, message: 'OK' },
    });

    const { store, container } = renderWithProviders(<Profile />, {
      preloadedState: authedState({ name: 'Alice Wonder', email: 'alice@syt.dev' }),
    });

    const nameInput = field(container, 'name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Alice Renamed');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const [url, payload] = (api.patch as any).mock.calls[0];
    expect(url).toBe('/users/me');
    expect(payload).toMatchObject({ name: 'Alice Renamed' });
    expect(toast.success).toHaveBeenCalledWith('Profile updated');
    // store now reflects the updated user
    expect(store.getState().auth.user?.name).toBe('Alice Renamed');
  });

  it('switching to the password tab and submitting posts /users/me/password', async () => {
    (api.post as any).mockResolvedValue({
      data: { data: {}, meta: {}, message: 'OK' },
    });

    const { container } = renderWithProviders(<Profile />, {
      preloadedState: authedState(),
    });

    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    // NOTE: the password form has no defaultValues and reuses the same DOM
    // input position as the profile form, so the "Current password" field can
    // start populated with the previous tab's value — clear before typing.
    const current = field(container, 'currentPassword');
    await userEvent.clear(current);
    await userEvent.type(current, 'oldpass');
    await userEvent.type(field(container, 'newPassword'), 'newpass1');
    // Both the tab toggle and the submit button read "Change password";
    // pick the form's submit button specifically.
    const submitBtn = container.querySelector<HTMLButtonElement>(
      'form button[type="submit"]'
    )!;
    await userEvent.click(submitBtn);

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, payload] = (api.post as any).mock.calls[0];
    expect(url).toBe('/users/me/password');
    expect(payload).toEqual({ currentPassword: 'oldpass', newPassword: 'newpass1' });
    expect(toast.success).toHaveBeenCalledWith('Password changed. Please log in again.');
  });

  it('shows a validation error and does not submit when the name is cleared', async () => {
    const { container } = renderWithProviders(<Profile />, {
      preloadedState: authedState({ name: 'Has Name' }),
    });

    await userEvent.clear(field(container, 'name'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Required')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });
});

// =====================================================================
// PublicProfile
// =====================================================================
describe('PublicProfile', () => {
  const renderPublic = (id: string, preloadedState?: any) =>
    renderWithProviders(<PublicProfile />, {
      route: `/users/${id}`,
      path: '/users/:id',
      preloadedState,
    });

  it('fetches the public user + their listings and renders both', async () => {
    const pub = {
      _id: 'seller-1',
      name: 'Bob Seller',
      location: 'Mumbai',
      createdAt: new Date('2024-01-01').toISOString(),
    };
    (userApi.getPublicProfile as any).mockResolvedValue({
      data: { user: pub },
      meta: {},
      message: 'OK',
    });
    (listingApi.list as any).mockResolvedValue({
      data: { items: [makeListing({ title: 'Bobs Lamp' })] },
      meta: meta({ total: 1 }),
      message: 'OK',
    });

    renderPublic('seller-1');

    expect(await screen.findByRole('heading', { name: 'Bob Seller' })).toBeInTheDocument();
    expect(screen.getByText(/Listings by Bob Seller/)).toBeInTheDocument();
    expect(await screen.findByText('Bobs Lamp')).toBeInTheDocument();
    // listings are fetched filtered by seller id
    expect(userApi.getPublicProfile).toHaveBeenCalledWith('seller-1');
    expect(listingApi.list).toHaveBeenCalledWith(expect.objectContaining({ seller: 'seller-1' }));
    // meta.total drives the listing count label
    expect(screen.getByText(/1 listing\b/)).toBeInTheDocument();
  });

  it('renders the empty state when the seller has no listings', async () => {
    const pub = {
      _id: 'seller-2',
      name: 'Empty Seller',
      createdAt: new Date('2024-01-01').toISOString(),
    };
    (userApi.getPublicProfile as any).mockResolvedValue({
      data: { user: pub },
      meta: {},
      message: 'OK',
    });
    (listingApi.list as any).mockResolvedValue({
      data: { items: [] },
      meta: meta({ total: 0 }),
      message: 'OK',
    });

    renderPublic('seller-2');

    expect(
      await screen.findByText('Empty Seller has no published listings yet.')
    ).toBeInTheDocument();
  });

  it('redirects to /profile when viewing your own id', async () => {
    renderPublic('me-id', authedState({ _id: 'me-id', name: 'Me' }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/profile', { replace: true })
    );
    // never fetches the public profile for yourself
    expect(userApi.getPublicProfile).not.toHaveBeenCalled();
  });

  it('toasts and navigates home when the user lookup fails', async () => {
    (userApi.getPublicProfile as any).mockRejectedValue({ message: 'nope' });
    (listingApi.list as any).mockResolvedValue({
      data: { items: [] },
      meta: meta({ total: 0 }),
      message: 'OK',
    });

    renderPublic('missing');

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
  });
});
