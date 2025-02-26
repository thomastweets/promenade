// Class to handle the artwork grid display and interaction
class ArtworksGrid {
    constructor() {
        this.grid = document.getElementById('artworksGrid');
        if (!this.grid) {
            console.error('Artworks grid element not found');
            return;
        }
        this.currentLang = window.i18n ? window.i18n.currentLang : 'de';
        this.artworkData = null;
        this.loadArtworkData().then(() => {
            this.renderArtworks();
            this.bindLanguageChange();
        });
    }

    async loadArtworkData() {
        try {
            const response = await fetch('/artworks/content/index.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.artworkData = await response.json();
        } catch (error) {
            console.error('Failed to load artwork data:', error);
            this.grid.innerHTML = '<p class="error-message">Failed to load artwork data</p>';
        }
    }

    bindLanguageChange() {
        document.addEventListener('languageChanged', (e) => {
            this.currentLang = e.detail.language;
            this.grid.innerHTML = ''; // Clear the grid
            this.renderArtworks();
        });
    }

    renderArtworks() {
        if (!this.artworkData || !this.grid) return;

        Object.entries(this.artworkData)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .forEach(([number, artwork]) => {
                const card = this.createArtworkCard(number, artwork);
                this.grid.appendChild(card);
            });
    }

    createArtworkCard(number, artwork) {
        if (!artwork || !artwork.title || !artwork.description) {
            console.error('Invalid artwork data:', artwork);
            return null;
        }

        const images = Array.isArray(artwork.image) ? artwork.image : [artwork.image];
        const description = artwork.description[this.currentLang] || '';
        // Limit description to ~100 characters and add ellipsis if needed
        const truncatedDesc = description.length > 100 ? description.substring(0, 100) + '...' : description;

        const card = document.createElement('div');
        card.className = 'artwork-card';
        card.innerHTML = `
            <div class="artwork-card-image">
                <img src="/artworks/images/${artwork.image}" alt="${artwork.title[this.currentLang] || ''}" 
                     onerror="this.src='/artworks/images/placeholder.jpg'">
                <span class="artwork-number">${artwork.id}</span>
                ${images.length > 1 ? `<span class="image-count"><i class="fas fa-images"></i> ${images.length}</span>` : ''}
            </div>
            <div class="artwork-card-content">
                <h3>${artwork.title[this.currentLang] || ''}</h3>
                <div class="artwork-metadata">
                    <span>${artwork.artist || ''}</span>
                    <span>${artwork.year || ''}</span>
                </div>
                <p>${truncatedDesc}</p>
            </div>
        `;

        // Make the entire card clickable
        card.addEventListener('click', () => {
            window.location.href = `index.html?artwork=${artwork.id}`;
        });

        return card;
    }
}

// Initialize the grid when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ArtworksGrid();
}); 