export function init(container, metrics) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h3 style="margin:0">Player Events</h3>
      <button class="clear-btn" id="evt-clear">Clear</button>
    </div>
    <ul class="events-list" id="evt-list"></ul>
    <div class="empty-state" id="evt-empty">Events will appear here during playback</div>
  `;

  const list = container.querySelector('#evt-list');
  const emptyEl = container.querySelector('#evt-empty');
  const clearBtn = container.querySelector('#evt-clear');

  clearBtn.addEventListener('click', () => {
    metrics.events = [];
    list.innerHTML = '';
    emptyEl.style.display = 'block';
  });

  metrics.on('events', (entry) => {
    emptyEl.style.display = 'none';

    const li = document.createElement('li');
    li.classList.add('event-entry');
    li.innerHTML = `
      <span class="event-time">${metrics.formatTime(entry.time)}</span>
      <span class="event-badge ${entry.severity}">${escapeHtml(entry.severity)}</span>
      <span class="event-message">${escapeHtml(entry.type)}: ${escapeHtml(entry.message)}</span>
    `;

    if (list.firstChild) {
      list.insertBefore(li, list.firstChild);
    } else {
      list.appendChild(li);
    }

    // Cap DOM entries
    while (list.children.length > 500) {
      list.removeChild(list.lastChild);
    }
  });

  metrics.on('reset', () => {
    list.innerHTML = '';
    emptyEl.style.display = 'block';
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
