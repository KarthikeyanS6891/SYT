import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet resolves its default marker icons relative to the stylesheet, which
// breaks under Vite's asset pipeline — point them at the bundled files instead.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export const addTiles = (map: L.Map) =>
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  }).addTo(map);

export interface LatLng {
  lat: number;
  lng: number;
}

// Fallback view covering India when there is no pin yet.
export const DEFAULT_CENTER: LatLng = { lat: 20.5937, lng: 78.9629 };
export const DEFAULT_ZOOM = 5;
export const PIN_ZOOM = 15;

export default L;
