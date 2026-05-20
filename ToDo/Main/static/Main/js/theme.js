/**
 * Theme switcher module.
 * Handles theme switching, toggle icon updates, and local storage integration.
 */

(function () {
    // Immediately check localStorage to avoid flash of dark theme
    const themePreference = localStorage.getItem('theme-preference');
    if (themePreference === 'light') {
        document.documentElement.classList.add('light-theme');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    // Helper function to update the icon element's classes
    const updateIcon = (isLight) => {
        // Look for a nested Font Awesome <i> element, or fallback to the button itself
        const iconElement = themeToggle.querySelector('i') || themeToggle;
        if (isLight) {
            iconElement.classList.replace('fa-moon', 'fa-sun');
            // If replace was not successful, make sure fa-sun is added and fa-moon is removed
            if (!iconElement.classList.contains('fa-sun')) {
                iconElement.classList.remove('fa-moon');
                iconElement.classList.add('fa-sun');
            }
        } else {
            iconElement.classList.replace('fa-sun', 'fa-moon');
            // If replace was not successful, make sure fa-moon is added and fa-sun is removed
            if (!iconElement.classList.contains('fa-moon')) {
                iconElement.classList.remove('fa-sun');
                iconElement.classList.add('fa-moon');
            }
        }
    };

    // Set initial state of the icon based on current document theme class
    const isLightActive = document.documentElement.classList.contains('light-theme');
    updateIcon(isLightActive);

    // Listen for theme toggle clicks
    themeToggle.addEventListener('click', () => {
        const wasLight = document.documentElement.classList.contains('light-theme');
        const nextLight = !wasLight;

        if (nextLight) {
            document.documentElement.classList.add('light-theme');
            localStorage.setItem('theme-preference', 'light');
        } else {
            document.documentElement.classList.remove('light-theme');
            localStorage.setItem('theme-preference', 'dark');
        }

        updateIcon(nextLight);
    });
});

window.addEventListener('load', () => {
    document.body.classList.remove('preload');
});
