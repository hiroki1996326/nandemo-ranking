"""ビルド・画像取得スクリプトの共通処理（Airtableに依存しない）。

データの源泉は content/ 配下のファイル。以下を提供する:
  - パス定数・カテゴリ・許可画像ホスト
  - to_js / build_sitemap_xml（出力書式・sitemap生成）
  - 画像クレジットの読み込み・整形
  - content/ からの読み込み（実体登録簿・記事・実体一覧）
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), '..')
CONTENT_DIR = os.path.join(ROOT, 'content')
ARTICLES_DIR = os.path.join(CONTENT_DIR, 'articles')
DATASETS_DIR = os.path.join(CONTENT_DIR, 'datasets')
ENTITIES_PATH = os.path.join(CONTENT_DIR, 'entities.json')

PUBLIC_DIR = os.path.join(ROOT, 'public')
DATA_OUTPUT_PATH = os.path.join(PUBLIC_DIR, 'data', 'ranking-data.js')
ENTITIES_OUTPUT_PATH = os.path.join(PUBLIC_DIR, 'data', 'entities.js')
IMAGES_DIR = os.path.join(PUBLIC_DIR, 'images', 'entities')
TOPIC_IMAGES_DIR = os.path.join(PUBLIC_DIR, 'images', 'topics')
SITEMAP_OUTPUT_PATH = os.path.join(PUBLIC_DIR, 'sitemap.xml')
ROBOTS_OUTPUT_PATH = os.path.join(PUBLIC_DIR, 'robots.txt')

SITE_URL = os.environ.get('SITE_URL', 'https://rankin-q.com').rstrip('/')

# 画像はこのドメインの画像のみ許可する（著作権方針。DESIGN.md §7参照）。
ALLOWED_IMAGE_HOSTS = ('upload.wikimedia.org', 'commons.wikimedia.org')

# サイトのカテゴリは固定4種。
CATEGORIES = [
    {'id': 'keizai', 'name': '経済・産業'},
    {'id': 'jinko', 'name': '人口・社会'},
    {'id': 'chiri', 'name': '地理・自然'},
    {'id': 'sports', 'name': 'スポーツ・興行'},
]


# ---- content/ の読み込み ----

def load_registry():
    """実体の登録簿 content/entities.json を返す（id -> {name, type}）。"""
    with open(ENTITIES_PATH, encoding='utf-8') as f:
        return json.load(f)


def load_articles():
    """content/articles/*.json を全部読んで返す。"""
    articles = []
    for name in sorted(os.listdir(ARTICLES_DIR)):
        if not name.endswith('.json'):
            continue
        with open(os.path.join(ARTICLES_DIR, name), encoding='utf-8') as f:
            articles.append(json.load(f))
    return articles


def load_entities_list():
    """画像取得スクリプト向けに、実体を [{id, name, type, image_url}] のリストで返す。
    （content登録簿には画像URLは持たないので image_url は空文字）。"""
    reg = load_registry()
    out = []
    for eid, e in reg.items():
        out.append({'id': eid, 'name': e.get('name'), 'type': e.get('type'), 'image_url': ''})
    return [e for e in out if e['id'] and e['name']]


def load_topics_meta():
    """記事のメタ情報を [{id, title, category}] のリストで返す（サムネ生成スクリプト向け）。"""
    out = []
    for a in load_articles():
        out.append({'id': a.get('id'), 'title': a.get('title'), 'category': a.get('category')})
    return [t for t in out if t['id'] and t['title']]


# ---- 画像クレジット ----

def load_image_credits():
    """fetch_wikipedia_images.py が保存したクレジット情報を読む。"""
    path = os.path.join(IMAGES_DIR, '_credits.json')
    if os.path.exists(path):
        try:
            with open(path, encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def format_credit(info):
    """クレジット情報を1行の表示用文字列にする（例: '山田太郎 / CC BY-SA 4.0'）。"""
    artist = (info.get('artist') or '').strip()
    lic = (info.get('license') or '').strip()
    parts = [p for p in (artist, lic) if p]
    return ' / '.join(parts)


# ---- 出力書式 ----

def to_js(value, indent=0):
    """Pythonの値を、ranking-data.jsと同じ書式（シングルクォート・2スペース）のJSリテラルに変換する。"""
    pad = '  ' * indent
    pad2 = '  ' * (indent + 1)
    if isinstance(value, dict):
        if not value:
            return '{}'
        lines = ['{']
        for k, v in value.items():
            key_js = to_js(str(k), indent + 1)
            lines.append(pad2 + key_js + ': ' + to_js(v, indent + 1) + ',')
        lines.append(pad + '}')
        return '\n'.join(lines)
    if isinstance(value, list):
        if not value:
            return '[]'
        lines = ['[']
        for item in value:
            lines.append(pad2 + to_js(item, indent + 1) + ',')
        lines.append(pad + ']')
        return '\n'.join(lines)
    if isinstance(value, str):
        escaped = value.replace('\\', '\\\\').replace("'", "\\'")
        return "'" + escaped + "'"
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if value is None:
        return 'null'
    return str(value)


def build_sitemap_xml(topics, entities=None):
    urls = [{'loc': SITE_URL + '/', 'lastmod': None}]
    seen_categories = []
    for t in topics:
        if t['category'] not in seen_categories:
            seen_categories.append(t['category'])
            urls.append({'loc': SITE_URL + '/category/' + t['category'], 'lastmod': None})
    for t in topics:
        urls.append({'loc': SITE_URL + '/topic/' + t['id'], 'lastmod': t.get('updatedAt')})
    # entity個別ページ(/entity/{id})はSEO上noindexのため、sitemapには含めない
    # （app.js側でnoindexを設定。クロール自体は許可するがindexはさせない方針）。
    # entity-type一覧(/entity-type/{type})も、見出し＋リンク集だけの薄いページで
    # SEO価値がないため廃止済み（sitemapに含めず、ページ自体も削除）。

    entries = []
    for u in urls:
        lastmod = '<lastmod>' + u['lastmod'] + '</lastmod>' if u['lastmod'] else ''
        entries.append('  <url><loc>' + u['loc'] + '</loc>' + lastmod + '</url>')

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + '\n'.join(entries) + '\n'
        '</urlset>\n'
    )
