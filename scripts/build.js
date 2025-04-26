const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { execSync } = require('child_process');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);

const jsDir = path.join(__dirname, '..', 'js');
const publicJsDir = path.join(__dirname, '..', 'public', 'js');

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

async function processJsFiles() {
  try {
    await ensureDir(publicJsDir);
    
    const files = await readdir(jsDir);
    
    for (const file of files) {
      if (path.extname(file) === '.js') {
        const inputPath = path.join(jsDir, file);
        const outputPath = path.join(publicJsDir, file);
        
        console.log(`Minifying ${file}...`);
        execSync(`npx terser ${inputPath} -o ${outputPath} --compress --mangle`);
      }
    }
    
    console.log('JavaScript optimization completed!');
  } catch (err) {
    console.error('Error processing JS files:', err);
    process.exit(1);
  }
}

// Run the process
processJsFiles(); 