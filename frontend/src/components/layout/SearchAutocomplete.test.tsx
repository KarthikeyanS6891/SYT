import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, userEvent } from '@/test/utils';
import { SearchAutocomplete } from './SearchAutocomplete';

const get = vi.fn();
vi.mock('@/services/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

beforeEach(() => {
  get.mockReset();
});

const renderIt = () =>
  render(
    <MemoryRouter>
      <SearchAutocomplete />
    </MemoryRouter>
  );

describe('SearchAutocomplete — result highlighting', () => {
  it('highlights every occurrence of the matched token, not just some of them (regression: stateful global-regex .test())', async () => {
    // A title with the query token repeated several times, interleaved with
    // non-matching text. Under the old code (reusing a single `g`-flag RegExp
    // instance across `.test()` calls in the same `.map()`), `lastIndex` state
    // leaking between calls could cause some real occurrences to render as plain
    // text instead of <mark>. Every occurrence below must be highlighted.
    get.mockResolvedValue({
      data: {
        data: {
          categories: [],
          listings: [
            {
              _id: 'l1',
              title: 'Car for car lovers: a great car, another car',
              price: 1000,
              currency: 'INR',
              images: [],
              location: 'Bengaluru',
            },
          ],
        },
      },
    });

    const user = userEvent.setup();
    renderIt();

    await user.type(screen.getByPlaceholderText(/search cars, phones/i), 'car');
    await waitFor(() => expect(get).toHaveBeenCalled(), { timeout: 2000 });

    // The listing's title renders first among the `.search-ac-title` nodes (the
    // "See all results for ..." free-text row also has this class, further down).
    const title = await waitFor(() => {
      const el = document.querySelectorAll('.search-ac-title')[0] as HTMLElement | undefined;
      expect(el?.textContent).toContain('lovers');
      return el!;
    });
    const marks = title.querySelectorAll('mark');
    // "car" appears 4 times in the title (case-insensitive: "Car", "car", "car", "car").
    expect(marks).toHaveLength(4);
    marks.forEach((m) => expect(m.textContent?.toLowerCase()).toBe('car'));
  });
});
