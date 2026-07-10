// ランキン！ — SPAルーター（記事メディア風レイアウト）
//   /                トップ（特集記事 + 新着記事一覧）
//   /category/{id}   カテゴリ内の記事一覧
//   /topic/{id}       個別記事（リード文 + 順位表 + 本文 + 出典）

const DATA = window.RANKING_DATA;
const CATEGORIES = DATA.categories;
const TOPICS = DATA.topics;

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function fmt(n) {
  return Number(n).toLocaleString('ja-JP');
}
function category(id) {
  return CATEGORIES.find(function (c) { return c.id === id; }) || { name: id };
}
function topicsOfCategory(id) {
  return TOPICS.filter(function (t) { return t.category === id; });
}
function latestPeriod(topic) {
  return topic.periods[topic.periods.length - 1];
}
function prevPeriod(topic) {
  return topic.periods.length > 1 ? topic.periods[topic.periods.length - 2] : null;
}
function rankedEntries(period) {
  return period.entries
    .slice()
    .sort(function (a, b) { return b.value - a.value; })
    .map(function (e, i) { return { rank: i + 1, name: e.name, value: e.value }; });
}
function prevRankMap(topic) {
  const prev = prevPeriod(topic);
  if (!prev) return null;
  const map = {};
  rankedEntries(prev).forEach(function (e) { map[e.name] = e; });
  return map;
}
function topChangePct(topic) {
  const prevMap = prevRankMap(topic);
  if (!prevMap) return 0;
  const top = rankedEntries(latestPeriod(topic))[0];
  const prev = prevMap[top.name];
  if (!prev) return 100;
  return Math.abs(((top.value - prev.value) / prev.value) * 100);
}
function deltaHtml(cur, prevMap) {
  if (!prevMap) return '';
  const prev = prevMap[cur.name];
  if (!prev) return '<span class="delta new">NEW</span>';
  const rankDiff = prev.rank - cur.rank;
  const pct = ((cur.value - prev.value) / prev.value) * 100;
  const sign = pct > 0 ? '+' : '';
  const cls = rankDiff > 0 ? 'up' : rankDiff < 0 ? 'down' : 'flat';
  const arrow = rankDiff > 0 ? '↑' + rankDiff : rankDiff < 0 ? '↓' + Math.abs(rankDiff) : '→';
  return '<span class="delta ' + cls + '">' + arrow +
    '<span class="delta-pct">' + sign + pct.toFixed(1) + '%</span></span>';
}
function dateLabel(topic) {
  if (!topic.updatedAt) return '';
  return topic.updatedAt.replace(/-/g, '.');
}
function eyecatchHtml(topic, size) {
  const top = rankedEntries(latestPeriod(topic))[0];
  return '<div class="eyecatch ' + esc(topic.category) + (size ? ' ' + size : '') + '">' +
    '<span class="eyecatch-rank">1<i>位</i></span>' +
    '<span class="eyecatch-name">' + esc(top.name) + '</span></div>';
}
function tagHtml(topic) {
  const cat = category(topic.category);
  return '<span class="tag tag-' + esc(topic.category) + '">' + esc(cat.name) + '</span>';
}

// ---- 記事カード（一覧・トップ用） ----
function articleCardHtml(topic) {
  return '<a class="article-card" href="/topic/' + esc(topic.id) + '">' +
    '<div class="ac-body">' +
      '<div class="ac-meta">' + tagHtml(topic) + '<span class="ac-date">' + esc(dateLabel(topic)) + '</span></div>' +
      '<h3 class="ac-title">' + esc(topic.title) + '</h3>' +
      '<p class="ac-lead">' + esc(topic.lead || '') + '</p>' +
    '</div>' +
  '</a>';
}

// ---- トップページ（特集 + 新着一覧） ----
function featuredTopic() {
  return TOPICS.slice().sort(function (a, b) { return topChangePct(b) - topChangePct(a); })[0];
}
function featuredHtml(topic) {
  const period = latestPeriod(topic);
  const top = rankedEntries(period)[0];
  const trend = topic.periods.length > 1 ? deltaHtml(top, prevRankMap(topic)) : '';
  return '<a class="featured" href="/topic/' + esc(topic.id) + '">' +
    eyecatchHtml(topic, 'featured-eye') +
    '<div class="featured-body">' +
      '<div class="ac-meta">' + tagHtml(topic) + '<span class="ac-date">' + esc(dateLabel(topic)) + '</span></div>' +
      '<h1 class="featured-title">' + esc(topic.title) + '</h1>' +
      '<p class="featured-lead">' + esc(topic.lead || '') + '</p>' +
      '<div class="featured-top"><span class="tc-rank">1位</span> ' +
        '<strong>' + esc(top.name) + '</strong> ' + fmt(top.value) + esc(topic.unit) + ' ' + trend + '</div>' +
    '</div>' +
  '</a>';
}
function homeHtml() {
  const featured = featuredTopic();
  const rest = TOPICS.filter(function (t) { return t.id !== featured.id; });
  return '<section class="featured-section">' + featuredHtml(featured) + '</section>' +
    '<section class="latest-section">' +
      '<h2 class="section-h">新着のランキング</h2>' +
      '<div class="article-list">' + rest.map(articleCardHtml).join('') + '</div>' +
    '</section>';
}

// ---- カテゴリページ ----
function categoryHtml(id) {
  const cat = category(id);
  const list = topicsOfCategory(id);
  return '<a class="back" href="/">← トップへ戻る</a>' +
    '<h1 class="cat-title">' + esc(cat.name) + 'のランキング</h1>' +
    '<div class="article-list article-list-wide">' + list.map(articleCardHtml).join('') + '</div>';
}

// ---- 個別記事ページ ----
function prevRankMapAt(topic, idx) {
  if (idx <= 0) return null;
  const map = {};
  rankedEntries(topic.periods[idx - 1]).forEach(function (e) { map[e.name] = e; });
  return map;
}
function podiumHtml(topic, idx) {
  const period = topic.periods[idx];
  const prevMap = prevRankMapAt(topic, idx);
  const top3 = rankedEntries(period).slice(0, 3);
  // 表彰台の見た目に合わせて 2位・1位・3位の順で並べる
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  return '<div class="podium">' + order.map(function (e) {
    return '<div class="podium-item pd-rank' + e.rank + '">' +
      '<span class="podium-rank">' + e.rank + '<span class="podium-rank-suffix">位</span></span>' +
      '<span class="podium-name">' + esc(e.name) + '</span>' +
      '<span class="podium-value">' + fmt(e.value) + '<span class="unit">' + esc(topic.unit) + '</span></span>' +
      (prevMap ? deltaHtml(e, prevMap) : '') +
    '</div>';
  }).join('') + '</div>';
}
function rankRowsHtml(list, topic, prevMap) {
  return list.map(function (e) {
    return '<tr><td class="col-rank">' + e.rank + '</td>' +
      '<td class="col-name">' + esc(e.name) + '</td>' +
      '<td class="col-value">' + fmt(e.value) + '<span class="unit">' + esc(topic.unit) + '</span></td>' +
      '<td class="col-delta">' + (prevMap ? deltaHtml(e, prevMap) : '') + '</td></tr>';
  }).join('');
}
function restTableHtml(topic, idx) {
  const period = topic.periods[idx];
  const prevMap = prevRankMapAt(topic, idx);
  const rest = rankedEntries(period).slice(3, 10);
  if (!rest.length) return '';
  return '<figure class="rank-figure">' +
    '<figcaption class="period-label">4位〜' + rest[rest.length - 1].rank + '位</figcaption>' +
    '<table class="rank-table"><tbody>' + rankRowsHtml(rest, topic, prevMap) + '</tbody></table>' +
  '</figure>';
}
function extendedListHtml(topic, idx) {
  const period = topic.periods[idx];
  const prevMap = prevRankMapAt(topic, idx);
  const rest = rankedEntries(period).slice(10);
  if (!rest.length) return '';
  return '<section class="extended-ranking">' +
    '<h2 class="section-h article-section-h">11位以降のランキング</h2>' +
    '<details class="extended-details">' +
      '<summary>11位〜' + rest[rest.length - 1].rank + '位を全て見る（全' + (rest.length + 10) + '件中）</summary>' +
      '<table class="rank-table extended-table"><tbody>' + rankRowsHtml(rest, topic, prevMap) + '</tbody></table>' +
    '</details>' +
  '</section>';
}
function periodContentHtml(topic, idx) {
  const period = topic.periods[idx];
  const periodHead = period.period ? esc(period.period) + '年のランキング' : 'ランキング';
  return '<h2 class="section-h article-section-h">' + periodHead + '</h2>' +
    podiumHtml(topic, idx) +
    restTableHtml(topic, idx);
}
function periodTabsHtml(topic, idx) {
  if (topic.periods.length < 2) return '';
  const items = topic.periods.map(function (p, i) { return { p: p, i: i }; }).reverse();
  return '<div class="period-tabs" role="tablist">' + items.map(function (o) {
    const p = o.p, i = o.i;
    return '<button type="button" class="period-tab' + (i === idx ? ' active' : '') +
      '" data-idx="' + i + '" aria-pressed="' + (i === idx) + '">' + esc(p.period) + '年</button>';
  }).join('') + '</div>';
}
function analysisHtml(topic) {
  const list = topic.analysis;
  if (!list || !list.length) return '';
  return '<section class="analysis">' +
    '<h2 class="section-h article-section-h">考察</h2>' +
    list.map(function (p) { return '<p class="article-body">' + esc(p) + '</p>'; }).join('') +
  '</section>';
}
function relatedTopics(topic) {
  return TOPICS.filter(function (t) { return t.category === topic.category && t.id !== topic.id; });
}
function otherCategoryTopics(topic) {
  return TOPICS.filter(function (t) { return t.category !== topic.category; });
}
function relatedHtml(topic) {
  const list = relatedTopics(topic);
  if (!list.length) return '';
  return '<section class="related">' +
    '<h2 class="section-h">関連するランキング</h2>' +
    '<div class="article-list">' + list.map(articleCardHtml).join('') + '</div>' +
  '</section>';
}
function otherRelatedHtml(topic) {
  const list = otherCategoryTopics(topic);
  if (!list.length) return '';
  return '<section class="related">' +
    '<h2 class="section-h">こちらのランキングも読まれています</h2>' +
    '<div class="article-list">' + list.map(articleCardHtml).join('') + '</div>' +
  '</section>';
}
function topicDetailHtml(id) {
  const topic = TOPICS.find(function (t) { return t.id === id; });
  if (!topic) return '<p class="empty">記事が見つかりません。</p>';
  const idx = topic.periods.length - 1;
  return '<a class="back" href="/category/' + esc(topic.category) + '">← ' + esc(category(topic.category).name) + 'へ戻る</a>' +
    '<article class="article" data-topic="' + esc(topic.id) + '">' +
      '<div class="ac-meta">' + tagHtml(topic) + '<span class="ac-date">' + esc(dateLabel(topic)) + ' 更新</span></div>' +
      '<h1 class="article-h1">' + esc(topic.title) + '</h1>' +
      (topic.lead ? '<p class="article-lead">' + esc(topic.lead) + '</p>' : '') +
      eyecatchHtml(topic, 'article-eye') +
      (topic.commentary ? '<p class="article-body">' + esc(topic.commentary) + '</p>' : '') +
      periodTabsHtml(topic, idx) +
      '<div class="period-block">' + periodContentHtml(topic, idx) + '</div>' +
      analysisHtml(topic) +
      '<div class="extended-block">' + extendedListHtml(topic, idx) + '</div>' +
      '<p class="source">出典: <a href="' + esc(topic.sourceUrl) + '" target="_blank" rel="noopener">' + esc(topic.source) + '</a></p>' +
    '</article>' +
    relatedHtml(topic) +
    otherRelatedHtml(topic);
}

// ---- ルーティング ----
function navHtml() {
  return CATEGORIES.map(function (c) {
    return '<a href="/category/' + esc(c.id) + '">' + esc(c.name) + '</a>';
  }).join('');
}
const SITE_NAME = 'ランキン！';
const SITE_DEFAULT_DESC = '人口・面積・GDP・漁獲量など、統計や記録にもとづく「事実」のランキングを、出典つきで届けるサイト。ユーザー投票・投稿によるランキングは扱いません。';
// canonical / og:url は本番ドメイン固定の絶対URLにする（プレビュー環境のURLがcanonicalに漏れないように）。
const CANONICAL_ORIGIN = 'https://rankin-q.com';
function setMeta(title, description) {
  document.title = title;
  const set = function (id, attr, value) {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, value);
  };
  const absUrl = CANONICAL_ORIGIN + location.pathname;
  set('meta-description', 'content', description);
  set('meta-canonical', 'href', absUrl);
  set('meta-og-title', 'content', title);
  set('meta-og-description', 'content', description);
  set('meta-og-url', 'content', absUrl);
  set('meta-twitter-title', 'content', title);
  set('meta-twitter-description', 'content', description);
}
function router() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const mCat = path.match(/^\/category\/(.+)$/);
  const mTopic = path.match(/^\/topic\/(.+)$/);
  let html;
  if (mTopic) {
    const id = decodeURIComponent(mTopic[1]);
    html = topicDetailHtml(id);
    const topic = TOPICS.find(function (t) { return t.id === id; });
    if (topic) setMeta(topic.title + '｜' + SITE_NAME, topic.lead || SITE_DEFAULT_DESC);
    else setMeta(SITE_NAME, SITE_DEFAULT_DESC);
  } else if (mCat) {
    const id = decodeURIComponent(mCat[1]);
    html = categoryHtml(id);
    const cat = category(id);
    setMeta(cat.name + 'のランキング一覧｜' + SITE_NAME, cat.name + 'に関する、出典のある統計・記録データにもとづくランキング記事の一覧。');
  } else {
    html = homeHtml();
    setMeta(SITE_NAME + '｜事実にもとづくランキングを、年ごとの変化つきで', SITE_DEFAULT_DESC);
  }
  document.getElementById('view').innerHTML = html;
  window.scrollTo(0, 0);
}
function navigate(path) {
  if (location.pathname !== path) history.pushState(null, '', path);
  router();
}

const PROD_HOSTS = [];
function showEnvBadge() {
  const host = location.hostname;
  if (PROD_HOSTS.indexOf(host) !== -1) return;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
  const el = document.createElement('div');
  el.textContent = (isLocal ? 'ローカル' : 'プレビュー') + '環境（仮データ表示中）';
  el.style.cssText =
    'position:fixed;top:8px;right:8px;z-index:9999;background:#1e6f5c;color:#fff;' +
    'font-size:12px;font-weight:700;padding:4px 11px;border-radius:4px;' +
    'font-family:var(--font);box-shadow:0 1px 4px rgba(0,0,0,.25);';
  document.body.appendChild(el);
}

function init() {
  document.getElementById('nav').innerHTML = navHtml();
  showEnvBadge();
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    const tab = ev.target.closest('.period-tab');
    if (tab) {
      const article = tab.closest('.article');
      const topic = TOPICS.find(function (t) { return t.id === article.getAttribute('data-topic'); });
      const idx = Number(tab.getAttribute('data-idx'));
      article.querySelector('.period-tabs').outerHTML = periodTabsHtml(topic, idx);
      article.querySelector('.period-block').innerHTML = periodContentHtml(topic, idx);
      article.querySelector('.extended-block').innerHTML = extendedListHtml(topic, idx);
      return;
    }
    const a = ev.target.closest('a');
    if (a) {
      const href = a.getAttribute('href');
      if (href && href.charAt(0) === '/') {
        ev.preventDefault();
        navigate(href);
      }
    }
  });
  window.addEventListener('popstate', router);
  router();
}

init();
