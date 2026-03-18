import { PRESET_STREAMS } from './presets.js';
import { MetricsCollector } from './metrics.js';
import { loadStream, detectFormat, destroyStream } from './player.js';
import { init as initStreamInfo } from './panels/stream-info.js';
import { init as initBuffer } from './panels/buffer.js';
import { init as initNetwork } from './panels/network.js';
import { init as initTimeline } from './panels/timeline.js';
import { init as initEventsLog } from './panels/events-log.js';
import { init as initErrors } from './panels/errors.js';
import { init as initManifest } from './panels/manifest.js';
import { init as initMetadata } from './panels/metadata.js';
import { initDashboard, setupVideoWidget, toggleLock, isLocked, resetDashboardLayout } from './dashboard.js';

const metrics = new MetricsCollector();

// Panel init function registry
const panelInits = {
  'stream-info': initStreamInfo,
  'buffer': initBuffer,
  'network': initNetwork,
  'timeline': initTimeline,
  'events': initEventsLog,
  'errors': initErrors,
  'manifest': initManifest,
  'metadata': initMetadata,
};

// Initialize dashboard grid
initDashboard();

// Setup video widget and get references
let { videoEl, placeholder } = setupVideoWidget();

// Initialize all panels
Object.entries(panelInits).forEach(([id, initFn]) => {
  const el = document.getElementById(`panel-${id}`);
  if (el) initFn(el, metrics);
});

// DOM elements
const presetSelect = document.getElementById('preset-select');
const urlInput = document.getElementById('url-input');
const loadBtn = document.getElementById('load-btn');
const formatBadge = document.getElementById('format-badge');
const lockBtn = document.getElementById('lock-btn');
const resetBtn = document.getElementById('reset-layout-btn');

// Populate presets
PRESET_STREAMS.forEach(p => {
  const opt = document.createElement('option');
  opt.value = p.url;
  opt.textContent = p.name;
  if (p.disabled) opt.disabled = true;
  presetSelect.appendChild(opt);
});

presetSelect.addEventListener('change', () => {
  if (presetSelect.value) {
    urlInput.value = presetSelect.value;
    updateFormatBadge(presetSelect.value);
  }
});

urlInput.addEventListener('input', () => {
  updateFormatBadge(urlInput.value);
});

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLoad();
});

loadBtn.addEventListener('click', doLoad);

// Layout controls
lockBtn.addEventListener('click', () => {
  const nowLocked = toggleLock();
  lockBtn.textContent = nowLocked ? 'Unlock' : 'Lock';
  lockBtn.classList.toggle('active', !nowLocked);
});

resetBtn.addEventListener('click', () => {
  const refs = resetDashboardLayout(panelInits, metrics);
  if (refs) {
    videoEl = refs.videoEl;
    placeholder = refs.placeholder;
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

  if (e.key === ' ' && videoEl) {
    e.preventDefault();
    if (videoEl.paused) videoEl.play().catch(() => {});
    else videoEl.pause();
  }

  if (e.ctrlKey && e.key === 'l') {
    e.preventDefault();
    urlInput.focus();
    urlInput.select();
  }
});

// URL hash support
function checkUrlHash() {
  const hash = window.location.hash;
  if (hash.startsWith('#url=')) {
    const url = decodeURIComponent(hash.slice(5));
    urlInput.value = url;
    updateFormatBadge(url);
    doLoad();
  }
}

function doLoad() {
  const url = urlInput.value.trim();
  if (!url) return;

  window.location.hash = 'url=' + encodeURIComponent(url);

  if (videoEl) {
    videoEl.classList.add('active');
  }
  if (placeholder) {
    placeholder.classList.add('hidden');
  }

  loadStream(url, videoEl, metrics);
  updateFormatBadge(url);
}

function updateFormatBadge(url) {
  const format = detectFormat(url);
  if (format === 'hls') {
    formatBadge.textContent = 'HLS';
    formatBadge.className = 'badge hls';
  } else if (format === 'dash') {
    formatBadge.textContent = 'DASH';
    formatBadge.className = 'badge dash';
  } else {
    formatBadge.className = 'badge hidden';
  }
}

checkUrlHash();
