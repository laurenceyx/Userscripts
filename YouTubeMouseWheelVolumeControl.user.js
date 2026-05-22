// ==UserScript==
// @name         YouTube Mouse Wheel Volume Control
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Adjust YouTube volume by scrolling the mouse wheel over the player. Default step is 5, hold Alt for a step of 1.
// @author       Yukiteru
// @match        *://*.youtube.com/*
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// ==/UserScript==

(function() {
    'use strict';

    let hideTimeout;
    let volumeIndicator = null;

    /**
     * Initializes or retrieves the volume indicator element.
     */
    function getOrCreateIndicator(player) {
        if (!volumeIndicator || !document.getElementById('gemini-vol-indicator')) {
            volumeIndicator = document.createElement('div');
            volumeIndicator.id = 'gemini-vol-indicator';

            volumeIndicator.style.cssText = `
                position: absolute;
                top: 15%;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0, 0, 0, 0.65);
                color: #ffffff;
                font-size: 28px;
                font-weight: 500;
                font-family: 'Roboto', 'Arial', sans-serif;
                padding: 10px 24px;
                border-radius: 8px;
                z-index: 99999;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.15s ease-in-out;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                backdrop-filter: blur(2px);
            `;
            player.appendChild(volumeIndicator);
        }
        return volumeIndicator;
    }

    /**
     * Displays the current volume percentage on screen.
     */
    function showVolumeUI(player, volume) {
        const indicator = getOrCreateIndicator(player);
        indicator.textContent = Math.round(volume) + '%';
        indicator.style.opacity = '1';

        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            indicator.style.opacity = '0';
        }, 1200);
    }

    // Main Event Listener
    document.addEventListener('wheel', function(e) {
        const player = document.getElementById('movie_player');

        // 1. Only trigger if mouse is over the player
        if (!player || !player.contains(e.target)) {
            return;
        }

        // Ignore if in fullscreen mode
        const isFullscreen = document.fullscreenElement ||
                             document.webkitFullscreenElement ||
                             player.classList.contains('ytp-fullscreen');
        if (isFullscreen) {
            return;
        }

        //  Ignore if scrolling over the bottom controls (progress bar, buttons, etc.)
        if (e.target.closest('.ytp-chrome-bottom')) {
            return;
        }

        // Verify YouTube API availability
        if (typeof player.getVolume !== 'function' || typeof player.setVolume !== 'function') {
            return;
        }

        // Prevent page from scrolling
        e.preventDefault();

        // Step: 1 if Alt is pressed, otherwise 5
        const step = e.altKey ? 1 : 5;
        const currentVolume = player.getVolume();
        let newVolume = currentVolume;

        // Determine direction
        if (e.deltaY < 0) {
            newVolume = Math.min(100, currentVolume + step);
        } else if (e.deltaY > 0) {
            newVolume = Math.max(0, currentVolume - step);
        }

        if (newVolume !== currentVolume) {
            player.setVolume(newVolume);

            if (typeof player.isMuted === 'function' && player.isMuted() && newVolume > 0) {
                player.unMute();
            }

            showVolumeUI(player, newVolume);
        }
    }, { passive: false });
})();
