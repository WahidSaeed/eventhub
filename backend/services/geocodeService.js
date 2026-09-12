const KEY = () => process.env.GOOGLE_MAPS_API_KEY;

// Resolves a free-text address to coordinates. Returns null when no key is
// configured or the address cannot be resolved: geocoding is an enhancement,
// so a failure here must never block creating an event.
async function geocodeAddress(address) {
  if (!address || !KEY()) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${KEY()}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.results.length) {
      console.warn(`Geocoding returned ${data.status} for address: ${address}`);
      return null;
    }
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  } catch (err) {
    console.warn(`Geocoding request failed: ${err.message}`);
    return null;
  }
}

module.exports = { geocodeAddress };
