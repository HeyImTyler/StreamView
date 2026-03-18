import { getHlsInstance, getDashInstance } from '../player.js';

export function init(container, metrics) {
  container.innerHTML = `
    <div class="empty-state" id="si-empty">Load a stream to see info</div>
    <div id="si-content" style="display:none">
      <h3>Stream</h3>
      <div class="metric-row"><span class="metric-label">Format</span><span class="metric-value" id="si-format">—</span></div>
      <div class="metric-row"><span class="metric-label">URL</span><span class="metric-value" id="si-url" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="">—</span></div>
      <div class="metric-row"><span class="metric-label">Type</span><span class="metric-value" id="si-type">—</span></div>
      <div class="metric-row"><span class="metric-label">Duration</span><span class="metric-value" id="si-duration">—</span></div>

      <h3>Current Quality</h3>
      <div class="metric-row"><span class="metric-label">Resolution</span><span class="metric-value" id="si-resolution">—</span></div>
      <div class="metric-row"><span class="metric-label">Bitrate</span><span class="metric-value" id="si-bitrate">—</span></div>
      <div class="metric-row"><span class="metric-label">Video Codec</span><span class="metric-value" id="si-codec">—</span></div>
      <div class="metric-row"><span class="metric-label">Audio Codec</span><span class="metric-value" id="si-acodec">—</span></div>

      <h3>Quality Override</h3>
      <div class="metric-row">
        <span class="metric-label">Level</span>
        <select class="quality-select" id="si-quality-select"><option value="-1">Auto</option></select>
      </div>

      <h3>Available Levels</h3>
      <ul class="level-list" id="si-levels"></ul>

      <h3>Playback</h3>
      <div class="metric-row"><span class="metric-label">Position</span><span class="metric-value" id="si-position">—</span></div>
      <div class="metric-row"><span class="metric-label">Playback Rate</span><span class="metric-value" id="si-rate">—</span></div>
      <div class="metric-row"><span class="metric-label">Decoded Size</span><span class="metric-value" id="si-decoded">—</span></div>
      <div class="metric-row"><span class="metric-label">Ready State</span><span class="metric-value" id="si-ready">—</span></div>
      <div class="metric-row"><span class="metric-label">Network State</span><span class="metric-value" id="si-netstate">—</span></div>
      <div id="si-latency-row" class="metric-row" style="display:none"><span class="metric-label">Live Latency</span><span class="metric-value" id="si-latency">—</span></div>

      <h3>Frame Stats</h3>
      <div class="metric-row"><span class="metric-label">FPS</span><span class="metric-value" id="si-fps">—</span></div>
      <div class="metric-row"><span class="metric-label">Dropped Frames</span><span class="metric-value" id="si-dropped">—</span></div>
      <div class="metric-row"><span class="metric-label">Total Frames</span><span class="metric-value" id="si-total-frames">—</span></div>
      <div class="metric-row"><span class="metric-label">Drop Rate</span><span class="metric-value" id="si-drop-rate">—</span></div>

      <h3>Audio Tracks</h3>
      <div id="si-audio-tracks"><span class="metric-value">—</span></div>
    </div>
  `;

  const qualitySelect = container.querySelector('#si-quality-select');
  qualitySelect.addEventListener('change', () => {
    const val = parseInt(qualitySelect.value, 10);
    const hls = getHlsInstance();
    const dash = getDashInstance();
    if (hls) {
      hls.currentLevel = val;
      metrics.addEvent('MANUAL', val === -1 ? 'Quality set to Auto' : `Quality forced to level ${val}`);
    } else if (dash && val >= 0) {
      dash.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
      dash.setQualityFor('video', val);
      metrics.addEvent('MANUAL', `Quality forced to level ${val}`);
    } else if (dash && val === -1) {
      dash.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
      metrics.addEvent('MANUAL', 'Quality set to Auto');
    }
  });

  metrics.on('streamInfo', (info) => {
    container.querySelector('#si-empty').style.display = 'none';
    container.querySelector('#si-content').style.display = 'block';

    const $ = id => container.querySelector(id);
    $('#si-format').textContent = (info.format || '—').toUpperCase();
    const urlEl = $('#si-url');
    urlEl.textContent = info.url || '—';
    urlEl.title = info.url || '';
    $('#si-type').textContent = info.isLive ? 'Live' : 'VOD';
    $('#si-duration').textContent = info.isLive ? '—' : formatDuration(info.duration);
    $('#si-resolution').textContent = info.currentResolution || '—';
    $('#si-bitrate').textContent = info.currentBitrate ? formatBitrate(info.currentBitrate) : '—';
    $('#si-codec').textContent = info.currentCodec || '—';
    $('#si-acodec').textContent = info.audioCodec || '—';

    // Update levels list
    const levelsList = $('#si-levels');
    levelsList.innerHTML = '';
    info.levels.forEach((l, i) => {
      const li = document.createElement('li');
      li.textContent = `L${i}: ${l.width}x${l.height} @ ${formatBitrate(l.bitrate)}`;
      if (i === info.currentLevel) li.classList.add('active-level');
      levelsList.appendChild(li);
    });

    // Update quality select
    const select = $('#si-quality-select');
    const currentVal = select.value;
    select.innerHTML = '<option value="-1">Auto</option>';
    info.levels.forEach((l, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `L${i}: ${l.width}x${l.height} @ ${formatBitrate(l.bitrate)}`;
      select.appendChild(opt);
    });
    select.value = currentVal;

    // Audio tracks
    const audioDiv = $('#si-audio-tracks');
    if (info.audioTracks.length > 0) {
      audioDiv.innerHTML = info.audioTracks.map(t =>
        `<div class="metric-row"><span class="metric-label">${t.lang}</span><span class="metric-value">${t.name}</span></div>`
      ).join('');
    }
  });

  const READY_STATES = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
  const NETWORK_STATES = ['EMPTY', 'IDLE', 'LOADING', 'NO_SOURCE'];

  metrics.on('playback', (pb) => {
    const $ = id => container.querySelector(id);
    $('#si-position').textContent = pb.currentTime.toFixed(2) + 's';
    $('#si-rate').textContent = pb.playbackRate + 'x';
    $('#si-decoded').textContent = pb.decodedWidth && pb.decodedHeight
      ? `${pb.decodedWidth}x${pb.decodedHeight}`
      : '—';
    $('#si-ready').textContent = READY_STATES[pb.readyState] || pb.readyState;
    $('#si-netstate').textContent = NETWORK_STATES[pb.networkState] || pb.networkState;

    // Live latency
    const latencyRow = $('#si-latency-row');
    if (pb.liveLatency != null) {
      latencyRow.style.display = 'flex';
      const latency = pb.liveLatency;
      $('#si-latency').textContent = latency.toFixed(2) + 's';
      $('#si-latency').style.color = latency > 10 ? 'var(--error)' : latency > 5 ? 'var(--warning)' : 'var(--success)';
    } else {
      latencyRow.style.display = 'none';
    }

    // Frame stats
    $('#si-fps').textContent = pb.fps > 0 ? pb.fps : '—';
    $('#si-dropped').textContent = pb.droppedFrames;
    $('#si-dropped').style.color = pb.droppedFrames > 0 ? 'var(--warning)' : '';
    $('#si-total-frames').textContent = pb.totalFrames;
    const dropRate = pb.totalFrames > 0 ? ((pb.droppedFrames / pb.totalFrames) * 100).toFixed(2) + '%' : '—';
    $('#si-drop-rate').textContent = dropRate;
    const dropPct = pb.totalFrames > 0 ? (pb.droppedFrames / pb.totalFrames) * 100 : 0;
    $('#si-drop-rate').style.color = dropPct > 1 ? 'var(--error)' : dropPct > 0.1 ? 'var(--warning)' : '';
  });

  metrics.on('reset', () => {
    container.querySelector('#si-empty').style.display = 'block';
    container.querySelector('#si-content').style.display = 'none';
  });
}

function formatBitrate(bps) {
  if (!bps) return '?';
  if (bps >= 1000000) return (bps / 1000000).toFixed(1) + ' Mbps';
  return (bps / 1000).toFixed(0) + ' kbps';
}

function formatDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
