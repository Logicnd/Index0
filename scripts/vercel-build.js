const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'public');

execSync('node scripts/generate-client-config.js', { cwd: root, stdio: 'inherit' });

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

['index.html', 'admin.html'].forEach((file) => {
  copyRecursive(path.join(root, file), path.join(outDir, file));
});

['css', 'js'].forEach((dir) => {
  copyRecursive(path.join(root, dir), path.join(outDir, dir));
});

console.log(`Vercel output ready in ${outDir}`);
