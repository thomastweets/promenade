const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const contentDir = path.join(__dirname, '..', 'public', 'artworks', 'content');
const outputFile = path.join(contentDir, 'index.json');

// Read all markdown files
const files = fs.readdirSync(contentDir)
    .filter(file => file.endsWith('.md'))
    .sort();

const artworks = {};

// Process each file
files.forEach(file => {
    const content = fs.readFileSync(path.join(contentDir, file), 'utf8');
    const frontMatter = content.split('---')[1];
    
    if (frontMatter) {
        try {
            const data = yaml.load(frontMatter);
            artworks[data.id] = data;
        } catch (e) {
            console.error(`Error processing ${file}:`, e);
        }
    }
});

// Write the index file
fs.writeFileSync(outputFile, JSON.stringify(artworks, null, 2));
console.log(`Generated ${outputFile} with ${Object.keys(artworks).length} artworks`); 