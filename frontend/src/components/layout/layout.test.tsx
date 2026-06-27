import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  authedState,
  makeCategory,
  makeListing,
  screen,
  within,
  waitFor,
  userEvent,
} from '@/test/utils';

// SearchAutocomplete talks to the raw axios instance (`@/services/api` default),
// NOT the searchApi wrapper. We keep the real unwrap/errorMessage/tokenStorage
// but stub the axios instance so no network happens and we can assert call args.
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

vi.mock('@/services/api', async (orig) => {
  const actual: any = await orig();
  const api: any = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
  return { ...actual, default: api };
});

import api from '@/services/api';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Layout } from './Layout';
import { SearchAutocomplete } from './SearchAutocomplete';

const getApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

// Shape the raw axios response that SearchAutocomplete reads (r.data.data.{categories,listings}).
const suggestResponse = (categories: any[] = [], listings: any[] = []) => ({
  data: { data: { categories, listings }, meta: {}, message: 'OK' },
});

beforeEach(() => {
  navigate.mockReset();
  getApi.get.mockReset();
  getApi.post.mockReset();
  // Default: no suggestions / never resolves issues.
  getApi.get.mockResolvedValue(suggestResponse());
});

describe('Navbar', () => {
  it('shows Login and Sign up buttons when logged out', () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    // No authed-only UI.
    expect(screen.queryByText('+ Post Ad')).not.toBeInTheDocument();
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('opens the login auth modal when Login is clicked', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<Navbar />);
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(store.getState().ui.authModal).toEqual({ open: true, mode: 'login' });
  });

  it('opens the register auth modal when Sign up is clicked', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<Navbar />);
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(store.getState().ui.authModal).toEqual({ open: true, mode: 'register' });
  });

  it('shows the post-ad link, avatar initials and logout when logged in', () => {
    renderWithProviders(<Navbar />, {
      preloadedState: authedState({ name: 'Jane Doe' }),
    });
    expect(screen.getByText('+ Post Ad')).toBeInTheDocument();
    expect(screen.getByText('+ Post Ad').closest('a')).toHaveAttribute('href', '/post');
    expect(screen.getByText('Logout')).toBeInTheDocument();
    // initials('Jane Doe') => 'JD'
    expect(screen.getByText('JD')).toBeInTheDocument();
    // Logged-out controls are gone.
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument();
  });

  it('does not render an unread badge when unreadCount is 0', () => {
    renderWithProviders(<Navbar />, {
      preloadedState: { ...authedState(), ui: { unreadCount: 0, authModal: { open: false, mode: 'login' }, theme: 'light' } },
    });
    expect(document.querySelector('.badge')).toBeNull();
  });

  it('renders the unread badge reflecting ui.unreadCount when logged in', () => {
    renderWithProviders(<Navbar />, {
      preloadedState: {
        ...authedState(),
        ui: { unreadCount: 7, authModal: { open: false, mode: 'login' }, theme: 'light' },
      },
    });
    const badge = document.querySelector('.badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('7');
  });

  it('shows the Admin link only for admin users', () => {
    const { unmount } = renderWithProviders(<Navbar />, {
      preloadedState: authedState({ role: 'user' }),
    });
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<Navbar />, { preloadedState: authedState({ role: 'admin' }) });
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Admin').closest('a')).toHaveAttribute('href', '/admin');
  });

  it('navigates home after logging out', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Navbar />, { preloadedState: authedState() });
    await user.click(screen.getByText('Logout'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
  });

  it('links the brand to the home page', () => {
    renderWithProviders(<Navbar />);
    const brand = screen.getByLabelText('SYT - Sell Your Things home');
    expect(brand).toHaveAttribute('href', '/');
  });
});

describe('Footer', () => {
  it('renders the section headings', () => {
    renderWithProviders(<Footer />);
    expect(screen.getByRole('heading', { name: 'Marketplace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Help & About/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Legal' })).toBeInTheDocument();
  });

  it('renders key marketplace and account links with correct hrefs', () => {
    renderWithProviders(<Footer />);
    expect(screen.getByRole('link', { name: 'Browse listings' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Post an ad' })).toHaveAttribute('href', '/post');
    expect(screen.getByRole('link', { name: 'My favorites' })).toHaveAttribute('href', '/favorites');
    expect(screen.getByRole('link', { name: 'Messages' })).toHaveAttribute('href', '/chat');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: 'My listings' })).toHaveAttribute('href', '/my-listings');
  });

  it('renders the copyright line with the current year', () => {
    renderWithProviders(<Footer />);
    const year = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`© ${year} SYT`))
    ).toBeInTheDocument();
  });
});

describe('Layout', () => {
  it('renders the Navbar, Footer and routed children/outlet', () => {
    renderWithProviders(<Layout />, {
      route: '/',
      path: '/',
    });
    // Navbar present (login button + search input).
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    // Footer present.
    expect(screen.getByRole('heading', { name: 'Marketplace' })).toBeInTheDocument();
    // Shell + main region exist.
    expect(document.querySelector('.app-shell')).toBeInTheDocument();
    expect(document.querySelector('main.layout-main')).toBeInTheDocument();
  });
});

describe('SearchAutocomplete', () => {
  it('does not query the API for queries shorter than 2 characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchAutocomplete />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'a');
    // Wait past the 220ms debounce.
    await new Promise((r) => setTimeout(r, 280));
    expect(getApi.get).not.toHaveBeenCalled();
  });

  it('calls api.get(/search/suggest) after the debounce and renders suggestions', async () => {
    const user = userEvent.setup();
    const cat = makeCategory({ name: 'Phones' });
    const listing = makeListing({ title: 'iPhone 13', price: 50000, currency: 'INR' });
    getApi.get.mockResolvedValue(suggestResponse([cat], [listing]));

    renderWithProviders(<SearchAutocomplete />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'iph');

    await waitFor(() =>
      expect(getApi.get).toHaveBeenCalledWith('/search/suggest', {
        params: { q: 'iph', limit: 6 },
      })
    );

    const panel = await screen.findByRole('listbox');
    expect(within(panel).getByText('Categories')).toBeInTheDocument();
    expect(within(panel).getByText('Listings')).toBeInTheDocument();
    // Titles are split across <mark>/<span> by the highlighter, so match on the
    // title container's full text content.
    const titles = Array.from(panel.querySelectorAll('.search-ac-title')).map(
      (el) => el.textContent
    );
    expect(titles).toContain('Phones');
    expect(titles).toContain('iPhone 13');
    // The free-text "see all results" option is always present when >= 2 chars.
    expect(within(panel).getByText(/See all results for/)).toBeInTheDocument();
  });

  it('navigates to the category page when a category suggestion is clicked', async () => {
    const user = userEvent.setup();
    const cat = makeCategory({ _id: 'cat-1', name: 'Phones' });
    getApi.get.mockResolvedValue(suggestResponse([cat], []));

    renderWithProviders(<SearchAutocomplete />);
    await user.type(screen.getByRole('textbox'), 'pho');

    const panel = await screen.findByRole('listbox');
    const option = await waitFor(() => {
      const el = Array.from(panel.querySelectorAll('.search-ac-title')).find(
        (e) => e.textContent === 'Phones'
      );
      if (!el) throw new Error('category suggestion not rendered yet');
      return el.closest('.search-ac-item')!;
    });
    await user.click(option);
    expect(navigate).toHaveBeenCalledWith('/?category=cat-1');
  });

  it('navigates to the listing details page when a listing suggestion is clicked', async () => {
    const user = userEvent.setup();
    const listing = makeListing({ _id: 'lst-99', title: 'iPhone 13' });
    getApi.get.mockResolvedValue(suggestResponse([], [listing]));

    renderWithProviders(<SearchAutocomplete />);
    await user.type(screen.getByRole('textbox'), 'iph');

    const panel = await screen.findByRole('listbox');
    const option = await waitFor(() => {
      const el = Array.from(panel.querySelectorAll('.search-ac-title')).find(
        (e) => e.textContent === 'iPhone 13'
      );
      if (!el) throw new Error('listing suggestion not rendered yet');
      return el.closest('.search-ac-item')!;
    });
    await user.click(option);
    expect(navigate).toHaveBeenCalledWith('/listings/lst-99');
  });

  it('submitting the form navigates to the search results page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchAutocomplete />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'laptop');
    await user.type(input, '{enter}');
    expect(navigate).toHaveBeenCalledWith('/?q=laptop');
  });

  it('clicking the "see all results" free-text option navigates to the query results', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchAutocomplete />);
    await user.type(screen.getByRole('textbox'), 'shoes');

    const seeAll = await screen.findByText(/See all results for/);
    await user.click(seeAll.closest('.search-ac-item')!);
    expect(navigate).toHaveBeenCalledWith('/?q=shoes');
  });

  it('shows an empty state when there are no matches', async () => {
    const user = userEvent.setup();
    getApi.get.mockResolvedValue(suggestResponse([], []));
    renderWithProviders(<SearchAutocomplete />);
    await user.type(screen.getByRole('textbox'), 'zzzz');

    expect(await screen.findByText(/No matches for/)).toBeInTheDocument();
  });

  it('clears the input via the clear button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchAutocomplete />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, 'hello');
    expect(input.value).toBe('hello');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input.value).toBe('');
    // Let any debounced effect settle so its state update isn't left dangling.
    await new Promise((r) => setTimeout(r, 280));
  });
});
