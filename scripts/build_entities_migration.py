#!/usr/bin/env python3
"""public/data/ranking-data.js から、Entities移行用のCSVを生成する（一回限りの移行スクリプト）。

Airtableには一切アクセスしない。ranking-data.js（現状の正）を読み、
- entities_candidate.csv （実体マスタの候補: id, name, type）
- entries_candidate.csv  （topic, period, entity, value）
- topics_candidate.csv   （全トピックのメタ情報）
を出力する。出力はレビュー用のCSVであり、Airtableへの取り込みは手動で行う。

使い方:
  python scripts/build_entities_migration.py
  python scripts/build_entities_migration.py --topics kome-shukakuryo-todofuken,todofuken-menseki   # パイロット用

標準ライブラリのみで動作する。
"""
import argparse
import csv
import os
import re
import unicodedata

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'ranking-data.js')
OUT_DIR = os.path.dirname(__file__)

# 表記ゆれの正規化マップ（左を見つけたら右に統一する）。今のところ既知の揺れはないので空だが、
# 今後見つかったらここに追加する。
SYNONYM_MAP = {}

PREFECTURES_ROMAJI = {
    '北海道': 'hokkaido', '青森県': 'aomori', '岩手県': 'iwate', '宮城県': 'miyagi',
    '秋田県': 'akita', '山形県': 'yamagata', '福島県': 'fukushima', '茨城県': 'ibaraki',
    '栃木県': 'tochigi', '群馬県': 'gunma', '埼玉県': 'saitama', '千葉県': 'chiba',
    '東京都': 'tokyo', '神奈川県': 'kanagawa', '新潟県': 'niigata', '富山県': 'toyama',
    '石川県': 'ishikawa', '福井県': 'fukui', '山梨県': 'yamanashi', '長野県': 'nagano',
    '岐阜県': 'gifu', '静岡県': 'shizuoka', '愛知県': 'aichi', '三重県': 'mie',
    '滋賀県': 'shiga', '京都府': 'kyoto', '大阪府': 'osaka', '兵庫県': 'hyogo',
    '奈良県': 'nara', '和歌山県': 'wakayama', '鳥取県': 'tottori', '島根県': 'shimane',
    '岡山県': 'okayama', '広島県': 'hiroshima', '山口県': 'yamaguchi', '徳島県': 'tokushima',
    '香川県': 'kagawa', '愛媛県': 'ehime', '高知県': 'kochi', '福岡県': 'fukuoka',
    '佐賀県': 'saga', '長崎県': 'nagasaki', '熊本県': 'kumamoto', '大分県': 'oita',
    '宮崎県': 'miyazaki', '鹿児島県': 'kagoshima', '沖縄県': 'okinawa',
}

COUNTRIES_ROMAJI = {
    'アメリカ': 'usa', '中国': 'china', 'ドイツ': 'germany', '日本': 'japan',
    'イギリス': 'uk', 'インド': 'india', 'フランス': 'france', 'イタリア': 'italy',
    'ロシア': 'russia', 'ブラジル': 'brazil', 'カナダ': 'canada', 'オーストラリア': 'australia',
    'メキシコ': 'mexico', '韓国': 'south-korea', '台湾': 'taiwan', '香港': 'hong-kong',
    'タイ': 'thailand', 'ベトナム': 'vietnam', 'シンガポール': 'singapore', 'オランダ': 'netherlands',
    'インドネシア': 'indonesia', 'パキスタン': 'pakistan', 'ナイジェリア': 'nigeria',
    'バングラデシュ': 'bangladesh', 'エチオピア': 'ethiopia', 'スペイン': 'spain',
}


def parse_ranking_data(path):
    with open(path, encoding='utf-8') as f:
        src = f.read()

    topics_src = src.split('topics: [', 1)[1]
    topics_src = topics_src.rsplit('],\n};', 1)[0]
    raw_blocks = re.split(r"\n {4}\{\n {6}id: '", topics_src)[1:]

    def grab(pattern, block, default=''):
        m = re.search(pattern, block)
        return m.group(1) if m else default

    topics = []
    for block in raw_blocks:
        tid = block.split("',", 1)[0]
        title = grab(r"title: '([^']*)'", block)
        category = grab(r"category: '([^']*)'", block)
        unit = grab(r"unit: '([^']*)'", block)
        source = grab(r"source: '([^']*)'", block)
        source_url = grab(r"sourceUrl: '([^']*)'", block)
        update_freq = grab(r"updateFrequency: '([^']*)'", block)
        updated_at = grab(r"updatedAt: '([^']*)'", block)
        lead = grab(r"lead: '((?:[^'\\]|\\.)*)'", block).replace("\\'", "'")
        commentary = grab(r"commentary: '((?:[^'\\]|\\.)*)'", block).replace("\\'", "'")
        analysis_heading = grab(r"analysisHeading: '((?:[^'\\]|\\.)*)'", block).replace("\\'", "'")

        analysis_m = re.search(r"analysis: \[(.*?)\n {6}\],", block, re.S)
        analysis_paras = []
        if analysis_m:
            for pm in re.finditer(r"'((?:[^'\\]|\\.)*)',", analysis_m.group(1)):
                analysis_paras.append(pm.group(1).replace("\\'", "'"))
        analysis_text = '\n\n'.join(analysis_paras)

        periods_m = re.search(r"periods: \[(.*)\n {6}\],\n {4}\},?\s*$", block, re.S)
        periods_src = periods_m.group(1) if periods_m else ''
        period_blocks = re.findall(
            r"\{\s*period:\s*(null|'[^']*'),\s*entries:\s*\[(.*?)\],?\s*\},?", periods_src, re.S)

        entries = []
        for period_val, entries_src in period_blocks:
            period = None if period_val == 'null' else period_val.strip("'")
            for em in re.finditer(
                    r"\{\s*name:\s*'((?:[^'\\]|\\.)*)',\s*value:\s*(-?[\d.]+),?\s*\}",
                    entries_src, re.S):
                name = em.group(1).replace("\\'", "'")
                value = em.group(2)
                entries.append((period, name, value))

        topics.append({
            'id': tid, 'title': title, 'category': category, 'unit': unit,
            'source': source, 'source_url': source_url, 'update_frequency': update_freq,
            'updated_at': updated_at, 'lead': lead, 'commentary': commentary,
            'analysis_heading': analysis_heading, 'analysis': analysis_text, 'entries': entries,
        })
    return topics


def normalize_name(name):
    name = unicodedata.normalize('NFKC', name.strip())
    return SYNONYM_MAP.get(name, name)


def infer_type_and_slug(name, used_slugs, counters):
    if name in PREFECTURES_ROMAJI:
        return 'prefecture', PREFECTURES_ROMAJI[name]
    if name in COUNTRIES_ROMAJI:
        return 'country', COUNTRIES_ROMAJI[name]
    # それ以外は type 未確定（人間が後で埋める）。slugは連番で発行する。
    counters['other'] = counters.get('other', 0) + 1
    slug = 'entity-%03d' % counters['other']
    while slug in used_slugs:
        counters['other'] += 1
        slug = 'entity-%03d' % counters['other']
    return '', slug


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--topics', help='カンマ区切りのtopic id。指定するとそのトピックだけ対象にする（パイロット用）')
    args = parser.parse_args()

    topics = parse_ranking_data(DATA_PATH)
    if args.topics:
        wanted = set(args.topics.split(','))
        topics = [t for t in topics if t['id'] in wanted]
        if not topics:
            print('指定されたtopic idが見つかりませんでした: ' + args.topics)
            return

    entities = {}  # normalized_name -> {slug, type}
    used_slugs = set()
    counters = {}
    entries_rows = []
    raw_name_count = 0
    seen_raw = set()

    for t in topics:
        for period, raw_name, value in t['entries']:
            raw_name_count += 1
            seen_raw.add(raw_name)
            norm = normalize_name(raw_name)
            if norm not in entities:
                etype, slug = infer_type_and_slug(norm, used_slugs, counters)
                used_slugs.add(slug)
                entities[norm] = {'slug': slug, 'type': etype}
            entries_rows.append({
                'topic': t['id'],
                'period': period or '',
                'entity': norm,
                'value': value,
            })

    entities_path = os.path.join(OUT_DIR, '..', 'entities_candidate.csv')
    entries_path = os.path.join(OUT_DIR, '..', 'entries_candidate.csv')
    topics_path = os.path.join(OUT_DIR, '..', 'topics_candidate.csv')

    with open(entities_path, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'name', 'type'])
        for name, info in sorted(entities.items(), key=lambda kv: (kv[1]['type'], kv[1]['slug'])):
            w.writerow([info['slug'], name, info['type']])

    with open(entries_path, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['topic', 'period', 'entity', 'value'])
        for row in entries_rows:
            w.writerow([row['topic'], row['period'], row['entity'], row['value']])

    with open(topics_path, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'title', 'category', 'unit', 'source', 'source_url',
                     'update_frequency', 'updated_at', 'lead', 'commentary',
                     'analysis_heading', 'analysis'])
        for t in topics:
            w.writerow([t['id'], t['title'], t['category'], t['unit'], t['source'], t['source_url'],
                        t['update_frequency'], t['updated_at'], t['lead'], t['commentary'],
                        t['analysis_heading'], t['analysis']])

    print('対象トピック数: ' + str(len(topics)))
    print('entries件数: ' + str(len(entries_rows)))
    print('ユニークな実体名（正規化前）: ' + str(len(seen_raw)))
    print('ユニークな実体（正規化後・重複排除済み）: ' + str(len(entities)))
    no_type = sum(1 for info in entities.values() if not info['type'])
    print('type未確定（要手動レビュー）: ' + str(no_type))
    print('出力: ' + entities_path)
    print('出力: ' + entries_path)
    print('出力: ' + topics_path)


if __name__ == '__main__':
    main()
