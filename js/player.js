let hlsInstance = null;
let dashInstance = null;
let pollingInterval = null;

export function detectFormat(url) {
  if (!url) return null;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.m3u8')) return 'hls';
  if (clean.endsWith('.mpd')) return 'dash';
  // Check query params as fallback
  if (url.toLowerCase().includes('.m3u8')) return 'hls';
  if (url.toLowerCase().includes('.mpd')) return 'dash';
  return null;
}

export function destroyStream(videoEl) {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  if (dashInstance) {
    dashInstance.reset();
    dashInstance = null;
  }
  videoEl.removeAttribute('src');
  videoEl.load();
}

export function loadStream(url, videoEl, metrics) {
  destroyStream(videoEl);
  metrics.reset();

  const format = detectFormat(url);
  metrics.updateStreamInfo({ format, url });
  metrics.addEvent('LOAD', `Loading ${format?.toUpperCase() || 'unknown'} stream: ${url}`);

  if (format === 'hls') {
    loadHls(url, videoEl, metrics);
  } else if (format === 'dash') {
    loadDash(url, videoEl, metrics);
  } else {
    // Try native playback
    metrics.addEvent('LOAD', 'Unknown format, attempting native playback', 'warn');
    videoEl.src = url;
    videoEl.play().catch(() => {});
  }

  // Fetch raw manifest text
  fetchManifest(url, metrics);

  startPolling(videoEl, metrics);
  wireVideoEvents(videoEl, metrics);

  return format;
}

function loadHls(url, videoEl, metrics) {
  if (typeof Hls === 'undefined') {
    metrics.addError({ type: 'INIT_ERROR', message: 'hls.js library not loaded', fatal: true });
    return;
  }

  if (!Hls.isSupported()) {
    // Safari native HLS fallback
    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      metrics.addEvent('INIT', 'Using native HLS playback (limited diagnostics)', 'warn');
      videoEl.src = url;
      videoEl.play().catch(() => {});
      return;
    }
    metrics.addError({ type: 'INIT_ERROR', message: 'HLS is not supported in this browser', fatal: true });
    return;
  }

  const hls = new Hls({
    debug: false,
    enableWorker: true,
    lowLatencyMode: true,
  });

  hlsInstance = hls;
  hls.loadSource(url);
  hls.attachMedia(videoEl);

  hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
    const levels = hls.levels.map((l, i) => ({
      index: i,
      width: l.width,
      height: l.height,
      bitrate: l.bitrate,
      codec: l.videoCodec || l.codecSet,
      audioCodec: l.audioCodec,
    }));

    metrics.updateStreamInfo({
      levels,
      audioTracks: hls.audioTracks.map((t, i) => ({ index: i, name: t.name, lang: t.lang })),
      isLive: hls.levels[0]?.details?.live || false,
    });

    metrics.addEvent('MANIFEST', `Parsed manifest: ${data.levels.length} quality level(s)`);
    videoEl.play().catch(() => {});
  });

  hls.on(Hls.Events.LEVEL_SWITCHED, (e, data) => {
    const level = hls.levels[data.level];
    if (level) {
      metrics.updateStreamInfo({
        currentLevel: data.level,
        currentResolution: level.width && level.height ? `${level.width}x${level.height}` : null,
        currentBitrate: level.bitrate,
        currentCodec: level.videoCodec || level.codecSet,
        audioCodec: level.audioCodec,
      });
      metrics.addQualityPoint(data.level, level.bitrate, `${level.width}x${level.height}`);
      metrics.addEvent('QUALITY', `Switched to level ${data.level} — ${level.width}x${level.height} @ ${formatBitrate(level.bitrate)}`);
    }
  });

  hls.on(Hls.Events.LEVEL_LOADED, (e, data) => {
    metrics.updateStreamInfo({
      isLive: data.details.live,
      duration: data.details.totalduration || 0,
    });
  });

  hls.on(Hls.Events.FRAG_LOADED, (e, data) => {
    const stats = data.frag.stats;
    const loadTime = stats.loading.end - stats.loading.start;
    metrics.addSegmentDownload({
      url: data.frag.url,
      duration: loadTime,
      size: stats.total,
      level: data.frag.level,
    });
  });

  hls.on(Hls.Events.FRAG_LOAD_EMERGENCY_ABORTED, (e, data) => {
    metrics.addEvent('ABORT', `Emergency abort: fragment at level ${data.frag.level}`, 'warn');
  });

  hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (e, data) => {
    metrics.updateStreamInfo({ currentAudioTrack: data.id });
    metrics.addEvent('AUDIO', `Audio track switched to ${data.id}`);
  });

  // Timed metadata (ID3 tags)
  hls.on(Hls.Events.FRAG_PARSING_METADATA, (e, data) => {
    if (data.samples) {
      data.samples.forEach(sample => {
        const pts = sample.pts != null ? sample.pts.toFixed(3) : '?';
        metrics.addMetadata({
          type: 'ID3',
          pts,
          size: sample.data ? sample.data.byteLength : 0,
        });
        metrics.addEvent('METADATA', `ID3 tag at PTS ${pts}s`);
      });
    }
  });

  hls.on(Hls.Events.ERROR, (e, data) => {
    const errorObj = {
      type: data.type,
      details: data.details,
      fatal: data.fatal,
      message: data.reason || data.details,
    };

    if (data.fatal) {
      metrics.addError(errorObj);
      // Try recovery
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          metrics.addEvent('RECOVERY', 'Attempting network error recovery...', 'warn');
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          metrics.addEvent('RECOVERY', 'Attempting media error recovery...', 'warn');
          hls.recoverMediaError();
          break;
        default:
          metrics.addEvent('FATAL', 'Unrecoverable error — stream destroyed', 'error');
          hls.destroy();
          break;
      }
    } else {
      metrics.addError(errorObj);
    }
  });
}

function loadDash(url, videoEl, metrics) {
  if (typeof dashjs === 'undefined') {
    metrics.addError({ type: 'INIT_ERROR', message: 'dash.js library not loaded', fatal: true });
    return;
  }

  const player = dashjs.MediaPlayer().create();
  dashInstance = player;

  player.updateSettings({
    debug: { logLevel: 0 },
    streaming: {
      abr: { autoSwitchBitrate: { video: true, audio: true } },
    },
  });

  player.initialize(videoEl, url, true);

  player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
    const bitrateList = player.getBitrateInfoListFor('video') || [];
    const levels = bitrateList.map((b, i) => ({
      index: i,
      width: b.width,
      height: b.height,
      bitrate: b.bitrate,
      codec: b.codec || '',
      audioCodec: '',
    }));

    const audioTracks = (player.getTracksFor('audio') || []).map((t, i) => ({
      index: i,
      name: t.labels?.[0]?.text || `Track ${i}`,
      lang: t.lang || 'unknown',
    }));

    metrics.updateStreamInfo({
      levels,
      audioTracks,
      isLive: player.isDynamic(),
      duration: player.duration() || 0,
    });

    metrics.addEvent('MANIFEST', `DASH stream initialized: ${levels.length} quality level(s)`);
  });

  player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
    if (e.mediaType !== 'video') return;
    const bitrateList = player.getBitrateInfoListFor('video') || [];
    const info = bitrateList[e.newQuality];
    if (info) {
      metrics.updateStreamInfo({
        currentLevel: e.newQuality,
        currentResolution: info.width && info.height ? `${info.width}x${info.height}` : null,
        currentBitrate: info.bitrate,
      });
      metrics.addQualityPoint(e.newQuality, info.bitrate, `${info.width}x${info.height}`);
      metrics.addEvent('QUALITY', `Switched to quality ${e.newQuality} — ${info.width}x${info.height} @ ${formatBitrate(info.bitrate)}`);
    }
  });

  player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, (e) => {
    if (e.request && e.request.type === 'MediaSegment') {
      const req = e.request;
      const loadTime = req.requestEndDate - req.requestStartDate;
      metrics.addSegmentDownload({
        url: req.url,
        duration: loadTime,
        size: req.bytesLoaded || 0,
        level: req.quality,
      });
    }
  });

  player.on(dashjs.MediaPlayer.events.ERROR, (e) => {
    metrics.addError({
      type: e.error?.code || 'DASH_ERROR',
      details: e.error?.message || JSON.stringify(e.error),
      fatal: true,
      message: e.error?.message || 'DASH playback error',
    });
  });

  player.on(dashjs.MediaPlayer.events.BUFFER_EMPTY, () => {
    metrics.updateBuffer({ isBuffering: true });
    metrics.addEvent('BUFFER', 'Buffer empty — rebuffering', 'warn');
  });

  player.on(dashjs.MediaPlayer.events.BUFFER_LOADED, () => {
    metrics.updateBuffer({ isBuffering: false });
    metrics.addEvent('BUFFER', 'Buffer loaded — playback resumed');
  });
}

function wireVideoEvents(videoEl, metrics) {
  const handler = (e) => {
    switch (e.type) {
      case 'waiting':
        metrics.updateBuffer({ isBuffering: true });
        metrics.addEvent('VIDEO', 'Waiting for data (rebuffering)', 'warn');
        break;
      case 'playing':
        metrics.updateBuffer({ isBuffering: false });
        metrics.addEvent('VIDEO', 'Playing');
        break;
      case 'pause':
        metrics.addEvent('VIDEO', 'Paused');
        break;
      case 'seeked':
        metrics.addEvent('VIDEO', `Seeked to ${videoEl.currentTime.toFixed(2)}s`);
        break;
      case 'ended':
        metrics.addEvent('VIDEO', 'Playback ended');
        break;
      case 'error':
        metrics.addError({
          type: 'MEDIA_ERROR',
          message: videoEl.error?.message || 'Native video error',
          details: `Code: ${videoEl.error?.code}`,
          fatal: true,
        });
        break;
    }
  };

  ['waiting', 'playing', 'pause', 'seeked', 'ended', 'error'].forEach(evt => {
    videoEl.addEventListener(evt, handler);
  });
}

function startPolling(videoEl, metrics) {
  pollingInterval = setInterval(() => {
    // Buffer length
    if (videoEl.buffered.length > 0) {
      const currentTime = videoEl.currentTime;
      let bufferEnd = 0;
      for (let i = 0; i < videoEl.buffered.length; i++) {
        if (videoEl.buffered.start(i) <= currentTime && videoEl.buffered.end(i) >= currentTime) {
          bufferEnd = videoEl.buffered.end(i);
          break;
        }
      }
      const bufferLength = Math.max(0, bufferEnd - currentTime);
      metrics.updateBuffer({ videoBufferLength: bufferLength });
      metrics.pushBufferHistory(bufferLength);
    }

    // Bandwidth estimate
    if (hlsInstance) {
      metrics.updateBandwidth(hlsInstance.bandwidthEstimate || 0);
    } else if (dashInstance) {
      try {
        const dashMetrics = dashInstance.getDashMetrics();
        const httpList = dashMetrics.getHttpRequests('video');
        if (httpList && httpList.length > 0) {
          const last = httpList[httpList.length - 1];
          if (last.trequest && last.tresponse) {
            const bw = dashInstance.getAverageThroughput('video');
            if (bw) metrics.updateBandwidth(bw * 1000); // kbps to bps
          }
        }
      } catch (e) { /* ignore dash metrics errors */ }
    }

    // Playback stats, dropped frames, FPS
    const playbackUpdate = {
      currentTime: videoEl.currentTime,
      playbackRate: videoEl.playbackRate,
      decodedWidth: videoEl.videoWidth || 0,
      decodedHeight: videoEl.videoHeight || 0,
      readyState: videoEl.readyState,
      networkState: videoEl.networkState,
    };

    if (typeof videoEl.getVideoPlaybackQuality === 'function') {
      const quality = videoEl.getVideoPlaybackQuality();
      playbackUpdate.droppedFrames = quality.droppedVideoFrames || 0;
      playbackUpdate.totalFrames = quality.totalVideoFrames || 0;

      // Calculate real-time FPS
      const now = performance.now();
      if (metrics._lastFrameTime > 0) {
        const elapsed = (now - metrics._lastFrameTime) / 1000;
        const frameDelta = quality.totalVideoFrames - metrics._lastFrameCount;
        if (elapsed > 0) {
          playbackUpdate.fps = Math.round(frameDelta / elapsed);
        }
      }
      metrics._lastFrameCount = quality.totalVideoFrames;
      metrics._lastFrameTime = now;
    }

    // Live latency
    if (hlsInstance && metrics.streamInfo.isLive) {
      try {
        playbackUpdate.liveLatency = hlsInstance.latency != null
          ? hlsInstance.latency
          : (hlsInstance.liveSyncPosition != null
            ? hlsInstance.liveSyncPosition - videoEl.currentTime
            : null);
      } catch (e) { /* ignore */ }
    } else if (dashInstance && metrics.streamInfo.isLive) {
      try {
        playbackUpdate.liveLatency = dashInstance.getCurrentLiveLatency();
      } catch (e) { /* ignore */ }
    } else {
      playbackUpdate.liveLatency = null;
    }

    metrics.updatePlayback(playbackUpdate);
  }, 500);
}

function fetchManifest(url, metrics) {
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then(text => {
      metrics.setManifestText(text);
      metrics.addEvent('MANIFEST', `Fetched raw manifest (${text.length} chars)`);
    })
    .catch(err => {
      metrics.setManifestText(`[Failed to fetch manifest: ${err.message}]\n\nNote: This may be due to CORS restrictions.\nThe stream may still play if the player handles CORS differently.`);
    });
}

function formatBitrate(bps) {
  if (!bps) return '?';
  if (bps >= 1000000) return (bps / 1000000).toFixed(1) + ' Mbps';
  return (bps / 1000).toFixed(0) + ' kbps';
}

export function getHlsInstance() { return hlsInstance; }
export function getDashInstance() { return dashInstance; }
