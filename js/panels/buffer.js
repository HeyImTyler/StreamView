export function init(container, metrics) {
  container.innerHTML = `
    <h3>Forward Buffer</h3>
    <div class="buffer-bar-container">
      <div class="buffer-bar good" id="buf-bar"><span id="buf-bar-text">0.0s</span></div>
    </div>
    <div class="metric-row"><span class="metric-label">Buffer Length</span><span class="metric-value" id="buf-length">0.00s</span></div>
    <div class="metric-row"><span class="metric-label">Rebuffer Count</span><span class="metric-value" id="buf-rebuffers">0</span></div>
    <div class="metric-row"><span class="metric-label">Total Rebuffer Time</span><span class="metric-value" id="buf-rebuffer-dur">0ms</span></div>
    <div class="metric-row"><span class="metric-label">Status</span><span class="metric-value" id="buf-status">Idle</span></div>
    <h3>Buffer History (60s)</h3>
    <div class="buffer-chart-container"><canvas id="buf-chart"></canvas></div>
  `;

  const bar = container.querySelector('#buf-bar');
  const barText = container.querySelector('#buf-bar-text');
  const lengthEl = container.querySelector('#buf-length');
  const rebufEl = container.querySelector('#buf-rebuffers');
  const rebufDurEl = container.querySelector('#buf-rebuffer-dur');
  const statusEl = container.querySelector('#buf-status');
  const canvas = container.querySelector('#buf-chart');

  function updateUI(buf) {
    const len = buf.videoBufferLength;
    lengthEl.textContent = len.toFixed(2) + 's';
    rebufEl.textContent = buf.rebufferCount;
    rebufDurEl.textContent = buf.rebufferDuration + 'ms';
    statusEl.textContent = buf.isBuffering ? 'Buffering...' : 'OK';
    statusEl.style.color = buf.isBuffering ? 'var(--warning)' : 'var(--success)';

    // Buffer bar
    const pct = Math.min(100, (len / 15) * 100);
    bar.style.width = Math.max(pct, 8) + '%';
    barText.textContent = len.toFixed(1) + 's';

    if (len > 5) {
      bar.className = 'buffer-bar good';
    } else if (len > 2) {
      bar.className = 'buffer-bar ok';
    } else {
      bar.className = 'buffer-bar low';
    }

    drawChart(buf.history);
  }

  function drawChart(history) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (w === 0 || h === 0) return;

    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (history.length < 2) return;

    const maxVal = Math.max(15, ...history.map(p => p.length));
    const xStep = w / (120 - 1); // 120 max points

    // Grid lines
    ctx.strokeStyle = 'rgba(48, 54, 61, 0.5)';
    ctx.lineWidth = 0.5;
    for (let v = 5; v <= maxVal; v += 5) {
      const y = h - (v / maxVal) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(139, 148, 158, 0.5)';
      ctx.font = '9px sans-serif';
      ctx.fillText(v + 's', 2, y - 2);
    }

    // Buffer line
    const startIdx = Math.max(0, history.length - 120);
    ctx.beginPath();
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 1.5;

    for (let i = startIdx; i < history.length; i++) {
      const x = (i - startIdx) * xStep;
      const y = h - (history[i].length / maxVal) * h;
      if (i === startIdx) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under curve
    const lastX = (history.length - 1 - startIdx) * xStep;
    ctx.lineTo(lastX, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(88, 166, 255, 0.08)';
    ctx.fill();
  }

  metrics.on('buffer', updateUI);
  metrics.on('reset', () => updateUI({
    videoBufferLength: 0, rebufferCount: 0, rebufferDuration: 0, isBuffering: false, history: []
  }));

  // Redraw chart on resize
  new ResizeObserver(() => {
    if (metrics.buffer && metrics.buffer.history) {
      drawChart(metrics.buffer.history);
    }
  }).observe(canvas);
}
