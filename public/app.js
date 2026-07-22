// ランキンQ — SPAルーター（記事メディア風レイアウト）
//   /                トップ（特集記事 + 新着記事一覧）
//   /category/{id}   カテゴリ内の記事一覧
//   /topic/{id}       個別記事（リード文 + 順位表 + 本文 + 出典）
//   /entity/{id}      実体詳細ページ（都道府県・国などが登場する記事の内部リンク集）

const DATA = window.RANKING_DATA;
const CATEGORIES = DATA.categories;
const TOPICS = DATA.topics;
const ENTITIES = window.ENTITIES_DATA || {};
const ENTITY_TYPE_LABEL = {
  prefecture: '都道府県', country: '国', mountain: '山', lake: '湖', river: '川',
  building: '建造物', movie: '映画', religion: '宗教', language: '言語', food: '食べ物',
  ocean: '海洋', continent: '大陸', island: '島', desert: '砂漠', planet: '惑星',
  trench: '海溝', waterfall: '滝', metro: '都市圏', other: 'その他',
};
// entityの表示名(name) -> スラッグ の逆引き。記事内の項目名から実体詳細ページへリンクするために使う。
const NAME_TO_SLUG = {};
Object.keys(ENTITIES).forEach(function (slug) { NAME_TO_SLUG[ENTITIES[slug].name] = slug; });

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
// 本文中の **強調したい語句** を<strong>に変換する（先にescするのでHTML注入の心配はない）。
function richText(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
function fmt(n) {
  return Number(n).toLocaleString('ja-JP');
}
function nameLinkHtml(name) {
  const slug = NAME_TO_SLUG[name];
  if (!slug) return esc(name);
  return '<a class="entity-link" href="/entity/' + esc(slug) + '">' + esc(name) + '</a>';
}
// items: [{label, href}]。最後の要素はhrefなし（現在地）として扱う。
function breadcrumbHtml(items) {
  return '<nav class="breadcrumb" aria-label="パンくずリスト">' +
    items.map(function (item, i) {
      const sep = i > 0 ? '<span class="breadcrumb-sep">›</span>' : '';
      const isLast = i === items.length - 1;
      const inner = (!isLast && item.href)
        ? '<a href="' + esc(item.href) + '">' + esc(item.label) + '</a>'
        : '<span aria-current="page">' + esc(item.label) + '</span>';
      return sep + inner;
    }).join('') +
  '</nav>';
}
function setBreadcrumbJsonLd(items) {
  let el = document.getElementById('breadcrumb-jsonld');
  if (!items) {
    if (el) el.remove();
    return;
  }
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(function (item, i) {
      const entry = { '@type': 'ListItem', position: i + 1, name: item.label };
      if (item.href) entry.item = CANONICAL_ORIGIN + item.href;
      return entry;
    }),
  };
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'breadcrumb-jsonld';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
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
    .map(function (e, i) { return { rank: i + 1, name: e.name, value: e.value, note: e.note || '' }; });
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
function tagHtml(topic) {
  const cat = category(topic.category);
  return '<span class="tag tag-' + esc(topic.category) + '">' + esc(cat.name) + '</span>';
}

// ---- 記事カード（一覧・トップ用） ----
function articleCardHtml(topic) {
  return '<a class="article-card" href="/topic/' + esc(topic.id) + '">' +
    (topic.thumbnail ? '<img class="ac-thumb" src="' + esc(topic.thumbnail) + '" alt="" loading="lazy" />' : '') +
    '<div class="ac-body">' +
      '<div class="ac-meta">' + tagHtml(topic) + '<span class="ac-date">' + esc(dateLabel(topic)) + '</span></div>' +
      '<h3 class="ac-title">' + esc(topic.title) + '</h3>' +
      '<p class="ac-lead">' + richText(topic.lead || '') + '</p>' +
    '</div>' +
  '</a>';
}

// ---- トップページ（FVスライダー + カテゴリ別一覧） ----
function sliderTopics() {
  // 各カテゴリから、直近の変動が最も大きいトピックを1本ずつピックしてスライダーに出す（カテゴリの多様性を出す）
  return CATEGORIES.map(function (c) {
    const list = topicsOfCategory(c.id);
    if (!list.length) return null;
    return list.slice().sort(function (a, b) { return topChangePct(b) - topChangePct(a); })[0];
  }).filter(Boolean);
}
function sliderSlideHtml(topic) {
  return '<a class="slide" href="/topic/' + esc(topic.id) + '">' +
    (topic.thumbnail ? '<img class="slide-thumb" src="' + esc(topic.thumbnail) + '" alt="" loading="lazy" />' : '') +
    '<div class="featured-body">' +
      '<div class="ac-meta">' + tagHtml(topic) + '<span class="ac-date">' + esc(dateLabel(topic)) + '</span></div>' +
      '<h2 class="featured-title">' + esc(topic.title) + '</h2>' +
      '<p class="featured-lead">' + richText(topic.lead || '') + '</p>' +
    '</div>' +
  '</a>';
}
function sliderHtml() {
  const slides = sliderTopics();
  if (!slides.length) return '';
  return '<section class="fv-slider-section">' +
    '<div class="fv-slider" id="fv-slider">' + slides.map(sliderSlideHtml).join('') + '</div>' +
    (slides.length > 1 ? (
      '<div class="fv-slider-nav">' +
        '<button type="button" class="fv-nav-btn" data-dir="-1" aria-label="前のランキング">‹</button>' +
        '<div class="fv-dots">' + slides.map(function (_, i) { return '<span class="fv-dot' + (i === 0 ? ' active' : '') + '"></span>'; }).join('') + '</div>' +
        '<button type="button" class="fv-nav-btn" data-dir="1" aria-label="次のランキング">›</button>' +
      '</div>'
    ) : '') +
  '</section>';
}
function categorySectionsHtml() {
  return CATEGORIES.map(function (c) {
    const list = topicsOfCategory(c.id);
    if (!list.length) return '';
    return '<section class="cat-section">' +
      '<h2 class="section-h"><a class="cat-section-link" href="/category/' + esc(c.id) + '">' + esc(c.name) + '</a></h2>' +
      '<div class="article-list">' + list.map(articleCardHtml).join('') + '</div>' +
    '</section>';
  }).join('');
}
function homeHtml() {
  return '<h1 class="sr-only">' + esc(SITE_NAME) + '｜事実にもとづくランキングを、年ごとの変化つきで</h1>' +
    sliderHtml() +
    categorySectionsHtml();
}
function initFvSlider() {
  const slider = document.getElementById('fv-slider');
  if (!slider) return;
  const dotsWrap = document.querySelector('.fv-dots');
  const dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.children) : [];
  const updateDots = function () {
    if (!dots.length) return;
    const firstSlide = slider.querySelector('.slide');
    const step = firstSlide ? firstSlide.getBoundingClientRect().width + 18 : slider.clientWidth;
    const idx = Math.min(dots.length - 1, Math.round(slider.scrollLeft / step));
    dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
  };
  slider.addEventListener('scroll', function () {
    window.clearTimeout(slider._fvScrollTimer);
    slider._fvScrollTimer = window.setTimeout(updateDots, 80);
  });
}

// ---- カテゴリページ ----
function categoryHtml(id) {
  const cat = category(id);
  const list = topicsOfCategory(id);
  return '<h1 class="cat-title">' + esc(cat.name) + 'のランキング</h1>' +
    '<div class="article-list article-list-wide">' + list.map(articleCardHtml).join('') + '</div>';
}

// ---- 個別記事ページ ----
function prevRankMapAt(topic, idx) {
  if (idx <= 0) return null;
  const map = {};
  rankedEntries(topic.periods[idx - 1]).forEach(function (e) { map[e.name] = e; });
  return map;
}
// トップ3カードの「前年比・順位変動」テキスト。前期間データが無ければ空。
function trendText(cur, prevMap) {
  if (!prevMap) return '';
  const prev = prevMap[cur.name];
  if (!prev) return '<span class="trend trend-new">初登場</span>';
  const rankDiff = prev.rank - cur.rank;
  const pct = ((cur.value - prev.value) / prev.value) * 100;
  const sign = pct > 0 ? '+' : '';
  let rankStr, cls, arrow;
  if (rankDiff > 0) { rankStr = rankDiff + 'つ上昇'; cls = 'up'; arrow = '↑'; }
  else if (rankDiff < 0) { rankStr = Math.abs(rankDiff) + 'つ下降'; cls = 'down'; arrow = '↓'; }
  else { rankStr = '順位変動なし'; cls = 'flat'; arrow = '→'; }
  return '<span class="trend trend-' + cls + '">' + arrow + ' 前年比 ' + sign + pct.toFixed(1) + '%・' + rankStr + '</span>';
}
// トップ3を縦積みのリッチカードで表示する（メダル・画像・数値・推移・説明文）。
function topThreeHtml(topic, idx) {
  const period = topic.periods[idx];
  const prevMap = prevRankMapAt(topic, idx);
  const top3 = rankedEntries(period).slice(0, 3);
  return '<div class="top3">' + top3.map(function (e) {
    const img = entityImageByName(e.name);
    const top3ImgCls = 'top3-img' + (entityIsFlag(e.name) ? ' flag-img' : '');
    const imgHtml = img ? '<img class="' + top3ImgCls + '" src="' + esc(img) + '" alt="" loading="lazy" />' : '';
    return '<div class="top3-card top3-rank' + e.rank + '">' +
      '<div class="top3-left">' +
        '<img class="top3-crown" src="/images/icons/rank-crown-' + e.rank + '.webp" alt="' + e.rank + '位" loading="lazy" />' +
        imgHtml +
      '</div>' +
      '<div class="top3-body">' +
        '<div class="top3-head">' +
          '<span class="top3-name">' + nameLinkHtml(e.name) + '</span>' +
          (prevMap ? trendText(e, prevMap) : '') +
        '</div>' +
        '<div class="top3-value">' + fmt(e.value) + '<span class="unit">' + esc(topic.unit) + '</span></div>' +
        (e.note ? '<p class="top3-note">' + richText(e.note) + '</p>' : '') +
      '</div>' +
    '</div>';
  }).join('') + '</div>';
}
function rankRowsHtml(list, topic, prevMap) {
  return list.map(function (e) {
    return '<tr><td class="col-rank">' + e.rank + '</td>' +
      '<td class="col-name">' + entityThumbHtml(e.name) + nameLinkHtml(e.name) + '</td>' +
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
    topThreeHtml(topic, idx) +
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
  const heading = topic.analysisHeading || '考察';
  return '<section class="analysis">' +
    '<h2 class="section-h article-section-h">' + esc(heading) + '</h2>' +
    list.map(function (p) { return '<p class="article-body">' + richText(p) + '</p>'; }).join('') +
  '</section>';
}
// 自由本文（sections）: 見出し・段落・箇条書き・表を好きな順で並べられる汎用ブロック。
// richText() が esc() でエスケープしてから **太字** だけ許可するのでHTML注入は起きない。
function articleTableHtml(t) {
  if (!t || !Array.isArray(t.rows)) return '';
  const headers = Array.isArray(t.headers) ? t.headers : [];
  const thead = headers.length
    ? '<thead><tr>' + headers.map(function (h) { return '<th>' + richText(String(h)) + '</th>'; }).join('') + '</tr></thead>'
    : '';
  const tbody = '<tbody>' + t.rows.map(function (r) {
    const cells = Array.isArray(r) ? r : [r];
    return '<tr>' + cells.map(function (cll) { return '<td>' + richText(String(cll)) + '</td>'; }).join('') + '</tr>';
  }).join('') + '</tbody>';
  const caption = t.caption ? '<figcaption class="article-table-cap">' + richText(String(t.caption)) + '</figcaption>' : '';
  return '<figure class="article-table-wrap"><table class="article-table">' + thead + tbody + '</table>' + caption + '</figure>';
}
function articleBlockHtml(block) {
  if (!block || typeof block !== 'object') return '';
  if (block.h2 != null) return '<h2 class="section-h article-section-h">' + esc(String(block.h2)) + '</h2>';
  if (block.h3 != null) return '<h3 class="article-section-h3">' + esc(String(block.h3)) + '</h3>';
  if (block.p != null) return '<p class="article-body">' + richText(String(block.p)) + '</p>';
  if (Array.isArray(block.list)) return '<ul class="article-list">' + block.list.map(function (li) { return '<li>' + richText(String(li)) + '</li>'; }).join('') + '</ul>';
  if (block.table != null) return articleTableHtml(block.table);
  return '';
}
function sectionsHtml(topic) {
  const list = topic.sections;
  if (!list || !list.length) return '';
  return '<section class="article-sections">' + list.map(articleBlockHtml).join('') + '</section>';
}
// listからn件だけ選ぶ。記事ごとに開始位置をずらして選ぶことで、サイト全体の
// 記事数が増えても関連リンクが「常に全記事」に膨れ上がらないようにする
// （SEO上、内部リンクが多すぎる/毎ページ同一の羅列になるのを避けるため）。
function pickRotated(list, topic, n) {
  if (list.length <= n) return list;
  const idx = TOPICS.indexOf(topic);
  const start = ((idx % list.length) + list.length) % list.length;
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[(start + i) % list.length]);
  return out;
}
function relatedTopics(topic) {
  const list = TOPICS.filter(function (t) { return t.category === topic.category && t.id !== topic.id; });
  return pickRotated(list, topic, 6);
}
function otherCategoryTopics(topic) {
  const list = TOPICS.filter(function (t) { return t.category !== topic.category; });
  return pickRotated(list, topic, 4);
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
// 実体名から、その実体の画像パスを返す（ランキング各項目の小サムネ用）。無ければ null。
function entityImageByName(name) {
  const slug = NAME_TO_SLUG[name];
  if (!slug) return null;
  const ent = ENTITIES[slug];
  return ent && ent.image ? ent.image : null;
}
// 国旗画像(flagcdn.com由来、縦横比3:2固定)かどうか。国旗は他の実体写真と違い
// 縦横比が統一されているため、正方形/4:3への強制クロップだと見切れて不格好になる。
function entityIsFlag(name) {
  const slug = NAME_TO_SLUG[name];
  return !!(slug && ENTITIES[slug] && ENTITIES[slug].type === 'country');
}
// ランキング項目名の左に出す小さいサムネ画像。実体に画像が無ければ空文字。
function entityThumbHtml(name) {
  const img = entityImageByName(name);
  if (!img) return '';
  const cls = 'rank-thumb' + (entityIsFlag(name) ? ' flag-img' : '');
  return '<img class="' + cls + '" src="' + esc(img) + '" alt="" loading="lazy" />';
}
// 推移グラフ（複数期間があるトピックだけ）。上位5件を折れ線で描く。手書きSVG・ライブラリ無し。
var TREND_COLORS = ['#1e6f5c', '#d8823a', '#3a7ca5', '#b0577d', '#7a8b3a'];
function trendChartHtml(topic) {
  const periods = topic.periods || [];
  if (periods.length < 2) return '';
  const labels = periods.map(function (p) { return p.period; });
  const latest = periods[periods.length - 1];
  const top = rankedEntries(latest).slice(0, 5);
  const series = top.map(function (e) {
    return {
      name: e.name,
      values: periods.map(function (p) {
        const hit = p.entries.find(function (x) { return x.name === e.name; });
        return hit ? hit.value : null;
      }),
    };
  });
  const all = [];
  series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
  if (!all.length) return '';
  let yMax = Math.max.apply(null, all);
  let yMin = Math.min.apply(null, all);
  const pad = (yMax - yMin) * 0.12 || yMax * 0.12;
  yMin = Math.max(0, yMin - pad); yMax = yMax + pad;

  const W = 680, H = 300, left = 66, right = W - 14, padTop = 16, bottom = 232;
  const n = labels.length;
  const xAt = function (i) { return left + (right - left) * (n === 1 ? 0.5 : i / (n - 1)); };
  const yAt = function (v) { return bottom - (bottom - padTop) * (v - yMin) / ((yMax - yMin) || 1); };

  // Y軸の目盛りは生の桁数のまま出すと(人口の億単位など)ケタが多すぎて読みにくいため、
  // 単位がすでに「億」「万」等で始まる(GDPの「億ドル」等、値が既に縮約済み)場合を除き、
  // 億/万の単位で丸めて表示する。
  const axisUnit = topic.unit || '';
  const alreadyScaled = /^(億|万)/.test(axisUnit);
  const fmtAxis = function (v) {
    const n = Math.round(v);
    if (!alreadyScaled) {
      const abs = Math.abs(n);
      if (abs >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '億';
      if (abs >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    }
    return fmt(n);
  };
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const v = yMin + (yMax - yMin) * g / 4;
    const y = yAt(v);
    grid += '<line class="chart-grid" x1="' + left + '" y1="' + y + '" x2="' + right + '" y2="' + y + '" />';
    grid += '<text class="chart-axis" x="' + (left - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + fmtAxis(v) + '</text>';
  }
  // 期間数が多い記事(数十年分など)ではラベルを全部出すと重なって読めなくなるため、
  // 目安8個程度に収まるよう間引く。最後(最新)のラベルは必ず表示する。
  let xlabels = '';
  const MAX_LABELS = 8;
  const step = Math.max(1, Math.ceil(n / MAX_LABELS));
  labels.forEach(function (lab, i) {
    const isLast = i === n - 1;
    if (i % step !== 0 && !isLast) return;
    xlabels += '<text class="chart-axis" x="' + xAt(i) + '" y="' + (bottom + 20) + '" text-anchor="middle">' + esc(String(lab)) + '</text>';
  });
  let lines = '';
  series.forEach(function (s, si) {
    const color = TREND_COLORS[si % TREND_COLORS.length];
    let d = '', dots = '', started = false;
    s.values.forEach(function (v, i) {
      if (v == null) { started = false; return; }
      const x = xAt(i), y = yAt(v);
      d += (started ? ' L' : 'M') + x + ' ' + y;
      started = true;
      dots += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + color + '" />';
    });
    lines += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" />' + dots;
  });
  const legend = series.map(function (s, si) {
    const color = TREND_COLORS[si % TREND_COLORS.length];
    return '<span class="chart-legend-item"><span class="chart-swatch" style="background:' + color + '"></span>' + nameLinkHtml(s.name) + '</span>';
  }).join('');

  return '<section class="trend-chart">' +
    '<h2 class="section-h article-section-h">上位の推移（' + esc(String(labels[0])) + '〜' + esc(String(labels[n - 1])) + '年、' + esc(topic.unit) + '）</h2>' +
    '<div class="chart-legend">' + legend + '</div>' +
    '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="上位の推移グラフ">' +
      grid + lines + xlabels +
    '</svg>' +
  '</section>';
}
function topicDetailHtml(id) {
  const topic = TOPICS.find(function (t) { return t.id === id; });
  if (!topic) return '<p class="empty">記事が見つかりません。</p>';
  const idx = topic.periods.length - 1;
  return '<article class="article" data-topic="' + esc(topic.id) + '">' +
      '<div class="ac-meta">' + tagHtml(topic) + '<span class="ac-date">' + esc(dateLabel(topic)) + ' 更新</span></div>' +
      '<h1 class="article-h1">' + esc(topic.title) + '</h1>' +
      (topic.thumbnail ? '<img class="article-hero topic-hero" src="' + esc(topic.thumbnail) + '" alt="" loading="lazy" />' : '') +
      (topic.lead ? '<p class="article-lead">' + richText(topic.lead) + '</p>' : '') +
      (topic.commentary ? '<p class="article-body">' + richText(topic.commentary) + '</p>' : '') +
      periodTabsHtml(topic, idx) +
      '<div class="period-block">' + periodContentHtml(topic, idx) + '</div>' +
      '<div class="extended-block">' + extendedListHtml(topic, idx) + '</div>' +
      trendChartHtml(topic) +
      sectionsHtml(topic) +
      analysisHtml(topic) +
      '<p class="source">出典: <a href="' + esc(topic.sourceUrl) + '" target="_blank" rel="noopener">' + esc(topic.source) + '</a></p>' +
    '</article>' +
    relatedHtml(topic) +
    otherRelatedHtml(topic);
}

// ---- 実体詳細ページ（都道府県・国などが登場する記事の内部リンク集） ----
function topicsForEntityName(name) {
  const list = [];
  TOPICS.forEach(function (topic) {
    const period = latestPeriod(topic);
    const ranked = rankedEntries(period);
    const hit = ranked.find(function (e) { return e.name === name; });
    if (hit) list.push({ topic: topic, rank: hit.rank, value: hit.value });
  });
  return list;
}
function entityDetailHtml(slug) {
  const entity = ENTITIES[slug];
  if (!entity) return '<p class="empty">ページが見つかりません。</p>';
  const appearances = topicsForEntityName(entity.name);
  const typeLabel = entity.type ? ENTITY_TYPE_LABEL[entity.type] || entity.type : '';
  return '<article class="article">' +
      (typeLabel
        ? '<div class="ac-meta"><a class="tag" href="/entity-type/' + esc(entity.type) + '">' + esc(typeLabel) + '</a></div>'
        : '') +
      '<h1 class="article-h1">' + esc(entity.name) + '</h1>' +
      (entity.image ? '<img class="article-hero entity-hero' + (entity.type === 'country' ? ' flag-img' : '') + '" src="' + esc(entity.image) + '" alt="' + esc(entity.name) + '" loading="lazy" />' : '') +
      (entity.description ? '<p class="article-lead">' + richText(entity.description) + '</p>' : '') +
      '<h2 class="section-h article-section-h">' + esc(entity.name) + 'が登場するランキング</h2>' +
      (appearances.length
        ? '<div class="article-list">' + appearances.map(function (a) {
            return '<a class="article-card" href="/topic/' + esc(a.topic.id) + '">' +
              '<div class="ac-body">' +
                '<div class="ac-meta">' + tagHtml(a.topic) + '<span class="ac-date">' + esc(dateLabel(a.topic)) + '</span></div>' +
                '<h3 class="ac-title">' + esc(a.topic.title) + '</h3>' +
                '<p class="ac-lead">' + a.rank + '位 ／ ' + fmt(a.value) + esc(a.topic.unit) + '</p>' +
              '</div>' +
            '</a>';
          }).join('') + '</div>'
        : '<p class="empty">現在、このサイトに登場する記事はありません。</p>') +
    '</article>';
}
function entitiesOfType(type) {
  return Object.keys(ENTITIES)
    .filter(function (slug) { return ENTITIES[slug].type === type; })
    .map(function (slug) { return { slug: slug, name: ENTITIES[slug].name }; })
    .sort(function (a, b) { return a.name.localeCompare(b.name, 'ja'); });
}
function entityTypeListHtml(type) {
  const label = ENTITY_TYPE_LABEL[type] || type;
  const list = entitiesOfType(type);
  if (!list.length) return '<p class="empty">ページが見つかりません。</p>';
  return '<h1 class="cat-title">' + esc(label) + '一覧</h1>' +
    '<p class="section-lead">' + esc(label) + 'は全' + list.length + '件あります。</p>' +
    '<div class="entity-grid">' + list.map(function (e) {
      return '<a class="entity-grid-item" href="/entity/' + esc(e.slug) + '">' + esc(e.name) + '</a>';
    }).join('') + '</div>';
}

// ---- ルーティング ----
function navHtml() {
  return CATEGORIES.map(function (c) {
    return '<a href="/category/' + esc(c.id) + '">' + esc(c.name) + '</a>';
  }).join('');
}
const SITE_NAME = 'ランキンQ';
const SITE_DEFAULT_DESC = '人口・面積・GDP・漁獲量など、統計や記録にもとづく「事実」のランキングを、出典つきで届けるサイト。ユーザー投票・投稿によるランキングは扱いません。';
// canonical / og:url は本番ドメイン固定の絶対URLにする（プレビュー環境のURLがcanonicalに漏れないように）。
const CANONICAL_ORIGIN = 'https://rankin-q.com';
function setMeta(title, description, imagePath, robots) {
  document.title = title;
  const set = function (id, attr, value) {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, value);
  };
  const absUrl = CANONICAL_ORIGIN + location.pathname;
  const absImage = imagePath ? CANONICAL_ORIGIN + imagePath : '';
  set('meta-robots', 'content', robots || 'index, follow');
  set('meta-description', 'content', description);
  set('meta-canonical', 'href', absUrl);
  set('meta-og-title', 'content', title);
  set('meta-og-description', 'content', description);
  set('meta-og-url', 'content', absUrl);
  set('meta-og-image', 'content', absImage);
  set('meta-twitter-card', 'content', absImage ? 'summary_large_image' : 'summary');
  set('meta-twitter-title', 'content', title);
  set('meta-twitter-description', 'content', description);
  set('meta-twitter-image', 'content', absImage);
}
function router() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const mCat = path.match(/^\/category\/(.+)$/);
  const mTopic = path.match(/^\/topic\/(.+)$/);
  const mEntity = path.match(/^\/entity\/(.+)$/);
  const mEntityType = path.match(/^\/entity-type\/(.+)$/);
  let html;
  let crumbs = null;
  if (mTopic) {
    const id = decodeURIComponent(mTopic[1]);
    html = topicDetailHtml(id);
    const topic = TOPICS.find(function (t) { return t.id === id; });
    if (topic) {
      setMeta(topic.title + '｜' + SITE_NAME, topic.lead || SITE_DEFAULT_DESC, topic.thumbnail);
      crumbs = [
        { label: 'ホーム', href: '/' },
        { label: category(topic.category).name, href: '/category/' + topic.category },
        { label: topic.title },
      ];
    } else setMeta(SITE_NAME, SITE_DEFAULT_DESC);
  } else if (mEntity) {
    const slug = decodeURIComponent(mEntity[1]);
    html = entityDetailHtml(slug);
    const entity = ENTITIES[slug];
    if (entity) {
      const metaDesc = entity.description
        ? entity.description.replace(/\*\*/g, '').slice(0, 120)
        : entity.name + 'が登場するランキング記事の一覧。' + SITE_DEFAULT_DESC;
      setMeta(entity.name + '｜' + SITE_NAME, metaDesc, entity.image, 'noindex, follow');
      crumbs = [{ label: 'ホーム', href: '/' }];
      if (entity.type) {
        crumbs.push({ label: (ENTITY_TYPE_LABEL[entity.type] || entity.type) + '一覧', href: '/entity-type/' + entity.type });
      }
      crumbs.push({ label: entity.name });
    } else setMeta(SITE_NAME, SITE_DEFAULT_DESC);
  } else if (mEntityType) {
    const type = decodeURIComponent(mEntityType[1]);
    html = entityTypeListHtml(type);
    const label = ENTITY_TYPE_LABEL[type] || type;
    setMeta(label + '一覧｜' + SITE_NAME, label + 'の一覧。' + SITE_DEFAULT_DESC);
    crumbs = [{ label: 'ホーム', href: '/' }, { label: label + '一覧' }];
  } else if (mCat) {
    const id = decodeURIComponent(mCat[1]);
    html = categoryHtml(id);
    const cat = category(id);
    setMeta(cat.name + 'のランキング一覧｜' + SITE_NAME, cat.name + 'に関する、出典のある統計・記録データにもとづくランキング記事の一覧。');
    crumbs = [{ label: 'ホーム', href: '/' }, { label: cat.name }];
  } else {
    html = homeHtml();
    setMeta(SITE_NAME + '｜統計と記録でつくるランキングメディア', SITE_DEFAULT_DESC);
  }
  document.getElementById('view').innerHTML = (crumbs ? breadcrumbHtml(crumbs) : '') + html;
  setBreadcrumbJsonLd(crumbs);
  initFvSlider();
  window.scrollTo(0, 0);
}
function navigate(path) {
  if (location.pathname !== path) history.pushState(null, '', path);
  router();
}

const PROD_HOSTS = ['rankin-q.com', 'www.rankin-q.com'];
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
    const navBtn = ev.target.closest('.fv-nav-btn');
    if (navBtn) {
      const slider = document.getElementById('fv-slider');
      if (slider) {
        const dir = Number(navBtn.getAttribute('data-dir'));
        const firstSlide = slider.querySelector('.slide');
        const step = firstSlide ? firstSlide.getBoundingClientRect().width + 18 : slider.clientWidth;
        slider.scrollBy({ left: dir * step, behavior: 'auto' });
      }
      return;
    }
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
