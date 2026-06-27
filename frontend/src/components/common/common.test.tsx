import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createRef } from 'react';
import {
  renderWithProviders,
  makeStore,
  authedState,
  screen,
  fireEvent,
  userEvent,
  render,
} from '@/test/utils';

import { Button } from './Button';
import { Field, Input, Textarea, Select } from './Input';
import { Loader } from './Loader';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { PrivateRoute } from './PrivateRoute';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies the base btn class and defaults to primary (no variant class)', () => {
    render(<Button>Hi</Button>);
    const btn = screen.getByRole('button', { name: 'Hi' });
    expect(btn).toHaveClass('btn');
    expect(btn).not.toHaveClass('secondary');
    expect(btn).not.toHaveClass('ghost');
    expect(btn).not.toHaveClass('danger');
  });

  it('maps variant -> class for secondary/ghost/danger', () => {
    const { rerender } = render(<Button variant="secondary">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('secondary');

    rerender(<Button variant="ghost">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('ghost');

    rerender(<Button variant="danger">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('danger');
  });

  it('adds the sm class for size="sm" and block class for block', () => {
    render(
      <Button size="sm" block>
        small
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'small' });
    expect(btn).toHaveClass('sm');
    expect(btn).toHaveClass('block');
  });

  it('merges an extra className', () => {
    render(<Button className="extra">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn', 'extra');
  });

  it('shows a spinner and disables the button while loading', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.spinner')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is set and shows no spinner', () => {
    render(<Button disabled>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.spinner')).not.toBeInTheDocument();
  });

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not fire onClick when loading', () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} loading>
        Go
      </Button>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards arbitrary button attributes like type', () => {
    render(<Button type="submit">submit</Button>);
    expect(screen.getByRole('button', { name: 'submit' })).toHaveAttribute('type', 'submit');
  });
});

// ---------------------------------------------------------------------------
// Field / Input / Textarea / Select
// ---------------------------------------------------------------------------
describe('Field', () => {
  it('renders the label and children', () => {
    render(
      <Field label="My Label">
        <input data-testid="child" />
      </Field>
    );
    expect(screen.getByText('My Label')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('shows the hint when there is no error', () => {
    render(
      <Field hint="be helpful">
        <input />
      </Field>
    );
    expect(screen.getByText('be helpful')).toBeInTheDocument();
  });

  it('hides the hint and shows the error when error is present', () => {
    render(
      <Field hint="be helpful" error="something broke">
        <input />
      </Field>
    );
    expect(screen.queryByText('be helpful')).not.toBeInTheDocument();
    expect(screen.getByText('something broke')).toBeInTheDocument();
    expect(screen.getByText('something broke')).toHaveClass('error');
  });
});

describe('Input', () => {
  it('renders the label', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows error text when error prop is set', () => {
    render(<Input label="Email" error="required" />);
    const err = screen.getByText('required');
    expect(err).toBeInTheDocument();
    expect(err).toHaveClass('error');
  });

  it('forwards a ref so its value can be read after typing', async () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="Name" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    await userEvent.type(ref.current!, 'hello');
    expect(ref.current!.value).toBe('hello');
  });

  it('passes through input attributes (placeholder, type)', () => {
    render(<Input placeholder="type here" type="password" />);
    const input = screen.getByPlaceholderText('type here');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveClass('input');
  });
});

describe('Textarea', () => {
  it('renders label and forwards a ref that reflects typed value', async () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea label="Description" ref={ref} />);
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    await userEvent.type(ref.current!, 'long text');
    expect(ref.current!.value).toBe('long text');
  });

  it('shows error text when error prop set', () => {
    render(<Textarea error="too short" />);
    expect(screen.getByText('too short')).toHaveClass('error');
  });
});

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ];

  it('renders a placeholder option plus the provided options', () => {
    render(<Select options={options} placeholder="Pick one" />);
    expect(screen.getByRole('option', { name: 'Pick one' })).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Option A' })).toHaveValue('a');
    expect(screen.getByRole('option', { name: 'Option B' })).toHaveValue('b');
  });

  it('renders only the options when no placeholder given', () => {
    render(<Select options={options} />);
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('renders the label and forwards a ref; selecting updates the value', async () => {
    const ref = createRef<HTMLSelectElement>();
    render(<Select label="Choice" ref={ref} options={options} placeholder="Pick" />);
    expect(screen.getByText('Choice')).toBeInTheDocument();
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
    await userEvent.selectOptions(ref.current!, 'b');
    expect(ref.current!.value).toBe('b');
  });

  it('shows error text when error prop set', () => {
    render(<Select options={options} error="choose something" />);
    expect(screen.getByText('choose something')).toHaveClass('error');
  });
});

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------
describe('Loader', () => {
  it('renders the page loader by default', () => {
    const { container } = render(<Loader />);
    const page = container.querySelector('.loader-page');
    expect(page).toBeInTheDocument();
    expect(page!.querySelector('.spinner')).toBeInTheDocument();
  });

  it('renders just the spinner span when inline', () => {
    const { container } = render(<Loader inline />);
    expect(container.querySelector('.loader-page')).not.toBeInTheDocument();
    const spinner = container.querySelector('.spinner');
    expect(spinner).toBeInTheDocument();
    expect(spinner!.tagName).toBe('SPAN');
  });
});

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------
describe('Logo', () => {
  it('renders an accessible svg with the full wordmark aria-label by default', () => {
    render(<Logo />);
    const img = screen.getByRole('img', { name: 'SYT - Sell Your Things' });
    expect(img.tagName.toLowerCase()).toBe('svg');
  });

  it('uses the short aria-label when the wordmark is hidden', () => {
    render(<Logo showWordmark={false} />);
    expect(screen.getByRole('img', { name: 'SYT' })).toBeInTheDocument();
  });

  it('renders the tagline text when showTagline is set', () => {
    render(<Logo showTagline />);
    expect(screen.getByText('SELL YOUR THINGS')).toBeInTheDocument();
  });

  it('applies a passed className', () => {
    render(<Logo className="my-logo" />);
    expect(screen.getByRole('img')).toHaveClass('my-logo');
  });
});

// ---------------------------------------------------------------------------
// ThemeToggle
// ---------------------------------------------------------------------------
describe('ThemeToggle', () => {
  it('renders with the light-theme label by default', () => {
    renderWithProviders(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' })
    ).toBeInTheDocument();
  });

  it('toggles the theme in the store and updates its label when clicked', async () => {
    const { store } = renderWithProviders(<ThemeToggle />);
    expect(store.getState().ui.theme).toBe('light');

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(store.getState().ui.theme).toBe('dark');
    expect(localStorage.getItem('syt:theme')).toBe('dark');
    // label flips to reflect the new state
    expect(
      screen.getByRole('button', { name: 'Switch to light theme' })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(store.getState().ui.theme).toBe('light');
    expect(localStorage.getItem('syt:theme')).toBe('light');
  });

  it('reflects an initial dark theme from the store', () => {
    renderWithProviders(<ThemeToggle />, {
      preloadedState: { ui: { unreadCount: 0, authModal: { open: false, mode: 'login' }, theme: 'dark' } },
    });
    expect(
      screen.getByRole('button', { name: 'Switch to light theme' })
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PrivateRoute
// ---------------------------------------------------------------------------
// Helper: render PrivateRoute inside a small routing tree so we can observe
// whether it renders its children at /private or redirects to the "/" landing.
const renderPrivate = (
  ui: React.ReactNode,
  preloadedState?: any,
  { adminOnly = false }: { adminOnly?: boolean } = {}
) => {
  const store = makeStore(preloadedState);
  const utils = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/" element={<div>landing-page</div>} />
          <Route
            path="/private"
            element={<PrivateRoute adminOnly={adminOnly}>{ui}</PrivateRoute>}
          />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return { store, ...utils };
};

describe('PrivateRoute', () => {
  it('shows the loader while auth is not yet initialized', () => {
    const { container } = renderPrivate(<div>secret</div>, {
      auth: { user: null, status: 'idle', error: null, initialized: false },
    });
    expect(container.querySelector('.loader-page')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.queryByText('landing-page')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to "/" and opens the login auth modal', () => {
    const { store } = renderPrivate(<div>secret</div>, {
      auth: { user: null, status: 'unauthenticated', error: null, initialized: true },
    });
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText('landing-page')).toBeInTheDocument();
    // effect dispatches openAuthModal('login')
    expect(store.getState().ui.authModal).toEqual({ open: true, mode: 'login' });
  });

  it('renders its children when authenticated', () => {
    renderPrivate(<div>secret</div>, authedState());
    expect(screen.getByText('secret')).toBeInTheDocument();
    expect(screen.queryByText('landing-page')).not.toBeInTheDocument();
  });

  it('redirects an authenticated non-admin away from an adminOnly route', () => {
    renderPrivate(<div>admin-area</div>, authedState({ role: 'user' }), { adminOnly: true });
    expect(screen.queryByText('admin-area')).not.toBeInTheDocument();
    expect(screen.getByText('landing-page')).toBeInTheDocument();
  });

  it('renders an adminOnly route for an admin user', () => {
    renderPrivate(<div>admin-area</div>, authedState({ role: 'admin' }), { adminOnly: true });
    expect(screen.getByText('admin-area')).toBeInTheDocument();
    expect(screen.queryByText('landing-page')).not.toBeInTheDocument();
  });
});
