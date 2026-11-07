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
  let items = [], limit = 12, generated = null;
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
  function render() {
    list.replaceChildren();
    const selected = items.filter(item => !author.value || item.sourceHandle === author.value);
    if (!selected.length) list.append(node('p', '目前沒有符合條件的公開貼文。', 'desc'));
    selected.slice(0, limit).forEach(item => {
      const entry = node('article', null, 'x-entry');
      entry.append(node('div', 'X', 'avatar'));
      const body = node('div');
      body.append(node('h4', '@' + item.sourceHandle));
      body.append(time('發布：', item.publishedAt), time('收錄轉發：', item.forwardedAt));
      if (item.summaryKind === 'ai' && typeof item.summary === 'string' && item.summary.trim()) {
        body.append(node('p', 'AI 摘要 · 非原文，請對照來源查核', 'expert-warning'));
        body.append(node('p', item.summary.slice(0, 700)));
      } else body.append(node('p', '原文連結 · 未提供已審閱摘要'));
      const link = node('a', '閱讀 X 原始貼文 ↗');
      link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      body.append(link); entry.append(body); list.append(entry);
    });
    more.hidden = selected.length <= limit;
  }
  function freshness() {
    if (!generated) return;
    const stale = Date.now() - generated.getTime() > staleMs;
    state.textContent = stale ? '快照已過期' : items.length + ' 則公開貼文';
    updated.replaceChildren(time('快照更新：', generated.toISOString()));
    updated.classList.toggle('expert-warning', stale);
    if (stale) updated.append('超過 24 小時未更新，不代表最新市場觀點。');
  }
  async function load() {
    refresh.disabled = true; state.textContent = '載入中';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('data/expert-views.json', {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new Error('Feed unavailable');
      const data = await response.json();
      if (data.schemaVersion !== 1 || data.source !== 'x-post-tracker' || !Array.isArray(data.items)) throw new Error('Unsupported schema');
      const stamp = date(data.generatedAt);
      if (!stamp || stamp.getTime() > Date.now() + 300000) throw new Error('Missing or invalid timestamp');
      const seen = new Set();
      items = data.items.filter(validItem).filter(item => !seen.has(item.id) && seen.add(item.id)).sort((a, b) => (Date.parse(b.forwardedAt) || 0) - (Date.parse(a.forwardedAt) || 0));
      const rejected = data.items.length && !items.length;
      if (rejected) throw new Error('No valid entries');
      generated = stamp; limit = 12;
      const previous = author.value;
      author.replaceChildren(new Option('全部帳號', ''));
      [...new Set(items.map(i => i.sourceHandle))].sort().forEach(handle => author.add(new Option('@' + handle, handle)));
      if ([...author.options].some(o => o.value === previous)) author.value = previous;
      render(); freshness();
    } catch (_) {
      state.textContent = generated ? '更新失敗 · 舊快照' : '尚無可用快照';
      updated.textContent = generated ? '無法取得新資料，以下保留上次載入的內容；快照時間：' + generated.toISOString() : '公開資料尚未就緒或暫時無法讀取，請稍後重新讀取。';
      updated.classList.add('expert-warning');
      if (!generated) { items = []; render(); }
    } finally { clearTimeout(timeout); refresh.disabled = false; }
  }
  author.addEventListener('change', () => { limit = 12; render(); });
  more.addEventListener('click', () => { limit += 12; render(); });
  refresh.addEventListener('click', load);
  load();
}());
