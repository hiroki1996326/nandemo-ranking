#!/usr/bin/env python3
"""public/data/ranking-data.js のデータを、Airtableの指定テーブルに直接書き込む。

CSVインポート経由だと手動作業でズレる事故が起きたため、
ranking-data.jsを正としてAPI経由で確実にAirtableへ反映する。

対象テーブルの中身は一旦全削除してから、正しいデータで作り直す（追記ではなく置き換え）。
テーブル自体・フィールド自体は事前にAirtable側で作成済みであること
（Topics: id/title/category/unit/source/source_url/update_frequency/updated_at/
  lead/commentary/analysis_heading/analysis の各フィールド、
  Entities: id/name/type、
  Entries: label/topic(Link)/period/entity(Link)/value）。

環境変数:
  AIRTABLE_API_KEY  書き込み権限(data.records:write)付きのトークン
  AIRTABLE_BASE_ID
  AIRTABLE_TOPICS_TABLE   （省略時 'topics_candidate'）
  AIRTABLE_ENTRIES_TABLE  （省略時 'entries_candidate'）
  AIRTABLE_ENTITIES_TABLE （省略時 'entities_candidate'）

使い方:
  python scripts/provision_airtable_data.py

標準ライブラリのみで動作する。
"""
import importlib.util
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

AIRTABLE_API_KEY = os.environ.get('AIRTABLE_API_KEY')
AIRTABLE_BASE_ID = os.environ.get('AIRTABLE_BASE_ID')
TOPICS_TABLE = os.environ.get('AIRTABLE_TOPICS_TABLE', 'topics_candidate')
ENTRIES_TABLE = os.environ.get('AIRTABLE_ENTRIES_TABLE', 'entries_candidate')
ENTITIES_TABLE = os.environ.get('AIRTABLE_ENTITIES_TABLE', 'entities_candidate')

_spec = importlib.util.spec_from_file_location(
    'build_entities_migration', os.path.join(os.path.dirname(__file__), 'build_entities_migration.py'))
mig = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mig)


def api_url(table_name, suffix=''):
    return 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + urllib.parse.quote(table_name) + suffix


def request(method, url, body=None):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': 'Bearer ' + AIRTABLE_API_KEY,
        'Content-Type': 'application/json',
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        print('APIエラー ' + method + ' ' + url + ': ' + e.read().decode('utf-8'), file=sys.stderr)
        raise


def fetch_all_record_ids(table_name):
    ids = []
    offset = None
    while True:
        url = api_url(table_name, '?pageSize=100' + ('&offset=' + offset if offset else ''))
        data = request('GET', url)
        ids.extend([r['id'] for r in data.get('records', [])])
        offset = data.get('offset')
        if not offset:
            break
    return ids


def delete_all(table_name):
    ids = fetch_all_record_ids(table_name)
    print(table_name + ': 既存' + str(len(ids)) + '件を削除します')
    for i in range(0, len(ids), 10):
        batch = ids[i:i + 10]
        qs = '&'.join('records[]=' + urllib.parse.quote(rid) for rid in batch)
        request('DELETE', api_url(table_name, '?' + qs))
    print(table_name + ': 削除完了')


def create_records(table_name, records):
    """records: [{fields...}, ...] を10件ずつ作成し、作成順にAirtableレコードIDのリストを返す。"""
    created_ids = []
    for i in range(0, len(records), 10):
        batch = records[i:i + 10]
        # typecast: True で、Single select等の未知の選択肢(prefecture/country等)を自動追加させる。
        body = {'records': [{'fields': f} for f in batch], 'typecast': True}
        data = request('POST', api_url(table_name), body)
        created_ids.extend([r['id'] for r in data['records']])
        time.sleep(0.2)  # レート制限対策
    return created_ids


def main():
    if not AIRTABLE_API_KEY or not AIRTABLE_BASE_ID:
        print('環境変数 AIRTABLE_API_KEY / AIRTABLE_BASE_ID を設定してください。', file=sys.stderr)
        sys.exit(1)

    topics = mig.parse_ranking_data(mig.DATA_PATH)

    # ---- Entities ----
    entities = {}
    used_slugs = set()
    counters = {}
    for t in topics:
        for period, raw_name, value in t['entries']:
            norm = mig.normalize_name(raw_name)
            if norm not in entities:
                etype, slug = mig.infer_type_and_slug(norm, used_slugs, counters)
                used_slugs.add(slug)
                entities[norm] = {'slug': slug, 'type': etype}

    delete_all(ENTITIES_TABLE)
    entity_records = [{'id': info['slug'], 'name': name, 'type': info['type'] or None}
                       for name, info in entities.items()]
    entity_ids = create_records(ENTITIES_TABLE, entity_records)
    entity_name_to_recid = {r['name']: rid for r, rid in zip(entity_records, entity_ids)}
    print(ENTITIES_TABLE + ': ' + str(len(entity_ids)) + '件作成しました')

    # ---- Topics ----
    delete_all(TOPICS_TABLE)
    topic_records = [{
        'id': t['id'], 'title': t['title'], 'category': t['category'], 'unit': t['unit'],
        'source': t['source'], 'source_url': t['source_url'], 'update_frequency': t['update_frequency'],
        'updated_at': t['updated_at'] or None, 'lead': t['lead'], 'commentary': t['commentary'],
        'analysis_heading': t['analysis_heading'], 'analysis': t['analysis'],
    } for t in topics]
    topic_ids = create_records(TOPICS_TABLE, topic_records)
    topic_id_to_recid = {t['id']: rid for t, rid in zip(topics, topic_ids)}
    print(TOPICS_TABLE + ': ' + str(len(topic_ids)) + '件作成しました')

    # ---- Entries ----
    delete_all(ENTRIES_TABLE)
    entry_records = []
    i = 0
    for t in topics:
        for period, raw_name, value in t['entries']:
            i += 1
            norm = mig.normalize_name(raw_name)
            entry_records.append({
                'label': 'e%04d_%s_%s' % (i, t['id'], norm),
                'topic': [topic_id_to_recid[t['id']]],
                'entity': [entity_name_to_recid[norm]],
                'period': period or '',
                'value': float(value),
            })
    entry_ids = create_records(ENTRIES_TABLE, entry_records)
    print(ENTRIES_TABLE + ': ' + str(len(entry_ids)) + '件作成しました')

    print('完了。')


if __name__ == '__main__':
    main()
