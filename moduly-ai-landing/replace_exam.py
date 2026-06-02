import re

filepath = 'src/pages/ExamMode.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Import vectaraService
content = content.replace(
    "import { supabase } from '../lib/supabase';",
    "import { supabase } from '../lib/supabase';\nimport vectaraService from '../services/vectaraService';"
)

# 2. Update solveWithAI
target_solve = """async function solveWithAI(question: string, mark: string, documentIds: ReadonlyArray<string>): Promise<string> {
  const requestBody: ExamRequest = { 
    question, 
    mark,
    documentIds: documentIds.length > 0 ? documentIds : undefined,
  };

  const backendBase = import.meta.env.VITE_BACKEND_URL || '';
  const res = await fetch(`${backendBase}/exam-solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    if (question.toLowerCase().includes('avl')) {
      return buildAnswerHtml('**AVL Tree Rotations** are self-balancing operations performed when a BST becomes unbalanced. They ensure operations remain O(log n).', mark);
    }
    return buildAnswerHtml('I am currently running in a demo environment without live API keys to grade this question! Please upload proper API credentials to grade custom questions.', mark);
  }

  const data = await res.json() as ExamResponse;
  return buildAnswerHtml(data.answer, mark);
}"""

replacement_solve = """async function solveWithAI(question: string, mark: string, documentIds: ReadonlyArray<string>): Promise<string> {
  try {
    const aiResponse = await vectaraService.chat(question);
    return buildAnswerHtml(aiResponse, mark);
  } catch (err) {
    return buildAnswerHtml('Error communicating with Vectara.', mark);
  }
}"""

content = content.replace(target_solve, replacement_solve)
content = content.replace(target_solve.replace('\n', '\r\n'), replacement_solve.replace('\n', '\r\n'))

# 3. Update "Generating structured answer..." to "Analyzing study materials..."
target_typing1 = """                    {isTyping && (
                      <div className="em-typing">
                        <span className="material-icons-outlined em-icon-20">smart_toy</span>
                        <div className="em-typing-dots">
                          <span /><span /><span />
                        </div>
                        Generating structured answer...
                      </div>
                    )}"""

replacement_typing1 = """                    {isTyping && (
                      <div className="em-typing">
                        <span className="material-icons-outlined em-icon-20">smart_toy</span>
                        <div className="em-typing-dots">
                          <span /><span /><span />
                        </div>
                        Analyzing study materials...
                      </div>
                    )}"""

content = content.replace(target_typing1, replacement_typing1)
content = content.replace(target_typing1.replace('\n', '\r\n'), replacement_typing1.replace('\n', '\r\n'))


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("ExamMode updated successfully!")
