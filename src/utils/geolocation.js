/**
 * Extract a meaningful short address from a Nominatim address object.
 * Prioritizes city/town/municipality, then broader administrative areas.
 */
export function extractShortAddress(addressComponents) {
  if (!addressComponents) return 'Unknown';
  const addr = addressComponents;

  // Preferred locality keys for the Philippines (order matters)
  const candidates = [
    addr.city,
    addr.town,
    addr.municipality,
    addr.district,
    addr.suburb,
    addr.county,
    addr.state_district,
    addr.state,
  ];
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  // Ultimate fallback: try the first part of the display_name, but ignore very short ones
  return 'Unknown';
}

export async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject('Geolocation not available');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          const fullAddress = data.display_name || 'Unknown location';
          const short = extractShortAddress(data.address || {});
          resolve({
            lat: latitude,
            lng: longitude,
            address: fullAddress,
            shortAddress: short || fullAddress.split(',')[0], // fallback if nothing found
          });
        } catch {
          resolve({
            lat: latitude,
            lng: longitude,
            address: 'Unknown location',
            shortAddress: 'Unknown location',
          });
        }
      },
      reject,
      { enableHighAccuracy: true }
    );
  });
}