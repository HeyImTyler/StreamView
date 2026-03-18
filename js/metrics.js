export class MetricsCollector {
  constructor() {
    this._listeners = {};
    this.reset();
  }

  reset() {
    this.streamInfo = {
      format: null,
      url: null,
      levels: [],
      currentLevel: -1,
      currentResolution: null,
      currentBitrate: null,
      currentCodec: null,
      audioCodec: null,
      audioTracks: [],
      currentAudioTrack: null,
      subtitleTracks: [],
      currentSubtitleTrack: -1,
      isLive: false,
      duration: 0,
    };

    this.buffer = {
      videoBufferLength: 0,
      audioBufferLength: 0,
      rebufferCount: 0,
      rebufferDuration: 0,
      isBuffering: false,
      bufferingStartTime: null,
      history: [],
    };

    this.network = {
      bandwidthEstimate: 0,
      segmentDownloads: [],
      failedRequests: [],
      totalBytesLoaded: 0,
    };

    this.playback = {
      currentTime: 0,
      playbackRate: 1,
      decodedWidth: 0,
      decodedHeight: 0,
      readyState: 0,
      networkState: 0,
      droppedFrames: 0,
      totalFrames: 0,
      fps: 0,
      liveLatency: null,
    };

    this.metadata = [];
    this.manifestText = null;

    this.qualityTimeline = [];
    this.events = [];
    this.errors = [];
    this._startTime = Date.now();
    this._lastFrameCount = 0;
    this._lastFrameTime = 0;

    this.emit('reset');
  }

  on(channel, callback) {
    if (!this._listeners[channel]) this._listeners[channel] = [];
    this._listeners[channel].push(callback);
  }

  off(channel, callback) {
    if (!this._listeners[channel]) return;
    this._listeners[channel] = this._listeners[channel].filter(cb => cb !== callback);
  }

  emit(channel, data) {
    const cbs = this._listeners[channel];
    if (cbs) cbs.forEach(cb => { try { cb(data); } catch (e) { console.error('Metrics listener error:', e); } });
  }

  get relativeTime() {
    return Date.now() - this._startTime;
  }

  formatTime(ms) {
    if (ms == null) ms = this.relativeTime;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const pad = n => String(n).padStart(2, '0');
    const msStr = String(ms % 1000).padStart(3, '0');
    return `${pad(h)}:${pad(m % 60)}:${pad(s % 60)}.${msStr}`;
  }

  updateStreamInfo(partial) {
    Object.assign(this.streamInfo, partial);
    this.emit('streamInfo', this.streamInfo);
  }

  updateBuffer(partial) {
    if (partial.isBuffering && !this.buffer.isBuffering) {
      this.buffer.bufferingStartTime = Date.now();
      this.buffer.rebufferCount++;
    }
    if (partial.isBuffering === false && this.buffer.isBuffering && this.buffer.bufferingStartTime) {
      this.buffer.rebufferDuration += Date.now() - this.buffer.bufferingStartTime;
      this.buffer.bufferingStartTime = null;
    }
    Object.assign(this.buffer, partial);
    this.emit('buffer', this.buffer);
  }

  pushBufferHistory(length) {
    this.buffer.history.push({ time: this.relativeTime, length });
    // Keep last 120 entries (60s at 500ms interval)
    if (this.buffer.history.length > 120) this.buffer.history.shift();
  }

  addSegmentDownload(info) {
    this.network.segmentDownloads.unshift({ ...info, time: this.relativeTime });
    if (this.network.segmentDownloads.length > 50) this.network.segmentDownloads.pop();
    this.network.totalBytesLoaded += info.size || 0;
    this.emit('network', this.network);
  }

  addFailedRequest(info) {
    this.network.failedRequests.unshift({ ...info, time: this.relativeTime });
    if (this.network.failedRequests.length > 30) this.network.failedRequests.pop();
    this.emit('network', this.network);
  }

  updateBandwidth(bps) {
    this.network.bandwidthEstimate = bps;
    this.emit('network', this.network);
  }

  addQualityPoint(level, bitrate, resolution) {
    this.qualityTimeline.push({ time: this.relativeTime, level, bitrate, resolution });
    this.emit('qualityTimeline', this.qualityTimeline);
  }

  addEvent(type, message, severity = 'info') {
    const entry = { time: this.relativeTime, type, message, severity };
    this.events.unshift(entry);
    if (this.events.length > 500) this.events.pop();
    this.emit('events', entry);
  }

  addError(errorObj) {
    const entry = { time: this.relativeTime, ...errorObj };
    this.errors.unshift(entry);
    this.emit('errors', entry);
    this.addEvent(errorObj.type || 'ERROR', errorObj.message || errorObj.details || 'Unknown error', 'error');
  }

  clearErrors() {
    this.errors = [];
    this.emit('errors', null);
  }

  updatePlayback(partial) {
    Object.assign(this.playback, partial);
    this.emit('playback', this.playback);
  }

  setManifestText(text) {
    this.manifestText = text;
    this.emit('manifest', text);
  }

  addMetadata(entry) {
    this.metadata.unshift({ time: this.relativeTime, ...entry });
    if (this.metadata.length > 200) this.metadata.pop();
    this.emit('metadata', entry);
  }

  clearMetadata() {
    this.metadata = [];
    this.emit('metadata', null);
  }
}
