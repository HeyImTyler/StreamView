export function init(container, metrics) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h3 style="margin:0">Raw Manifest</h3>
      <button class="clear-btn" id="manifest-copy">Copy</button>
    </div>
    <div class="empty-state" id="manifest-empty">Manifest will appear here when a stream is loaded</div>
    <pre id="manifest-text" class="manifest-pre"></pre>
  `;

  const textEl = container.querySelector('#manifest-text');
  const emptyEl = container.querySelector('#manifest-empty');
  const copyBtn = container.querySelector('#manifest-copy');

  copyBtn.addEventListener('click', () => {
    if (metrics.manifestText) {
      navigator.clipboard.writeText(metrics.manifestText).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    }
  });

  metrics.on('manifest', (text) => {
    if (!text) {
      emptyEl.style.display = 'block';
      textEl.style.display = 'none';
      return;
    }
    emptyEl.style.display = 'none';
    textEl.style.display = 'block';
    textEl.textContent = text;
  });

  metrics.on('reset', () => {
    emptyEl.style.display = 'block';
    textEl.style.display = 'none';
    textEl.textContent = '';
  });
}
