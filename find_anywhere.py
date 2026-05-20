import os

def search():
    target = "barangay' or 'cleaner"
    print(f"Searching for exact phrase: \"{target}\"...")
    count = 0
    for root, dirs, files in os.walk("."):
        if ".git" in dirs:
            dirs.remove(".git")
        for file in files:
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    if target.lower() in content.lower():
                        print(f"MATCH in {filepath}")
                        # Print lines around the match
                        f.seek(0)
                        for idx, line in enumerate(f, 1):
                            if target.lower() in line.lower():
                                print(f"  Line {idx}: {line.strip()}")
                        count += 1
            except Exception:
                pass
    print(f"Search completed. Found {count} matching file(s).")

if __name__ == "__main__":
    search()
