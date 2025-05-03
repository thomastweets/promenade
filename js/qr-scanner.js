import QrScanner from 'qr-scanner';
QrScanner.WORKER_PATH = 'vendor/qr-scanner-worker.min.js';

export async function initializeQRScanner() {
    // Create a video element for the scanner
    const videoElem = document.createElement('video');
    videoElem.className = 'qr-scanner-video';
    document.body.appendChild(videoElem);

    // Create scanner instance with highlighting disabled
    const scanner = new QrScanner(
        videoElem,
        result => {
            // This callback will be replaced by the app's callback
            scanner.scanComplete(result);
        },
        {
            highlightScanRegion: false, // Disable built-in highlighting
            highlightCodeOutline: false, // Disable code outline
            maxScansPerSecond: 5,
            calculateScanRegion: (video) => {
                const smallestDimension = Math.min(video.videoWidth, video.videoHeight);
                const scanRegionSize = Math.round(smallestDimension * 0.6);
                
                return {
                    x: Math.round((video.videoWidth - scanRegionSize) / 2),
                    y: Math.round((video.videoHeight - scanRegionSize) / 2),
                    width: scanRegionSize,
                    height: scanRegionSize,
                };
            }
        }
    );

    // Add custom overlay
    const overlay = document.createElement('div');
    overlay.className = 'qr-scanner-overlay';
    overlay.innerHTML = `
        <div class="scan-region">
            <div class="scan-region-highlight">
                <div class="corner-tl"></div>
                <div class="corner-tr"></div>
                <div class="corner-bl"></div>
                <div class="corner-br"></div>
            </div>
            <div class="scan-region-message">Position the QR code in the frame</div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Add click handler to background
    overlay.addEventListener('click', (e) => {
        // Only trigger if clicking the overlay background, not the scan region
        if (e.target === overlay) {
            cleanup();
            scanner.scanComplete({ type: 'user-cancel' });
        }
    });

    // Add escape key handler
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            cleanup();
            scanner.scanComplete({ type: 'user-cancel' });
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    // Add styles for the overlay
    const style = document.createElement('style');
    style.textContent = `
        .qr-scanner-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            cursor: pointer;
        }
        
        .scan-region {
            position: relative;
            width: 280px;
            height: 280px;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: -40px;
            cursor: default; /* Reset cursor for scan region */
        }

        .scan-region-highlight {
            width: 250px;
            height: 250px;
            border: 2px solid var(--primary-color, #2563eb);
            border-radius: 12px;
            background: transparent;
            position: relative;
            z-index: 1002;
        }

        /* Corner markers */
        .corner-tl, .corner-tr, .corner-bl, .corner-br {
            position: absolute;
            width: 20px;
            height: 20px;
            border-color: var(--primary-color, #2563eb);
            border-style: solid;
        }

        .corner-tl {
            top: -2px;
            left: -2px;
            border-width: 4px 0 0 4px;
            border-radius: 12px 0 0 0;
        }

        .corner-tr {
            top: -2px;
            right: -2px;
            border-width: 4px 4px 0 0;
            border-radius: 0 12px 0 0;
        }

        .corner-bl {
            bottom: -2px;
            left: -2px;
            border-width: 0 0 4px 4px;
            border-radius: 0 0 0 12px;
        }

        .corner-br {
            bottom: -2px;
            right: -2px;
            border-width: 0 4px 4px 0;
            border-radius: 0 0 12px 0;
        }

        .scan-region-message {
            color: white;
            font-size: 1.1rem;
            text-align: center;
            margin-top: 16px;
            position: relative;
            z-index: 1002;
        }

        .qr-scanner-video {
            position: fixed !important;
            object-fit: cover !important;
            width: 250px !important;
            height: 250px !important;
            top: calc(50% - 40px) !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            border-radius: 12px !important;
            z-index: 1001 !important;
        }

        /* Hide any QrScanner built-in elements */
        ::part(qr-scanner-region) {
            display: none !important;
        }
    `;
    document.head.appendChild(style);

    // Clean up function
    const cleanup = () => {
        videoElem.remove();
        overlay.remove();
        style.remove();
        scanner.destroy();
        document.removeEventListener('keydown', escapeHandler);
    };

    // Add method to handle scan completion
    scanner.scanComplete = (result) => {
        // This will be overridden by the app
        console.log('Scan complete:', result);
    };

    return {
        start: async () => {
            try {
                await scanner.start();
            } catch (error) {
                cleanup();
                throw error;
            }
        },
        stop: () => {
            scanner.stop();
            cleanup();
        },
        destroy: cleanup,
        setCallback: (callback) => {
            scanner.scanComplete = callback;
        }
    };
} 