import re

file_path = "src/pages/StudyMode.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Add import if missing
if "import { ButtonColorful }" not in content:
    content = content.replace("import './StudyMode.css';", "import { ButtonColorful } from '../components/ui/button-colorful';\nimport './StudyMode.css';")

# 1. New Study Session (Line 552)
content = re.sub(
    r'<button className="sm-dash-create-btn">\s*<span className="material-icons-outlined">add</span>\s*New Study Session\s*</button>',
    r'<ButtonColorful className="sm-dash-create-btn" onClick={() => setStudyView(\'pick-docs\')} label="New Study Session" />',
    content
)

# 2. Upload Documents (Line 629)
content = re.sub(
    r'<button className="sm-pick-upload-btn" onClick=\{\(\) => setPickerOpen\(true\)\}>\s*<span className="material-icons-outlined">cloud_upload</span>\s*Upload Documents\s*</button>',
    r'<ButtonColorful className="sm-pick-upload-btn" onClick={() => setPickerOpen(true)} label="Upload Documents" />',
    content
)

# 3. Skip & Learn Everything (Line ~666)
content = re.sub(
    r'<button\s*className="sm-pick-skip-btn"\s*onClick=\{\(\) => \{\s*selectAllDocs\(\);\s*setStudyView\(\'chat\'\);\s*\}\}\s*>\s*Skip & Learn Everything\s*<span className="material-icons-outlined">arrow_forward</span>\s*</button>',
    r'<ButtonColorful className="sm-pick-skip-btn" onClick={() => { selectAllDocs(); setStudyView(\'chat\'); }} label="Skip & Learn Everything" />',
    content
)

# 4. Start Learning (Line ~781)
content = re.sub(
    r'<button\s*className="sm-btn-start"\s*disabled=\{selectedDocIds\.length === 0\}\s*onClick=\{\(\) => setStudyView\(\'chat\'\)\}\s*>\s*Start Learning\s*<span className="material-icons-outlined">arrow_forward</span>\s*</button>',
    r'<ButtonColorful className="sm-btn-start w-full mt-4" disabled={selectedDocIds.length === 0} onClick={() => setStudyView(\'chat\')} label="Start Learning" />',
    content
)

with open(file_path, "w") as f:
    f.write(content)

print("StudyMode.tsx updated")
