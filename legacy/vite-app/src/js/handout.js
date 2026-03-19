import { loadExhibitionConfig, getCurrentLang } from './shared.js';
import QRCode from 'qrcode';
import jsyaml from 'js-yaml';
import '@fortawesome/fontawesome-free/css/all.min.css';

function getQrNote(lang) {
    return lang === 'de'
        ? 'Scannen Sie diesen QR-Code mit Ihrem Smartphone, um den Audioguide für dieses Kunstwerk zu hören.'
        : 'Scan this QR code with your smartphone to listen to the audio guide for this artwork.';
}

async function loadArtworkData(artworkId) {
    // Fetch artwork markdown from public/artworks/content/{id}.md
    const response = await fetch(`/artworks/content/${artworkId}.md`);
    if (!response.ok) throw new Error('Artwork not found');
    const text = await response.text();
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) throw new Error('Invalid artwork format');
    return jsyaml.load(match[1]);
}

function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

function renderHandout(config, artwork) {
    const lang = getCurrentLang();
    // Logo (screen)
    if (config.logo) {
        const logoDiv = document.getElementById('handoutLogo');
        logoDiv.innerHTML = `<img src="${config.logo}" alt="Logo" style="max-height:80px;">`;
    }
    // Print logo
    if (config.print_logo) {
        const printLogoDiv = document.getElementById('handoutPrintLogo');
        printLogoDiv.innerHTML = `<img src="${config.print_logo}" alt="Print Logo" style="max-height:80px;">`;
        printLogoDiv.style.display = 'none'; // will be shown by CSS in print
    }
    // Title & subtitle
    document.getElementById('handoutTitle').textContent = artwork.title?.[lang] || artwork.title || '';
    document.getElementById('handoutSubtitle').textContent = config.title?.[lang] || '';
    // Artwork info
    const material = typeof artwork.material === 'object' ? (artwork.material[lang] || Object.values(artwork.material)[0] || '') : (artwork.material || '');
    const dimensions = typeof artwork.dimensions === 'object' ? (artwork.dimensions[lang] || Object.values(artwork.dimensions)[0] || '') : (artwork.dimensions || '');
    const contentDiv = document.getElementById('handoutContent');
    contentDiv.innerHTML = `
        <div class="artwork-meta">
            <div><strong>${artwork.artist || ''}</strong> (${artwork.year || ''})</div>
            <div>${material}</div>
            <div>${dimensions}</div>
        </div>
        <div class="artwork-description">${artwork.description?.[lang] || ''}</div>
    `;
    // First image
    const imageDiv = document.getElementById('handoutImage');
    if (artwork.image && artwork.image.length > 0) {
        imageDiv.innerHTML = `<img src="/artworks/images/${artwork.image[0]}" alt="Artwork image" style="max-width:100%;max-height:350px;">`;
    }
    // QR code and artwork number row
    const qrSectionLabel = document.getElementById('qrSectionLabel');
    qrSectionLabel.textContent = getQrNote(lang);
    const qrDiv = document.getElementById('handoutQR');
    qrDiv.innerHTML = '';
    const baseDomain = config.baseDomain || window.location.origin;
    const qrUrl = `${baseDomain}/index.html?artwork=${artwork.id}`;
    const qrCanvas = document.createElement('canvas');
    QRCode.toCanvas(qrCanvas, qrUrl, { width: 800 }, (err) => {
        if (!err) qrDiv.appendChild(qrCanvas);
        // Add the URL below the QR code
        const urlDiv = document.createElement('div');
        urlDiv.className = 'handout-link';
        urlDiv.textContent = qrUrl;
        qrDiv.appendChild(urlDiv);
        // Add big headphone and number below QR
        const qrRow = document.createElement('div');
        qrRow.className = 'handout-qr-row';
        qrRow.innerHTML = `
            <span class="handout-headphone-number">
                <i class="fas fa-headphones"></i>
                <span class="handout-artwork-number">${artwork.id}</span>
            </span>
        `;
        qrDiv.appendChild(qrRow);
    });
}

(async function() {
    try {
        const artworkId = getQueryParam('artwork');
        if (!artworkId) throw new Error('No artwork specified');
        const [config, artwork] = await Promise.all([
            loadExhibitionConfig(),
            loadArtworkData(artworkId)
        ]);
        renderHandout(config, artwork);
    } catch (e) {
        document.body.innerHTML = `<div style="color:red;padding:2em;text-align:center;">${e.message}</div>`;
    }
})(); 