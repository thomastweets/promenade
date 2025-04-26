const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { execSync } = require('child_process');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const cssDir = path.join(__dirname, '..', 'css');
const publicCssDir = path.join(__dirname, '..', 'public', 'css');

async function ensureDir(dir) {
  try {
    await stat(dir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await mkdir(dir, { recursive: true });
    } else {
      throw err;
    }
  }
}

async function processCssFiles() {
  try {
    await ensureDir(publicCssDir);
    
    const files = await readdir(cssDir);
    
    for (const file of files) {
      if (path.extname(file) === '.css') {
        const inputPath = path.join(cssDir, file);
        const outputPath = path.join(publicCssDir, file);
        
        console.log(`Optimizing ${file}...`);
        execSync(`npx postcss ${inputPath} -o ${outputPath}`);
      }
    }
    
    console.log('CSS optimization completed!');
  } catch (err) {
    console.error('Error processing CSS files:', err);
    process.exit(1);
  }
}

// Run the process
processCssFiles(); 