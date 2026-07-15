#!/usr/bin/env python3
"""content/ 配下のファイルを源泉に、サイトのデータ（public/data/*.js）を生成する。

Airtableに依存しない。編集は content/ のファイルを直接（AI経由で）行う想定。

入力:
  content/entities.json            実体の登録簿: id -> {name, type}
  content/articles/<id>.json        記事1本ずつ（実体はIDで参照）
  content/datasets/<name>.csv       大量の時系列数値（1列目=実体ID、ヘッダ=期間）
  public/images/entities/<id>.webp   実体画像（fetch_*.pyが取得済み）
  public/images/entities/_credits.json 画像のクレジット
  public/images/topics/<id>.webp     記事サムネ(generate_topic_thumbnails.pyが生成)

出力:
  public/data/ranking-data.js       app.jsが読むデータ（既存と同じ形）
  public/data/entities.js
  public/sitemap.xml / robots.txt

記事ファイルの entries は次のどちらか:
  - "data":    [ {period, entries:[{entity, value}]} ]  … インライン（少量・staticなお題向け）
  - "dataset": "<csv名>"                                 … content/datasets/<csv名>.csv を展開（大量の時系列向け）

ビルド時に実体IDの存在チェック等のバリデーションを行い、問題があれば停止する。
"""
import csv
import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

sys.path.insert(0, os.path.dirname(__file__))
import json  # noqa: E402
import common as c  # noqa: E402

CONTENT_DIR = c.CONTENT_DIR
ARTICLES_DIR = c.ARTICLES_DIR
DATASETS_DIR = c.DATASETS_DIR
ENTITIES_PATH = c.ENTITIES_PATH

VALID_CATEGORY_IDS = {cat['id'] for cat in c.CATEGORIES}


class BuildError(Exception):
    pass


def load_registry():
    with open(ENTITIES_PATH, encoding='utf-8') as f:
        return json.load(f)


def load_articles():
    articles = []
    for name in sorted(os.listdir(ARTICLES_DIR)):
        if not name.endswith('.json'):
            continue
        with open(os.path.join(ARTICLES_DIR, name), encoding='utf-8') as f:
            articles.append(json.load(f))
    return articles


def load_dataset(dataset_name):
    """content/datasets/<name>.csv を [ {period, entries:[{entity, value}]} ] に展開する。
    CSVは 1列目=実体ID、以降の列ヘッダ=期間（年など）、セル=数値。空セルはスキップ。"""
    path = os.path.join(DATASETS_DIR, dataset_name + '.csv')
    if not os.path.exists(path):
        raise BuildError('dataset が見つかりません: ' + path)
    with open(path, encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = [r for r in reader if r and any(cell.strip() for cell in r)]
    if not rows:
        return []
    header = rows[0]
    periods = header[1:]  # 先頭列(entity)以外が期間
    by_period = {p: [] for p in periods}
    for row in rows[1:]:
        entity_id = row[0].strip()
        if not entity_id:
            continue
        for i, cell in enumerate(row[1:]):
            cell = cell.strip()
            if not cell:
                continue
            try:
                value = float(cell)
            except ValueError:
                raise BuildError('数値でないセル: dataset=' + dataset_name + ' entity=' + entity_id + ' 値=' + cell)
            if value == int(value):
                value = int(value)
            by_period[periods[i]].append({'entity': entity_id, 'value': value})
    out = []
    for p in periods:
        # 期間は数値化できれば数値に
        pk = p
        try:
            pk = int(p)
        except ValueError:
            pass
        out.append({'period': pk, 'entries': by_period[p]})
    return out


def resolve_topic(article, registry):
    """記事1本を、app.jsが読む topic 形式に変換する（実体ID→表示名を解決）。"""
    slug = article.get('id')

    # entries は dataset か インラインdata のどちらか
    if article.get('dataset'):
        raw_periods = load_dataset(article['dataset'])
    else:
        raw_periods = article.get('data', [])

    notes = article.get('notes', {}) or {}

    periods = []
    for p in raw_periods:
        entries = []
        for e in p.get('entries', []):
            eid = e['entity']
            ent = registry.get(eid)
            if ent is None:
                raise BuildError('記事 ' + str(slug) + ' が未登録の実体IDを参照: ' + str(eid) +
                                 '（content/entities.json に無い）')
            entry = {'name': ent['name'], 'value': e['value']}
            if eid in notes:
                entry['note'] = notes[eid]
            entries.append(entry)
        entries.sort(key=lambda x: x['value'], reverse=True)
        periods.append({'period': p.get('period'), 'entries': entries})
    periods.sort(key=lambda pp: (pp['period'] is None, pp['period']))

    return {
        'id': slug,
        'title': article.get('title'),
        'category': article.get('category'),
        'unit': article.get('unit'),
        'source': article.get('source'),
        'sourceUrl': article.get('sourceUrl'),
        'updateFrequency': article.get('updateFrequency'),
        'updatedAt': article.get('updatedAt'),
        'lead': article.get('lead', '') or '',
        'commentary': article.get('commentary', '') or '',
        'analysisHeading': article.get('analysisHeading', '') or '',
        'analysis': article.get('analysis', []) or [],
        'sections': article.get('sections', []) or [],
        'periods': periods,
        'thumbnail': None,
    }


def validate(articles, registry):
    errors = []
    for a in articles:
        if a.get('category') not in VALID_CATEGORY_IDS:
            errors.append('記事 ' + str(a.get('id')) + ' のcategoryが不正: ' + str(a.get('category')))
        if not a.get('title'):
            errors.append('記事 ' + str(a.get('id')) + ' にtitleが無い')
        elif 'ランキング' not in a.get('title', ''):
            print('警告: タイトルに「ランキング」が含まれない: ' + str(a.get('id')), file=sys.stderr)
        # 自由本文ブロック(sections)の構造チェック（タイポ検出）
        known_block_keys = {'h2', 'h3', 'p', 'list', 'table'}
        for i, block in enumerate(a.get('sections', []) or []):
            if not isinstance(block, dict):
                errors.append('記事 ' + str(a.get('id')) + ' の sections[' + str(i) + '] がオブジェクトでない')
                continue
            keys = set(block.keys()) & known_block_keys
            if not keys:
                errors.append('記事 ' + str(a.get('id')) + ' の sections[' + str(i) +
                              '] に有効なブロック種別が無い（' + ', '.join(sorted(known_block_keys)) + ' のいずれか）: ' + str(list(block.keys())))
            if 'table' in block:
                tbl = block['table']
                if not isinstance(tbl, dict) or not isinstance(tbl.get('rows'), list):
                    errors.append('記事 ' + str(a.get('id')) + ' の sections[' + str(i) + '] の table に rows(配列) が無い')
    # 似すぎた実体名の警告（表記ゆれの二重登録検出）
    names = {}
    for eid, e in registry.items():
        nm = (e.get('name') or '').strip()
        names.setdefault(nm, []).append(eid)
    for nm, ids in names.items():
        if len(ids) > 1:
            print('警告: 同名の実体が複数登録されている: ' + nm + ' -> ' + ', '.join(ids), file=sys.stderr)
    if errors:
        raise BuildError('\n'.join(errors))


def attach_images(topics, entities_out):
    """public/images 配下の画像を discover して紐づける（fetch_*.py が取得済みの前提）。"""
    credits = c.load_image_credits()
    for eid, e in entities_out.items():
        candidate = os.path.join(c.IMAGES_DIR, eid + '.webp')
        if os.path.exists(candidate):
            e['image'] = '/images/entities/' + eid + '.webp'
        if not (e.get('imageCredit') or '').strip():
            info = credits.get(eid)
            if info:
                e['imageCredit'] = c.format_credit(info)
    for t in topics:
        candidate = os.path.join(c.TOPIC_IMAGES_DIR, t['id'] + '.webp')
        if os.path.exists(candidate):
            t['thumbnail'] = '/images/topics/' + t['id'] + '.webp'


def main():
    registry = load_registry()
    articles = load_articles()
    validate(articles, registry)

    topics = []
    for a in articles:
        topics.append(resolve_topic(a, registry))

    # entities.js 用の出力（登録簿順＝id昇順）
    entities_out = {}
    for eid in sorted(registry.keys()):
        e = registry[eid]
        entities_out[eid] = {
            'name': e.get('name'),
            'type': e.get('type'),
            'image': None,
            'imageCredit': '',
        }

    attach_images(topics, entities_out)

    # ---- ranking-data.js ----
    data = {'categories': c.CATEGORIES, 'topics': topics}
    header = (
        '// このファイルは scripts/build.py が content/ から自動生成します。\n'
        '// 直接編集しないでください（content/ を編集して再ビルドしてください）。\n'
    )
    with open(c.DATA_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(header + 'window.RANKING_DATA = ' + c.to_js(data) + ';\n')
    print(str(len(topics)) + '件のトピックを ' + c.DATA_OUTPUT_PATH + ' に書き出しました。')

    # ---- entities.js ----
    with open(c.ENTITIES_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(
            '// このファイルは scripts/build.py が content/ から自動生成します。\n'
            'window.ENTITIES_DATA = ' + c.to_js(entities_out) + ';\n'
        )
    print(str(len(entities_out)) + '件のEntitiesを ' + c.ENTITIES_OUTPUT_PATH + ' に書き出しました。')

    # ---- sitemap / robots（entities は id/type を持つ形に合わせる）----
    entities_for_sitemap = {eid: {'id': eid, 'type': e.get('type')} for eid, e in entities_out.items()}
    with open(c.SITEMAP_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(c.build_sitemap_xml(topics, entities_for_sitemap))
    print('sitemap.xml を書き出しました。')
    with open(c.ROBOTS_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write('User-agent: *\nAllow: /\n\nSitemap: ' + c.SITE_URL + '/sitemap.xml\n')
    print('robots.txt を書き出しました。')


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        print('ビルドエラー:\n' + str(e), file=sys.stderr)
        sys.exit(1)
