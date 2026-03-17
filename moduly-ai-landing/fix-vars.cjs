const fs = require('fs');
const path = require('path');

const cssFiles = [
  'src/pages/Dashboard.css',
  'src/pages/StudyMode.css',
  'src/pages/ExamMode.css',
  'src/pages/Library.css',
  'src/pages/UploadDocs.css',
  'src/pages/Settings.css',
  'src/pages/Onboarding.css',
  'src/components/AppNav/AppNav.css',
  'src/components/AuthModal.css'
];

let totalChanged = 0;
const baseDir = process.cwd();

cssFiles.forEach(file => {
  const fullPath = path.join(baseDir, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const sizeBefore = content.length;
  
  // Replacements
  content = content.replace(/color:\s*var\(--muted\)/g, 'color: var(--muted-foreground)');
  content = content.replace(/var\(--surface\)/g, 'var(--muted)');
  content = content.replace(/var\(--card\)/g, 'var(--background)');
  
  if (content.length !== sizeBefore) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated: ${file}`);
    totalChanged++;
  }
});

console.log(`Total files updated: ${totalChanged}`);
