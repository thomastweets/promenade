// Copy fixture data from fixtures/ to runtime locations
const fs = require('fs-extra');
const path = require('path');

const fixtureRoot = path.join(__dirname, '../fixtures');
const runtimeExhibition = path.join(__dirname, '../public/exhibition.md');
const fixtureExhibition = path.join(fixtureRoot, 'exhibition.md');
const runtimeExampleDir = path.join(__dirname, '../public/artworks/content');
const fixtureExampleDir = path.join(fixtureRoot, 'artworks/content');

async function copyFixtures() {
  // Copy exhibition.md
  if (await fs.pathExists(fixtureExhibition)) {
    await fs.copy(fixtureExhibition, runtimeExhibition);
    console.log('Copied exhibition.md fixture.');
  }
  // Copy example artworks (all .md files in fixtures/artworks/content)
  if (await fs.pathExists(fixtureExampleDir)) {
    const files = await fs.readdir(fixtureExampleDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        await fs.copy(
          path.join(fixtureExampleDir, file),
          path.join(runtimeExampleDir, file)
        );
        console.log(`Copied artwork fixture: ${file}`);
      }
    }
  }
}

copyFixtures().catch(err => {
  console.error('Error copying fixtures:', err);
  process.exit(1);
}); 