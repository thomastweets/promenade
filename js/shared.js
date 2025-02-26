class SharedUI {
    constructor() {
        // Initialize theme
        this.theme = localStorage.getItem('theme') || 'light';
        this.initializeElements();
        this.bindEvents();
        this.applyTheme();
    }

    initializeElements() {
        this.themeToggle = document.getElementById('themeToggle');
        this.lightIcon = this.themeToggle.querySelector('.light-icon');
        this.darkIcon = this.themeToggle.querySelector('.dark-icon');
    }

    bindEvents() {
        // Theme toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => {
                this.toggleTheme();
                this.themeToggle.blur(); // Remove focus after click
            });
        }
    }

    toggleTheme() {
        // Toggle between light and dark only
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
    }

    applyTheme() {
        // Set theme directly without checking system preference
        document.documentElement.setAttribute('data-theme', this.theme);
        
        // Update icons based on current theme
        const isDark = this.theme === 'dark';
        this.lightIcon.classList.toggle('active', !isDark);
        this.darkIcon.classList.toggle('active', isDark);
    }
}

// Initialize shared UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sharedUI = new SharedUI();
}); 