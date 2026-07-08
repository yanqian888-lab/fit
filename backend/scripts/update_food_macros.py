#!/usr/bin/env python3
"""
按照 word/食品库02.txt 更新 food_db 的三大营养素（protein/fat/carb），
不修改其他字段。
"""
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / 'data' / 'app.db'
CSV_PATH = BASE_DIR / '..' / 'word' / '食品库02.txt'


def is_number(s):
    try:
        float(s)
        return True
    except ValueError:
        return False


def parse_line(line, header_len):
    # 备注里可能有英文逗号且未加引号，最多切出 11 列
    parts = line.strip().split(',', header_len - 1)
    if len(parts) < 4 or not is_number(parts[0]):
        return None

    food_id = int(parts[0])

    # 第 4 列（索引 3）若是数字，说明 food_name 缺失
    if is_number(parts[3]):
        # 索引：calories=3, protein=4, fat=5, carbs=6
        if len(parts) < 7:
            return None
        return {
            'food_id': food_id,
            'protein': float(parts[4]),
            'fat': float(parts[5]),
            'carb': float(parts[6]),
        }
    else:
        # 正常：food_name=3, calories=4, protein=5, fat=6, carbs=7
        if len(parts) < 8:
            return None
        return {
            'food_id': food_id,
            'protein': float(parts[5]),
            'fat': float(parts[6]),
            'carb': float(parts[7]),
        }


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    parsed = []
    with open(CSV_PATH, encoding='utf-8') as f:
        header = f.readline().strip().split(',')
        header_len = len(header)
        for line in f:
            if not line.strip():
                continue
            item = parse_line(line, header_len)
            if item:
                parsed.append(item)
            else:
                print('无法解析行:', line.strip()[:80])

    updated = 0
    skipped = 0

    cur.execute('BEGIN')
    for item in parsed:
        cur.execute(
            'SELECT 1 FROM food_db WHERE food_id = ?',
            (item['food_id'],)
        )
        if not cur.fetchone():
            skipped += 1
            continue

        cur.execute(
            '''UPDATE food_db
               SET protein_per_100g = ?,
                   fat_per_100g = ?,
                   carb_per_100g = ?
               WHERE food_id = ?''',
            (item['protein'], item['fat'], item['carb'], item['food_id'])
        )
        if cur.rowcount:
            updated += 1

    conn.commit()
    conn.close()

    print(f'文件解析成功行数: {len(parsed)}')
    print(f'已更新行数: {updated}')
    print(f'food_db 中不存在的 food_id 跳过: {skipped}')


if __name__ == '__main__':
    main()
