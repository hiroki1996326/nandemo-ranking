#!/usr/bin/env python3
"""Airtable(Topics / Entries) を public/data/ranking-data.js に同期する。

対応するAirtableスキーマは DESIGN.md の「3. データモデル」を参照。

環境変数:
  AIRTABLE_API_KEY  Airtable Personal Access Token（必須）
  AIRTABLE_BASE_ID  対象ベースのID（必須。例: appXXXXXXXXXXXXXX）
  AIRTABLE_TOPICS_TABLE   Topicsテーブル名（省略時 'Topics'）
  AIRTABLE_ENTRIES_TABLE  Entriesテーブル名（省略時 'Entries'）
  SITE_URL  本番サイトのURL（省略時プレースホルダー。sitemap.xmlの絶対URL生成に使う。
            ドメインが決まったら必ず設定すること）

使い方:
  AIRTABLE_API_KEY=xxx AIRTABLE_BASE_ID=appXXXX python scripts/sync_from_airtable.py

標準ライブラリのみで動作する（追加パッケージのインストール不要）。
"""
import json
import os
import sys
import urllib.parse
import urllib.request

AIRTABLE_API_KEY = os.environ.get('AIRTABLE_API_KEY')
AIRTABLE_BASE_ID = os.environ.get('AIRTABLE_BASE_ID')
TOPICS_TABLE = os.environ.get('AIRTABLE_TOPICS_TABLE', 'Topics')
ENTRIES_TABLE = os.environ.get('AIRTABLE_ENTRIES_TABLE', 'Entries')

SITE_URL = os.environ.get('SITE_URL', 'https://example.com').rstrip('/')

DATA_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'ranking-data.js')
SITEMAP_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'sitemap.xml')
ROBOTS_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'robots.txt')

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


def build_topics(topic_records, entry_records):
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
        period = fields.get('period') or None
        name = fields.get('name')
        value = fields.get('value')
        if name is None or value is None:
            continue
        entries_by_topic.setdefault(topic_record_id, {}).setdefault(period, []).append(
            {'name': name, 'value': value}
        )

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
            'analysis': analysis,
            'periods': periods,
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
            lines.append(pad2 + k + ': ' + to_js(v, indent + 1) + ',')
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


def build_sitemap_xml(topics):
    urls = [{'loc': SITE_URL + '/', 'lastmod': None}]
    seen_categories = []
    for t in topics:
        if t['category'] not in seen_categories:
            seen_categories.append(t['category'])
            urls.append({'loc': SITE_URL + '/category/' + t['category'], 'lastmod': None})
    for t in topics:
        urls.append({'loc': SITE_URL + '/topic/' + t['id'], 'lastmod': t.get('updatedAt')})

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
    if not AIRTABLE_API_KEY or not AIRTABLE_BASE_ID:
        print('環境変数 AIRTABLE_API_KEY / AIRTABLE_BASE_ID を設定してください。', file=sys.stderr)
        sys.exit(1)

    topic_records = fetch_all_records(TOPICS_TABLE)
    entry_records = fetch_all_records(ENTRIES_TABLE)
    topics = build_topics(topic_records, entry_records)

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

    with open(SITEMAP_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(build_sitemap_xml(topics))
    print('sitemap.xml を ' + SITEMAP_OUTPUT_PATH + ' に書き出しました。')

    with open(ROBOTS_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write('User-agent: *\nAllow: /\n\nSitemap: ' + SITE_URL + '/sitemap.xml\n')
    print('robots.txt を ' + ROBOTS_OUTPUT_PATH + ' に書き出しました。')

    if SITE_URL == 'https://example.com':
        print('警告: SITE_URL が未設定のため sitemap.xml / robots.txt はプレースホルダードメインで生成されました。', file=sys.stderr)


if __name__ == '__main__':
    main()
