import { LatLng } from 'react-native-maps';
import ENV from '../constants/config';

// ─── Decode Google encoded polyline → coordinate array ───────
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

// ─── Encode coordinate array → Google encoded polyline ───────
export function encodePolyline(coords: LatLng[]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const { latitude, longitude } of coords) {
    const lat = Math.round(latitude * 1e5);
    const lng = Math.round(longitude * 1e5);

    encoded += encodeValue(lat - prevLat);
    encoded += encodeValue(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }
  return encoded;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let encoded = '';
  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
}

// ─── Return type for fetchRoute ──────────────────────────────
export interface RouteResult {
  coords: LatLng[];
  distance: string;
  duration: string;
  encodedPolyline: string;
}

// ─── Fetch Directions API route (road-following) ─────────────
export async function fetchRoute(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[] = [],
): Promise<RouteResult> {
  try {
    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${ENV.MAPS_API_KEY}`;
    if (waypoints.length > 0) {
      const wp = waypoints.map((w) => `${w.latitude},${w.longitude}`).join('|');
      url += `&waypoints=${wp}`;
    }
    const res = await fetch(url);
    const json = await res.json();
    if (json.routes?.length > 0) {
      const route = json.routes[0];
      const legs = route.legs || [];
      const totalDist = legs.reduce((sum: number, l: any) => sum + (l.distance?.value || 0), 0);
      const totalDur = legs.reduce((sum: number, l: any) => sum + (l.duration?.value || 0), 0);
      const distText =
        totalDist < 1000 ? `${totalDist} m` : `${(totalDist / 1000).toFixed(1)} km`;
      const durText =
        totalDur < 3600
          ? `${Math.round(totalDur / 60)} min`
          : `${Math.floor(totalDur / 3600)}h ${Math.round((totalDur % 3600) / 60)}m`;
      const rawPoly = route.overview_polyline?.points || '';
      return {
        coords: rawPoly ? decodePolyline(rawPoly) : [],
        distance: distText,
        duration: durText,
        encodedPolyline: rawPoly,
      };
    }
  } catch (e) {
    console.warn('Directions API error:', e);
  }
  return { coords: [], distance: '', duration: '', encodedPolyline: '' };
}

// ─── Reverse geocode ─────────────────────────────────────────
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${ENV.MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.results?.length > 0) {
      return json.results[0].formatted_address;
    }
  } catch {}
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
