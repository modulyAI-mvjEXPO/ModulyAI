import re

filepath = 'src/pages/StudyMode.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Import vectaraService
content = content.replace(
    "import { ButtonColorful } from '../components/ui/button-colorful';\nimport './StudyMode.css';",
    "import { ButtonColorful } from '../components/ui/button-colorful';\nimport vectaraService from '../services/vectaraService';\nimport './StudyMode.css';"
)
content = content.replace(
    "import { ButtonColorful } from '../components/ui/button-colorful';\r\nimport './StudyMode.css';",
    "import { ButtonColorful } from '../components/ui/button-colorful';\r\nimport vectaraService from '../services/vectaraService';\r\nimport './StudyMode.css';"
)

# 2. Modify sendMessage general AI mode
target_general = """      const selectedDocIds = docs.filter(d => d.selected).map(d => d.id);
      const history = buildHistory([...messages, userMsg]);
      const response = await chatWithAI(text, selectedDocIds, selectedMark, strict, subjectId || undefined, history);

      const generalAiMsg: Message = {
        id: uid(),
        role: 'ai',
        content: response.response,"""
replacement_general = """      const selectedDocIds = docs.filter(d => d.selected).map(d => d.id);
      const history = buildHistory([...messages, userMsg]);
      const responseText = await vectaraService.chat(text, history);

      const generalAiMsg: Message = {
        id: uid(),
        role: 'ai',
        content: responseText,"""
content = content.replace(target_general, replacement_general)
content = content.replace(target_general.replace('\n', '\r\n'), replacement_general.replace('\n', '\r\n'))

# 3. Typing indicator
target_typing = """              <div className="sm-bubble sm-bubble--ai sm-typing-bubble">
                <span /><span /><span />
              </div>"""
replacement_typing = """              <div className="sm-bubble sm-bubble--ai sm-typing-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>Analyzing study materials...</span>
                <span /><span /><span />
              </div>"""
content = content.replace(target_typing, replacement_typing)
content = content.replace(target_typing.replace('\n', '\r\n'), replacement_typing.replace('\n', '\r\n'))

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("StudyMode updated successfully!")
