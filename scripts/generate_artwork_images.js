const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Create images directory if it doesn't exist
const imagesDir = path.join(__dirname, '../public/artworks/images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

// Function to generate a random pastel color
function getPastelColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 80%)`;
}

// Function to create an artwork image with different styles
function createArtworkImage(artwork, imageName, style = 'main') {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Different background styles based on image type
    switch (style) {
        case 'main':
            // Main image: solid pastel background
            ctx.fillStyle = getPastelColor();
            ctx.fillRect(0, 0, width, height);
            break;
        case 'detail':
            // Detail image: gradient background
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, getPastelColor());
            gradient.addColorStop(1, getPastelColor());
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            break;
        case 'context':
            // Context image: pattern background
            ctx.fillStyle = getPastelColor();
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            for (let i = 0; i < width; i += 30) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, height);
                ctx.stroke();
            }
            break;
        case 'restoration':
            // Restoration image: split view effect
            ctx.fillStyle = getPastelColor();
            ctx.fillRect(0, 0, width/2, height);
            ctx.fillStyle = getPastelColor();
            ctx.fillRect(width/2, 0, width/2, height);
            break;
    }

    // Add artwork information
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    
    // Title
    ctx.fillText(artwork.title.en, width/2, height/2 - 50);
    
    // Artist and Year
    ctx.font = '32px Arial';
    ctx.fillText(`${artwork.artist}, ${artwork.year}`, width/2, height/2 + 50);
    
    // Image type label
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`${style.toUpperCase()} VIEW`, width/2, height - 100);
    
    // Add artwork ID
    ctx.fillText(`ID: ${artwork.id}`, width/2, height - 50);

    // Save the image
    const buffer = canvas.toBuffer('image/jpeg');
    fs.writeFileSync(path.join(imagesDir, imageName), buffer);
    console.log(`Generated image: ${imageName}`);
}

// Process each artwork markdown file
const contentDir = path.join(__dirname, '../public/artworks/content');
fs.readdirSync(contentDir)
    .filter(file => file.endsWith('.md'))
    .forEach(file => {
        const filePath = path.join(contentDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        
        if (match) {
            const artwork = yaml.load(match[1]);
            const baseFilename = artwork.id;
            
            // Generate multiple images for each artwork
            const images = [
                `${baseFilename}.jpg`,                    // Main image
                `${baseFilename}-detail1.jpg`,            // Detail view 1
                `${baseFilename}-detail2.jpg`,            // Detail view 2
                `${baseFilename}-context.jpg`             // Context view
            ];

            // Update the markdown file with the new image array
            const updatedYaml = {
                ...artwork,
                image: images
            };
            
            const updatedContent = `---\n${yaml.dump(updatedYaml)}---\n`;
            fs.writeFileSync(filePath, updatedContent);

            // Generate all images
            createArtworkImage(artwork, images[0], 'main');
            createArtworkImage(artwork, images[1], 'detail');
            createArtworkImage(artwork, images[2], 'detail');
            createArtworkImage(artwork, images[3], 'context');
        }
    });

console.log('All artwork images have been generated!'); 