#!/usr/bin/env python3
"""Airtable(Topics / Entries) を public/data/ranking-data.js に同期する。

対応するAirtableスキーマは DESIGN.md の「3. データモデル」を参照。

環境変数:
  AIRTABLE_API_KEY  Airtable Personal Access Token（必須）
  AIRTABLE_BASE_ID  対象ベースのID（必須。例: appXXXXXXXXXXXXXX）
  AIRTABLE_TOPICS_TABLE   Topicsテーブル名（省略時 'Topics'）
  AIRTABLE_ENTRIES_TABLE  Entriesテーブル名（省略時 'Entries'）
  AIRTABLE_ENTITIES_TABLE Entitiesテーブル名（省略時 'Entities'）
  SITE_URL  本番サイトのURL（省略時プレースホルダー。sitemap.xmlの絶対URL生成に使う。
            ドメインが決まったら必ず設定すること）

使い方:
  AIRTABLE_API_KEY=xxx AIRTABLE_BASE_ID=appXXXX python scripts/sync_from_airtable.py

標準ライブラリのみで動作する（追加パッケージのインストール不要）。
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_dotenv  # noqa: E402

load_dotenv()

AIRTABLE_API_KEY = os.environ.get('AIRTABLE_API_KEY')
AIRTABLE_BASE_ID = os.environ.get('AIRTABLE_BASE_ID')
TOPICS_TABLE = os.environ.get('AIRTABLE_TOPICS_TABLE', 'Topics')
ENTRIES_TABLE = os.environ.get('AIRTABLE_ENTRIES_TABLE', 'Entries')
ENTITIES_TABLE = os.environ.get('AIRTABLE_ENTITIES_TABLE', 'Entities')

SITE_URL = os.environ.get('SITE_URL', 'https://rankin-q.com').rstrip('/')

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')
DATA_OUTPUT_PATH = os.path.join(PUBLIC_DIR, 'data', 'ranking-data.js')
ENTITIES_OUTPUT_PATH = os.path.join(PUBLIC_DIR, 'data', 'entities.js')
IMAGES_DIR = os.path.join(PUBLIC_DIR, 'images', 'entities')
TOPIC_IMAGES_DIR = os.path.join(PUBLIC_DIR, 'images', 'topics')
SITEMAP_OUTPUT_PATH = os.path.join(PUBLIC_DIR, 'sitemap.xml')
ROBOTS_OUTPUT_PATH = os.path.join(PUBLIC_DIR, 'robots.txt')

# 画像はこのドメインの画像のみ許可する（著作権方針。DESIGN.md §7参照）。
ALLOWED_IMAGE_HOSTS = ('upload.wikimedia.org', 'commons.wikimedia.org')

# サイトのカテゴリは固定4種（Airtable側は各Topicsレコードの単一選択フィールド 'category' に
# このidのいずれかを入れる運用。カテゴリテーブルは作らない）。
CATEGORIES = [
    {'id': 'keizai', 'name': '経済・産業'},
    {'id': 'jinko', 'name': '人口・社会'},
    {'id': 'chiri', 'name': '地理・自然'},
    {'id': 'sports', 'name': 'スポーツ・興行'},
]


def fetch_all_records(table_name):
    records = []
    offset = None
    base_url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + urllib.parse.quote(table_name)
    while True:
        params = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        url = base_url + '?' + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + AIRTABLE_API_KEY})
        with urllib.request.urlopen(req) as resp:
            data = json.load(resp)
        records.extend(data.get('records', []))
        offset = data.get('offset')
        if not offset:
            break
    return records


def build_entities(entity_records):
    """record_id -> {id, name, type, image_url, image_credit} のマップを作る。"""
    entities = {}
    for rec in entity_records:
        f = rec['fields']
        entities[rec['id']] = {
            'id': f.get('id'),
            'name': f.get('name'),
            'type': f.get('type'),
            'image_url': f.get('image_url') or '',
            'image_credit': f.get('image_credit') or '',
        }
    return entities


def download_entity_images(entities):
    """Entitiesのimage_urlをローカルにダウンロードし、各entityにlocal_imageパスを追加する。
    許可ドメイン（Wikimedia Commons）以外の画像は無視する（DESIGN.md §7の著作権方針）。
    既にダウンロード済みのファイルは再取得しない。
    """
    os.makedirs(IMAGES_DIR, exist_ok=True)
    for entity in entities.values():
        url = entity.get('image_url')
        entity['local_image'] = None
        if not url:
            continue
        host = urllib.parse.urlparse(url).netloc
        if host not in ALLOWED_IMAGE_HOSTS:
            print('警告: 許可されていない画像ホストのためスキップ: ' + entity.get('id', '?') + ' (' + host + ')', file=sys.stderr)
            continue
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or '.jpg'
        filename = entity['id'] + ext
        local_path = os.path.join(IMAGES_DIR, filename)
        if not os.path.exists(local_path):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'nandemo-ranking-sync/1.0'})
                with urllib.request.urlopen(req) as resp, open(local_path, 'wb') as out:
                    out.write(resp.read())
                print('画像を保存しました: ' + filename)
            except Exception as e:
                print('警告: 画像ダウンロード失敗 ' + entity.get('id', '?') + ': ' + str(e), file=sys.stderr)
                continue
        entity['local_image'] = '/images/entities/' + filename


def _load_image_credits():
    """fetch_wikipedia_images.py が保存したクレジット情報（作者・ライセンス）を読む。"""
    path = os.path.join(IMAGES_DIR, '_credits.json')
    if os.path.exists(path):
        try:
            with open(path, encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _format_credit(info):
    """クレジット情報を1行の表示用文字列にする（例: '写真: 山田太郎 / CC BY-SA 4.0'）。"""
    artist = (info.get('artist') or '').strip()
    lic = (info.get('license') or '').strip()
    parts = []
    if artist:
        parts.append(artist)
    if lic:
        parts.append(lic)
    return ' / '.join(parts)


def attach_generated_images(entities, topics):
    """fetch_wikipedia_images.py / generate_images.py が public/images/ に保存した画像を
    各データに紐づける。Entitiesは実写（local_image）が既にある場合は上書きしない。
    Wikipedia由来の画像は、CCライセンスの表示義務に備えクレジットも紐づける。
    """
    credits = _load_image_credits()
    for entity in entities.values():
        if not entity.get('id'):
            continue
        if not entity.get('local_image'):
            candidate = os.path.join(IMAGES_DIR, entity['id'] + '.webp')
            if os.path.exists(candidate):
                entity['local_image'] = '/images/entities/' + entity['id'] + '.webp'
        # Airtableにクレジットが手入力されていない場合のみ、取得時のクレジットで補う
        if not (entity.get('image_credit') or '').strip():
            info = credits.get(entity['id'])
            if info:
                entity['image_credit'] = _format_credit(info)

    for topic in topics:
        topic['thumbnail'] = None
        if not topic.get('id'):
            continue
        candidate = os.path.join(TOPIC_IMAGES_DIR, topic['id'] + '.webp')
        if os.path.exists(candidate):
            topic['thumbnail'] = '/images/topics/' + topic['id'] + '.webp'


def build_topics(topic_records, entry_records, entities):
    # EntriesのTopicsへのリンクフィールドは、Airtable側の作成経緯によって
    # フィールド名が 'topic' または 'Topics' のどちらにもなり得るため両方に対応する。
    # （どちらのフィールドも「リンク先レコードIDの配列」である場合のみ有効とし、
    #  文字列型の古いテキスト列を誤って読まないようにする）
    entries_by_topic = {}
    for rec in entry_records:
        fields = rec['fields']
        topic_links = fields.get('Topics')
        if not isinstance(topic_links, list) or not topic_links:
            topic_links = fields.get('topic')
        if not isinstance(topic_links, list) or not topic_links:
            continue
        topic_record_id = topic_links[0]

        # entity（Entitiesへのリンク）優先。旧来の自由記述 name フィールドにもフォールバック対応。
        entity_links = fields.get('entity')
        name = None
        if isinstance(entity_links, list) and entity_links:
            entity = entities.get(entity_links[0])
            if entity:
                name = entity['name']
        if name is None:
            name = fields.get('name')

        period = fields.get('period') or None
        value = fields.get('value')
        if name is None or value is None:
            continue
        entry = {'name': name, 'value': value}
        # トップ3カード用の説明文（任意。Airtableのnote欄に入力があれば取り込む）
        note = (fields.get('note') or '').strip()
        if note:
            entry['note'] = note
        entries_by_topic.setdefault(topic_record_id, {}).setdefault(period, []).append(entry)

    topics = []
    for rec in topic_records:
        f = rec['fields']
        record_id = rec['id']
        period_map = entries_by_topic.get(record_id, {})

        periods = []
        for period_key in sorted(period_map.keys(), key=lambda p: (p is None, p)):
            entries = sorted(period_map[period_key], key=lambda e: e['value'], reverse=True)
            periods.append({'period': period_key, 'entries': entries})

        analysis_raw = f.get('analysis', '') or ''
        analysis = [p.strip() for p in analysis_raw.split('\n\n') if p.strip()]

        topics.append({
            'id': f.get('id'),
            'title': f.get('title'),
            'category': f.get('category'),
            'unit': f.get('unit'),
            'source': f.get('source'),
            'sourceUrl': f.get('source_url'),
            'updateFrequency': f.get('update_frequency'),
            'updatedAt': f.get('updated_at'),
            'lead': f.get('lead', '') or '',
            'commentary': f.get('commentary', '') or '',
            'analysisHeading': f.get('analysis_heading', '') or '',
            'analysis': analysis,
            'periods': periods,
            'thumbnail': None,
        })
    return topics


def to_js(value, indent=0):
    """Pythonの値を、既存の手書きranking-data.jsと同じ書式（シングルクォート・2スペース）のJSリテラルに変換する。"""
    pad = '  ' * indent
    pad2 = '  ' * (indent + 1)
    if isinstance(value, dict):
        if not value:
            return '{}'
        lines = ['{']
        for k, v in value.items():
            # キーは常にクォートする（ハイフンなどを含む識別子として不正な文字列でも安全なように）。
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
    seen_types = []
    for entity in (entities or {}).values():
        if entity.get('id'):
            urls.append({'loc': SITE_URL + '/entity/' + entity['id'], 'lastmod': None})
        if entity.get('type') and entity['type'] not in seen_types:
            seen_types.append(entity['type'])
            urls.append({'loc': SITE_URL + '/entity-type/' + entity['type'], 'lastmod': None})

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


def main():
    # 【重要】サイトのデータは現在 scripts/build.py が content/ 配下のファイルから生成する。
    # このスクリプト(Airtable同期)はレガシー（移行前のバックアップ用）。実行すると
    # content/ 由来のデータ（例: 米の過去数十年の推移CSV）が上書きで失われるため、
    # 誤実行を防ぐガードを置く。どうしても実行する場合のみ --force を付ける。
    if '--force' not in sys.argv:
        print('このスクリプトはレガシーです。サイトは scripts/build.py が content/ から生成します。',
              file=sys.stderr)
        print('実行すると content/ 由来のデータ（米の推移CSV等）が失われます。', file=sys.stderr)
        print('本当に旧Airtable方式で上書きする場合のみ `--force` を付けてください。', file=sys.stderr)
        sys.exit(1)
    if not AIRTABLE_API_KEY or not AIRTABLE_BASE_ID:
        print('環境変数 AIRTABLE_API_KEY / AIRTABLE_BASE_ID を設定してください。', file=sys.stderr)
        sys.exit(1)

    topic_records = fetch_all_records(TOPICS_TABLE)
    entry_records = fetch_all_records(ENTRIES_TABLE)
    try:
        entity_records = fetch_all_records(ENTITIES_TABLE)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print('Entitiesテーブルが見つからないためスキップします（未作成の場合は正常）。', file=sys.stderr)
            entity_records = []
        else:
            raise
    entities = build_entities(entity_records)
    download_entity_images(entities)

    topics = build_topics(topic_records, entry_records, entities)
    attach_generated_images(entities, topics)

    data = {'categories': CATEGORIES, 'topics': topics}
    js_body = to_js(data)

    header = (
        '// このファイルは scripts/sync_from_airtable.py が自動生成します。\n'
        '// 直接編集しないでください（Airtableで編集し、再同期してください）。\n'
    )
    output = header + 'window.RANKING_DATA = ' + js_body + ';\n'

    with open(DATA_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(output)
    print(str(len(topics)) + '件のトピックを ' + DATA_OUTPUT_PATH + ' に書き出しました。')

    entities_out = {}
    for entity in entities.values():
        if not entity.get('id'):
            continue
        entities_out[entity['id']] = {
            'name': entity['name'],
            'type': entity['type'],
            'image': entity.get('local_image'),
            'imageCredit': entity.get('image_credit') or '',
        }
    entities_output = (
        '// このファイルは scripts/sync_from_airtable.py が自動生成します。\n'
        '// 実体（都道府県・国など）のマスタデータ。画像は将来の実体詳細ページ用。\n'
        'window.ENTITIES_DATA = ' + to_js(entities_out) + ';\n'
    )
    with open(ENTITIES_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(entities_output)
    print(str(len(entities_out)) + '件のEntitiesを ' + ENTITIES_OUTPUT_PATH + ' に書き出しました。')

    with open(SITEMAP_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(build_sitemap_xml(topics, entities))
    print('sitemap.xml を ' + SITEMAP_OUTPUT_PATH + ' に書き出しました。')

    with open(ROBOTS_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write('User-agent: *\nAllow: /\n\nSitemap: ' + SITE_URL + '/sitemap.xml\n')
    print('robots.txt を ' + ROBOTS_OUTPUT_PATH + ' に書き出しました。')

    if SITE_URL == 'https://example.com':
        print('警告: SITE_URL が未設定のため sitemap.xml / robots.txt はプレースホルダードメインで生成されました。', file=sys.stderr)


if __name__ == '__main__':
    main()
