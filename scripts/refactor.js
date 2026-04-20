const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /from\("contacts"\)/g, to: 'from("students")' },
  { from: /from\("contact_programs"\)/g, to: 'from("student_programs")' },
  { from: /from\("contact_payments"\)/g, to: 'from("student_payments")' },
  { from: /from\("contact_documents"\)/g, to: 'from("student_documents")' },
  { from: /contact_id/g, to: 'student_id' },
  { from: /"counselor"/g, to: '"teacher"' },
  { from: /'counselor'/g, to: "'teacher'" },
  { from: /Contact/g, (match, offset, string) => {
    // Avoid replacing part of larger words like 'Contacted'
    const prev = string[offset - 1];
    const next = string[offset + match.length];
    if (/[a-zA-Z]/.test(prev) || (/[a-z]/.test(next) && next !== 's')) return match; 
    return 'Student';
  }},
];

function walk(dir, callback) {
  fs.readdirSync(dir).forEach( f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
};

walk('./src', (filePath) => {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  for (const r of replacements) {
    if (typeof r.to === 'function') {
      content = content.replace(r.from, r.to);
    } else {
      content = content.replace(r.from, r.to);
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
