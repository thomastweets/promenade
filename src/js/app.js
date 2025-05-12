import './i18n.js';
import { initializeQRScanner } from './qr-scanner.js';
import Swiper from 'swiper';
import jsyaml from 'js-yaml';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import '../css/styles.css';

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
            prevBtn.innerHTML = `<i class="fas fa-chevron-left"></i>`;
            prevBtn.addEventListener('click', () => this.navigateArtwork(-1));
        }
        if (nextBtn) {
            nextBtn.innerHTML = `<i class="fas fa-chevron-right"></i>`;
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

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (this.audioElement.paused) {
                    this.audioElement.play();
                    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                } else {
                    this.audioElement.pause();
                    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
            });
        }

        if (this.audioElement && progressFilled && currentTime && duration) {
            this.audioElement.addEventListener('timeupdate', () => {
                const percent = (this.audioElement.currentTime / this.audioElement.duration) * 100;
                progressFilled.style.width = `${percent}%`;
                currentTime.textContent = this.formatTime(this.audioElement.currentTime);
            });

            this.audioElement.addEventListener('loadedmetadata', () => {
                duration.textContent = this.formatTime(this.audioElement.duration);
            });

            this.audioElement.addEventListener('ended', () => {
                if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            });
        }

        if (progressBar) {
            progressBar.addEventListener('click', (e) => {
                const progressTime = (e.offsetX / progressBar.offsetWidth) * this.audioElement.duration;
                this.audioElement.currentTime = progressTime;
            });
        }
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
        let needsInject = false;
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
                        <span id="artwork-dimensions" style="display:none">
                            <i class="fas fa-ruler-combined"></i>
                            <span class="dimensions-value"></span>
                        </span>
                        <span id="artwork-material" style="display:none">
                            <i class="fas fa-cube"></i>
                            <span class="material-value"></span>
                        </span>
                    </div>
                    <p id="artwork-description"></p>
                </div>
            `;
            needsInject = true;
        }

        this.updateContent(artwork);

        // Ensure updateArtworkImages is called after DOM update
        if (needsInject) {
            requestAnimationFrame(() => {
                this.updateArtworkImages(artwork);
            });
        } else {
            this.updateArtworkImages(artwork);
        }

        // Update audio source and reset player
        const audioFile = artwork.audio[getCurrentLang()];
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
        const lang = getCurrentLang();
        // Update main content with headphone icon
        document.getElementById('artwork-number').innerHTML = `
            <i class="fas fa-headphones"></i>
            ${artwork.id}
        `;
        document.getElementById('artwork-title').textContent = artwork.title[lang];
        document.querySelector('.artist-name').textContent = artwork.artist;
        document.querySelector('.year-value').textContent = artwork.year;
        // Render description with paragraphs and line breaks
        const descRaw = artwork.description[lang] || '';
        const descHtml = descRaw
            .split(/\n\s*\n/)
            .map(paragraph => paragraph.trim().replace(/\n/g, '<br>'))
            .filter(Boolean)
            .map(paragraph => `<p>${paragraph}</p>`)
            .join('');
        document.getElementById('artwork-description').innerHTML = descHtml;
        // Update audio player info with headphone icon
        document.querySelector('.audio-artwork-number').innerHTML = `
            <i class="fas fa-headphones"></i>
            ${artwork.id}
        `;
        document.querySelector('.audio-artwork-title').textContent = artwork.title[lang];
        // Update navigation numbers
        const prevNumber = (parseInt(artwork.id) - 1).toString().padStart(2, '0');
        const nextNumber = (parseInt(artwork.id) + 1).toString().padStart(2, '0');
        const prevElement = document.querySelector('.prev-artwork-number');
        const nextElement = document.querySelector('.next-artwork-number');
        if (prevElement) prevElement.innerHTML = `<i class='fas fa-headphones'></i> ${prevNumber}`;
        if (nextElement) nextElement.innerHTML = `<i class='fas fa-headphones'></i> ${nextNumber}`;
        // Dimensions
        const dimElem = document.getElementById('artwork-dimensions');
        if (artwork.dimensions) {
            dimElem.style.display = '';
            dimElem.querySelector('.dimensions-value').textContent = artwork.dimensions;
        } else {
            dimElem.style.display = 'none';
        }
        // Material (i18n)
        const matElem = document.getElementById('artwork-material');
        const langMat = artwork.material && artwork.material[lang];
        if (langMat) {
            matElem.style.display = '';
            matElem.querySelector('.material-value').textContent = langMat;
        } else {
            matElem.style.display = 'none';
        }
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
        const swiperContainer = document.querySelector('.artwork-swiper');

        // Clear existing slides
        swiperWrapper.innerHTML = '';

        // Remove existing image count indicator if any
        const existingCount = swiperContainer.querySelector('.image-count');
        if (existingCount) existingCount.remove();

        // Add image count indicator if multiple images
        if (images.length > 1) {
            const imageCount = document.createElement('div');
            imageCount.className = 'image-count';
            imageCount.innerHTML = `<i class="fas fa-images"></i> ${images.length}`;
            swiperContainer.appendChild(imageCount);
        }

        // Add new slides
        images.forEach(image => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = `<img src="/artworks/images/${image}" alt="${artwork.title[getCurrentLang()]}" />`;
            swiperWrapper.appendChild(slide);
        });

        // Destroy previous Swiper instance if exists
        if (this.swiper) {
            this.swiper.destroy(true, true);
            this.swiper = null;
        }

        // Now that all slides and navigation elements are present, initialize Swiper
        this.swiper = new Swiper('.artwork-swiper', {
            slidesPerView: 1,
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
        // Only update navigation/pagination if they exist
        if (this.swiper.navigation && typeof this.swiper.navigation.update === 'function') {
            this.swiper.navigation.update();
        }
        if (this.swiper.pagination && typeof this.swiper.pagination.update === 'function') {
            this.swiper.pagination.update();
        }
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

// Helper to safely get the current language
function getCurrentLang() {
    return (window.i18n && window.i18n.currentLang) ? window.i18n.currentLang : 'de';
}

// Load and parse exhibition config from public/exhibition.md
async function loadExhibitionConfig() {
    try {
        const response = await fetch('/exhibition.md');
        if (!response.ok) throw new Error('Exhibition config not found');
        const text = await response.text();
        const match = text.match(/^---\n([\s\S]*?)\n---/);
        if (!match) throw new Error('Invalid exhibition config format');
        const config = jsyaml.load(match[1]);
        window.exhibitionConfig = config;
        return config;
    } catch (e) {
        console.error('Failed to load exhibition config:', e);
        window.exhibitionConfig = {};
        return {};
    }
}

// Wait for config before initializing the app
window.addEventListener('DOMContentLoaded', async () => {
    await loadExhibitionConfig();
    updateExhibitionUI();
    new AudioGuideApp();
});

function updateExhibitionUI() {
    const config = window.exhibitionConfig || {};
    const lang = getCurrentLang();
    // Logo
    if (config.logo) {
        let logoImg = document.querySelector('.exhibition-logo');
        if (!logoImg) {
            logoImg = document.createElement('img');
            logoImg.className = 'exhibition-logo';
        }
        logoImg.src = config.logo;
        logoImg.alt = config.title && config.title[lang] ? config.title[lang] : 'Logo';
        logoImg.style.maxHeight = '80px';
        logoImg.style.marginRight = '0';
        const logoContainer = document.querySelector('.header-logo');
        if (logoContainer && !logoContainer.contains(logoImg)) {
            logoContainer.innerHTML = '';
            logoContainer.appendChild(logoImg);
        }
    }
    // Title in header
    if (config.title && config.title[lang]) {
        const h1 = document.querySelector('h1[data-i18n="app.title"]');
        if (h1) h1.textContent = config.title[lang];
        document.title = config.title[lang];
        // Subtitle
        let subtitleElem = document.querySelector('.exhibition-subtitle');
        if (!subtitleElem) {
            subtitleElem = document.createElement('div');
            subtitleElem.className = 'exhibition-subtitle';
            const h1 = document.querySelector('h1[data-i18n="app.title"]');
            if (h1 && h1.parentElement) h1.parentElement.insertBefore(subtitleElem, h1.nextSibling);
        }
        if (config.subtitle && config.subtitle[lang]) {
            subtitleElem.textContent = config.subtitle[lang];
            subtitleElem.style.display = '';
        } else {
            subtitleElem.style.display = 'none';
        }
        // Inject subtitle style if not present
        if (!document.getElementById('exhibition-subtitle-style')) {
            const style = document.createElement('style');
            style.id = 'exhibition-subtitle-style';
            style.textContent = `
                .exhibition-subtitle {
                    display: block;
                    font-size: 1.1rem;
                    color: var(--text-secondary, #bfc9db);
                    margin-top: 0.3em;
                    margin-bottom: 0.5em;
                    font-weight: 400;
                    letter-spacing: 0.01em;
                    text-align: center;
                }
            `;
            document.head.appendChild(style);
        }
    }
    // Only render start page intro on index.html
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
        // Start page heading and text
        if (config.start_page) {
            let introHeading = document.getElementById('exhibition-intro-heading');
            let introText = document.getElementById('exhibition-intro-text');
            if (!introHeading) {
                introHeading = document.createElement('h2');
                introHeading.id = 'exhibition-intro-heading';
                const main = document.querySelector('main');
                if (main) main.insertBefore(introHeading, main.firstChild);
            }
            if (!introText) {
                introText = document.createElement('div');
                introText.id = 'exhibition-intro-text';
                const main = document.querySelector('main');
                if (main) main.insertBefore(introText, introHeading.nextSibling);
            }
            if (config.start_page.heading && config.start_page.heading[lang]) {
                introHeading.textContent = config.start_page.heading[lang];
                introHeading.style.display = '';
            } else {
                introHeading.style.display = 'none';
            }
            if (config.start_page.text && config.start_page.text[lang]) {
                introText.innerHTML = config.start_page.text[lang].replace(/\n/g, '<br>');
                introText.style.display = '';
            } else {
                introText.style.display = 'none';
            }
        }
    } else {
        // Remove start page intro if present on other pages
        let introHeading = document.getElementById('exhibition-intro-heading');
        let introText = document.getElementById('exhibition-intro-text');
        if (introHeading) introHeading.remove();
        if (introText) introText.remove();
    }

    // Footer injection (with styling)
    let footer = document.querySelector('footer.exhibition-footer');
    if (!footer) {
        footer = document.createElement('footer');
        footer.className = 'exhibition-footer';
        const appDiv = document.querySelector('.app');
        if (appDiv) appDiv.appendChild(footer);
    }
    let html = '';
    // Organisation name and homepage
    if (config.organisation && config.organisation.name && config.organisation.name[lang]) {
        if (config.organisation.homepage) {
            html += `<div class="org"><a href="${config.organisation.homepage}" target="_blank" rel="noopener">${config.organisation.name[lang]}</a></div>`;
        } else {
            html += `<div class="org">${config.organisation.name[lang]}</div>`;
        }
    }
    // Dates
    if (config.dates && (config.dates.start || config.dates.end)) {
        html += '<div class="dates">';
        if (config.dates.start) html += `<span class="date-start">${config.dates.start}</span>`;
        if (config.dates.start && config.dates.end) html += ' – ';
        if (config.dates.end) html += `<span class="date-end">${config.dates.end}</span>`;
        html += '</div>';
    }
    // Contact info
    if (config.organisation && config.organisation.contact && (config.organisation.contact.email || config.organisation.contact.phone)) {
        html += '<div class="contact">';
        if (config.organisation.contact.email) html += `<a href="mailto:${config.organisation.contact.email}"><i class="fas fa-envelope"></i> ${config.organisation.contact.email}</a> `;
        if (config.organisation.contact.phone) html += `<span><i class="fas fa-phone"></i> ${config.organisation.contact.phone}</span>`;
        html += '</div>';
    }
    // Social links
    if (config.organisation && config.organisation.social) {
        const social = config.organisation.social;
        const icons = { twitter: 'fab fa-twitter', instagram: 'fab fa-instagram', facebook: 'fab fa-facebook' };
        const links = Object.entries(icons)
            .filter(([key]) => social[key])
            .map(([key, icon]) => `<a href="${social[key]}" target="_blank" rel="noopener"><i class="${icon}"></i></a>`)
            .join(' ');
        if (links) html += `<div class="social">${links}</div>`;
    }
    // Footer text
    if (config.footer && config.footer.text && config.footer.text[lang]) {
        html += `<div class="footer-text">${config.footer.text[lang]}</div>`;
    }
    footer.innerHTML = html;
    // Inject footer styles if not present
    if (!document.getElementById('exhibition-footer-style')) {
        const style = document.createElement('style');
        style.id = 'exhibition-footer-style';
        style.textContent = `
        .exhibition-footer {
            background: var(--bg-secondary, #222c3a);
            color: var(--text-secondary, #bfc9db);
            border-top: 1px solid var(--border-color, #334);
            padding: 2rem 1rem 1.5rem 1rem;
            margin-top: 2rem;
            display: flex;
            flex-wrap: wrap;
            gap: 1.5rem 2.5rem;
            justify-content: center;
            align-items: flex-start;
            font-size: 1rem;
        }
        .exhibition-footer .org, .exhibition-footer .dates, .exhibition-footer .contact, .exhibition-footer .social, .exhibition-footer .footer-text {
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .exhibition-footer .org a {
            color: var(--primary-color, #0055a5);
            text-decoration: none;
            font-weight: bold;
        }
        .exhibition-footer .org a:hover {
            text-decoration: underline;
        }
        .exhibition-footer .social a {
            color: var(--primary-color, #0055a5);
            font-size: 1.3em;
            margin-right: 0.5em;
        }
        .exhibition-footer .social a:last-child {
            margin-right: 0;
        }
        .exhibition-footer .contact a, .exhibition-footer .contact span {
            color: inherit;
            text-decoration: none;
            margin-right: 1em;
        }
        .exhibition-footer .contact a:hover {
            text-decoration: underline;
        }
        .exhibition-footer .footer-text {
            flex-basis: 100%;
            justify-content: center;
            text-align: center;
            margin-top: 0.5rem;
            color: var(--text-secondary, #bfc9db);
            font-size: 0.95em;
        }
        @media (max-width: 600px) {
            .exhibition-footer {
                flex-direction: column;
                align-items: stretch;
                gap: 0.5rem;
                padding: 1.2rem 0.5rem 1rem 0.5rem;
            }
            .exhibition-footer .footer-text {
                margin-top: 1rem;
            }
        }
        `;
        document.head.appendChild(style);
    }

    // Theme colors
    if (config.theme) {
        const root = document.documentElement;
        if (config.theme.color_primary) {
            root.style.setProperty('--primary-color', config.theme.color_primary);
        }
        if (config.theme.color_secondary) {
            root.style.setProperty('--secondary-color', config.theme.color_secondary);
        }
    }

    // Vita (artist bio) section for about page
    if (window.location.pathname.endsWith('about.html')) {
        if (config.vita && config.vita.enabled && config.vita.text && config.vita.text[lang]) {
            let main = document.querySelector('main.content-page');
            if (main) {
                let vitaSection = document.getElementById('vita-section');
                if (!vitaSection) {
                    vitaSection = document.createElement('div');
                    vitaSection.className = 'content-section';
                    vitaSection.id = 'vita-section';
                    main.insertBefore(vitaSection, main.firstChild);
                }
                let heading = config.vita.heading && config.vita.heading[lang] ? config.vita.heading[lang] : '';
                let photoHtml = '';
                if (config.vita.artist_photo) {
                    photoHtml = `<img src="${config.vita.artist_photo}" alt="Artist photo" class="vita-artist-photo">`;
                }
                vitaSection.innerHTML = `
                    <h2><i class="fas fa-user"></i> ${heading}</h2>
                    <div class="vita-bio-flex">
                        ${photoHtml}
                        <div class="vita-text">${config.vita.text[lang].replace(/\n/g, '<br>')}</div>
                    </div>
                `;
                // Inject style for artist photo if not present
                if (!document.getElementById('vita-photo-style')) {
                    const style = document.createElement('style');
                    style.id = 'vita-photo-style';
                    style.textContent = `
                        .vita-bio-flex { display: flex; align-items: flex-start; gap: 2rem; flex-wrap: wrap; }
                        .vita-artist-photo {
                            width: 120px;
                            height: 120px;
                            object-fit: cover;
                            border-radius: 50%;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
                            margin-bottom: 1rem;
                        }
                        @media (max-width: 600px) {
                            .vita-bio-flex { flex-direction: column; align-items: center; gap: 1rem; }
                            .vita-artist-photo { width: 90px; height: 90px; }
                        }
                    `;
                    document.head.appendChild(style);
                }
            }
        } else {
            // Remove vita section if not enabled or missing
            let vitaSection = document.getElementById('vita-section');
            if (vitaSection) vitaSection.remove();
        }
    }
} 