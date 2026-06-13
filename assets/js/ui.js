/**
 * ORBITAL — DOM / UI controls.
 * Filters, stats, event feed, legend, live clock, link-status pill and the
 * full detail modal.
 */
import { categoryMeta } from './config.js';
import { buildMiniMap } from './cards.js';
import {
  formatLatLon,
  formatLatLonDecimal,
  formatDate,
  timeAgo,
  esc,
} from './format.js';

/* ----------------------------- live clock ----------------------------- */
export function startClock() {
  const el = document.getElementById('clock');
  const tick = () => {
    el.textContent = new Date().toISOString().slice(11, 19) + ' UTC';
  };
  tick();
  setInterval(tick, 1000);
}

/* ----------------------------- link status ----------------------------- */
export function setLinkStatus(live) {
  const pill = document.getElementById('link-status');
  const label = document.getElementById('link-label');
  pill.classList.toggle('is-offline', !live);
  label.textContent = live ? 'LIVE · NASA EONET' : 'OFFLINE · SAMPLE';
}

/* ------------------------------- filters ------------------------------- */
export function buildFilters(events, active, onToggle) {
  const wrap = document.getElementById('filters');
  const counts = new Map();
  for (const ev of events) {
    counts.set(ev.categoryId, (counts.get(ev.categoryId) || 0) + 1);
  }

  const ids = [...counts.keys()].sort(
    (a, b) => counts.get(b) - counts.get(a)
  );

  wrap.innerHTML = '';
  // "ALL" chip
  wrap.appendChild(
    chip('all', 'ALL', events.length, '#7cf3c0', active.size === 0, onToggle)
  );
  for (const id of ids) {
    const meta = categoryMeta(id);
    wrap.appendChild(
      chip(id, meta.title, counts.get(id), meta.color, active.has(id), onToggle, meta.icon)
    );
  }
}

function chip(id, label, count, color, isOn, onToggle, icon = '') {
  const b = document.createElement('button');
  b.className = `fchip ${isOn ? 'is-on' : ''}`;
  b.style.setProperty('--c', color);
  b.innerHTML = `${icon ? `<span class="fchip__icon">${icon}</span>` : ''}<span>${esc(label)}</span><span class="fchip__n">${count}</span>`;
  b.addEventListener('click', () => onToggle(id));
  return b;
}

/* -------------------------------- stats -------------------------------- */
export function renderStats(allEvents, filtered) {
  const el = document.getElementById('stats');
  const active = allEvents.filter((e) => !e.closed).length;
  const cats = new Set(allEvents.map((e) => e.categoryId)).size;
  const newest = allEvents
    .map((e) => e.date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const tiles = [
    { k: 'TRACKED EVENTS', v: allEvents.length },
    { k: 'ACTIVE NOW', v: active, accent: '#ff5b3a' },
    { k: 'CATEGORIES', v: cats },
    { k: 'IN VIEW', v: filtered.length, accent: '#39d0ff' },
    { k: 'LATEST ACQ', v: timeAgo(newest), small: true },
  ];

  el.innerHTML = tiles
    .map(
      (t) => `
      <div class="stat">
        <div class="stat__v ${t.small ? 'stat__v--sm' : ''}" ${
        t.accent ? `style="color:${t.accent}"` : ''
      }>${esc(t.v)}</div>
        <div class="stat__k">${t.k}</div>
      </div>`
    )
    .join('');
}

/* -------------------------------- feed --------------------------------- */
export function renderFeed(events, onSelect) {
  const ul = document.getElementById('feed');
  const count = document.getElementById('feed-count');
  count.textContent = String(events.length);
  ul.innerHTML = '';

  for (const ev of events.slice(0, 120)) {
    const meta = categoryMeta(ev.categoryId);
    const li = document.createElement('li');
    li.className = 'feed__row';
    li.style.setProperty('--c', meta.color);
    li.innerHTML = `
      <span class="feed__icon">${meta.icon}</span>
      <span class="feed__body">
        <span class="feed__title">${esc(ev.title)}</span>
        <span class="feed__meta mono">${esc(meta.title)} · ${formatLatLonDecimal(ev.lat, ev.lon)}</span>
      </span>
      <span class="feed__time mono">${timeAgo(ev.date)}</span>`;
    li.addEventListener('click', () => onSelect(ev));
    ul.appendChild(li);
  }
}

/* ------------------------------- legend -------------------------------- */
export function renderLegend(events) {
  const el = document.getElementById('legend');
  const ids = [...new Set(events.map((e) => e.categoryId))];
  el.innerHTML = ids
    .map((id) => {
      const m = categoryMeta(id);
      return `<span class="legend__item"><span class="legend__dot" style="background:${m.color}"></span>${esc(m.title)}</span>`;
    })
    .join('');
}

/* -------------------------------- modal -------------------------------- */
let modalMap = null;

export function initModal() {
  const modal = document.getElementById('modal');
  modal.querySelectorAll('[data-close]').forEach((el) =>
    el.addEventListener('click', closeModal)
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

export function openModal(ev) {
  const modal = document.getElementById('modal');
  const meta = categoryMeta(ev.categoryId);

  modal.querySelector('#modal-cat').textContent = `${meta.icon} ${ev.categoryTitle}`;
  modal.querySelector('#modal-cat').style.color = meta.color;
  modal.querySelector('#modal-title').textContent = ev.title;

  const mag =
    ev.magnitudeValue != null
      ? `${ev.magnitudeValue} ${ev.magnitudeUnit || ''}`.trim()
      : '—';

  const rows = [
    ['Status', ev.closed ? 'Closed' : 'Active'],
    ['Coordinates', formatLatLon(ev.lat, ev.lon)],
    ['Decimal', formatLatLonDecimal(ev.lat, ev.lon)],
    ['Acquisition', `${formatDate(ev.date)} (${timeAgo(ev.date)})`],
    ['Magnitude', mag],
    ['Geometry pts', ev.points],
    ['Imagery', 'Sentinel-2 MSI · cloudless mosaic'],
  ];
  modal.querySelector('#modal-dl').innerHTML = rows
    .map(
      ([k, v]) =>
        `<dt>${esc(k)}</dt><dd class="mono">${esc(v)}</dd>`
    )
    .join('');

  const links = [];
  if (ev.link) links.push(['NASA EONET record', ev.link]);
  for (const s of ev.sources || []) {
    if (s.url) links.push([`Source · ${s.id}`, s.url]);
  }
  links.push([
    'Open in Sentinel Hub EO Browser',
    `https://apps.sentinel-hub.com/eo-browser/?lat=${ev.lat}&lng=${ev.lon}&zoom=11`,
  ]);
  modal.querySelector('#modal-links').innerHTML = links
    .map(
      ([t, u]) =>
        `<a class="modal__link" href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`
    )
    .join('');

  modal.hidden = false;
  document.body.classList.add('no-scroll');

  // (re)build the interactive inspection map
  const mapEl = modal.querySelector('#modal-map');
  if (modalMap) {
    modalMap.remove();
    modalMap = null;
  }
  mapEl.innerHTML = '';
  modalMap = buildMiniMap(mapEl, ev, { interactive: true });
  setTimeout(() => modalMap && modalMap.invalidateSize(), 120);
}

export function closeModal() {
  const modal = document.getElementById('modal');
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove('no-scroll');
  if (modalMap) {
    modalMap.remove();
    modalMap = null;
  }
}

/* ----------------------------- boot screen ----------------------------- */
export function boot(steps) {
  const fill = document.getElementById('boot-fill');
  const status = document.getElementById('boot-status');
  let i = 0;
  const total = steps.length;
  return {
    step(msg) {
      i += 1;
      if (status) status.textContent = msg;
      if (fill) fill.style.width = `${Math.round((i / total) * 100)}%`;
    },
    done() {
      const el = document.getElementById('boot');
      if (fill) fill.style.width = '100%';
      setTimeout(() => el && el.classList.add('is-hidden'), 350);
    },
  };
}
