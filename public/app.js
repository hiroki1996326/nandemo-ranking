// ランキン！ — SPAルーター（記事メディア風レイアウト）
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
  ocean: '海洋', continent: '大陸', other: 'その他',
};
// entityの表示名(name) -> スラッグ の逆引き。記事内の項目名から実体詳細ページへリンクするために使う。
const NAME_TO_SLUG = {};
Object.keys(ENTITIES).forEach(function (slug) { NAME_TO_SLUG[ENTITIES[slug].name] = slug; });

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
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
    '<div class="featured-body">' +
      '<div class="ac-meta">' + tagHtml(topic) + '<span class="ac-date">' + esc(dateLabel(topic)) + '</span></div>' +
      '<h2 class="featured-title">' + esc(topic.title) + '</h2>' +
      '<p class="featured-lead">' + esc(topic.lead || '') + '</p>' +
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
function podiumHtml(topic, idx) {
  const period = topic.periods[idx];
  const prevMap = prevRankMapAt(topic, idx);
  const top3 = rankedEntries(period).slice(0, 3);
  // 表彰台の見た目に合わせて 2位・1位・3位の順で並べる
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  return '<div class="podium">' + order.map(function (e) {
    return '<div class="podium-item pd-rank' + e.rank + '">' +
      '<span class="podium-medal"><span class="podium-rank">' + e.rank + '<span class="podium-rank-suffix">位</span></span></span>' +
      '<span class="podium-name">' + nameLinkHtml(e.name) + '</span>' +
      '<span class="podium-value">' + fmt(e.value) + '<span class="unit">' + esc(topic.unit) + '</span></span>' +
      (prevMap ? deltaHtml(e, prevMap) : '') +
    '</div>';
  }).join('') + '</div>';
}
function rankRowsHtml(list, topic, prevMap) {
  return list.map(function (e) {
    return '<tr><td class="col-rank">' + e.rank + '</td>' +
      '<td class="col-name">' + nameLinkHtml(e.name) + '</td>' +
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
  const heading = topic.analysisHeading || '考察';
  return '<section class="analysis">' +
    '<h2 class="section-h article-section-h">' + esc(heading) + '</h2>' +
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
  return '<article class="article" data-topic="' + esc(topic.id) + '">' +
      '<div class="ac-meta">' + tagHtml(topic) + '<span class="ac-date">' + esc(dateLabel(topic)) + ' 更新</span></div>' +
      '<h1 class="article-h1">' + esc(topic.title) + '</h1>' +
      (topic.lead ? '<p class="article-lead">' + esc(topic.lead) + '</p>' : '') +
      (topic.commentary ? '<p class="article-body">' + esc(topic.commentary) + '</p>' : '') +
      periodTabsHtml(topic, idx) +
      '<div class="period-block">' + periodContentHtml(topic, idx) + '</div>' +
      '<div class="extended-block">' + extendedListHtml(topic, idx) + '</div>' +
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
      (typeLabel ? '<div class="ac-meta"><span class="tag">' + esc(typeLabel) + '</span></div>' : '') +
      '<h1 class="article-h1">' + esc(entity.name) + '</h1>' +
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
  const mEntity = path.match(/^\/entity\/(.+)$/);
  let html;
  let crumbs = null;
  if (mTopic) {
    const id = decodeURIComponent(mTopic[1]);
    html = topicDetailHtml(id);
    const topic = TOPICS.find(function (t) { return t.id === id; });
    if (topic) {
      setMeta(topic.title + '｜' + SITE_NAME, topic.lead || SITE_DEFAULT_DESC);
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
      setMeta(entity.name + '｜' + SITE_NAME, entity.name + 'が登場するランキング記事の一覧。' + SITE_DEFAULT_DESC);
      crumbs = [{ label: 'ホーム', href: '/' }, { label: entity.name }];
    } else setMeta(SITE_NAME, SITE_DEFAULT_DESC);
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
