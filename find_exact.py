import os

def search():
    terms = ["barangay", "cleaner"]
    print("Searching for files containing 'barangay' and 'cleaner'...")
    for root, dirs, files in os.walk("."):
        if any(ignored in root for ignored in ["node_modules", ".git", ".next", "venv", "venv_tf"]):
            continue
        for file in files:
            filepath = os.path.join(root, file)
            # Only search source/text files
            if not file.endswith((".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".sql", ".md", ".txt")):
                continue
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    content_lower = content.lower()
                    if "barangay" in content_lower and "cleaner" in content_lower:
                        print(f"File contains both: {filepath}")
                        # Print lines containing cleaner/barangay
                        f.seek(0)
                        for i, line in enumerate(f, 1):
                            line_lower = line.lower()
                            if "barangay" in line_lower or "cleaner" in line_lower:
                                if "must be" in line_lower or "error" in line_lower or "valid" in line_lower or "or" in line_lower:
                                    print(f"  Line {i}: {line.strip()}")
            except Exception as e:
                pass

if __name__ == "__main__":
    search()
