const STORAGE_KEY = 'streamview-layout-v2';

const PANEL_DEFS = [
  { id: 'video-player', title: 'Video Player',  w: 8, h: 7, x: 0, y: 0,  minW: 3, minH: 3 },
  { id: 'stream-info',  title: 'Stream Info',    w: 4, h: 7, x: 8, y: 0,  minW: 3, minH: 3 },
  { id: 'buffer',       title: 'Buffer',         w: 4, h: 5, x: 0, y: 7,  minW: 3, minH: 3 },
  { id: 'network',      title: 'Network',        w: 4, h: 5, x: 4, y: 7,  minW: 3, minH: 3 },
  { id: 'timeline',     title: 'Timeline',       w: 4, h: 5, x: 8, y: 7,  minW: 3, minH: 3 },
  { id: 'events',       title: 'Events',         w: 4, h: 5, x: 0, y: 12, minW: 3, minH: 3 },
  { id: 'errors',       title: 'Errors',         w: 4, h: 5, x: 4, y: 12, minW: 3, minH: 3 },
  { id: 'manifest',     title: 'Manifest',       w: 4, h: 5, x: 8, y: 12, minW: 3, minH: 3 },
  { id: 'metadata',     title: 'Metadata',       w: 4, h: 5, x: 0, y: 17, minW: 3, minH: 3 },
];

let grid = null;
let locked = true;

export function initDashboard() {
  const saved = loadLayout();
  const layout = saved || PANEL_DEFS;

  grid = GridStack.init({
    column: 12,
    cellHeight: 60,
    margin: 4,
    animate: true,
    float: false,
    disableResize: locked,
    disableDrag: locked,
    resizable: { handles: 'se,sw,e,w,s' },
    draggable: { handle: '.widget-header' },
  }, '#dashboard');

  layout.forEach(def => {
    const widgetHtml = createWidgetHtml(def);
    grid.addWidget(widgetHtml, {
      x: def.x, y: def.y, w: def.w, h: def.h,
      minW: def.minW || 3, minH: def.minH || 3,
      id: def.id,
    });
  });

  grid.on('change', () => saveLayout());

  // Responsive
  handleResponsive();

  return grid;
}

function createWidgetHtml(def) {
  const el = document.createElement('div');
  el.classList.add('grid-stack-item');
  el.setAttribute('gs-id', def.id);
  el.setAttribute('gs-w', def.w);
  el.setAttribute('gs-h', def.h);
  el.setAttribute('gs-x', def.x);
  el.setAttribute('gs-y', def.y);
  if (def.minW) el.setAttribute('gs-min-w', def.minW);
  if (def.minH) el.setAttribute('gs-min-h', def.minH);

  el.innerHTML = `
    <div class="grid-stack-item-content widget-card">
      <div class="widget-header">
        <span class="widget-title">${def.title}</span>
      </div>
      <div class="widget-body" id="panel-${def.id}"></div>
    </div>
  `;
  return el;
}

export function setupVideoWidget() {
  const container = document.getElementById('panel-video-player');
  if (!container) return;

  const template = document.getElementById('video-template');
  const content = template.content.cloneNode(true);
  container.appendChild(content);

  return {
    videoEl: container.querySelector('#video-player'),
    placeholder: container.querySelector('#player-placeholder'),
  };
}

export function toggleLock() {
  locked = !locked;
  if (grid) {
    grid.enableMove(!locked);
    grid.enableResize(!locked);
  }
  return locked;
}

export function isLocked() {
  return locked;
}

export function resetDashboardLayout(panelInits, metrics) {
  if (!grid) return;
  grid.removeAll();
  PANEL_DEFS.forEach(def => {
    const widgetHtml = createWidgetHtml(def);
    grid.addWidget(widgetHtml, {
      x: def.x, y: def.y, w: def.w, h: def.h,
      minW: def.minW || 3, minH: def.minH || 3,
      id: def.id,
    });
  });
  localStorage.removeItem(STORAGE_KEY);

  // Re-setup video and re-init panels
  const videoRefs = setupVideoWidget();
  Object.entries(panelInits).forEach(([id, initFn]) => {
    const el = document.getElementById(`panel-${id}`);
    if (el) initFn(el, metrics);
  });

  return videoRefs;
}

function saveLayout() {
  if (!grid) return;
  const items = grid.getGridItems().map(el => {
    const node = el.gridstackNode;
    return {
      id: node.id,
      x: node.x, y: node.y,
      w: node.w, h: node.h,
      minW: node.minW, minH: node.minH,
      title: PANEL_DEFS.find(d => d.id === node.id)?.title || node.id,
    };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const items = JSON.parse(raw);
    const ids = new Set(items.map(i => i.id));
    const required = PANEL_DEFS.map(d => d.id);
    if (!required.every(id => ids.has(id))) return null;
    // Merge titles from PANEL_DEFS
    return items.map(item => ({
      ...item,
      title: PANEL_DEFS.find(d => d.id === item.id)?.title || item.title || item.id,
    }));
  } catch {
    return null;
  }
}

function handleResponsive() {
  if (!grid) return;
  const mq = window.matchMedia('(max-width: 768px)');
  function apply(e) {
    grid.column(e.matches ? 1 : 12);
  }
  mq.addEventListener('change', apply);
  apply(mq);
}
