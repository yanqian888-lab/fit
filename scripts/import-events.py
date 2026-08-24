#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
事件集合/事件导入脚本（幂等，可重复执行）

从 Excel 导入事件集与事件到后台事件模块：
- 事件集 -> event_collections（默认启用）
- 事件   -> pet_events_lib（默认不启用 is_enabled=0，由后台逐个启用）
- 场景分类：外出 -> location=explore（外出时长默认 30 分钟），居家 -> location=home

用法：
  python3 scripts/import-events.py <事件表格.xlsx> [db路径]
示例：
  python3 scripts/import-events.py 事件集合.xlsx backend/data/app.db
"""
import sqlite3
import sys

import openpyxl

# 集合名称 -> coll_key（同时作为 pet_events_lib.type）
COLL_KEY_MAP = {
    '多巴胺生长记': 'dopamine',
    '搭搭小确幸': 'small_joy',
    '意志力小事': 'willpower',
    '消除皮质醇': 'cortisol',
    '家里也很有趣': 'home_fun',
}

LOCATION_MAP = {'外出': 'explore', '居家': 'home'}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    xlsx_path = sys.argv[1]
    db_path = sys.argv[2] if len(sys.argv) > 2 else 'backend/data/app.db'

    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    ws = wb.worksheets[0]

    conn = sqlite3.connect(db_path, timeout=30)
    cur = conn.cursor()

    coll_order = {}   # name -> 首次出现顺序
    coll_seq = {}     # name -> 集合内自增序号（序号列缺失/异常时兜底）
    rows = []
    cur_coll = None
    for row in ws.iter_rows(min_row=2, values_only=True):
        name, seq, title, scene, desc = row[:5]
        if name:
            cur_coll = str(name).strip()
            if cur_coll not in coll_order:
                coll_order[cur_coll] = len(coll_order)
        if not title or not cur_coll:
            continue
        coll_seq[cur_coll] = coll_seq.get(cur_coll, 0) + 1
        # 序号列必须是数字，否则用集合内自增序号（表格中可能混入文字说明）
        seq_val = int(seq) if isinstance(seq, (int, float)) else coll_seq[cur_coll]
        rows.append({
            'coll_name': cur_coll,
            'seq': seq_val,
            'title': str(title).strip(),
            'scene': str(scene).strip() if scene else '',
            'content': str(desc).strip() if desc else '',
        })

    unknown_colls = [n for n in coll_order if n not in COLL_KEY_MAP]
    if unknown_colls:
        print('错误：存在未映射 coll_key 的集合名称，请先在 COLL_KEY_MAP 中补充:', unknown_colls)
        sys.exit(1)

    # 导入事件集（幂等）
    coll_inserted = 0
    for name, order in coll_order.items():
        cur.execute(
            'INSERT OR IGNORE INTO event_collections (coll_key, name, sort_order, is_enabled) VALUES (?, ?, ?, 1)',
            (COLL_KEY_MAP[name], name, order),
        )
        coll_inserted += cur.rowcount

    # 导入事件（幂等，默认不启用）
    evt_inserted = 0
    skipped_scene = 0
    for r in rows:
        location = LOCATION_MAP.get(r['scene'])
        if not location:
            skipped_scene += 1
            print('  跳过（场景分类无法识别 %r）: %s' % (r['scene'], r['title']))
            continue
        coll_key = COLL_KEY_MAP[r['coll_name']]
        event_key = '%s_%03d' % (coll_key, r['seq'])
        explore_minutes = 120 if location == 'explore' else 60
        cur.execute(
            '''INSERT OR IGNORE INTO pet_events_lib
               (event_key, type, title, content, rarity, drop_rate, weight, location, explore_minutes, reward_json, sort_order, is_enabled)
               VALUES (?, ?, ?, ?, 'common', 0.1, 5, ?, ?, '{"berries":10}', ?, 0)''',
            (event_key, coll_key, r['title'], r['content'], location, explore_minutes, r['seq']),
        )
        evt_inserted += cur.rowcount

    conn.commit()
    total_colls = cur.execute('SELECT COUNT(*) FROM event_collections').fetchone()[0]
    total_events = cur.execute('SELECT COUNT(*) FROM pet_events_lib').fetchone()[0]
    enabled_events = cur.execute('SELECT COUNT(*) FROM pet_events_lib WHERE is_enabled = 1').fetchone()[0]
    conn.close()

    print('导入完成:')
    print('  新增事件集: %d（本次），库内共 %d 个' % (coll_inserted, total_colls))
    print('  新增事件: %d（本次，均未启用），库内共 %d 条（已启用 %d）' % (evt_inserted, total_events, enabled_events))
    if skipped_scene:
        print('  跳过场景无法识别: %d 条' % skipped_scene)


if __name__ == '__main__':
    main()
