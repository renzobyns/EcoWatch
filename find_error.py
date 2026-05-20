import os

def search_text(text):
    print(f"Searching for: '{text}'...")
    found = False
    for root, dirs, files in os.walk("."):
        # Ignore common large directories to avoid lag
        if any(ignored in root for ignored in ["node_modules", ".git", ".next"]):
            continue
        for file in files:
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    for i, line in enumerate(f, 1):
                        if text.lower() in line.lower():
                            print(f"MATCH in {filepath}:{i} -> {line.strip()}")
                            found = True
            except Exception as e:
                pass
    if not found:
        print("No matches found.")

if __name__ == "__main__":
    search_text("must be")
    search_text("barangay")
