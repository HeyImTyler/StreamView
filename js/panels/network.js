export function init(container, metrics) {
  container.innerHTML = `
    <h3>Bandwidth</h3>
    <div class="metric-row"><span class="metric-label">Estimated Bandwidth</span><span class="metric-value" id="net-bw">—</span></div>
    <div class="metric-row"><span class="metric-label">Total Downloaded</span><span class="metric-value" id="net-total">0 B</span></div>
    <div class="metric-row"><span class="metric-label">Avg Segment Time</span><span class="metric-value" id="net-avg-time">—</span></div>
    <h3>Segment Downloads</h3>
    <div style="overflow-x:auto">
      <table class="segment-table">
        <thead><tr><th>URL</th><th>Size</th><th>Time</th><th>Speed</th></tr></thead>
        <tbody id="net-segments"></tbody>
      </table>
    </div>
    <h3>Failed Requests</h3>
    <div id="net-failures"><span class="metric-value" style="color:var(--success)">None</span></div>
  `;

  const bwEl = container.querySelector('#net-bw');
  const totalEl = container.querySelector('#net-total');
  const avgEl = container.querySelector('#net-avg-time');
  const segBody = container.querySelector('#net-segments');
  const failDiv = container.querySelector('#net-failures');

  metrics.on('network', (net) => {
    bwEl.textContent = net.bandwidthEstimate ? formatBitrate(net.bandwidthEstimate) : '—';
    totalEl.textContent = formatBytes(net.totalBytesLoaded);

    // Avg segment time
    const recent = net.segmentDownloads.slice(0, 30);
    if (recent.length > 0) {
      const avg = recent.reduce((s, d) => s + d.duration, 0) / recent.length;
      avgEl.textContent = avg.toFixed(0) + 'ms';
    }

    // Segment table
    segBody.innerHTML = '';
    recent.forEach(seg => {
      const tr = document.createElement('tr');
      if (seg.duration > 1000) tr.classList.add('slow');

      const urlParts = (seg.url || '').split('/');
      const shortUrl = urlParts[urlParts.length - 1]?.split('?')[0] || seg.url;
      const speed = seg.duration > 0 && seg.size > 0
        ? formatBitrate((seg.size * 8 / seg.duration) * 1000)
        : '—';

      tr.innerHTML = `
        <td title="${escapeHtml(seg.url || '')}">${escapeHtml(shortUrl)}</td>
        <td>${formatBytes(seg.size)}</td>
        <td>${seg.duration?.toFixed(0) || '?'}ms</td>
        <td>${speed}</td>
      `;
      segBody.appendChild(tr);
    });

    // Failed requests
    if (net.failedRequests.length > 0) {
      failDiv.innerHTML = net.failedRequests.map(f => `
        <div class="metric-row" style="color:var(--error)">
          <span>${escapeHtml(f.url || 'unknown')}</span>
          <span class="metric-value">${f.status || 'err'}</span>
        </div>
      `).join('');
    } else {
      failDiv.innerHTML = '<span class="metric-value" style="color:var(--success)">None</span>';
    }
  });

  metrics.on('reset', () => {
    bwEl.textContent = '—';
    totalEl.textContent = '0 B';
    avgEl.textContent = '—';
    segBody.innerHTML = '';
    failDiv.innerHTML = '<span class="metric-value" style="color:var(--success)">None</span>';
  });
}

function formatBitrate(bps) {
  if (!bps) return '?';
  if (bps >= 1000000) return (bps / 1000000).toFixed(1) + ' Mbps';
  return (bps / 1000).toFixed(0) + ' kbps';
}

function formatBytes(b) {
  if (!b || b === 0) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
