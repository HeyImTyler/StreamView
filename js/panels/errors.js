export function init(container, metrics) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h3 style="margin:0">Errors</h3>
      <button class="clear-btn" id="err-clear">Clear</button>
    </div>
    <div id="err-list"></div>
    <div class="no-errors" id="err-empty">No errors</div>
  `;

  const list = container.querySelector('#err-list');
  const emptyEl = container.querySelector('#err-empty');
  const clearBtn = container.querySelector('#err-clear');

  clearBtn.addEventListener('click', () => {
    metrics.clearErrors();
    list.innerHTML = '';
    emptyEl.style.display = 'block';
  });

  function renderError(err) {
    emptyEl.style.display = 'none';

    const card = document.createElement('div');
    card.classList.add('error-card');
    if (!err.fatal) card.classList.add('non-fatal');

    const detailsSection = err.details && err.details !== err.message
      ? `<details><summary>Details</summary><pre>${escapeHtml(typeof err.details === 'string' ? err.details : JSON.stringify(err.details, null, 2))}</pre></details>`
      : '';

    card.innerHTML = `
      <div class="error-header">
        <span class="error-type">${escapeHtml(err.type || 'ERROR')}</span>
        <span class="error-fatal-badge ${err.fatal ? 'fatal' : 'non-fatal'}">${err.fatal ? 'Fatal' : 'Non-Fatal'}</span>
      </div>
      <div class="error-message">${escapeHtml(err.message || 'Unknown error')}</div>
      ${detailsSection}
      <div class="error-time">${metrics.formatTime(err.time)}</div>
    `;

    if (list.firstChild) {
      list.insertBefore(card, list.firstChild);
    } else {
      list.appendChild(card);
    }
  }

  metrics.on('errors', (entry) => {
    if (entry === null) {
      // clearErrors was called
      list.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    renderError(entry);
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
