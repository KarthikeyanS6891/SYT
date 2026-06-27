import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Leaflet manipulates real DOM geometry that jsdom lacks, so we mock our wrapper.
const h = vi.hoisted(() => ({ markers: [] as any[], maps: [] as any[] }));
vi.mock('./leaflet', () => {
  const makeMarker = () => {
    const m: any = {
      addTo: vi.fn(() => m),
      setLatLng: vi.fn(() => m),
      bindPopup: vi.fn(() => m),
      unbindPopup: vi.fn(() => m),
      on: vi.fn(() => m),
      remove: vi.fn(),
    };
    h.markers.push(m);
    return m;
  };
  const makeMap = () => {
    const map: any = {
      on: vi.fn(() => map),
      setView: vi.fn(() => map),
      panTo: vi.fn(),
      flyTo: vi.fn(),
      getZoom: vi.fn(() => 14),
      getBounds: vi.fn(() => ({ contains: () => true })),
      invalidateSize: vi.fn(),
      remove: vi.fn(),
    };
    h.maps.push(map);
    return map;
  };
  const L = { map: vi.fn(makeMap), marker: vi.fn(makeMarker), latLng: (lat: number, lng: number) => ({ lat, lng }) };
  return { default: L, addTiles: vi.fn(), DEFAULT_CENTER: { lat: 20.59, lng: 78.96 }, DEFAULT_ZOOM: 5, PIN_ZOOM: 15 };
});

import { ListingMap } from './ListingMap';

describe('ListingMap', () => {
  it('renders a map container and a marker at the coordinates', () => {
    render(<ListingMap lat={12.9716} lng={77.5946} label="Bengaluru" />);
    expect(document.querySelector('.listing-map .map-canvas')).toBeInTheDocument();
    expect(h.maps.length).toBeGreaterThanOrEqual(1);
    expect(h.markers.length).toBeGreaterThanOrEqual(1);
    expect(h.markers[h.markers.length - 1].bindPopup).toHaveBeenCalledWith('Bengaluru');
  });

  it('renders Google Maps directions and OpenStreetMap links with the coordinates', () => {
    render(<ListingMap lat={13.0827} lng={80.2707} />);
    const dir = screen.getByText(/get directions/i).closest('a')!;
    const osm = screen.getByText(/larger map/i).closest('a')!;
    expect(dir).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=13.0827,80.2707');
    expect(dir).toHaveAttribute('target', '_blank');
    expect(osm.getAttribute('href')).toContain('mlat=13.0827');
    expect(osm.getAttribute('href')).toContain('mlon=80.2707');
  });

  it('updates the marker/view when coordinates change (component stays mounted)', () => {
    const { rerender } = render(<ListingMap lat={12.9716} lng={77.5946} />);
    const marker = h.markers[h.markers.length - 1];
    const map = h.maps[h.maps.length - 1];
    rerender(<ListingMap lat={19.076} lng={72.8777} />);
    expect(marker.setLatLng).toHaveBeenCalledWith([19.076, 72.8777]);
    expect(map.setView).toHaveBeenCalledWith([19.076, 72.8777], expect.any(Number));
  });

  it('removes the leaflet map on unmount', () => {
    const { unmount } = render(<ListingMap lat={1} lng={2} />);
    const map = h.maps[h.maps.length - 1];
    unmount();
    expect(map.remove).toHaveBeenCalled();
  });
});
