import os
import re

files_with_conflicts = [
    "src/pages/ExamMode.css",
    "src/pages/StudyMode.tsx",
    "src/pages/Dashboard.css",
    "src/pages/Dashboard.tsx",
    "src/pages/ExamMode.tsx",
    "src/components/FileUpload.tsx",
    "src/pages/Library.tsx",
    "src/sections/Hero.tsx"
]

def resolve_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, 'r') as f:
        content = f.read()
        
    # Regex to match:
    # <<<<<<< HEAD
    # (content we want to keep)
    # =======
    # (content we want to discard)
    # >>>>>>> (commit msg)
    
    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n?=======\n.*?\n?>>>>>>> [^\n]*\n', re.DOTALL)
    
    new_content, count = pattern.subn(r'\1\n', content)
    
    if count > 0:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Resolved {count} conflicts in {filepath}")
    else:
        print(f"No conflicts found matching the pattern in {filepath}")

for f in files_with_conflicts:
    resolve_file(f)
