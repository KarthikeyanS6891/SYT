import { ReactElement, ReactNode } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, RenderOptions } from '@testing-library/react';
import authReducer, { AuthState } from '@/store/slices/authSlice';
import uiReducer from '@/store/slices/uiSlice';
import type { Category, Listing, User } from '@/types';

export const makeStore = (preloadedState?: any) =>
  configureStore({
    reducer: { auth: authReducer, ui: uiReducer },
    preloadedState,
  });

export type AppStore = ReturnType<typeof makeStore>;

interface Options extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: any;
  store?: AppStore;
  /** Initial URL, e.g. '/listings/abc'. */
  route?: string;
  /** When set, the ui is wrapped in <Routes><Route path=...>; lets useParams resolve. */
  path?: string;
}

/** Render a component wrapped in the Redux store + a memory router. */
export const renderWithProviders = (ui: ReactElement, options: Options = {}) => {
  const {
    preloadedState,
    store = makeStore(preloadedState),
    route = '/',
    path,
    ...rest
  } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        {path ? (
          <Routes>
            <Route path={path} element={children} />
          </Routes>
        ) : (
          children
        )}
      </MemoryRouter>
    </Provider>
  );

  return { store, ...render(ui, { wrapper: Wrapper, ...rest }) };
};

// ---- preloaded-state helpers ----
export const authedState = (user: Partial<User> = {}) => ({
  auth: {
    user: makeUser(user),
    status: 'authenticated',
    error: null,
    initialized: true,
  } as AuthState,
});

// ---- data factories ----
let n = 0;
const uid = () => `id_${n++}`;

export const makeUser = (over: Partial<User> = {}): User => ({
  _id: uid(),
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString(),
  ...over,
});

export const makeCategory = (over: Partial<Category> = {}): Category => ({
  _id: uid(),
  name: 'Electronics',
  slug: 'electronics',
  icon: '📦',
  ...over,
});

export const makeListing = (over: Partial<Listing> = {}): Listing => ({
  _id: uid(),
  seller: makeUser(),
  title: 'Test Listing',
  description: 'A nice item for sale, in great condition.',
  category: makeCategory(),
  price: 1000,
  currency: 'INR',
  condition: 'used',
  location: 'Bengaluru',
  images: [{ url: 'http://example.com/a.jpg', key: 'a.jpg' }],
  status: 'published',
  boosted: false,
  views: 0,
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString(),
  ...over,
});

// re-export RTL + user-event for convenience
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
