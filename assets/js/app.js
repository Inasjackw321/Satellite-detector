/**
 * ORBITAL — application bootstrap & state.
 * Pulls live NASA EONET disaster events, projects them onto Sentinel-2 imagery
 * and keeps the map / feed / gallery in sync with the active filters.
 */
import { fetchEvents } from './api.js';
import { initMap, setBasemap, plotEvents, flyTo } from './map.js';
import { initGallery, renderGallery } from './cards.js';
import {
  startClock,
  setLinkStatus,
  buildFilters,
  renderStats,
  renderFeed,
  renderLegend,
  initModal,
  openModal,
  boot,
} from './ui.js';

const state = {
  all: [],            // every normalised event
  activeCats: new Set(), // empty == all categories
  search: '',
  days: 20,
  live: false,
};

/** Apply category + search filters. */
function filtered() {
  const q = state.search.trim().toLowerCase();
  return state.all.filter((ev) => {
    if (state.activeCats.size && !state.activeCats.has(ev.categoryId)) return false;
    if (q && !ev.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Re-render every view from current state. */
function render() {
  const list = filtered();

  // sort newest acquisition first for feed + gallery
  const byDate = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

  const plotted = plotEvents(list);
  document.getElementById('map-readout').textContent = `${plotted} events plotted`;

  renderStats(state.all, list);
  renderFeed(byDate, handleSelect);
  renderGallery(byDate);
  buildFilters(state.all, state.activeCats, toggleCategory);
  renderLegend(state.all);

  document.getElementById('gallery-count').textContent = `${list.length} targets`;
}

function toggleCategory(id) {
  if (id === 'all') {
    state.activeCats.clear();
  } else if (state.activeCats.has(id)) {
    state.activeCats.delete(id);
  } else {
    state.activeCats.add(id);
  }
  render();
}

function handleSelect(ev) {
  flyTo(ev, 7);
  openModal(ev);
}

async function load() {
  const b = boot([1, 2, 3, 4]);
  b.step('Establishing downlink…');

  const { events, live } = await fetchEvents({ days: state.days, limit: 500 });
  state.all = events;
  state.live = live;

  b.step('Decoding telemetry…');
  setLinkStatus(live);

  b.step('Projecting onto Sentinel-2 imagery…');
  render();

  b.step('Calibrating optics…');
  b.done();
}

function wireControls() {
  document.getElementById('days').addEventListener('change', (e) => {
    state.days = Number(e.target.value);
    load();
  });

  document.getElementById('basemap').addEventListener('change', (e) => {
    setBasemap(e.target.value);
  });

  let searchTimer;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value;
      render();
    }, 180);
  });

  document.getElementById('refresh').addEventListener('click', load);
}

function main() {
  startClock();
  initMap('map', handleSelect);
  initGallery('gallery', 'load-more', openModal);
  initModal();
  wireControls();
  load();
}

document.addEventListener('DOMContentLoaded', main);
