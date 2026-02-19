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

// ─── Fetch ALL alternative routes from Directions API ────────
export interface AllRoutesResult {
  primary: RouteResult;
  alternatives: string[]; // encoded polylines for alternative routes
}

export async function fetchAllRoutes(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[] = [],
): Promise<AllRoutesResult> {
  const empty: AllRoutesResult = {
    primary: { coords: [], distance: '', duration: '', encodedPolyline: '' },
    alternatives: [],
  };
  try {
    // ── 1. Build primary route URL (with waypoints if any) ──
    let primaryUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${ENV.MAPS_API_KEY}`;
    if (waypoints.length > 0) {
      const wp = waypoints.map((w) => `${w.latitude},${w.longitude}`).join('|');
      primaryUrl += `&waypoints=${wp}`;
    }
    // Always request alternatives (works only when NO waypoints are present)
    const altUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&alternatives=true&key=${ENV.MAPS_API_KEY}`;

    // If waypoints exist, make TWO requests:
    //   1) primary with waypoints (the preferred route)
    //   2) without waypoints + alternatives=true (to get alternative routes)
    // If no waypoints, one request with alternatives=true is enough.
    const hasWaypoints = waypoints.length > 0;

    const [primaryRes, altRes] = await Promise.all(
      hasWaypoints
        ? [fetch(primaryUrl), fetch(altUrl)]
        : [fetch(altUrl), Promise.resolve(null)]
    );

    const primaryJson = await primaryRes.json();
    if (!primaryJson.routes?.length) return empty;

    // Parse primary route
    const first = primaryJson.routes[0];
    const legs = first.legs || [];
    const totalDist = legs.reduce((sum: number, l: any) => sum + (l.distance?.value || 0), 0);
    const totalDur = legs.reduce((sum: number, l: any) => sum + (l.duration?.value || 0), 0);
    const distText = totalDist < 1000 ? `${totalDist} m` : `${(totalDist / 1000).toFixed(1)} km`;
    const durText = totalDur < 3600
      ? `${Math.round(totalDur / 60)} min`
      : `${Math.floor(totalDur / 3600)}h ${Math.round((totalDur % 3600) / 60)}m`;
    const primaryPoly = first.overview_polyline?.points || '';

    // Collect alternative polylines
    const altPolylines: string[] = [];

    // Alternatives from the primary response (when no waypoints, the primary request IS the alt request)
    for (let i = 1; i < primaryJson.routes.length; i++) {
      const poly = primaryJson.routes[i].overview_polyline?.points;
      if (poly) altPolylines.push(poly);
    }

    // If we made a second request for alternatives (because waypoints blocked them)
    if (hasWaypoints && altRes) {
      const altJson = await altRes.json();
      if (altJson.routes?.length) {
        for (const route of altJson.routes) {
          const poly = route.overview_polyline?.points;
          // Don't add if it's the same as our primary
          if (poly && poly !== primaryPoly) altPolylines.push(poly);
        }
      }
    }

    console.log(`[fetchAllRoutes] Primary route: ${primaryPoly.length} chars, Alternatives: ${altPolylines.length}`);

    return {
      primary: {
        coords: primaryPoly ? decodePolyline(primaryPoly) : [],
        distance: distText,
        duration: durText,
        encodedPolyline: primaryPoly,
      },
      alternatives: altPolylines,
    };
  } catch (e) {
    console.warn('Directions API alternatives error:', e);
  }
  return empty;
}

// ─── Forward geocode (address → lat,lng) ────────────────────
export async function geocodeAddress(
  address: string,
): Promise<{ latitude: number; longitude: number; formattedAddress: string } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${ENV.MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.results?.length > 0) {
      const loc = json.results[0].geometry.location;
      return {
        latitude: loc.lat,
        longitude: loc.lng,
        formattedAddress: json.results[0].formatted_address,
      };
    }
  } catch (e) {
    console.warn('Geocode error:', e);
  }
  return null;
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
