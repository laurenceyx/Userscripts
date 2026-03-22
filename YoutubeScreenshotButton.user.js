// ==UserScript==
// @name         YouTube Screenshot Button
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @author       Yukiteru
// @description  Adds a screenshot button to the YouTube player.
// @license      MIT
// @match        https://www.youtube.com/*
// @grant        GM_log
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    const LOG_PREFIX = '[YT Screenshot]';
    const log = (msg) => GM_log(`${LOG_PREFIX} ${msg}`);

    // 1 = Download Only, 2 = Copy to Clipboard, 3 = Both
    const CONFIG = {
        ACTION: GM_getValue('screenshot_action', 3) 
    };

    const SVG_PATH = "M19.5,7h-3.14l-1.39-2H9.03L7.64,7H4.5C3.67,7,3,7.67,3,8.5v11C3,20.33,3.67,21,4.5,21h15c0.83,0,1.5-0.67,1.5-1.5v-11 C21,7.67,20.33,7,19.5,7z M19.5,19.5h-15v-11h4.05l1.83-2h3.24l1.83,2h4.05V19.5z M12,10.25c-2.07,0-3.75,1.68-3.75,3.75S9.93,17.75,12,17.75s3.75-1.68,3.75-3.75S14.07,10.25,12,10.25z M12,16.25 c-1.24,0-2.25-1.01-2.25-2.25s1.01-2.25,2.25-2.25s2.25,1.01,2.25,2.25S13.24,16.25,12,16.25z";
    let currentSettingsBtn = null;
    let menuCmdId = null;

    function getTranslations() {
        const lang = (navigator.language || 'en').split('-')[0];
        const dict = { en: "Screenshot (s)", zh: "截图 (s)", ja: "スクリーンショット (s)", ko: "스크린샷 (s)" };
        return dict[lang] || dict.en;
    }

    // Dynamic Tampermonkey menu
    function setupMenu() {
        const actionNames = {
            1: 'Download Only',
            2: 'Copy to Clipboard',
            3: 'Download & Copy'
        };

        if (menuCmdId !== null) {
            GM_unregisterMenuCommand(menuCmdId);
        }

        menuCmdId = GM_registerMenuCommand(`Action: ${actionNames[CONFIG.ACTION]}`, () => {
            const promptText = "Select screenshot behavior:\n\n1 = Download Only\n2 = Copy to Clipboard\n3 = Download & Copy";
            const newAction = prompt(promptText, CONFIG.ACTION);
            
            if (newAction && ['1', '2', '3'].includes(newAction.trim())) {
                const parsedAction = parseInt(newAction.trim(), 10);
                GM_setValue('screenshot_action', parsedAction);
                CONFIG.ACTION = parsedAction;
                setupMenu(); // Refresh menu UI instantly
            } else if (newAction !== null) {
                alert("Invalid input. Please enter 1, 2, or 3.");
            }
        });
    }

    // Tooltip hijack to match YouTube native UI
    function showNativeTooltip(text, referenceBtn) {
        if (currentSettingsBtn) {
            currentSettingsBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }

        const tooltipEl = document.querySelector('.ytp-tooltip');
        const textWrapper = document.querySelector('.ytp-tooltip-text-wrapper');
        const player = document.querySelector('.html5-video-player');

        if (tooltipEl && textWrapper && player) {
            const textSpan = textWrapper.querySelector('.ytp-tooltip-text');
            if (textSpan) {
                textSpan.textContent = text;
                const btnRect = referenceBtn.getBoundingClientRect();
                const playerRect = player.getBoundingClientRect();
                const tooltipRect = tooltipEl.getBoundingClientRect();
                
                const leftPos = (btnRect.left - playerRect.left) + (btnRect.width / 2) - (tooltipRect.width / 2);
                tooltipEl.style.left = `${leftPos}px`;
            }
        }
    }

    function hideNativeTooltip() {
        if (currentSettingsBtn) {
            currentSettingsBtn.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        }
    }

    function createButton() {
        const btn = document.createElement('button');
        btn.className = 'ytp-button';
        btn.id = 'yt-custom-screenshot-btn';
        btn.setAttribute('aria-label', getTranslations());

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '2 3 20 20'); // Centered & padded
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('fill', 'white');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', SVG_PATH);
        
        svg.appendChild(path);
        btn.appendChild(svg);

        btn.addEventListener('click', handleScreenshot);
        btn.addEventListener('mouseover', () => showNativeTooltip(getTranslations(), btn));
        btn.addEventListener('mouseout', hideNativeTooltip);

        return btn;
    }

    async function handleScreenshot() {
        const video = document.querySelector('video.video-stream');
        if (!video) return log('Error: Video element not found.');

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0);

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('Failed to generate blob.');

            if (CONFIG.ACTION === 2 || CONFIG.ACTION === 3) {
                const clipItem = new window.ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([clipItem]).catch(e => log(`Clipboard error: ${e}`));
            }

            if (CONFIG.ACTION === 1 || CONFIG.ACTION === 3) {
                downloadBlob(blob);
            }
        } catch (err) {
            log(`Capture failed: ${err}`);
        }
    }

    function downloadBlob(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = generateFilename('png');
        a.click();
        URL.revokeObjectURL(url);
    }

    function generateFilename(ext) {
        try {
            const titleNode = document.querySelector('.ytd-watch-metadata #title') || document.querySelector('title');
            const safeTitle = (titleNode ? titleNode.textContent.trim() : 'yt_video').replace(/[\\/:*?"<>|]/g, '_'); 
            
            const video = document.querySelector('video.video-stream');
            const progress = video ? video.currentTime.toFixed(2) : '0.00';
            
            const d = new Date();
            const timeStr = `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}_${d.getHours().toString().padStart(2,'0')}${d.getMinutes().toString().padStart(2,'0')}${d.getSeconds().toString().padStart(2,'0')}`;
            
            return `${safeTitle}_${progress}s_${timeStr}.${ext}`;
        } catch (e) {
            return `screenshot_${Date.now()}.${ext}`;
        }
    }

    function setupShortcut() {
        document.addEventListener('keydown', (e) => {
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const isTyping = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable);
            
            if (!isTyping && e.key.toLowerCase() === 's') {
                handleScreenshot();
            }
        });
    }

    function injectButton() {
        if (document.getElementById('yt-custom-screenshot-btn')) return;

        const settingsBtn = document.querySelector('.ytp-right-controls .ytp-settings-button') || 
                            document.querySelector('.ytp-right-controls-left > .ytp-settings-button');
        const video = document.querySelector('video.video-stream');

        if (settingsBtn && video) {
            currentSettingsBtn = settingsBtn;
            settingsBtn.insertAdjacentElement('beforebegin', createButton());
        }
    }

    // Bypass iframe clipboard restriction for embedded videos
    function fixIframeClipboard() {
        if (window.self !== window.top) return;
        document.querySelectorAll('iframe').forEach(iframe => {
            if (/youtube\.com\/embed/.test(iframe.src) && !iframe.allow.includes('clipboard-write')) {
                iframe.allow += ' clipboard-write;';
            }
        });
    }

    function init() {
        fixIframeClipboard();
        setupMenu();
        setupShortcut();

        const observer = new MutationObserver(injectButton);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (location.host.includes('youtube.com')) {
        init();
    }

})();
