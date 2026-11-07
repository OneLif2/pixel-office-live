/* Public, allow-listed feed only. Never render source strings as HTML. */
(function () {
  'use strict';
  const state = document.getElementById('expert-state');
  const updated = document.getElementById('expert-updated');
  const list = document.getElementById('expert-items');
  const author = document.getElementById('expert-author');
  const more = document.getElementById('expert-more');
  const refresh = document.getElementById('expert-refresh');
  const staleMs = 24 * 60 * 60 * 1000;
  const refreshMs = 5 * 60 * 1000;
  let items = [], limit = 12, generated = null;
  let loading = false, loadFailed = false, lastAttempt = 0;
  function node(tag, text, cls) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  function date(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value) : null;
  }
  function time(label, value) {
    const d = date(value), p = node('p', label, 'tiny');
    if (!d) { p.append('時間不詳'); return p; }
    const t = node('time', d.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei', hour12: false}) + ' 台北');
    t.dateTime = d.toISOString(); p.append(t); return p;
  }
  function validItem(item) {
    if (!item || typeof item.id !== 'string' || !/^\d{5,25}$/.test(item.id)) return false;
    if (typeof item.sourceHandle !== 'string' || !/^[A-Za-z0-9_]{1,15}$/.test(item.sourceHandle)) return false;
    return item.url === 'https://x.com/' + item.sourceHandle + '/status/' + item.id;
  }
  function provenance(item) {
    // Only fixed labels are displayed; unknown metadata is never echoed.
    if (item.deliveryKinds !== undefined) {
      if (!Array.isArray(item.deliveryKinds) || !item.deliveryKinds.length ||
          item.deliveryKinds.some(kind => kind !== 'individual' && kind !== 'digest')) return '收錄方式未詳';
      const individual = item.deliveryKinds.includes('individual');
      const digest = item.deliveryKinds.includes('digest');
      if (individual && digest) return '個別轉發 + 摘要收錄';
      return digest ? '摘要收錄' : '個別轉發';
    }
    // Compatible with snapshots created before deliveryKinds was introduced.
    if (item.tier === 'DIGEST') return '摘要收錄';
    if (['FORWARD', 'HIGH', 'CRITICAL'].includes(item.tier)) return '個別轉發';
    return '收錄方式未詳';
  }
  function publicSummary(item) {
    if (item.summaryKind !== 'ai' || typeof item.summary !== 'string') return null;
    const text = item.summary.trim();
    // Reject overlength rather than cutting a qualifier or changing the author's meaning.
    if (!text || Array.from(text).length >= 100 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u.test(text)) return null;
    return text;
  }
  function publicCorrection(item) {
    const correction = item.correction;
    if (!correction || typeof correction !== 'object') return null;
    const text = publicSummary({summaryKind: 'ai', summary: correction.text});
    if (!text || !Array.isArray(correction.sources) || correction.sources.length < 1 || correction.sources.length > 3) return null;
    const safeSEC = /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/\d+\/(?:xslF345X\d+\/)?[A-Za-z0-9_.-]+\.xml$/;
    if (correction.sources.some(source => !source || typeof source.url !== 'string' || !safeSEC.test(source.url))) return null;
    return {text, sources: correction.sources};
  }
  function render() {
    list.replaceChildren();
    const selected = items.filter(item => !author.value || item.sourceHandle === author.value);
    if (!selected.length) list.append(node('p', '目前沒有符合條件的公開貼文。', 'desc'));
    selected.slice(0, limit).forEach(item => {
      const entry = node('article', null, 'x-entry');
      entry.append(node('div', 'X', 'avatar'));
      const body = node('div');
      body.append(node('h4', '@' + item.sourceHandle));
      body.append(node('span', provenance(item), 'badge expert-provenance'));
      body.append(time('發布：', item.publishedAt), time('最近收錄：', item.forwardedAt));
      const correction = publicCorrection(item);
      const invalidCorrection = Object.prototype.hasOwnProperty.call(item, 'correction') && !correction;
      const summary = invalidCorrection ? null : publicSummary(item);
      if (summary) {
        body.append(node('p', 'AI 原文摘要 · 未經獨立查核，請對照來源', 'expert-warning'));
        body.append(node('p', summary, 'expert-summary'));
      } else body.append(node('p', invalidCorrection ? '補充查核資料待核對，暫不顯示摘要。' : '原文連結 · 暫無可用的原文摘要'));
      if (correction) {
        const note = node('aside', null, 'expert-correction');
        note.append(node('strong', '補充查核 · SEC 文件'));
        note.append(node('p', correction.text));
        correction.sources.forEach(source => {
          const citation = node('a', '查看 SEC Form 4 與註腳 ↗');
          citation.href = source.url; citation.target = '_blank'; citation.rel = 'noopener noreferrer';
          note.append(citation);
        });
        body.append(note);
      }
      const link = node('a', '閱讀 X 原始貼文 ↗');
      link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      body.append(link); entry.append(body); list.append(entry);
    });
    more.hidden = selected.length <= limit;
  }
  function freshness() {
    if (!generated) return;
    const stale = Date.now() - generated.getTime() > staleMs;
    state.textContent = loadFailed ? '更新失敗 · 舊快照' : stale ? '快照已過期' : items.length + ' 則公開貼文';
    updated.replaceChildren(time('已發布快照產生時間：', generated.toISOString()));
    updated.append(node('p', '完整來源檢查：尚無可驗證的完成時間。快照產生、排程成功或本站重讀皆不代表完整來源檢查已完成。', 'tiny'));
    updated.classList.toggle('expert-warning', !!(stale || loadFailed));
    if (loadFailed) updated.append(node('p', '無法取得新快照，保留上次內容；仍依原有時間判斷資料年齡。', 'tiny'));
    if (stale) updated.append(node('p', '快照已超過 24 小時，不代表最新市場觀點。', 'tiny'));
  }
  async function load() {
    if (loading) return;
    loading = true; lastAttempt = Date.now();
    refresh.disabled = true;
    if (!generated) state.textContent = '載入中';
    else freshness();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('data/expert-views.json', {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new Error('Feed unavailable');
      const data = await response.json();
      if (data.schemaVersion !== 1 || data.source !== 'x-post-tracker' || !Array.isArray(data.items)) throw new Error('Unsupported schema');
      const stamp = date(data.generatedAt);
      if (!stamp || stamp.getTime() > Date.now() + 300000) throw new Error('Missing or invalid timestamp');
      if (generated && stamp.getTime() < generated.getTime()) throw new Error('Older snapshot rejected');
      const seen = new Set();
      const nextItems = data.items.filter(validItem).filter(item => !seen.has(item.id) && seen.add(item.id)).sort((a, b) => (Date.parse(b.forwardedAt) || 0) - (Date.parse(a.forwardedAt) || 0));
      const rejected = data.items.length && !nextItems.length;
      if (rejected) throw new Error('No valid entries');
      // Schema v1 has no attested complete-check timestamp. Never infer it from a heartbeat.
      items = nextItems; generated = stamp; loadFailed = false;
      const previous = author.value;
      author.replaceChildren(new Option('全部帳號', ''));
      [...new Set(items.map(i => i.sourceHandle))].sort().forEach(handle => author.add(new Option('@' + handle, handle)));
      if ([...author.options].some(o => o.value === previous)) author.value = previous;
      render(); freshness();
    } catch (_) {
      loadFailed = true;
      if (generated) freshness();
      else {
        state.textContent = '尚無可用快照';
        updated.textContent = '公開資料尚未就緒或暫時無法讀取，請稍後重新讀取。';
        updated.classList.add('expert-warning');
        items = []; render();
      }
    } finally { clearTimeout(timeout); loading = false; refresh.disabled = false; }
  }
  author.addEventListener('change', () => { limit = 12; render(); });
  more.addEventListener('click', () => { limit += 12; render(); });
  refresh.addEventListener('click', load);
  function resume() {
    freshness();
    if (!document.hidden && Date.now() - lastAttempt >= 60000) load();
  }
  // Age changes even when no new snapshot arrives. Resume handles throttled background timers.
  setInterval(freshness, 60000);
  setInterval(() => { if (!document.hidden) load(); }, refreshMs);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  window.addEventListener('pageshow', resume);
  load();
}());
