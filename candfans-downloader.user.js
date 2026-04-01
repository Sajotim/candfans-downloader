// ==UserScript==
// @name         Candfans Downloader
// @namespace    https://github.com/candfans-downloader
// @version      2.1.0
// @description  One-click scan & download videos from Candfans creators you subscribe to. Zero external dependencies.
// @author       candfans-downloader
// @match        https://candfans.jp/*
// @license      MIT
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ── Styles ──
  const STYLES = `
    #cfd-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 52px; height: 52px; border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff; font-size: 22px; border: none; cursor: pointer;
      box-shadow: 0 4px 14px rgba(99,102,241,.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform .15s, box-shadow .15s;
    }
    #cfd-fab:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(99,102,241,.55); }

    #cfd-panel {
      position: fixed; bottom: 88px; right: 24px; z-index: 99998;
      width: 400px; max-height: 85vh; overflow-y: auto;
      background: #1e1e2e; color: #cdd6f4;
      border-radius: 16px; padding: 20px; display: none;
      box-shadow: 0 8px 32px rgba(0,0,0,.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.5;
    }
    #cfd-panel.open { display: block; }

    #cfd-panel h3 { margin: 0 0 14px; font-size: 16px; color: #cba6f7; font-weight: 700; }
    #cfd-panel label { display: block; margin-bottom: 4px; color: #a6adc8; font-size: 12px; }
    #cfd-panel select, #cfd-panel input[type=number], #cfd-panel input[type=text] {
      width: 100%; padding: 7px 10px; border-radius: 8px;
      border: 1px solid #45475a; background: #313244; color: #cdd6f4;
      font-size: 13px; margin-bottom: 10px; box-sizing: border-box;
    }
    #cfd-panel select:focus, #cfd-panel input:focus { outline: none; border-color: #6366f1; }

    .cfd-row { display: flex; gap: 8px; margin-bottom: 10px; }
    .cfd-row > * { flex: 1; }

    .cfd-btn {
      width: 100%; padding: 9px; border: none; border-radius: 8px;
      font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity .15s;
    }
    .cfd-btn:hover { opacity: .85; }
    .cfd-btn:disabled { opacity: .4; cursor: not-allowed; }
    .cfd-btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
    .cfd-btn-green { background: #22c55e; color: #fff; }
    .cfd-btn-outline { background: transparent; border: 1px solid #45475a; color: #cdd6f4; }
    .cfd-btn-sm { padding: 5px 10px; font-size: 11px; width: auto; border-radius: 6px; }

    #cfd-progress-wrap {
      width: 100%; height: 6px; background: #313244; border-radius: 3px;
      margin: 10px 0; overflow: hidden; display: none;
    }
    #cfd-progress-bar {
      height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #8b5cf6);
      border-radius: 3px; transition: width .2s;
    }
    #cfd-status { font-size: 12px; color: #a6adc8; margin-bottom: 6px; min-height: 16px; }
    #cfd-stats { font-size: 12px; color: #a6adc8; margin-top: 6px; }

    .cfd-export-group { display: none; flex-direction: column; gap: 8px; margin-top: 12px; }
    .cfd-export-group.show { display: flex; }

    .cfd-divider { border: none; border-top: 1px solid #313244; margin: 10px 0; }

    #cfd-video-list {
      max-height: 250px; overflow-y: auto; margin-top: 8px;
      border: 1px solid #313244; border-radius: 8px; font-size: 11px;
    }
    #cfd-video-list table { width: 100%; border-collapse: collapse; }
    #cfd-video-list th { position: sticky; top: 0; background: #313244; padding: 4px 6px; text-align: left; color: #a6adc8; }
    #cfd-video-list td { padding: 4px 6px; border-top: 1px solid #1e1e2e; }
    #cfd-video-list tr:hover { background: #313244; }
    #cfd-video-list input[type=checkbox] { accent-color: #6366f1; cursor: pointer; }
    .cfd-dl-status { font-size: 10px; }
    .cfd-dl-status.ok { color: #22c55e; }
    .cfd-dl-status.err { color: #f38ba8; }
    .cfd-dl-status.busy { color: #fab387; }

    .cfd-select-bar { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
    .cfd-select-bar span { font-size: 11px; color: #a6adc8; margin-left: auto; }

    /* Single post download button */
    .cfd-post-dl-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 14px; border-radius: 8px; border: none;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: opacity .15s;
      margin: 8px 0;
    }
    .cfd-post-dl-btn:hover { opacity: .85; }
    .cfd-post-dl-btn:disabled { opacity: .4; cursor: not-allowed; }
    .cfd-post-dl-btn svg { width: 14px; height: 14px; }
  `;

  // ── State ──
  let scanning = false;
  let results = {};
  let downloading = false;
  let abortController = null;
  let selectedIndices = new Set();

  // ── Helpers ──
  const RESERVED_ROUTES = ['explore', 'search', 'settings', 'notifications', 'messages', 'mypage', 'login', 'register', 'ranking', 'posts', 'help', 'terms', 'privacy', 'law', 'inquiry'];

  function getUserCodeFromURL() {
    const m = location.pathname.match(/^\/([^/?#]+)/);
    if (!m) return null;
    const code = m[1];
    return RESERVED_ROUTES.includes(code) ? null : code;
  }

  function getURLParam(key) {
    return new URLSearchParams(location.search).get(key);
  }

  function getSinglePostId() {
    const m = location.pathname.match(/\/posts\/comment\/show\/(\d+)/);
    return m ? m[1] : null;
  }

  function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  async function apiFetch(path) {
    const resp = await fetch(`https://candfans.jp/api${path}`, { credentials: 'include' });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${path}`);
    return resp.json();
  }

  const DL_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  // ── SPA URL Change Observer ──
  function observeURLChanges(callback) {
    let lastUrl = location.href;
    const check = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        callback();
      }
    };
    for (const method of ['pushState', 'replaceState']) {
      const orig = history[method];
      history[method] = function () {
        const result = orig.apply(this, arguments);
        check();
        return result;
      };
    }
    window.addEventListener('popstate', check);
  }

  // ── Core: Scan ──
  async function scanCreator(userCode, options, onProgress) {
    onProgress('Fetching creator info...');
    const userData = await apiFetch(`/v3/users/by-user-code/${userCode}`);
    const user = userData.user || userData.data;
    const userId = user.id || user.user_id;
    const username = user.name || user.username || user.code || userCode;

    let page = 1;
    let hasMore = true;
    const items = [];
    const planId = options.planId || '';

    while (hasMore) {
      const params = {
        user_id: userId,
        keyword: '',
        'post_type[]': '1',
        sort_order: '',
        page: page
      };
      if (planId) params.plan_id = planId;
      const qs = new URLSearchParams(params);

      onProgress(`Scanning page ${page}...`);
      const data = await apiFetch(`/contents/get-timeline?${qs}`);
      const posts = data.data || [];
      if (posts.length === 0) { hasMore = false; break; }

      for (const p of posts) {
        const isVideo = p.contents_type === 2;
        const isPhoto = p.contents_type === 1;
        const duration = p.attachment_length || 0;
        const att = (p.attachments && p.attachments[0]) || {};

        if (options.contentType === 'video' && !isVideo) continue;
        if (options.contentType === 'photo' && !isPhoto) continue;
        if (isVideo && duration < options.minDuration) continue;

        const url = options.quality === 'low' && att.low ? att.low : att.default || null;
        if (!url && isVideo) continue;

        items.push({
          post_id: p.post_id,
          title: sanitizeFilename(p.title || `post_${p.post_id}`),
          type: isVideo ? 'video' : 'photo',
          duration: isVideo ? duration : 0,
          url: isVideo ? url : null,
        });
      }

      page++;
      if (posts.length < 10) hasMore = false;
    }

    return { username, userId, items };
  }

  // ── Export: URL list (TSV) ──
  function generateTSV(data, indices) {
    const videos = data.items.filter(i => i.type === 'video');
    const selected = indices ? videos.filter((_, i) => indices.has(i)) : videos;
    const header = 'post_id\tduration_sec\ttitle\turl';
    const rows = selected.map(v => `${v.post_id}\t${Math.round(v.duration)}\t${v.title}\t${v.url}`);
    return [header, ...rows].join('\n');
  }

  function triggerDownloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ── In-browser HLS download ──
  async function parseM3U8(m3u8Url) {
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
    const resp = await fetch(m3u8Url);
    const text = await resp.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const variantLine = lines.find(l => l.startsWith('#EXT-X-STREAM-INF'));
    if (variantLine) {
      let bestUrl = null;
      let bestBw = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
          const bw = bwMatch ? parseInt(bwMatch[1]) : 0;
          if (bw >= bestBw && i + 1 < lines.length) {
            bestBw = bw;
            bestUrl = lines[i + 1];
          }
        }
      }
      if (bestUrl) {
        const resolvedUrl = bestUrl.startsWith('http') ? bestUrl : baseUrl + bestUrl;
        return parseM3U8(resolvedUrl);
      }
    }

    const segments = [];
    for (const line of lines) {
      if (!line.startsWith('#')) {
        segments.push(line.startsWith('http') ? line : baseUrl + line);
      }
    }
    return segments;
  }

  async function downloadHLS(video, onStatus, signal) {
    const { post_id, title, url } = video;
    const filename = `${post_id}_${title}.mp4`;

    onStatus('busy', 'Parsing...');
    const segments = await parseM3U8(url);
    const total = segments.length;
    const chunks = [];
    let totalBytes = 0;

    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) {
        onStatus('err', 'Cancelled');
        return;
      }
      onStatus('busy', `${i + 1}/${total} segs (${formatBytes(totalBytes)})`);
      const resp = await fetch(segments[i]);
      const buf = await resp.arrayBuffer();
      chunks.push(buf);
      totalBytes += buf.byteLength;
    }

    onStatus('busy', `Merging ${formatBytes(totalBytes)}...`);
    const blob = new Blob(chunks, { type: 'video/mp2t' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);

    onStatus('ok', `Done (${formatBytes(totalBytes)})`);
  }

  async function downloadAllHLS(videos, indices, updateRow, onGlobalStatus) {
    downloading = true;
    abortController = new AbortController();
    const signal = abortController.signal;
    const selected = indices ? [...indices].sort((a, b) => a - b) : videos.map((_, i) => i);
    let done = 0;

    for (const idx of selected) {
      if (signal.aborted) break;
      done++;
      onGlobalStatus(`Downloading ${done}/${selected.length}...`);
      try {
        await downloadHLS(videos[idx], (cls, msg) => updateRow(idx, cls, msg), signal);
      } catch (e) {
        updateRow(idx, 'err', e.message.substring(0, 30));
      }
      if (done < selected.length && !signal.aborted) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    downloading = false;
    onGlobalStatus(signal.aborted ? 'Download cancelled.' : 'All downloads complete!');
  }

  // ── Single Post Download ──
  function findM3U8FromPage() {
    // Strategy 1: search page HTML for video.candfans.jp m3u8 URLs
    const match = document.body.innerHTML.match(/https?:\/\/video\.candfans\.jp\/[^"'\s<>]+\.m3u8/);
    if (match) return match[0];

    // Strategy 2: check video/source elements
    const allSources = document.querySelectorAll('source[src*=".m3u8"], video[src*=".m3u8"]');
    for (const el of allSources) {
      const src = el.src || el.getAttribute('src');
      if (src) return src;
    }

    // Strategy 3: check data attributes on video elements
    const videoEl = document.querySelector('video');
    if (videoEl) {
      const dataSrc = videoEl.getAttribute('data-src') || videoEl.dataset.hlsSrc;
      if (dataSrc && dataSrc.includes('.m3u8')) return dataSrc;
    }

    return null;
  }

  function injectSinglePostButton() {
    const postId = getSinglePostId();
    if (!postId) return;

    // Remove any previously injected button
    document.querySelectorAll('.cfd-post-dl-btn').forEach(el => el.remove());

    const tryInject = () => {
      // Find the video player wrapper: walk up from <video> to find
      // a container that's a good insertion sibling
      const videoEl = document.querySelector('video');
      if (!videoEl) return false;

      // Walk up to find a reasonable outer container (e.g. the sticky wrapper or aspect-video div)
      let insertTarget = null;
      let el = videoEl;
      while (el && el !== document.body) {
        // Look for the outermost video wrapper before the main content
        if (el.classList.contains('sticky') || el.className.includes('aspect-video')) {
          insertTarget = el;
        }
        el = el.parentElement;
      }

      // Fallback: use the closest reasonable container
      if (!insertTarget) {
        insertTarget = videoEl.closest('[class*="aspect"]') || videoEl.closest('[class*="sticky"]') || videoEl.parentElement?.parentElement?.parentElement;
      }
      if (!insertTarget) return false;

      // Don't double-inject
      if (insertTarget.parentElement?.querySelector('.cfd-post-dl-btn')) return true;

      const btn = document.createElement('button');
      btn.className = 'cfd-post-dl-btn';
      btn.innerHTML = `${DL_ICON_SVG} Download this video`;

      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.innerHTML = `${DL_ICON_SVG} Fetching...`;

        try {
          const m3u8Url = findM3U8FromPage();

          if (!m3u8Url) {
            btn.innerHTML = `${DL_ICON_SVG} URL not found`;
            setTimeout(() => { btn.disabled = false; btn.innerHTML = `${DL_ICON_SVG} Download this video`; }, 3000);
            return;
          }

          // Build a clean title from page title, stripping the CF prefix and site name
          const rawTitle = document.title
            .replace(/^CF\d+\s*/, '')
            .replace(/\s*\|.*$/, '')
            .replace(/[\\/:*?"<>|]/g, '_')
            .substring(0, 80) || `post_${postId}`;
          const video = { post_id: postId, title: rawTitle, url: m3u8Url };

          btn.innerHTML = `${DL_ICON_SVG} Downloading...`;
          await downloadHLS(video,
            (cls, msg) => { btn.innerHTML = `${DL_ICON_SVG} ${msg}`; },
            { aborted: false }
          );
          btn.innerHTML = `${DL_ICON_SVG} Done!`;
        } catch (e) {
          btn.innerHTML = `${DL_ICON_SVG} Error: ${e.message.substring(0, 20)}`;
        } finally {
          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = `${DL_ICON_SVG} Download this video`;
          }, 5000);
        }
      });

      // Insert AFTER the video container
      insertTarget.parentElement.insertBefore(btn, insertTarget.nextSibling);
      return true;
    };

    // Try immediately, then observe for SPA content loading
    if (!tryInject()) {
      const observer = new MutationObserver(() => {
        if (tryInject()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 15000);
    }
  }

  // ── Selection helpers ──
  function updateSelectionCount(panel, videos) {
    const counter = panel.querySelector('#cfd-sel-count');
    if (counter) counter.textContent = `${selectedIndices.size}/${videos.length} selected`;
  }

  function setAllCheckboxes(panel, videos, checked) {
    selectedIndices.clear();
    if (checked) videos.forEach((_, i) => selectedIndices.add(i));
    panel.querySelectorAll('#cfd-video-list input[type=checkbox]').forEach((cb, i) => {
      if (i === 0) return; // skip header "select all"
    });
    panel.querySelectorAll('.cfd-row-cb').forEach((cb, i) => { cb.checked = checked; });
    const masterCb = panel.querySelector('#cfd-select-all');
    if (masterCb) masterCb.checked = checked;
    updateSelectionCount(panel, videos);
  }

  // ── UI ──
  function init() {
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.id = 'cfd-fab';
    fab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'cfd-panel';

    const userCode = getUserCodeFromURL();
    const planId = getURLParam('postPlanId') || '';

    panel.innerHTML = `
      <h3>Candfans Downloader</h3>

      <label>Creator</label>
      <input type="text" id="cfd-user" value="${userCode || ''}" placeholder="user_code (from URL)" />

      <div class="cfd-row">
        <div>
          <label>Content</label>
          <select id="cfd-type">
            <option value="video">Videos only</option>
            <option value="all">All</option>
          </select>
        </div>
        <div>
          <label>Quality</label>
          <select id="cfd-quality">
            <option value="default">Default (Best)</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div class="cfd-row">
        <div>
          <label>Min duration (sec)</label>
          <input type="number" id="cfd-min-dur" value="0" min="0" step="10" />
        </div>
        <div>
          <label>Plan ID</label>
          <input type="text" id="cfd-plan" value="${planId}" placeholder="Optional" />
        </div>
      </div>

      <button class="cfd-btn cfd-btn-primary" id="cfd-scan">Scan</button>

      <div id="cfd-progress-wrap"><div id="cfd-progress-bar"></div></div>
      <div id="cfd-status"></div>
      <div id="cfd-stats"></div>

      <div class="cfd-export-group" id="cfd-exports">
        <hr class="cfd-divider"/>
        <div class="cfd-select-bar" id="cfd-select-bar">
          <button class="cfd-btn cfd-btn-outline cfd-btn-sm" id="cfd-sel-all">All</button>
          <button class="cfd-btn cfd-btn-outline cfd-btn-sm" id="cfd-sel-none">None</button>
          <button class="cfd-btn cfd-btn-outline cfd-btn-sm" id="cfd-sel-invert">Invert</button>
          <span id="cfd-sel-count"></span>
        </div>
        <div id="cfd-video-list"></div>
        <div class="cfd-row">
          <button class="cfd-btn cfd-btn-primary" id="cfd-dl-browser">Download selected</button>
          <button class="cfd-btn cfd-btn-outline" id="cfd-dl-stop" style="display:none;">Stop</button>
        </div>
        <button class="cfd-btn cfd-btn-outline" id="cfd-dl-tsv">Export selected (.tsv)</button>
      </div>
    `;
    document.body.appendChild(panel);

    // DOM refs
    const $status = panel.querySelector('#cfd-status');
    const $stats = panel.querySelector('#cfd-stats');
    const $progressWrap = panel.querySelector('#cfd-progress-wrap');
    const $progressBar = panel.querySelector('#cfd-progress-bar');
    const $exports = panel.querySelector('#cfd-exports');
    const $scan = panel.querySelector('#cfd-scan');
    const $videoList = panel.querySelector('#cfd-video-list');
    const $dlBrowser = panel.querySelector('#cfd-dl-browser');
    const $dlStop = panel.querySelector('#cfd-dl-stop');

    fab.addEventListener('click', () => panel.classList.toggle('open'));

    // ── SPA URL observer ──
    observeURLChanges(() => {
      const newCode = getUserCodeFromURL();
      const newPlan = getURLParam('postPlanId') || '';
      const $user = panel.querySelector('#cfd-user');
      const $plan = panel.querySelector('#cfd-plan');
      if (newCode && $user) $user.value = newCode;
      if ($plan) $plan.value = newPlan;

      // Handle single post pages
      injectSinglePostButton();
    });

    // ── Scan ──
    $scan.addEventListener('click', async () => {
      if (scanning) return;
      scanning = true;
      $scan.disabled = true;
      $scan.textContent = 'Scanning...';
      $exports.classList.remove('show');
      $progressWrap.style.display = 'block';
      $progressBar.style.width = '0%';
      $stats.textContent = '';
      $videoList.innerHTML = '';
      results = {};
      selectedIndices.clear();

      const userCodeInput = panel.querySelector('#cfd-user').value.trim();
      if (!userCodeInput) {
        $status.textContent = 'Please enter a user code.';
        scanning = false;
        $scan.disabled = false;
        $scan.textContent = 'Scan';
        return;
      }

      const options = {
        contentType: panel.querySelector('#cfd-type').value,
        quality: panel.querySelector('#cfd-quality').value,
        minDuration: parseInt(panel.querySelector('#cfd-min-dur').value) || 0,
        planId: panel.querySelector('#cfd-plan').value || '',
      };

      try {
        const data = await scanCreator(userCodeInput, options, (msg) => {
          $status.textContent = msg;
          const pct = Math.min(95, parseFloat($progressBar.style.width) + 2);
          $progressBar.style.width = `${pct}%`;
        });

        results = data;
        $progressBar.style.width = '100%';

        const videos = data.items.filter(i => i.type === 'video');
        const totalDur = videos.reduce((s, v) => s + v.duration, 0);

        $status.textContent = 'Scan complete!';
        $stats.innerHTML = `<b>${data.username}</b> &mdash; ${videos.length} videos (${formatDuration(totalDur)})`;

        // Build video list table with checkboxes
        if (videos.length > 0) {
          // Select all by default
          videos.forEach((_, i) => selectedIndices.add(i));

          let html = '<table><thead><tr>';
          html += '<th><input type="checkbox" id="cfd-select-all" checked /></th>';
          html += '<th>#</th><th>Title</th><th>Duration</th><th>Status</th>';
          html += '</tr></thead><tbody>';
          videos.forEach((v, i) => {
            html += `<tr id="cfd-row-${i}">`;
            html += `<td><input type="checkbox" class="cfd-row-cb" data-idx="${i}" checked /></td>`;
            html += `<td>${i + 1}</td>`;
            html += `<td title="${v.title}">${v.title.substring(0, 30)}${v.title.length > 30 ? '...' : ''}</td>`;
            html += `<td>${formatDuration(v.duration)}</td>`;
            html += `<td class="cfd-dl-status" id="cfd-st-${i}">-</td>`;
            html += '</tr>';
          });
          html += '</tbody></table>';
          $videoList.innerHTML = html;

          // Master checkbox
          panel.querySelector('#cfd-select-all').addEventListener('change', (e) => {
            setAllCheckboxes(panel, videos, e.target.checked);
          });

          // Individual checkboxes
          panel.querySelectorAll('.cfd-row-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
              const idx = parseInt(e.target.dataset.idx);
              if (e.target.checked) selectedIndices.add(idx);
              else selectedIndices.delete(idx);
              // Update master checkbox
              const master = panel.querySelector('#cfd-select-all');
              if (master) master.checked = selectedIndices.size === videos.length;
              updateSelectionCount(panel, videos);
            });
          });

          updateSelectionCount(panel, videos);
          $exports.classList.add('show');

          // Selection toolbar events
          panel.querySelector('#cfd-sel-all').onclick = () => setAllCheckboxes(panel, videos, true);
          panel.querySelector('#cfd-sel-none').onclick = () => setAllCheckboxes(panel, videos, false);
          panel.querySelector('#cfd-sel-invert').onclick = () => {
            videos.forEach((_, i) => {
              if (selectedIndices.has(i)) selectedIndices.delete(i);
              else selectedIndices.add(i);
            });
            panel.querySelectorAll('.cfd-row-cb').forEach((cb, i) => {
              cb.checked = selectedIndices.has(i);
            });
            const master = panel.querySelector('#cfd-select-all');
            if (master) master.checked = selectedIndices.size === videos.length;
            updateSelectionCount(panel, videos);
          };
        }
      } catch (err) {
        $status.textContent = `Error: ${err.message}`;
        console.error('[Candfans DL]', err);
      } finally {
        scanning = false;
        $scan.disabled = false;
        $scan.textContent = 'Scan';
      }
    });

    // ── Export TSV (selected only) ──
    panel.querySelector('#cfd-dl-tsv').addEventListener('click', () => {
      if (!results.items) return;
      const tsv = generateTSV(results, selectedIndices.size > 0 ? selectedIndices : null);
      triggerDownloadFile(tsv, `candfans_${results.username}_urls.tsv`);
    });

    // ── Download in browser (selected only) ──
    $dlBrowser.addEventListener('click', async () => {
      if (!results.items || downloading) return;
      const videos = results.items.filter(i => i.type === 'video');
      if (!videos.length || selectedIndices.size === 0) return;

      $dlBrowser.style.display = 'none';
      $dlStop.style.display = 'block';

      await downloadAllHLS(
        videos,
        selectedIndices,
        (idx, cls, msg) => {
          const el = panel.querySelector(`#cfd-st-${idx}`);
          if (el) { el.className = `cfd-dl-status ${cls}`; el.textContent = msg; }
          const row = panel.querySelector(`#cfd-row-${idx}`);
          if (row) row.scrollIntoView({ block: 'nearest' });
        },
        (msg) => { $status.textContent = msg; }
      );

      $dlBrowser.style.display = 'block';
      $dlStop.style.display = 'none';
    });

    // ── Stop download ──
    $dlStop.addEventListener('click', () => {
      if (abortController) abortController.abort();
    });

    // ── Initial single post check ──
    injectSinglePostButton();
  }

  // ── Bootstrap ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
