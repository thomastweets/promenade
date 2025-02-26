# Promenade

A lightweight, mobile-first web application for museum audio guides. This application allows visitors to access artwork information, images, and audio descriptions by entering numbers or scanning QR codes.

## Features

- Mobile-first responsive design
- Works offline (PWA)
- QR code scanning support
- Native audio playback
- No server required - runs entirely in the browser
- Easy to customize and deploy

## Setup

1. Clone this repository
2. Add your artwork assets:
   - Place artwork images in `assets/` directory
   - Place audio files in `assets/` directory
   - Update the `artworkData` object in `js/app.js` with your content

### Artwork Data Structure

Add your artwork information to the `artworkData` object in `js/app.js`:

```javascript
const artworkData = {
    1: {
        title: "Artwork Title",
        description: "Artwork description",
        image: "assets/artwork-1.jpg",
        audio: "assets/audio-1.mp3"
    },
    // Add more artwork entries...
};
```

## Deployment

Since this is a static website, you can deploy it to any web hosting service that supports static sites:

- GitHub Pages
- Netlify
- Vercel
- Or any standard web server

## QR Code Generation

To generate QR codes for your artworks:

1. Create QR codes that contain just the artwork number (e.g., "1", "2", etc.)
2. Print and place the QR codes next to the corresponding artworks

## Development

To run locally during development:

1. Use a local web server (e.g., Python's built-in server):
   ```bash
   python -m http.server 8000
   ```
2. Open `http://localhost:8000` in your browser

## Browser Support

This application uses modern web technologies and should work in all recent versions of:

- Chrome
- Firefox
- Safari
- Edge

## Customization

### Styling
Modify `css/styles.css` to match your institution's branding:

- Update the color scheme in the `:root` variables
- Modify the layout and components as needed

### Adding Features
The modular structure makes it easy to add new features:

1. Modify the HTML in `index.html`
2. Add corresponding styles in `css/styles.css`
3. Extend the `AudioGuide` class in `js/app.js`
