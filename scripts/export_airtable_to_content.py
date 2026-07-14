#!/usr/bin/env python3
"""【一度だけ実行する移行スクリプト】Airtableの全データを content/ 配下のファイルに書き出す。

ファイル方式（content/ を源泉に build.py がサイトを生成する方式）へ移行するための
初回エクスポート。以後の編集は content/ のファイルを直接（AI経由で）編集する想定。

出力:
  content/entities.json                 実体の登録簿: id -> {name, type}
  content/articles/<topic-id>.json       記事1本ずつ（実体はIDで参照、文章はテキストのまま）

Airtableは畳まず残す（バックアップ）。このスクリプトはAirtableを一切書き換えない（読むだけ）。
"""
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_dotenv  # noqa: E402

load_dotenv()

# sync_from_airtable の取得ロジックを流用する
import sync_from_airtable as sync  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..')
CONTENT_DIR = os.path.join(ROOT, 'content')
ARTICLES_DIR = os.path.join(CONTENT_DIR, 'articles')
ENTITIES_PATH = os.path.join(CONTENT_DIR, 'entities.json')


def main():
    if not sync.AIRTABLE_API_KEY or not sync.AIRTABLE_BASE_ID:
        print('環境変数 AIRTABLE_API_KEY / AIRTABLE_BASE_ID を設定してください。', file=sys.stderr)
        sys.exit(1)

    os.makedirs(ARTICLES_DIR, exist_ok=True)

    topic_records = sync.fetch_all_records(sync.TOPICS_TABLE)
    entry_records = sync.fetch_all_records(sync.ENTRIES_TABLE)
    entity_records = sync.fetch_all_records(sync.ENTITIES_TABLE)

    # record_id -> entity（id/name/type）
    entities_by_recid = sync.build_entities(entity_records)

    # ---- 実体の登録簿を書き出す ----
    registry = {}
    for e in entities_by_recid.values():
        eid = e.get('id')
        if not eid:
            continue
        registry[eid] = {'name': e.get('name'), 'type': e.get('type')}
    with open(ENTITIES_PATH, 'w', encoding='utf-8') as f:
        json.dump(registry, f, ensure_ascii=False, indent=2, sort_keys=True)
    print(str(len(registry)) + '件の実体を ' + ENTITIES_PATH + ' に書き出しました。')

    # ---- topic record_id -> topic slug id ----
    topic_slug_by_recid = {}
    for rec in topic_records:
        slug = rec['fields'].get('id')
        if slug:
            topic_slug_by_recid[rec['id']] = slug

    # ---- entriesを topic slug ごとに集約（実体はIDで参照）----
    # data[topic_slug] = { period(None or int/str): [ {entity, value} ... ] }
    # notes[topic_slug] = { entity_id: note }
    data_by_topic = {}
    notes_by_topic = {}
    for rec in entry_records:
        f = rec['fields']
        topic_links = f.get('Topics')
        if not isinstance(topic_links, list) or not topic_links:
            topic_links = f.get('topic')
        if not isinstance(topic_links, list) or not topic_links:
            continue
        topic_slug = topic_slug_by_recid.get(topic_links[0])
        if not topic_slug:
            continue

        entity_links = f.get('entity')
        entity_id = None
        if isinstance(entity_links, list) and entity_links:
            ent = entities_by_recid.get(entity_links[0])
            if ent:
                entity_id = ent.get('id')
        if not entity_id:
            # 実体リンクが無い古いデータは移行対象外（今回のデータには無いはず）
            print('警告: entityリンクが無いentryをスキップ: topic=' + topic_slug, file=sys.stderr)
            continue

        value = f.get('value')
        if value is None:
            continue
        period = f.get('period')
        period = None if period is None else period

        data_by_topic.setdefault(topic_slug, {}).setdefault(period, []).append({
            'entity': entity_id, 'value': value,
        })
        note = (f.get('note') or '').strip()
        if note:
            notes_by_topic.setdefault(topic_slug, {})[entity_id] = note

    # ---- 記事ファイルを書き出す ----
    written = 0
    for rec in topic_records:
        f = rec['fields']
        slug = f.get('id')
        if not slug:
            continue

        # periods を period キー順に整列（None=staticは先頭）
        period_map = data_by_topic.get(slug, {})
        periods = []
        for period_key in sorted(period_map.keys(), key=lambda p: (p is None, p)):
            periods.append({'period': period_key, 'entries': period_map[period_key]})

        analysis_raw = f.get('analysis', '') or ''
        analysis = [p.strip() for p in analysis_raw.split('\n\n') if p.strip()]

        article = {
            'id': slug,
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
            'data': periods,
        }
        notes = notes_by_topic.get(slug)
        if notes:
            article['notes'] = notes

        out_path = os.path.join(ARTICLES_DIR, slug + '.json')
        with open(out_path, 'w', encoding='utf-8') as fp:
            json.dump(article, fp, ensure_ascii=False, indent=2)
        written += 1

    print(str(written) + '件の記事を ' + ARTICLES_DIR + ' に書き出しました。')
    print('完了。次に scripts/build.py で content/ からサイトを生成できます。')


if __name__ == '__main__':
    main()
