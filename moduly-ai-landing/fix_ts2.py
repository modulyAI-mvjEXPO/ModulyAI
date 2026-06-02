import re
filepath = 'src/pages/ExamMode.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r'import type \{ ExamRequest, ExamResponse.*?;', "import type { PyqIntelligenceResponse } from '../lib/ai/types';", c)
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(c)

filepath = 'src/pages/StudyMode.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r"import \{ chatWithAI \} from '\.\./lib/ai/core';\s*", "", c)
c = re.sub(r'\{activeTopics\.length > 0 \? ` · \$\{activeTopics\.map\(t => t\.title\)\.join\(\', \'\)\}` : \'\'\}', "", c)
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(c)
