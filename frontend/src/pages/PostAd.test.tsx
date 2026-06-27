import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  authedState,
  makeCategory,
  makeListing,
  screen,
  waitFor,
  userEvent,
} from '@/test/utils';

// ---- mocks ----
vi.mock('@/services/listingService', () => ({
  listingApi: {
    list: vi.fn(),
    get: vi.fn(),
    similar: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    toggleBoost: vi.fn(),
  },
  categoryApi: { list: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// Capture the navigate mock + keep MemoryRouter working by spreading the real module.
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

// Stub the heavy leaflet-backed picker. Expose its props as buttons / text so we
// can drive onChange / onAddressFound and assert autoLocate / received value.
vi.mock('@/components/map/LocationPicker', () => ({
  LocationPicker: (props: any) => (
    <div data-testid="location-picker">
      <span data-testid="lp-autolocate">{String(props.autoLocate)}</span>
      <span data-testid="lp-value">{props.value ? `${props.value.lat},${props.value.lng}` : 'null'}</span>
      <button type="button" onClick={() => props.onChange({ lat: 12.5, lng: 77.5 })}>
        set-pin
      </button>
      <button type="button" onClick={() => props.onChange(null)}>
        clear-pin
      </button>
      <button type="button" onClick={() => props.onAddressFound('Indiranagar, Bengaluru')}>
        found-address
      </button>
    </div>
  ),
}));

// Stub the image uploader so we can flip images on/off via a button.
vi.mock('@/components/listings/ImageUploader', () => ({
  ImageUploader: (props: any) => (
    <div data-testid="image-uploader">
      <span data-testid="iu-count">{props.images.length}</span>
      <button
        type="button"
        onClick={() => props.onChange([{ url: 'http://x/1.jpg', key: '1.jpg' }])}
      >
        add-image
      </button>
    </div>
  ),
}));

import { listingApi, categoryApi } from '@/services/listingService';
import toast from 'react-hot-toast';
import PostAd from './PostAd';

const electronics = makeCategory({ _id: 'cat-1', name: 'Electronics', icon: '📱' });

const okCat = () =>
  (categoryApi.list as any).mockResolvedValue({
    data: { items: [electronics] },
    meta: {},
    message: 'OK',
  });

// Fill the always-required text fields (title/description/price/location) for a
// valid create submission. Category is selected separately when needed.
const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText('What are you selling?'), 'Nice phone');
  await user.type(
    screen.getByPlaceholderText(/Add details about condition/i),
    'A long enough description here.'
  );
  // Price input is the only number input on the form.
  const price = document.querySelector('input[type="number"]') as HTMLInputElement;
  await user.type(price, '1500');
  // Location input has no placeholder; it's the text input that is NOT title.
  const textInputs = Array.from(
    document.querySelectorAll('input[type="text"], input:not([type])')
  ) as HTMLInputElement[];
  const location = textInputs.find(
    (i) => i.placeholder !== 'What are you selling?'
  )!;
  await user.type(location, 'Bengaluru');
};

const selectCategory = async (user: ReturnType<typeof userEvent.setup>) => {
  const selects = Array.from(document.querySelectorAll('select')) as HTMLSelectElement[];
  // The first select is the Category select (placeholder "Select category").
  const categorySelect = selects.find((s) =>
    Array.from(s.options).some((o) => o.textContent?.includes('Select category'))
  )!;
  await user.selectOptions(categorySelect, 'cat-1');
};

beforeEach(() => {
  navigate.mockReset();
  okCat();
});

describe('PostAd — create mode', () => {
  it('renders the "Post a new ad" heading and loads categories', async () => {
    renderWithProviders(<PostAd />, { preloadedState: authedState(), route: '/post' });
    expect(screen.getByRole('heading', { name: /post a new ad/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publish ad/i })).toBeInTheDocument();
    await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());
    // category option rendered from the loaded list
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Electronics/i })).toBeInTheDocument()
    );
    // never calls get() in create mode
    expect(listingApi.get).not.toHaveBeenCalled();
  });

  it('passes autoLocate=true to the LocationPicker when NOT editing', async () => {
    renderWithProviders(<PostAd />, { preloadedState: authedState(), route: '/post' });
    expect(screen.getByTestId('lp-autolocate')).toHaveTextContent('true');
    // let the categories effect settle to avoid a trailing act() warning
    await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());
  });

  it('submitting without an image shows an error toast and does NOT call create', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PostAd />, { preloadedState: authedState(), route: '/post' });
    await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());

    await fillRequired(user);
    await selectCategory(user);
    await user.click(screen.getByRole('button', { name: /publish ad/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Add at least one image')
    );
    expect(listingApi.create).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('with an image + valid fields, create is called with the payload including latitude/longitude when a pin was set, then navigates to /my-listings', async () => {
    const user = userEvent.setup();
    (listingApi.create as any).mockResolvedValue({
      data: { listing: makeListing() },
      meta: {},
      message: 'OK',
    });
    renderWithProviders(<PostAd />, { preloadedState: authedState(), route: '/post' });
    await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());

    await fillRequired(user);
    await selectCategory(user);
    await user.click(screen.getByRole('button', { name: 'add-image' }));
    await user.click(screen.getByRole('button', { name: 'set-pin' }));

    await user.click(screen.getByRole('button', { name: /publish ad/i }));

    await waitFor(() => expect(listingApi.create).toHaveBeenCalledTimes(1));
    const payload = (listingApi.create as any).mock.calls[0][0];
    expect(payload).toMatchObject({
      title: 'Nice phone',
      description: 'A long enough description here.',
      category: 'cat-1',
      price: 1500,
      location: 'Bengaluru',
      condition: 'used',
      status: 'published',
      latitude: 12.5,
      longitude: 77.5,
      images: [{ url: 'http://x/1.jpg', key: '1.jpg' }],
    });
    expect(toast.success).toHaveBeenCalledWith('Listing created');
    expect(navigate).toHaveBeenCalledWith('/my-listings');
  });

  it('create without a pin sends latitude/longitude as undefined (omitted) in create mode', async () => {
    const user = userEvent.setup();
    (listingApi.create as any).mockResolvedValue({
      data: { listing: makeListing() },
      meta: {},
      message: 'OK',
    });
    renderWithProviders(<PostAd />, { preloadedState: authedState(), route: '/post' });
    await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());

    await fillRequired(user);
    await selectCategory(user);
    await user.click(screen.getByRole('button', { name: 'add-image' }));

    await user.click(screen.getByRole('button', { name: /publish ad/i }));

    await waitFor(() => expect(listingApi.create).toHaveBeenCalledTimes(1));
    const payload = (listingApi.create as any).mock.calls[0][0];
    expect(payload.latitude).toBeUndefined();
    expect(payload.longitude).toBeUndefined();
  });

  it('onAddressFound fills the empty location field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PostAd />, { preloadedState: authedState(), route: '/post' });
    await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'found-address' }));

    const textInputs = Array.from(
      document.querySelectorAll('input[type="text"], input:not([type])')
    ) as HTMLInputElement[];
    const location = textInputs.find((i) => i.placeholder !== 'What are you selling?')!;
    await waitFor(() => expect(location.value).toBe('Indiranagar, Bengaluru'));
  });

  it('onAddressFound does NOT overwrite a location the user already typed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PostAd />, { preloadedState: authedState(), route: '/post' });
    await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());

    const textInputs = Array.from(
      document.querySelectorAll('input[type="text"], input:not([type])')
    ) as HTMLInputElement[];
    const location = textInputs.find((i) => i.placeholder !== 'What are you selling?')!;
    await user.type(location, 'Mumbai');

    await user.click(screen.getByRole('button', { name: 'found-address' }));
    expect(location.value).toBe('Mumbai');
  });

  it('shows a validation error and does not submit when required fields are empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PostAd />, { preloadedState: authedState(), route: '/post' });
    await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /publish ad/i }));

    await waitFor(() => expect(screen.getByText('Title required')).toBeInTheDocument());
    expect(listingApi.create).not.toHaveBeenCalled();
  });

  it('shows an error toast when create rejects (no navigation)', async () => {
    const user = userEvent.setup();
    (listingApi.create as any).mockRejectedValue(new Error('boom'));
    renderWithProviders(<PostAd />, { preloadedState: authedState(), route: '/post' });
    await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());

    await fillRequired(user);
    await selectCategory(user);
    await user.click(screen.getByRole('button', { name: 'add-image' }));
    await user.click(screen.getByRole('button', { name: /publish ad/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalledWith('/my-listings');
  });
});

describe('PostAd — edit mode', () => {
  const editListing = makeListing({
    _id: 'L1',
    title: 'Old title',
    description: 'Old description that is long enough.',
    category: electronics,
    price: 999,
    condition: 'new',
    location: 'Chennai',
    status: 'published',
    geo: { type: 'Point', coordinates: [77.9, 13.1] },
    images: [{ url: 'http://x/old.jpg', key: 'old.jpg' }],
  });

  it('calls listingApi.get, prefills the form, converts geo to picker coords, and passes autoLocate=false', async () => {
    (listingApi.get as any).mockResolvedValue({
      data: { listing: editListing, isFavorite: false },
      meta: {},
      message: 'OK',
    });
    renderWithProviders(<PostAd />, {
      preloadedState: authedState(),
      route: '/post/L1',
      path: '/post/:id',
    });

    await waitFor(() => expect(listingApi.get).toHaveBeenCalledWith('L1'));

    // Heading flips to Edit + button text changes.
    expect(await screen.findByRole('heading', { name: /edit listing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();

    // Prefilled title.
    await waitFor(() =>
      expect((screen.getByPlaceholderText('What are you selling?') as HTMLInputElement).value).toBe(
        'Old title'
      )
    );

    // geo [lng=77.9, lat=13.1] -> picker value {lat:13.1, lng:77.9}
    expect(screen.getByTestId('lp-value')).toHaveTextContent('13.1,77.9');
    // not auto-locating during edit
    expect(screen.getByTestId('lp-autolocate')).toHaveTextContent('false');
  });

  it('submit calls listingApi.update with the prefilled payload and navigates', async () => {
    (listingApi.get as any).mockResolvedValue({
      data: { listing: editListing, isFavorite: false },
      meta: {},
      message: 'OK',
    });
    (listingApi.update as any).mockResolvedValue({
      data: { listing: editListing },
      meta: {},
      message: 'OK',
    });
    const user = userEvent.setup();
    renderWithProviders(<PostAd />, {
      preloadedState: authedState(),
      route: '/post/L1',
      path: '/post/:id',
    });
    await waitFor(() => expect(listingApi.get).toHaveBeenCalledWith('L1'));
    await screen.findByRole('button', { name: /save changes/i });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(listingApi.update).toHaveBeenCalledTimes(1));
    const [id, payload] = (listingApi.update as any).mock.calls[0];
    expect(id).toBe('L1');
    expect(payload).toMatchObject({
      title: 'Old title',
      category: 'cat-1',
      price: 999,
      location: 'Chennai',
      latitude: 13.1,
      longitude: 77.9,
    });
    expect(listingApi.create).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Listing updated');
    expect(navigate).toHaveBeenCalledWith('/my-listings');
  });

  it('clearing the pin sends latitude:null / longitude:null on update', async () => {
    (listingApi.get as any).mockResolvedValue({
      data: { listing: editListing, isFavorite: false },
      meta: {},
      message: 'OK',
    });
    (listingApi.update as any).mockResolvedValue({
      data: { listing: editListing },
      meta: {},
      message: 'OK',
    });
    const user = userEvent.setup();
    renderWithProviders(<PostAd />, {
      preloadedState: authedState(),
      route: '/post/L1',
      path: '/post/:id',
    });
    await waitFor(() => expect(listingApi.get).toHaveBeenCalledWith('L1'));
    await screen.findByRole('button', { name: /save changes/i });

    await user.click(screen.getByRole('button', { name: 'clear-pin' }));
    expect(screen.getByTestId('lp-value')).toHaveTextContent('null');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(listingApi.update).toHaveBeenCalledTimes(1));
    const [, payload] = (listingApi.update as any).mock.calls[0];
    expect(payload.latitude).toBeNull();
    expect(payload.longitude).toBeNull();
  });

  it('navigates to /my-listings and toasts when get() fails', async () => {
    (listingApi.get as any).mockRejectedValue(new Error('not found'));
    renderWithProviders(<PostAd />, {
      preloadedState: authedState(),
      route: '/post/L1',
      path: '/post/:id',
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith('/my-listings');
  });
});
