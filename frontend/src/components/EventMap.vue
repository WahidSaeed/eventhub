<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import api from '../services/api';

const props = defineProps({
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  label: { type: String, default: '' }
});

const mapEl = ref(null);
const status = ref('loading');

// The browser key is served at runtime by /api/config so one built image can run
// with different keys. It is a separate, referrer-restricted key from the
// server-side geocoding key.
let loaderPromise = null;
function loadMapsApi(key) {
  if (window.google && window.google.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

async function render() {
  if (props.lat === null || props.lng === null) {
    status.value = 'no-location';
    return;
  }

  try {
    const { googleMapsApiKey } = await api.get('/config');
    if (!googleMapsApiKey) {
      status.value = 'no-key';
      return;
    }

    await loadMapsApi(googleMapsApiKey);

    // Reveal the container before constructing the map. Google Maps measures
    // the element once at construction, so building it while v-show still has
    // the element at display:none produces a grey box with misplaced tiles.
    status.value = 'ready';
    await nextTick();

    const position = { lat: props.lat, lng: props.lng };
    const map = new window.google.maps.Map(mapEl.value, {
      center: position,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });
    new window.google.maps.Marker({ map, position, title: props.label });
  } catch (err) {
    status.value = 'error';
  }
}

onMounted(render);
watch(() => [props.lat, props.lng], render);
</script>

<template>
  <div>
    <div v-show="status === 'ready'" ref="mapEl" class="h-64 w-full border border-rule"></div>

    <p v-if="status === 'no-location'" class="event-meta">
      This venue has not been placed on the map yet.
    </p>
    <p v-else-if="status === 'no-key'" class="event-meta">
      Map unavailable: no browser Maps key is configured.
    </p>
    <p v-else-if="status === 'error'" class="event-meta">
      The map could not be loaded.
    </p>
    <p v-else-if="status === 'loading'" class="event-meta">Loading map</p>
  </div>
</template>
