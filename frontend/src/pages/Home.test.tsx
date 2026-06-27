import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  makeCategory,
  makeListing,
  authedState,
  screen,
  within,
  waitFor,
  userEvent,
} from '@/test/utils';

// --- mock the data services so no network happens ---
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

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import Home from './Home';
import { listingApi, categoryApi } from '@/services/listingService';
import { favoriteApi } from '@/services/favoriteService';
import toast from 'react-hot-toast';

const meta = (over: Partial<{ page: number; pages: number; total: number; limit: number }> = {}) => ({
  page: 1,
  pages: 1,
  total: 1,
  limit: 12,
  ...over,
});

const listResult = (items: any[], metaOver = {}) => ({
  data: { items },
  meta: meta(metaOver),
  message: 'OK',
});

const catResult = (items: any[]) => ({
  data: { items },
  meta: meta(),
  message: 'OK',
});

beforeEach(() => {
  (categoryApi.list as any).mockResolvedValue(catResult([]));
  (listingApi.list as any).mockResolvedValue(listResult([]));
});

describe('Home', () => {
  it('fetches categories on mount and listings with the default filters', async () => {
    (listingApi.list as any).mockResolvedValue(listResult([makeListing({ title: 'A Bike' })]));

    renderWithProviders(<Home />);

    await waitFor(() => expect(categoryApi.list).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(listingApi.list).toHaveBeenCalled());

    // default filters derived from an empty URL query
    expect((listingApi.list as any).mock.calls[0][0]).toMatchObject({
      sort: 'latest',
      page: 1,
      limit: 12,
    });
  });

  it('shows the loader while listings are loading, then the grid', async () => {
    let resolveList: (v: any) => void = () => {};
    (listingApi.list as any).mockReturnValue(
      new Promise((res) => {
        resolveList = res;
      })
    );

    const { container } = renderWithProviders(<Home />);

    // loader visible before the promise resolves
    expect(container.querySelector('.loader-page')).toBeInTheDocument();
    expect(container.querySelector('.grid')).not.toBeInTheDocument();

    resolveList(listResult([makeListing({ title: 'Shiny Phone' })]));

    expect(await screen.findByText('Shiny Phone')).toBeInTheDocument();
    expect(container.querySelector('.loader-page')).not.toBeInTheDocument();
  });

  it('renders one card per fetched listing', async () => {
    (listingApi.list as any).mockResolvedValue(
      listResult([
        makeListing({ title: 'Listing One' }),
        makeListing({ title: 'Listing Two' }),
        makeListing({ title: 'Listing Three' }),
      ])
    );

    const { container } = renderWithProviders(<Home />);

    expect(await screen.findByText('Listing One')).toBeInTheDocument();
    expect(screen.getByText('Listing Two')).toBeInTheDocument();
    expect(screen.getByText('Listing Three')).toBeInTheDocument();
    expect(container.querySelectorAll('.listing-card')).toHaveLength(3);
  });

  it('shows the empty state when no listings match', async () => {
    (listingApi.list as any).mockResolvedValue(listResult([]));

    renderWithProviders(<Home />);

    expect(
      await screen.findByText('No listings match your filters.')
    ).toBeInTheDocument();
  });

  it('does not render pagination when there is only a single page', async () => {
    (listingApi.list as any).mockResolvedValue(
      listResult([makeListing({ title: 'Only Page' })], { pages: 1, total: 1 })
    );

    const { container } = renderWithProviders(<Home />);

    expect(await screen.findByText('Only Page')).toBeInTheDocument();
    expect(container.querySelector('.pagination')).not.toBeInTheDocument();
  });

  it('renders pagination when meta.pages > 1 and marks the current page active', async () => {
    (listingApi.list as any).mockResolvedValue(
      listResult([makeListing({ title: 'Paged Item' })], { page: 1, pages: 3, total: 30 })
    );

    const { container } = renderWithProviders(<Home />);

    await screen.findByText('Paged Item');
    const pagination = container.querySelector('.pagination') as HTMLElement;
    expect(pagination).toBeInTheDocument();

    const buttons = within(pagination).getAllByRole('button');
    const pageNums = buttons.map((b) => b.textContent).filter((t) => /^\d+$/.test(t || ''));
    expect(pageNums).toEqual(['1', '2', '3']);
    // page 1 is current => has the active class
    expect(within(pagination).getByRole('button', { name: '1' })).toHaveClass('active');
    expect(within(pagination).getByRole('button', { name: '2' })).not.toHaveClass('active');
  });

  it('clicking a page button re-fetches with the new page and updates the URL query', async () => {
    (listingApi.list as any).mockResolvedValue(
      listResult([makeListing({ title: 'Paged Item' })], { page: 1, pages: 3, total: 30 })
    );

    const { container } = renderWithProviders(<Home />);
    await screen.findByText('Paged Item');

    const callsBefore = (listingApi.list as any).mock.calls.length;
    const pagination = container.querySelector('.pagination') as HTMLElement;
    await userEvent.click(within(pagination).getByRole('button', { name: '2' }));

    await waitFor(() =>
      expect((listingApi.list as any).mock.calls.length).toBeGreaterThan(callsBefore)
    );
    const lastArgs = (listingApi.list as any).mock.calls.at(-1)[0];
    expect(lastArgs).toMatchObject({ page: 2, limit: 12 });
  });

  it('changing the sort filter re-fetches with the new sort and resets to page 1', async () => {
    (listingApi.list as any).mockResolvedValue(
      listResult([makeListing({ title: 'Sortable' })], { page: 2, pages: 3, total: 30 })
    );

    renderWithProviders(<Home />, { route: '/?page=2' });
    await screen.findByText('Sortable');

    const callsBefore = (listingApi.list as any).mock.calls.length;
    await userEvent.selectOptions(
      screen.getByDisplayValue('Latest'),
      'price_asc'
    );

    await waitFor(() =>
      expect((listingApi.list as any).mock.calls.length).toBeGreaterThan(callsBefore)
    );
    const lastArgs = (listingApi.list as any).mock.calls.at(-1)[0];
    // Filters component resets page to 1 on any change
    expect(lastArgs).toMatchObject({ sort: 'price_asc', page: 1 });
  });

  it('typing in the location filter re-fetches with the location param', async () => {
    (listingApi.list as any).mockResolvedValue(listResult([makeListing({ title: 'Local Item' })]));

    renderWithProviders(<Home />);
    await screen.findByText('Local Item');

    await userEvent.type(screen.getByPlaceholderText('Location'), 'Pune');

    await waitFor(() => {
      const lastArgs = (listingApi.list as any).mock.calls.at(-1)[0];
      expect(lastArgs).toMatchObject({ location: 'Pune', page: 1 });
    });
  });

  it('reads filters from the initial URL query and passes them to the API', async () => {
    (listingApi.list as any).mockResolvedValue(listResult([makeListing({ title: 'Filtered' })]));

    renderWithProviders(<Home />, {
      route: '/?q=phone&category=cat1&minPrice=100&maxPrice=500&sort=price_desc&page=2',
    });

    await screen.findByText('Filtered');
    const firstArgs = (listingApi.list as any).mock.calls[0][0];
    expect(firstArgs).toMatchObject({
      q: 'phone',
      category: 'cat1',
      minPrice: 100,
      maxPrice: 500,
      sort: 'price_desc',
      page: 2,
      limit: 12,
    });
  });

  it('shows the "Showing results for" banner when a search query is present', async () => {
    (listingApi.list as any).mockResolvedValue(listResult([makeListing({ title: 'Queried' })]));

    renderWithProviders(<Home />, { route: '/?q=laptop' });

    await screen.findByText('Queried');
    expect(screen.getByText(/Showing results for/i)).toBeInTheDocument();
    expect(screen.getByText('laptop')).toBeInTheDocument();
  });

  it('renders category quick-pick pills from fetched categories', async () => {
    (categoryApi.list as any).mockResolvedValue(
      catResult([makeCategory({ name: 'Cars', slug: 'cars' })])
    );
    (listingApi.list as any).mockResolvedValue(listResult([makeListing({ title: 'Car Ad' })]));

    renderWithProviders(<Home />);

    await screen.findByText('Car Ad');
    expect(await screen.findByRole('button', { name: 'Cars' })).toBeInTheDocument();
  });

  it('shows an error toast when listing fetch rejects', async () => {
    (listingApi.list as any).mockRejectedValue(new Error('boom'));

    renderWithProviders(<Home />);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('toggling a favorite while logged out opens the auth modal and does not call the API', async () => {
    (listingApi.list as any).mockResolvedValue(
      listResult([makeListing({ title: 'Favable', isFavorite: false })])
    );

    const { store } = renderWithProviders(<Home />);
    await screen.findByText('Favable');

    await userEvent.click(screen.getByRole('button', { name: /toggle favorite/i }));

    expect(store.getState().ui.authModal.open).toBe(true);
    expect(favoriteApi.add).not.toHaveBeenCalled();
    expect(favoriteApi.remove).not.toHaveBeenCalled();
  });

  it('toggling a favorite while logged in calls favoriteApi.add and flips the heart', async () => {
    (favoriteApi.add as any).mockResolvedValue({ data: {}, meta: meta(), message: 'OK' });
    (listingApi.list as any).mockResolvedValue(
      listResult([makeListing({ _id: 'lst1', title: 'AddFav', isFavorite: false })])
    );

    renderWithProviders(<Home />, { preloadedState: authedState({ name: 'Me' }) });
    await screen.findByText('AddFav');

    const favBtn = screen.getByRole('button', { name: /toggle favorite/i });
    expect(favBtn).toHaveTextContent('♡');

    await userEvent.click(favBtn);

    await waitFor(() => expect(favoriteApi.add).toHaveBeenCalledWith('lst1'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /toggle favorite/i })).toHaveTextContent('♥')
    );
  });

  it('removing a favorite while logged in calls favoriteApi.remove', async () => {
    (favoriteApi.remove as any).mockResolvedValue({ data: {}, meta: meta(), message: 'OK' });
    (listingApi.list as any).mockResolvedValue(
      listResult([makeListing({ _id: 'lst2', title: 'RemFav', isFavorite: true })])
    );

    renderWithProviders(<Home />, { preloadedState: authedState({ name: 'Me' }) });
    await screen.findByText('RemFav');

    const favBtn = screen.getByRole('button', { name: /toggle favorite/i });
    expect(favBtn).toHaveTextContent('♥');

    await userEvent.click(favBtn);

    await waitFor(() => expect(favoriteApi.remove).toHaveBeenCalledWith('lst2'));
  });
});
