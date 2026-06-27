import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  makeListing,
  screen,
  within,
  fireEvent,
  userEvent,
} from '@/test/utils';
import type { ListingFilters } from '@/types';

// Assert navigation by mocking useNavigate while keeping MemoryRouter intact.
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import { ListingCard } from './ListingCard';
import { ListingGrid } from './ListingGrid';
import { Filters } from './Filters';

beforeEach(() => {
  navigate.mockReset();
});

describe('ListingCard', () => {
  it('shows formatted price, title, location and timeAgo', () => {
    // 5 minutes ago relative to a fixed "now".
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T00:05:00Z'));
    const listing = makeListing({
      title: 'Vintage Camera',
      price: 22000,
      currency: 'INR',
      location: 'Mumbai',
      createdAt: '2024-06-01T00:00:00Z',
    });

    renderWithProviders(<ListingCard listing={listing} />);

    // Price formatted via Intl (rupee symbol, no decimals).
    const price = document.querySelector('.price')!;
    expect(price.textContent).toMatch(/₹/);
    expect(price.textContent).toMatch(/22,000/);
    expect(price.textContent).not.toMatch(/\.00/);

    expect(screen.getByRole('heading', { name: 'Vintage Camera' })).toBeInTheDocument();
    expect(screen.getByText('Mumbai')).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('renders the cover image as a background when an image exists', () => {
    const listing = makeListing({ images: [{ url: 'http://example.com/cover.jpg', key: 'k' }] });
    renderWithProviders(<ListingCard listing={listing} />);
    const thumb = document.querySelector('.thumb') as HTMLElement;
    expect(thumb.style.backgroundImage).toContain('http://example.com/cover.jpg');
  });

  it('shows the "★ Featured" badge only when boosted', () => {
    const { unmount } = renderWithProviders(<ListingCard listing={makeListing({ boosted: false })} />);
    expect(screen.queryByText(/Featured/)).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<ListingCard listing={makeListing({ boosted: true })} />);
    const badge = screen.getByText('★ Featured');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('badge', 'boost-badge');
  });

  it('renders the favorite button only when onToggleFavorite is passed', () => {
    const { unmount } = renderWithProviders(<ListingCard listing={makeListing()} />);
    expect(screen.queryByRole('button', { name: /toggle favorite/i })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<ListingCard listing={makeListing()} onToggleFavorite={vi.fn()} />);
    expect(screen.getByRole('button', { name: /toggle favorite/i })).toBeInTheDocument();
  });

  it('shows ♥ when isFavorite and ♡ otherwise', () => {
    const { unmount } = renderWithProviders(
      <ListingCard listing={makeListing({ isFavorite: true })} onToggleFavorite={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /toggle favorite/i })).toHaveTextContent('♥');
    unmount();

    renderWithProviders(
      <ListingCard listing={makeListing({ isFavorite: false })} onToggleFavorite={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /toggle favorite/i })).toHaveTextContent('♡');
  });

  it('clicking favorite calls onToggleFavorite(id, !isFavorite) and does NOT navigate', async () => {
    const onToggleFavorite = vi.fn();
    const listing = makeListing({ _id: 'lst1', isFavorite: false });
    renderWithProviders(<ListingCard listing={listing} onToggleFavorite={onToggleFavorite} />);

    await userEvent.click(screen.getByRole('button', { name: /toggle favorite/i }));

    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onToggleFavorite).toHaveBeenCalledWith('lst1', true);
    // stopPropagation prevents the card click handler from firing.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clicking favorite on an already-favorited listing toggles to false', async () => {
    const onToggleFavorite = vi.fn();
    const listing = makeListing({ _id: 'lst2', isFavorite: true });
    renderWithProviders(<ListingCard listing={listing} onToggleFavorite={onToggleFavorite} />);

    await userEvent.click(screen.getByRole('button', { name: /toggle favorite/i }));
    expect(onToggleFavorite).toHaveBeenCalledWith('lst2', false);
  });

  it('clicking the card navigates to /listings/:id', async () => {
    const listing = makeListing({ _id: 'abc123' });
    renderWithProviders(<ListingCard listing={listing} />);

    await userEvent.click(document.querySelector('.listing-card') as HTMLElement);
    expect(navigate).toHaveBeenCalledWith('/listings/abc123');
  });
});

describe('ListingGrid', () => {
  it('renders the default empty-state text when items is empty', () => {
    renderWithProviders(<ListingGrid items={[]} />);
    const empty = document.querySelector('.empty-state')!;
    expect(empty).toHaveTextContent('No listings found.');
    expect(document.querySelector('.grid')).not.toBeInTheDocument();
  });

  it('renders a custom empty-state text', () => {
    renderWithProviders(<ListingGrid items={[]} emptyText="Nothing here yet" />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('renders one card per item otherwise', () => {
    const items = [
      makeListing({ _id: 'a', title: 'Alpha' }),
      makeListing({ _id: 'b', title: 'Bravo' }),
      makeListing({ _id: 'c', title: 'Charlie' }),
    ];
    renderWithProviders(<ListingGrid items={items} />);

    const grid = document.querySelector('.grid')!;
    const cards = within(grid as HTMLElement).getAllByRole('heading');
    expect(cards).toHaveLength(3);
    expect(document.querySelectorAll('.listing-card')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bravo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Charlie' })).toBeInTheDocument();
  });

  it('passes onToggleFavorite through to each card', () => {
    const onToggleFavorite = vi.fn();
    const items = [makeListing({ _id: 'a' }), makeListing({ _id: 'b' })];
    renderWithProviders(<ListingGrid items={items} onToggleFavorite={onToggleFavorite} />);
    expect(screen.getAllByRole('button', { name: /toggle favorite/i })).toHaveLength(2);
  });
});

describe('Filters', () => {
  const base: ListingFilters = { q: 'phone', category: 'cat1', page: 3 };

  it('typing location calls onChange with merged filters and page reset to 1', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Filters filters={base} onChange={onChange} />);

    // type=text input; type a single char to inspect the merge precisely.
    fireEvent.change(screen.getByPlaceholderText('Location'), { target: { value: 'Delhi' } });

    expect(onChange).toHaveBeenLastCalledWith({
      q: 'phone',
      category: 'cat1',
      location: 'Delhi',
      page: 1,
    });
  });

  it('clearing location sends location: undefined', () => {
    const onChange = vi.fn();
    renderWithProviders(<Filters filters={{ ...base, location: 'Delhi' }} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('Location'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({
      q: 'phone',
      category: 'cat1',
      location: undefined,
      page: 1,
    });
  });

  it('typing min price calls onChange with numeric minPrice and page reset to 1', () => {
    const onChange = vi.fn();
    renderWithProviders(<Filters filters={base} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('Min price'), { target: { value: '500' } });
    expect(onChange).toHaveBeenLastCalledWith({
      q: 'phone',
      category: 'cat1',
      minPrice: 500,
      page: 1,
    });
  });

  it('clearing min price sends minPrice: undefined', () => {
    const onChange = vi.fn();
    renderWithProviders(<Filters filters={{ ...base, minPrice: 500 }} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('Min price'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({
      q: 'phone',
      category: 'cat1',
      minPrice: undefined,
      page: 1,
    });
  });

  it('typing max price calls onChange with numeric maxPrice and page reset to 1', () => {
    const onChange = vi.fn();
    renderWithProviders(<Filters filters={base} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('Max price'), { target: { value: '9999' } });
    expect(onChange).toHaveBeenLastCalledWith({
      q: 'phone',
      category: 'cat1',
      maxPrice: 9999,
      page: 1,
    });
  });

  it('changing sort calls onChange with the new sort and page reset to 1', () => {
    const onChange = vi.fn();
    renderWithProviders(<Filters filters={base} onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'price_desc' } });
    expect(onChange).toHaveBeenLastCalledWith({
      q: 'phone',
      category: 'cat1',
      sort: 'price_desc',
      page: 1,
    });
  });

  it('reflects current filter values in the controls', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <Filters
        filters={{ location: 'Pune', minPrice: 100, maxPrice: 200, sort: 'popular', page: 1 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByPlaceholderText('Location')).toHaveValue('Pune');
    expect(screen.getByPlaceholderText('Min price')).toHaveValue(100);
    expect(screen.getByPlaceholderText('Max price')).toHaveValue(200);
    expect(screen.getByRole('combobox')).toHaveValue('popular');
  });

  it('defaults the sort select to "latest" when sort is unset', () => {
    const onChange = vi.fn();
    renderWithProviders(<Filters filters={{}} onChange={onChange} />);
    expect(screen.getByRole('combobox')).toHaveValue('latest');
  });
});
