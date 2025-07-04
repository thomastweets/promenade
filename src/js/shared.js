import jsyaml from 'js-yaml';

class SharedUI {
    constructor() {
        // Initialize theme
        this.theme = localStorage.getItem('theme') || 'light';
        this.initializeElements();
        this.bindEvents();
        this.applyTheme();
    }

    initializeElements() {
        this.themeToggle = document.querySelector('.theme-toggle');
        if (this.themeToggle) {
            this.lightIcon = this.themeToggle.querySelector('.light-icon');
            this.darkIcon = this.themeToggle.querySelector('.dark-icon');
        } else {
            this.lightIcon = null;
            this.darkIcon = null;
        }
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
        if (this.lightIcon && this.darkIcon) {
            const isDark = this.theme === 'dark';
            this.lightIcon.classList.toggle('active', !isDark);
            this.darkIcon.classList.toggle('active', isDark);
        }
    }
}

// Initialize shared UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sharedUI = new SharedUI();

    // Burger menu toggle logic
    const burger = document.querySelector('.burger-menu');
    const navLinks = document.querySelector('.nav-links');
    if (burger && navLinks) {
        burger.addEventListener('click', () => {
            const expanded = burger.getAttribute('aria-expanded') === 'true';
            burger.setAttribute('aria-expanded', !expanded);
            navLinks.classList.toggle('show');
        });
    }
});

// Helper to safely get the current language
export function getCurrentLang() {
    return (window.i18n && window.i18n.currentLang) ? window.i18n.currentLang : 'de';
}

// Load and parse exhibition config from public/exhibition.md
export async function loadExhibitionConfig() {
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