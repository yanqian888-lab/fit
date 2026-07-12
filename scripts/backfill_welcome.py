import sqlite3
import sys

def backfill(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT id FROM users")
    users = c.fetchall()
    inserted = 0
    content = "你好呀，我是你的专属减肥搭子～\n从今天开始，我会陪你一起记录饮食、运动、体重，一起瘦下来！有什么想聊的，随时告诉我吧～"
    for (uid,) in users:
        count = c.execute("SELECT COUNT(*) FROM chat_messages WHERE user_id = ?", (uid,)).fetchone()[0]
        if count == 0:
            c.execute("""
                INSERT INTO chat_messages (user_id, role, content, content_type, mode)
                VALUES (?, ?, ?, ?, ?)
            """, (uid, 'partner', content, 'text', 'gentle'))
            inserted += 1
    conn.commit()
    conn.close()
    print(f"{db_path}: inserted {inserted}")

if __name__ == '__main__':
    for path in sys.argv[1:]:
        backfill(path)
