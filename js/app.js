import { initializeQRScanner } from './qr-scanner.js';

class AudioGuideApp {
    constructor() {
        this.currentArtwork = null;
        this.audioElement = document.getElementById('audio-element');
        this.artworkContent = document.getElementById('artwork-content');
        this.swiper = null;
        this.isScanning = false;
        
        this.initializeUI();
        this.initializeAudioPlayer();
        this.initializeLanguageButtons();
        this.loadArtworkFromURL();
    }

    initializeUI() {
        // Initialize theme toggle
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            const lightIcon = themeToggle.querySelector('.light-icon');
            const darkIcon = themeToggle.querySelector('.dark-icon');
            
            // Set initial state
            const currentTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', currentTheme);
            this.updateThemeIcons(lightIcon, darkIcon, currentTheme);

            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                this.updateThemeIcons(lightIcon, darkIcon, newTheme);
            });
        }

        // Check if we're on an artwork page
        const params = new URLSearchParams(window.location.search);
        const isArtworkPage = params.has('artwork');
        
        // Add appropriate class to body
        if (isArtworkPage) {
            document.body.classList.add('has-artwork');
        } else {
            document.body.classList.remove('has-artwork');
        }

        // Initialize artwork menu button
        const menuButton = document.querySelector('.artwork-menu-toggle');
        if (menuButton) {
            menuButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleArtworkMenu();
            });
        }

        // Initialize input tabs on root page only
        if (!isArtworkPage) {
            this.initializeInputTabs();
        }
        
        // Navigation - update with artwork numbers
        const prevBtn = document.getElementById('prevArtwork');
        const nextBtn = document.getElementById('nextArtwork');
        if (prevBtn) {
            prevBtn.innerHTML = `
                <i class="fas fa-chevron-left"></i>
                <span class="artwork-number">
                    <i class="fas fa-headphones"></i>
                    <span class="prev-number"></span>
                </span>
            `;
            prevBtn.addEventListener('click', () => this.navigateArtwork(-1));
        }
        if (nextBtn) {
            nextBtn.innerHTML = `
                <span class="artwork-number">
                    <i class="fas fa-headphones"></i>
                    <span class="next-number"></span>
                </span>
                <i class="fas fa-chevron-right"></i>
            `;
            nextBtn.addEventListener('click', () => this.navigateArtwork(1));
        }

        // Hide player initially if we're on the root page
        const player = document.getElementById('audio-player');
        if (player) {
            if (!isArtworkPage) {
                player.classList.remove('show');
            } else {
                player.classList.add('show');
            }
        }

        // Update input placeholder translation
        const input = document.getElementById('artworkNumber');
        if (input && window.i18n) {
            const updatePlaceholder = () => {
                input.placeholder = window.i18n.getTranslation('input.placeholder');
            };
            updatePlaceholder();
            // Update placeholder when language changes
            window.addEventListener('languageChanged', updatePlaceholder);
        }
    }

    updateThemeIcons(lightIcon, darkIcon, theme) {
        if (theme === 'light') {
            lightIcon.classList.remove('active');
            darkIcon.classList.add('active');
        } else {
            lightIcon.classList.add('active');
            darkIcon.classList.remove('active');
        }
    }

    toggleArtworkMenu() {
        let menu = document.querySelector('.artwork-menu');
        if (!menu) {
            menu = this.createArtworkMenu();
            document.body.appendChild(menu);
            // Trigger animation after a small delay
            requestAnimationFrame(() => {
                menu.classList.add('show');
            });
        } else {
            menu.classList.remove('show');
            menu.addEventListener('transitionend', () => menu.remove(), { once: true });
        }
    }

    createArtworkMenu() {
        const menu = document.createElement('div');
        menu.className = 'artwork-menu';
        menu.innerHTML = `
            <div class="artwork-menu-content">
                <div class="artwork-menu-header">
                    <h2><i class="fas fa-headphones"></i> Available Artworks</h2>
                    <div class="artwork-menu-actions">
                        <button class="menu-action-btn" id="menuNumpad">
                            <i class="fas fa-keyboard"></i>
                            <span data-i18n="input.numpad">Enter Number</span>
                        </button>
                        <button class="menu-action-btn" id="menuQRScanner">
                            <i class="fas fa-qrcode"></i>
                            <span data-i18n="input.qr">Scan QR Code</span>
                        </button>
                    </div>
                    <button class="close-menu"><i class="fas fa-times"></i></button>
                </div>
                <div class="artwork-menu-grid">
                    ${this.generateArtworkCards()}
                </div>
            </div>
        `;

        // Add event listeners
        menu.querySelector('.close-menu').addEventListener('click', () => this.toggleArtworkMenu());

        // Add click handlers for artwork cards
        menu.querySelectorAll('.artwork-mini-card').forEach(card => {
            card.addEventListener('click', () => {
                const artworkId = card.dataset.artwork;
                this.loadArtwork(artworkId);
                this.toggleArtworkMenu();
            });
        });

        // Add click handlers for menu action buttons
        menu.querySelector('#menuNumpad')?.addEventListener('click', () => {
            this.showQuickNumpad();
        });

        menu.querySelector('#menuQRScanner')?.addEventListener('click', async () => {
            this.toggleArtworkMenu(); // Close the menu first
            try {
                const qrScanner = await initializeQRScanner();
                
                qrScanner.setCallback(result => {
                    if (result.type === 'user-cancel') {
                        this.stopScanning();
                        return;
                    }

                    const urlMatch = result.data.match(/artwork=(\d+)/);
                    if (urlMatch) {
                        this.loadArtwork(urlMatch[1]);
                        qrScanner.stop();
                        this.stopScanning();
                        return;
                    }

                    const numberMatch = result.data.match(/^(\d+)$/);
                    if (numberMatch) {
                        this.loadArtwork(numberMatch[1]);
                        qrScanner.stop();
                        this.stopScanning();
                        return;
                    }

                    document.getElementById('errorMessage').textContent = 'Invalid artwork code';
                    document.getElementById('errorMessage').style.opacity = '1';
                });

                await qrScanner.start();
            } catch (error) {
                console.error('Failed to initialize QR scanner:', error);
                document.getElementById('errorMessage').textContent = 'Failed to start camera';
                document.getElementById('errorMessage').style.opacity = '1';
            }
        });

        return menu;
    }

    generateArtworkCards() {
        // Generate 10 artwork cards (or however many you have)
        return Array.from({ length: 10 }, (_, i) => {
            const number = (i + 1).toString().padStart(2, '0');
            return `
                <div class="artwork-mini-card" data-artwork="${number}">
                    <i class="fas fa-headphones"></i>
                    <span class="artwork-number">
                        <i class="fas fa-headphones"></i>
                        ${number}
                    </span>
                </div>
            `;
        }).join('');
    }

    initializeInputTabs() {
        const isArtworkPage = new URLSearchParams(window.location.search).has('artwork');
        const numpadTab = document.querySelector('[data-input="numpad"]');
        const qrTab = document.querySelector('[data-input="qr"]');
        const numpadPanel = document.getElementById('numpadPanel');
        const qrPanel = document.getElementById('qrPanel');

        // Only show numpad by default on root page
        if (!isArtworkPage) {
            numpadTab?.classList.add('active');
            numpadPanel?.classList.add('active');
        } else {
            // Hide input section on artwork pages
            const inputSection = document.querySelector('.input-section');
            if (inputSection) {
                inputSection.style.display = 'none';
            }
        }

        // Handle tab switching
        numpadTab?.addEventListener('click', () => {
            this.switchInputTab('numpad');
            if (this.isScanning) {
                this.stopScanning();
            }
        });

        qrTab?.addEventListener('click', async () => {
            this.switchInputTab('qr');
            // Start QR scanner immediately
            try {
                const qrScanner = await initializeQRScanner();
                
                qrScanner.setCallback(result => {
                    if (result.type === 'user-cancel') {
                        this.stopScanning();
                        return;
                    }

                    const urlMatch = result.data.match(/artwork=(\d+)/);
                    if (urlMatch) {
                        this.loadArtwork(urlMatch[1]);
                        qrScanner.stop();
                        this.stopScanning();
                        return;
                    }

                    const numberMatch = result.data.match(/^(\d+)$/);
                    if (numberMatch) {
                        this.loadArtwork(numberMatch[1]);
                        qrScanner.stop();
                        this.stopScanning();
                        return;
                    }

                    document.getElementById('errorMessage').textContent = 'Invalid artwork code';
                    document.getElementById('errorMessage').style.opacity = '1';
                });

                await qrScanner.start();
            } catch (error) {
                console.error('Failed to initialize QR scanner:', error);
                document.getElementById('errorMessage').textContent = 'Failed to start camera';
                document.getElementById('errorMessage').style.opacity = '1';
            }
        });

        // Initialize keypad with display
        this.initializeKeypad();
    }

    initializeQuickInput() {
        const quickInput = document.createElement('div');
        quickInput.className = 'artwork-quick-input';
        quickInput.innerHTML = `
            <button id="showNumpad">
                <i class="fas fa-keyboard"></i>
                <span data-i18n="input.numpad">Enter Number</span>
            </button>
            <button id="startQRScanner">
                <i class="fas fa-qrcode"></i>
                <span data-i18n="input.qr">Scan QR Code</span>
            </button>
        `;

        // Insert at the top of the artwork content
        const artworkContent = document.querySelector('.artwork-content');
        artworkContent?.insertBefore(quickInput, artworkContent.firstChild);

        // Initialize event listeners
        document.getElementById('showNumpad')?.addEventListener('click', () => {
            this.showQuickNumpad();
        });

        document.getElementById('startQRScanner')?.addEventListener('click', async () => {
            try {
                const qrScanner = await initializeQRScanner();
                
                qrScanner.setCallback(result => {
                    if (result.type === 'user-cancel') {
                        this.stopScanning();
                        return;
                    }

                    const urlMatch = result.data.match(/artwork=(\d+)/);
                    if (urlMatch) {
                        this.loadArtwork(urlMatch[1]);
                        qrScanner.stop();
                        this.stopScanning();
                        return;
                    }

                    const numberMatch = result.data.match(/^(\d+)$/);
                    if (numberMatch) {
                        this.loadArtwork(numberMatch[1]);
                        qrScanner.stop();
                        this.stopScanning();
                        return;
                    }

                    document.getElementById('errorMessage').textContent = 'Invalid artwork code';
                    document.getElementById('errorMessage').style.opacity = '1';
                });

                await qrScanner.start();
            } catch (error) {
                console.error('Failed to initialize QR scanner:', error);
                document.getElementById('errorMessage').textContent = 'Failed to start camera';
                document.getElementById('errorMessage').style.opacity = '1';
            }
        });
    }

    switchInputTab(tab) {
        const tabs = document.querySelectorAll('.input-tab');
        const panels = document.querySelectorAll('.input-panel');
        
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        document.querySelector(`[data-input="${tab}"]`)?.classList.add('active');
        document.getElementById(`${tab}Panel`)?.classList.add('active');
    }

    showQuickNumpad() {
        // Remove any existing modal
        const existingModal = document.querySelector('.modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="keypad">
                    <div class="keypad-display"></div>
                    <div class="keypad-row">
                        <button class="keypad-button" data-value="1">1</button>
                        <button class="keypad-button" data-value="2">2</button>
                        <button class="keypad-button" data-value="3">3</button>
                    </div>
                    <div class="keypad-row">
                        <button class="keypad-button" data-value="4">4</button>
                        <button class="keypad-button" data-value="5">5</button>
                        <button class="keypad-button" data-value="6">6</button>
                    </div>
                    <div class="keypad-row">
                        <button class="keypad-button" data-value="7">7</button>
                        <button class="keypad-button" data-value="8">8</button>
                        <button class="keypad-button" data-value="9">9</button>
                    </div>
                    <div class="keypad-row">
                        <button class="keypad-button keypad-clear" data-value="clear">C</button>
                        <button class="keypad-button" data-value="0">0</button>
                        <button class="keypad-button keypad-delete" data-value="delete"><i class="fas fa-backspace"></i></button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.initializeKeypadEvents(modal);

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Add escape key handler
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    initializeKeypad() {
        const display = document.querySelector('.keypad-display');
        let currentValue = '';

        document.querySelectorAll('.keypad-button').forEach(button => {
            button.addEventListener('click', () => {
                const value = button.dataset.value;
                
                if (value === 'clear') {
                    currentValue = '';
                } else if (value === 'delete') {
                    currentValue = currentValue.slice(0, -1);
                } else if (currentValue.length < 2) {
                    currentValue += value;
                }

                if (display) {
                    display.textContent = currentValue;
                }

                if (currentValue.length === 2) {
                    this.loadArtwork(currentValue);
                    currentValue = '';
                    // Close modal if it exists
                    const modal = document.querySelector('.modal');
                    if (modal) {
                        modal.remove();
                    }
                }
            });
        });
    }

    initializeKeypadEvents(container) {
        const display = container.querySelector('.keypad-display');
        let currentValue = '';

        container.querySelectorAll('.keypad-button').forEach(button => {
            button.addEventListener('click', () => {
                const value = button.dataset.value;
                
                if (value === 'clear') {
                    currentValue = '';
                } else if (value === 'delete') {
                    currentValue = currentValue.slice(0, -1);
                } else if (currentValue.length < 2) {
                    currentValue += value;
                }

                if (display) {
                    display.textContent = currentValue;
                }

                if (currentValue.length === 2) {
                    this.loadArtwork(currentValue);
                    container.remove();
                }
            });
        });
    }

    initializeQRScanner() {
        const scanButton = document.getElementById('scanQR');
        const cancelButton = document.getElementById('cancelScan');
        let qrScanner = null;

        scanButton?.addEventListener('click', async () => {
            this.isScanning = true;
            scanButton.classList.add('hidden');
            cancelButton?.classList.remove('hidden');
            
            try {
                qrScanner = await initializeQRScanner();
                
                // Set callback for successful scans
                qrScanner.setCallback(result => {
                    // Handle user cancellation
                    if (result.type === 'user-cancel') {
                        this.stopScanning();
                        return;
                    }

                    // Try to extract artwork ID from URL parameter
                    const urlMatch = result.data.match(/artwork=(\d+)/);
                    if (urlMatch) {
                        this.loadArtwork(urlMatch[1]);
                        qrScanner.stop();
                        this.stopScanning();
                        return;
                    }

                    // Try to parse as direct number
                    const numberMatch = result.data.match(/^(\d+)$/);
                    if (numberMatch) {
                        this.loadArtwork(numberMatch[1]);
                        qrScanner.stop();
                        this.stopScanning();
                        return;
                    }

                    // Invalid QR code
                    document.getElementById('errorMessage').textContent = 'Invalid artwork code';
                    document.getElementById('errorMessage').style.opacity = '1';
                });

                await qrScanner.start().catch(error => {
                    console.warn('QR scanning error:', error);
                    // Handle camera access errors
                    if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
                        qrScanner.stop();
                        this.stopScanning();
                        document.getElementById('errorMessage').textContent = 'Camera access denied';
                        document.getElementById('errorMessage').style.opacity = '1';
                    }
                });
            } catch (error) {
                console.error('Failed to initialize QR scanner:', error);
                this.stopScanning();
                document.getElementById('errorMessage').textContent = 'Failed to start camera';
                document.getElementById('errorMessage').style.opacity = '1';
            }
        });

        // Update cancel button handler
        cancelButton?.addEventListener('click', () => {
            if (this.isScanning && qrScanner) {
                qrScanner.stop();
                this.stopScanning();
            }
        });
    }

    initializeCancelButtons() {
        const cancelScan = document.getElementById('cancelScan');
        cancelScan.addEventListener('click', () => {
            if (this.isScanning) {
                // Stop QR scanner if it's running
                const scanner = document.querySelector('video');
                if (scanner) {
                    scanner.srcObject.getTracks().forEach(track => track.stop());
                    scanner.remove();
                }
                this.stopScanning();
            }
        });
    }

    stopScanning() {
        this.isScanning = false;
        document.getElementById('scanQR').classList.remove('hidden');
        document.getElementById('cancelScan').classList.add('hidden');
    }

    initializeAudioPlayer() {
        const playPauseBtn = document.querySelector('.audio-play-pause');
        const progressBar = document.querySelector('.progress-bar');
        const progressFilled = document.querySelector('.progress-filled');
        const currentTime = document.querySelector('.current-time');
        const duration = document.querySelector('.duration');

        playPauseBtn.addEventListener('click', () => {
            if (this.audioElement.paused) {
                this.audioElement.play();
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                this.audioElement.pause();
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        });

        this.audioElement.addEventListener('timeupdate', () => {
            const percent = (this.audioElement.currentTime / this.audioElement.duration) * 100;
            progressFilled.style.width = `${percent}%`;
            currentTime.textContent = this.formatTime(this.audioElement.currentTime);
        });

        this.audioElement.addEventListener('loadedmetadata', () => {
            duration.textContent = this.formatTime(this.audioElement.duration);
        });

        this.audioElement.addEventListener('ended', () => {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        });

        progressBar.addEventListener('click', (e) => {
            const progressTime = (e.offsetX / progressBar.offsetWidth) * this.audioElement.duration;
            this.audioElement.currentTime = progressTime;
        });
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    async loadArtwork(id) {
        try {
            const response = await fetch(`/artworks/content/${id.padStart(2, '0')}.md`);
            if (!response.ok) throw new Error('Artwork not found');
            
            const content = await response.text();
            
            // Parse YAML front matter
            const match = content.match(/^---\n([\s\S]*?)\n---/);
            if (!match) throw new Error('Invalid artwork content format');
            
            const artwork = jsyaml.load(match[1]);
            this.currentArtwork = artwork;
            
            // Update URL without reloading
            const url = new URL(window.location);
            url.searchParams.set('artwork', id);
            window.history.pushState({}, '', url);

            // Add has-artwork class to body
            document.body.classList.add('has-artwork');

            this.displayArtwork(artwork);
            
            // Clear any previous error messages
            document.getElementById('errorMessage').textContent = '';
        } catch (error) {
            console.error('Failed to load artwork:', error);
            document.getElementById('errorMessage').textContent = 'Artwork not found';
            document.getElementById('errorMessage').style.opacity = '1';
        }
    }

    resetAudioPlayer() {
        if (!this.audioElement) return;
        
        // Reset audio element
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        
        // Reset play button
        const playPauseBtn = document.querySelector('.audio-play-pause');
        if (playPauseBtn) {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
        
        // Reset progress bar
        const progressFilled = document.querySelector('.progress-filled');
        if (progressFilled) {
            progressFilled.style.width = '0%';
        }
        
        // Reset time display
        const currentTime = document.querySelector('.current-time');
        const duration = document.querySelector('.duration');
        if (currentTime) currentTime.textContent = '0:00';
        if (duration) duration.textContent = '0:00';
    }

    displayArtwork(artwork) {
        // Create artwork content structure if it doesn't exist
        if (!document.querySelector('.artwork-swiper')) {
            this.artworkContent.innerHTML = `
                <div class="swiper artwork-swiper">
                    <div class="swiper-wrapper">
                        <!-- Images will be added here dynamically -->
                    </div>
                    <div class="swiper-pagination"></div>
                    <div class="swiper-button-next"></div>
                    <div class="swiper-button-prev"></div>
                </div>
                <div class="artwork-info">
                    <div class="artwork-header">
                        <span id="artwork-number" class="artwork-number"></span>
                        <h2 id="artwork-title"></h2>
                    </div>
                    <div class="artwork-metadata">
                        <span id="artwork-artist">
                            <i class="fas fa-user-paintbrush"></i>
                            <span class="artist-name"></span>
                        </span>
                        <span id="artwork-year">
                            <i class="fas fa-calendar-alt"></i>
                            <span class="year-value"></span>
                        </span>
                    </div>
                    <p id="artwork-description"></p>
                </div>
            `;
        }

        this.updateContent(artwork);
        this.updateArtworkImages(artwork);

        // Update audio source and reset player
        const audioFile = artwork.audio[window.i18n.currentLang];
        this.audioElement.src = `/artworks/audio/${audioFile}`;
        
        // Show content and player
        this.artworkContent.classList.remove('hidden');
        document.getElementById('audio-player').classList.add('show');
        
        // Update navigation buttons state
        this.updateNavigationState();

        // Auto-play the audio
        this.audioElement.play().then(() => {
            document.querySelector('.audio-play-pause').innerHTML = '<i class="fas fa-pause"></i>';
        }).catch(error => {
            console.warn('Auto-play failed:', error);
            document.querySelector('.audio-play-pause').innerHTML = '<i class="fas fa-play"></i>';
        });
    }

    updateContent(artwork) {
        const lang = window.i18n.currentLang;
        
        // Update main content with headphone icon
        document.getElementById('artwork-number').innerHTML = `
            <i class="fas fa-headphones"></i>
            ${artwork.id}
        `;
        document.getElementById('artwork-title').textContent = artwork.title[lang];
        document.querySelector('.artist-name').textContent = artwork.artist;
        document.querySelector('.year-value').textContent = artwork.year;
        document.getElementById('artwork-description').textContent = artwork.description[lang];
        
        // Update audio player info with headphone icon
        document.querySelector('.audio-artwork-number').innerHTML = `
            <i class="fas fa-headphones"></i>
            ${artwork.id}
        `;
        document.querySelector('.audio-artwork-title').textContent = artwork.title[lang];

        // Update navigation numbers
        const prevNumber = (parseInt(artwork.id) - 1).toString().padStart(2, '0');
        const nextNumber = (parseInt(artwork.id) + 1).toString().padStart(2, '0');
        const prevElement = document.querySelector('.prev-number');
        const nextElement = document.querySelector('.next-number');
        if (prevElement) prevElement.textContent = prevNumber;
        if (nextElement) nextElement.textContent = nextNumber;
    }

    updateNavigationState() {
        if (!this.currentArtwork) return;
        
        const currentId = parseInt(this.currentArtwork.id);
        const prevButton = document.getElementById('prevArtwork');
        const nextButton = document.getElementById('nextArtwork');
        
        // Hide buttons completely if no previous/next artwork
        if (currentId <= 1) {
            prevButton.style.display = 'none';
        } else {
            prevButton.style.display = 'flex';
            prevButton.disabled = false;
        }
        
        if (currentId >= 10) {
            nextButton.style.display = 'none';
        } else {
            nextButton.style.display = 'flex';
            nextButton.disabled = false;
        }
    }

    updateArtworkImages(artwork) {
        const images = Array.isArray(artwork.image) ? artwork.image : [artwork.image];
        const swiperWrapper = document.querySelector('.swiper-wrapper');
        
        // Clear existing slides
        swiperWrapper.innerHTML = '';
        
        // Remove existing image count indicator if any
        const existingCount = document.querySelector('.artwork-swiper .image-count');
        if (existingCount) {
            existingCount.remove();
        }
        
        // Add image count indicator if multiple images
        if (images.length > 1) {
            const imageCount = document.createElement('div');
            imageCount.className = 'image-count';
            imageCount.innerHTML = `<i class="fas fa-images"></i> ${images.length}`;
            document.querySelector('.artwork-swiper').appendChild(imageCount);
        }
        
        // Add new slides
        images.forEach(image => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = `<img src="/artworks/images/${image}" alt="${artwork.title[window.i18n.currentLang]}">`;
            swiperWrapper.appendChild(slide);
        });

        // Initialize or update Swiper
        if (this.swiper) {
            this.swiper.destroy();
            this.swiper = null;
        }
        
        this.swiper = new Swiper('.artwork-swiper', {
            pagination: {
                el: '.swiper-pagination',
                clickable: true
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev'
            },
            loop: images.length > 1,
            grabCursor: true
        });
    }

    loadArtworkFromURL() {
        const params = new URLSearchParams(window.location.search);
        const artworkId = params.get('artwork');
        if (artworkId) {
            this.loadArtwork(artworkId);
        }
    }

    navigateArtwork(direction) {
        if (!this.currentArtwork) return;
        
        const currentId = parseInt(this.currentArtwork.id);
        const newId = (currentId + direction).toString().padStart(2, '0');
        this.loadArtwork(newId);
    }

    initializeLanguageButtons() {
        const buttons = document.querySelectorAll('.lang-btn');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const lang = button.dataset.lang;
                // Update active state
                buttons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Set language and trigger event
                window.i18n.setLanguage(lang);
                
                // Update content if artwork is loaded
                if (this.currentArtwork) {
                    this.updateContent(this.currentArtwork);
                    // Update audio source
                    const audioFile = this.currentArtwork.audio[lang];
                    this.audioElement.src = `/artworks/audio/${audioFile}`;
                    this.resetAudioPlayer();
                }
            });
            
            // Set initial active state
            if (button.dataset.lang === window.i18n.currentLang) {
                button.classList.add('active');
            }
        });
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AudioGuideApp();
}); 