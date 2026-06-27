import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

// Capture the leaflet map "click" handler + the marker so we can drive them.
const h = vi.hoisted(() => ({ clickCb: null as any, markers: [] as any[] }));
vi.mock('./leaflet', () => {
  const makeMarker = () => {
    const m: any = {
      addTo: vi.fn(() => m),
      on: vi.fn(() => m),
      setLatLng: vi.fn(() => m),
      getLatLng: vi.fn(() => ({ lat: 0, lng: 0 })),
      remove: vi.fn(),
    };
    h.markers.push(m);
    return m;
  };
  const makeMap = () => {
    const map: any = {
      on: vi.fn((ev: string, cb: any) => { if (ev === 'click') h.clickCb = cb; return map; }),
      setView: vi.fn(), panTo: vi.fn(), flyTo: vi.fn(),
      getZoom: vi.fn(() => 14), getBounds: vi.fn(() => ({ contains: () => true })),
      invalidateSize: vi.fn(), remove: vi.fn(),
    };
    return map;
  };
  const L = { map: vi.fn(makeMap), marker: vi.fn(makeMarker), latLng: (lat: number, lng: number) => ({ lat, lng }) };
  return { default: L, addTiles: vi.fn(), DEFAULT_CENTER: { lat: 20.59, lng: 78.96 }, DEFAULT_ZOOM: 5, PIN_ZOOM: 15 };
});

import toast from 'react-hot-toast';
import { LocationPicker } from './LocationPicker';

const setGeolocation = (impl: Partial<Geolocation>) => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: impl });
};
const setPermissions = (state: string | null) => {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: state ? { query: vi.fn().mockResolvedValue({ state }) } : undefined,
  });
};

beforeEach(() => {
  h.clickCb = null;
  h.markers.length = 0;
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ address: { suburb: 'Indiranagar', city: 'Bengaluru' } }),
  }) as any;
});
afterEach(() => vi.clearAllMocks());

describe('LocationPicker', () => {
  it('renders the map canvas and the "use my location" button', () => {
    setPermissions('prompt');
    render(<LocationPicker value={null} onChange={vi.fn()} />);
    expect(document.querySelector('.location-picker .map-canvas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /current location/i })).toBeInTheDocument();
  });

  it('clicking "use my current location" reports rounded coordinates', async () => {
    setPermissions('prompt');
    setGeolocation({
      getCurrentPosition: (success: any) =>
        success({ coords: { latitude: 12.9715991, longitude: 77.5945663 } }),
    });
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /current location/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ lat: 12.971599, lng: 77.594566 }));
  });

  it('shows a toast when geolocation permission is denied', async () => {
    setPermissions('prompt');
    setGeolocation({
      getCurrentPosition: (_s: any, error: any) =>
        error({ code: 1, PERMISSION_DENIED: 1, message: 'denied' }),
    });
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /current location/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('auto-locates on mount when permission is already granted (no click)', async () => {
    setPermissions('granted');
    const getCurrentPosition = vi.fn((success: any) =>
      success({ coords: { latitude: 19.076, longitude: 72.8777 } }));
    setGeolocation({ getCurrentPosition });
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} autoLocate />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ lat: 19.076, lng: 72.8777 }));
  });

  it('does NOT auto-locate when permission is only "prompt"', async () => {
    setPermissions('prompt');
    const getCurrentPosition = vi.fn();
    setGeolocation({ getCurrentPosition });
    render(<LocationPicker value={null} onChange={vi.fn()} autoLocate />);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 20));
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('reverse-geocodes a dropped pin and reports the address', async () => {
    setPermissions('prompt');
    const onAddressFound = vi.fn();
    render(<LocationPicker value={null} onChange={vi.fn()} onAddressFound={onAddressFound} />);
    // simulate a map click via the captured leaflet handler
    expect(h.clickCb).toBeTypeOf('function');
    await act(async () => {
      h.clickCb({ latlng: { lat: 12.9716, lng: 77.5946 } });
    });
    await waitFor(() => expect(onAddressFound).toHaveBeenCalledWith('Indiranagar, Bengaluru'));
  });

  it('shows "Remove pin" only when a value is set and clears it on click', async () => {
    setPermissions('prompt');
    const onChange = vi.fn();
    const { rerender } = render(<LocationPicker value={null} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: /remove pin/i })).not.toBeInTheDocument();

    rerender(<LocationPicker value={{ lat: 12.97, lng: 77.59 }} onChange={onChange} />);
    const removeBtn = screen.getByRole('button', { name: /remove pin/i });
    await userEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
