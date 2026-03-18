export function init(container, metrics) {
  container.innerHTML = `
    <h3>Quality Level Over Time</h3>
    <canvas id="timeline-canvas"></canvas>
    <div class="empty-state" id="timeline-empty">Quality changes will appear here during playback</div>
  `;

  const canvas = container.querySelector('#timeline-canvas');
  const emptyEl = container.querySelector('#timeline-empty');

  function draw(timeline) {
    if (!timeline || timeline.length === 0) {
      canvas.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    canvas.style.display = 'block';
    emptyEl.style.display = 'none';

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

    const padding = { top: 20, bottom: 25, left: 50, right: 10 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Determine scales
    const allBitrates = timeline.map(p => p.bitrate).filter(Boolean);
    const levels = metrics.streamInfo.levels || [];
    const allLevelBitrates = levels.map(l => l.bitrate);
    const maxBitrate = Math.max(...allBitrates, ...allLevelBitrates, 1);
    const minTime = timeline[0].time;
    const maxTime = timeline[timeline.length - 1].time;
    const timeRange = Math.max(maxTime - minTime, 1000);

    const xScale = (t) => padding.left + ((t - minTime) / timeRange) * plotW;
    const yScale = (b) => padding.top + plotH - (b / maxBitrate) * plotH;

    // Draw level reference lines
    ctx.strokeStyle = 'rgba(48, 54, 61, 0.6)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    levels.forEach(l => {
      const y = yScale(l.bitrate);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(139, 148, 158, 0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatBitrate(l.bitrate), padding.left - 4, y + 3);
    });
    ctx.setLineDash([]);

    // Draw step chart
    ctx.beginPath();
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;

    for (let i = 0; i < timeline.length; i++) {
      const x = xScale(timeline[i].time);
      const y = yScale(timeline[i].bitrate || 0);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Step: horizontal then vertical
        const prevY = yScale(timeline[i - 1].bitrate || 0);
        ctx.lineTo(x, prevY);
        ctx.lineTo(x, y);
      }
    }

    // Extend to current time
    const lastPoint = timeline[timeline.length - 1];
    const nowX = padding.left + plotW;
    ctx.lineTo(nowX, yScale(lastPoint.bitrate || 0));
    ctx.stroke();

    // Fill under
    ctx.lineTo(nowX, padding.top + plotH);
    ctx.lineTo(xScale(timeline[0].time), padding.top + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(88, 166, 255, 0.06)';
    ctx.fill();

    // Draw points
    timeline.forEach(p => {
      const x = xScale(p.time);
      const y = yScale(p.bitrate || 0);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#58a6ff';
      ctx.fill();
    });

    // X-axis time labels
    ctx.fillStyle = 'rgba(139, 148, 158, 0.7)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const numLabels = Math.min(6, Math.floor(plotW / 60));
    for (let i = 0; i <= numLabels; i++) {
      const t = minTime + (timeRange / numLabels) * i;
      const x = xScale(t);
      ctx.fillText(formatTimeLabel(t), x, h - 5);
    }
  }

  metrics.on('qualityTimeline', () => draw(metrics.qualityTimeline));
  metrics.on('reset', () => draw([]));

  // Redraw on resize
  new ResizeObserver(() => {
    if (metrics.qualityTimeline.length > 0) {
      draw(metrics.qualityTimeline);
    }
  }).observe(canvas);
}

function formatBitrate(bps) {
  if (!bps) return '?';
  if (bps >= 1000000) return (bps / 1000000).toFixed(1) + 'M';
  return (bps / 1000).toFixed(0) + 'k';
}

function formatTimeLabel(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}
