export function init(container, metrics) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h3 style="margin:0">Timed Metadata / ID3 / SCTE-35</h3>
      <button class="clear-btn" id="meta-clear">Clear</button>
    </div>
    <div class="empty-state" id="meta-empty">Timed metadata events will appear here during playback</div>
    <div id="meta-list"></div>
  `;

  const list = container.querySelector('#meta-list');
  const emptyEl = container.querySelector('#meta-empty');
  const clearBtn = container.querySelector('#meta-clear');

  clearBtn.addEventListener('click', () => {
    metrics.clearMetadata();
    list.innerHTML = '';
    emptyEl.style.display = 'block';
  });

  metrics.on('metadata', (entry) => {
    if (entry === null) {
      list.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';

    const card = document.createElement('div');
    card.classList.add('metadata-card');

    card.innerHTML = `
      <div class="meta-header">
        <span class="meta-type-badge">${escapeHtml(entry.type)}</span>
        <span class="event-time">${metrics.formatTime(entry.time)}</span>
      </div>
      <div class="meta-details">
        <span>PTS: ${escapeHtml(String(entry.pts || '—'))}</span>
        ${entry.size ? `<span>Size: ${entry.size} bytes</span>` : ''}
        ${entry.key ? `<span>Key: ${escapeHtml(entry.key)}</span>` : ''}
        ${entry.value ? `<span>Value: ${escapeHtml(String(entry.value))}</span>` : ''}
      </div>
    `;

    if (list.firstChild) {
      list.insertBefore(card, list.firstChild);
    } else {
      list.appendChild(card);
    }

    // Cap entries
    while (list.children.length > 200) {
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
