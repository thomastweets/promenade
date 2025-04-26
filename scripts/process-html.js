const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const glob = require('glob');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const globPromise = promisify(glob);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Create clean fonts.css with correct references
async function cleanFontsCss() {
  console.log('Creating clean fonts.css with correct references...');
  
  try {
    // Generate the clean CSS with correct references
    const fontsCSS = `
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(../fonts/playfair-display/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtXK-F2qC0s.woff2) format('woff2'),
       url(../fonts/playfair-display/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtXK-F2qC0s.woff) format('woff');
}

@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(../fonts/playfair-display/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiu78btXK-F2qC0s.woff2) format('woff2'),
       url(../fonts/playfair-display/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiu78btXK-F2qC0s.woff) format('woff');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(../fonts/inter/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2) format('woff2'),
       url(../fonts/inter/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff) format('woff');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(../fonts/inter/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2) format('woff2'),
       url(../fonts/inter/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff) format('woff');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(../fonts/inter/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2) format('woff2'),
       url(../fonts/inter/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff) format('woff');
}`;

    // Minify the CSS
    // A simple minification for illustration - in production you'd use a proper minifier
    const minifiedCSS = fontsCSS
      .replace(/\n/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\/\*.*?\*\//g, '')
      .replace(/\s*{\s*/g, '{')
      .replace(/\s*}\s*/g, '}')
      .replace(/\s*:\s*/g, ':')
      .replace(/\s*;\s*/g, ';')
      .replace(/;\}/g, '}')
      .trim();

    // Write the minified CSS to the fonts.css file
    const fontsFile = path.join(PUBLIC_DIR, 'css', 'fonts.css');
    await writeFile(fontsFile, minifiedCSS);
    
    console.log('Updated fonts.css file with correct font references');
  } catch (err) {
    console.error('Error updating fonts.css:', err);
  }
}

// Fix JavaScript references in HTML files
async function fixJsReferences() {
  console.log('Fixing JavaScript references in HTML files...');
  
  try {
    // Get all HTML files
    const htmlFiles = await globPromise(path.join(PUBLIC_DIR, '*.html'));
    
    for (const htmlFile of htmlFiles) {
      console.log(`Processing ${path.basename(htmlFile)}...`);
      let htmlContent = await readFile(htmlFile, 'utf8');
      
      // Fix vendor JS references
      htmlContent = htmlContent.replace(
        /src="js\/vendor\/js-yaml\.min\.js"/g,
        'src="js/vendor/js-yaml.min.js"'
      );
      
      await writeFile(htmlFile, htmlContent);
    }
    
    console.log('Fixed JavaScript references in HTML files');
  } catch (err) {
    console.error('Error fixing JavaScript references:', err);
  }
}

// Main function
async function processAssets() {
  try {
    await cleanFontsCss();
    await fixJsReferences();
    console.log('Asset processing completed!');
  } catch (err) {
    console.error('Error processing assets:', err);
    process.exit(1);
  }
}

// Run the process
processAssets(); 