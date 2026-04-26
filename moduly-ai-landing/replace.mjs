import fs from 'fs';
import path from 'path';

const dirs = ['src', 'netlify', '.'];
const exts = ['.ts', '.tsx', '.css', '.html', '.mts', '.mjs'];

function walk(dir, callback) {
    if (dir === '.' || dir === './') {
        callback('./index.html');
        return;
    }
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        if (stat.isDirectory()) {
            walk(filepath, callback);
        } else {
            if (exts.includes(path.extname(filepath))) {
                callback(filepath);
            }
        }
    }
}

let files = [];
walk('src', f => files.push(f));
walk('netlify', f => files.push(f));
walk('.', f => files.push(f));

for (const f of files) {
    let content = fs.readFileSync(f, 'utf8');
    
    // rename vtu -> college, VTU -> College
    let newContent = content
        .replace(/VTU/g, 'College')
        .replace(/vtu/g, 'college')
        .replace(/Vtu/g, 'College');
        
    if (newContent !== content) {
        fs.writeFileSync(f, newContent, 'utf8');
        console.log('Updated', f);
    }
}

// Rename vtuData.ts to collegeData.ts if it exists
if (fs.existsSync('src/lib/vtuData.ts')) {
    fs.renameSync('src/lib/vtuData.ts', 'src/lib/collegeData.ts');
    console.log('Renamed vtuData.ts to collegeData.ts');
}
