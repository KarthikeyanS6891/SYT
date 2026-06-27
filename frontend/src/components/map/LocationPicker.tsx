import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import L, { addTiles, DEFAULT_CENTER, DEFAULT_ZOOM, PIN_ZOOM, LatLng } from './leaflet';
import { Button } from '@/components/common/Button';

// Best-effort "Area, City" lookup via OpenStreetMap's free Nominatim service.
const reverseGeocode = async ({ lat, lng }: LatLng): Promise<string | null> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&accept-language=en`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const parts = [
      a.suburb || a.neighbourhood || a.village || a.town,
      a.city || a.town || a.state_district || a.county,
      a.state,
    ].filter(Boolean) as string[];
    const unique = [...new Set(parts)].slice(0, 2);
    if (unique.length) return unique.join(', ');
    return typeof data.display_name === 'string'
      ? data.display_name.split(',').slice(0, 2).join(',').trim()
      : null;
  } catch {
    return null;
  }
};

interface LocationPickerProps {
  value: LatLng | null;
  onChange: (coords: LatLng | null) => void;
  /** Called with a human-readable area name after a pin is placed. */
  onAddressFound?: (address: string) => void;
  /** Drop a pin automatically on mount when geolocation permission is already granted (never prompts). */
  autoLocate?: boolean;
}

export const LocationPicker = ({ value, onChange, onAddressFound, autoLocate }: LocationPickerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const autoLocatedRef = useRef(false);
  const [locating, setLocating] = useState(false);

  const onChangeRef = useRef(onChange);
  const onAddressFoundRef = useRef(onAddressFound);
  useEffect(() => {
    onChangeRef.current = onChange;
    onAddressFoundRef.current = onAddressFound;
  });

  const pick = useCallback((coords: LatLng) => {
    const rounded = { lat: +coords.lat.toFixed(6), lng: +coords.lng.toFixed(6) };
    onChangeRef.current(rounded);
    reverseGeocode(rounded).then((address) => {
      if (address) onAddressFoundRef.current?.(address);
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: value ? [value.lat, value.lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: value ? PIN_ZOOM : DEFAULT_ZOOM,
    });
    addTiles(map);
    map.on('click', (e: L.LeafletMouseEvent) => pick({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);

  // Keep the marker in sync with the controlled value (map clicks, drags,
  // geolocation, and the edit form loading an existing pin all land here).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const latlng = L.latLng(value.lat, value.lng);
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
    } else {
      markerRef.current = L.marker(latlng, { draggable: true })
        .addTo(map)
        .on('dragend', () => {
          const p = markerRef.current?.getLatLng();
          if (p) pick({ lat: p.lat, lng: p.lng });
        });
    }
    if (map.getZoom() < 12) map.flyTo(latlng, PIN_ZOOM);
    else if (!map.getBounds().contains(latlng)) map.panTo(latlng);
  }, [value, pick]);

  const locate = useCallback(
    (interactive: boolean) => {
      if (!navigator.geolocation) {
        if (interactive) toast.error('Geolocation is not supported by your browser');
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          pick({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          setLocating(false);
          if (!interactive) return;
          toast.error(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission denied — click the map to drop a pin instead'
              : 'Could not detect your location'
          );
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    },
    [pick]
  );

  // When the user has already granted location access (e.g. chose "allow on
  // every visit"), pin their position right away — no prompt, no extra click.
  useEffect(() => {
    if (!autoLocate || value || autoLocatedRef.current) return;
    autoLocatedRef.current = true;
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (status.state === 'granted') locate(false);
      })
      .catch(() => null);
  }, [autoLocate, value, locate]);

  return (
    <div className="location-picker">
      <div className="map-actions">
        <Button type="button" size="sm" variant="secondary" onClick={() => locate(true)} loading={locating}>
          📍 Use my current location
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            Remove pin
          </Button>
        )}
      </div>
      <div ref={containerRef} className="map-canvas" />
      <div className="text-xs muted" style={{ marginTop: 6 }}>
        Click the map to drop a pin or drag it to adjust. Buyers will see this spot on your listing.
      </div>
    </div>
  );
};
