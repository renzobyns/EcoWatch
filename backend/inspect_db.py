import sqlite3
import os

db_path = os.path.abspath("backend/ecowatch.db")
print(f"Connecting to {db_path}...")
conn = sqlite3.connect(db_path)
c = conn.cursor()

print("\n--- TABLES ---")
c.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
for name, sql in c.fetchall():
    print(f"Table: {name}")
    print(sql)
    print("-" * 40)

print("\n--- TRIGGERS ---")
c.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'")
for name, tbl_name, sql in c.fetchall():
    print(f"Trigger: {name} on {tbl_name}")
    print(sql)
    print("-" * 40)
