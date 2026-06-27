import { useEffect, useRef } from 'react';
import L, { addTiles } from './leaflet';

const DETAIL_ZOOM = 14;

interface ListingMapProps {
  lat: number;
  lng: number;
  /** Popup text for the marker, e.g. the listing's location name. */
  label?: string;
}

export const ListingMap = ({ lat, lng, label }: ListingMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: DETAIL_ZOOM,
      scrollWheelZoom: false,
    });
    addTiles(map);
    markerRef.current = L.marker([lat, lng]).addTo(map);
    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The component stays mounted when navigating between listings, so follow
  // coordinate changes instead of relying on a remount.
  useEffect(() => {
    mapRef.current?.setView([lat, lng], DETAIL_ZOOM);
    markerRef.current?.setLatLng([lat, lng]);
  }, [lat, lng]);

  useEffect(() => {
    if (!markerRef.current) return;
    if (label) markerRef.current.bindPopup(label);
    else markerRef.current.unbindPopup();
  }, [label]);

  return (
    <div className="listing-map">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-actions">
        <a
          className="map-link"
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
        >
          Get directions ↗
        </a>
        <a
          className="map-link"
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
          target="_blank"
          rel="noreferrer"
        >
          View larger map ↗
        </a>
      </div>
    </div>
  );
};
