'use strict';

/* Text-to-Speech module for reading book content aloud */
(function textToSpeech() {
    // Check if browser supports Web Speech API
    if (!('speechSynthesis' in window)) {
        console.warn('Text-to-Speech not supported in this browser');
        const ttsButton = document.getElementById('mdbook-tts-toggle');
        if (ttsButton) {
            ttsButton.style.display = 'none';
        }
        return;
    }

    const synth = window.speechSynthesis;
    let currentUtterance = null;
    let isPaused = false;
    let isPlaying = false;
    let currentSpeed = parseFloat(localStorage.getItem('mdbook-tts-speed') || '1.0');
    let currentVoice = localStorage.getItem('mdbook-tts-voice') || null;
    let availableVoices = [];

    // Get the main content container
    function getContentText() {
        const contentElement = document.querySelector('#mdbook-content main');
        if (!contentElement) return '';

        // Clone the content to manipulate it
        const clone = contentElement.cloneNode(true);

        // Remove code blocks and other elements that shouldn't be read
        clone.querySelectorAll('pre, code, .hljs, script, style, .menu-bar, .nav-chapters').forEach(el => el.remove());

        // Add pauses after headers and paragraphs for more natural reading
        const paragraphs = Array.from(contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li'));
        const segments = [];

        paragraphs.forEach(p => {
            const text = p.textContent.trim();
            if (text && !p.querySelector('pre, code')) {
                segments.push(text);
            }
        });

        return segments.join('. ');
    }

    // Load available voices
    function loadVoices() {
        availableVoices = synth.getVoices();

        // Prefer high-quality, natural voices
        // Priority: English voices, then local/preferred language, then any
        const preferredVoices = availableVoices.filter(voice =>
            voice.lang.startsWith('en') ||
            voice.lang.startsWith('sr') ||
            voice.localService
        );

        if (preferredVoices.length > 0) {
            availableVoices = preferredVoices;
        }

        // If we have a saved voice preference, validate it
        if (currentVoice) {
            const voiceExists = availableVoices.some(v => v.name === currentVoice);
            if (!voiceExists) {
                currentVoice = null;
                localStorage.removeItem('mdbook-tts-voice');
            }
        }
    }

    // Initialize voices
    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = loadVoices;
    }

    function getBestVoice() {
        if (currentVoice) {
            const saved = availableVoices.find(v => v.name === currentVoice);
            if (saved) return saved;
        }

        // Try to find the best voice automatically
        // Prefer: natural/premium > local > default
        const lang = document.documentElement.lang || 'en';

        // Look for high-quality voices for the page language
        let voice = availableVoices.find(v =>
            v.lang.startsWith(lang) &&
            (v.name.includes('Natural') || v.name.includes('Premium') || v.localService)
        );

        if (!voice) {
            // Fall back to any voice matching the language
            voice = availableVoices.find(v => v.lang.startsWith(lang));
        }

        if (!voice && availableVoices.length > 0) {
            // Last resort: use any available voice
            voice = availableVoices[0];
        }

        return voice;
    }

    function speak() {
        if (isPlaying && !isPaused) {
            // Already playing, stop it
            stop();
            return;
        }

        if (isPaused) {
            // Resume from pause
            synth.resume();
            isPaused = false;
            isPlaying = true;
            updateButton();
            return;
        }

        // Start new speech
        const text = getContentText();
        if (!text) {
            console.warn('No text content found to read');
            return;
        }

        currentUtterance = new SpeechSynthesisUtterance(text);

        // Set voice
        const voice = getBestVoice();
        if (voice) {
            currentUtterance.voice = voice;
            currentUtterance.lang = voice.lang;
        }

        // Set speech parameters for natural reading
        currentUtterance.rate = currentSpeed; // Speed: 0.1 to 10 (1 is normal)
        currentUtterance.pitch = 1.0; // Pitch: 0 to 2 (1 is normal)
        currentUtterance.volume = 1.0; // Volume: 0 to 1

        // Event handlers
        currentUtterance.onstart = function() {
            isPlaying = true;
            isPaused = false;
            updateButton();
        };

        currentUtterance.onend = function() {
            isPlaying = false;
            isPaused = false;
            currentUtterance = null;
            updateButton();
        };

        currentUtterance.onerror = function(event) {
            console.error('Speech synthesis error:', event);
            isPlaying = false;
            isPaused = false;
            currentUtterance = null;
            updateButton();
        };

        synth.speak(currentUtterance);
    }

    function stop() {
        synth.cancel();
        isPlaying = false;
        isPaused = false;
        currentUtterance = null;
        updateButton();
    }

    function pause() {
        if (isPlaying && !isPaused) {
            synth.pause();
            isPaused = true;
            updateButton();
        }
    }

    function resume() {
        if (isPaused) {
            synth.resume();
            isPaused = false;
            updateButton();
        }
    }

    function updateButton() {
        const button = document.getElementById('mdbook-tts-toggle');
        const icon = button?.querySelector('svg');
        const controls = document.getElementById('mdbook-tts-controls');
        const fabButton = document.getElementById('mdbook-tts-fab');
        const fabIcon = fabButton?.querySelector('svg');
        const pauseButton = document.getElementById('mdbook-tts-pause');
        const pauseIcon = pauseButton?.querySelector('svg path');
        const stopButton = document.getElementById('mdbook-tts-stop');

        if (!button) return;

        if (isPlaying && !isPaused) {
            button.setAttribute('title', 'Stop reading');
            button.setAttribute('aria-label', 'Stop reading');
            button.classList.add('tts-active');
            // Change icon to stop/pause icon
            if (icon) {
                icon.innerHTML = '<path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM192 160H288h32c17.7 0 32 14.3 32 32V320c0 17.7-14.3 32-32 32H288 192 160c-17.7 0-32-14.3-32-32V192c0-17.7 14.3-32 32-32h32z"/>';
            }
            // Update FAB button
            if (fabButton) {
                fabButton.setAttribute('title', 'Stop reading');
                fabButton.setAttribute('aria-label', 'Stop reading');
                fabButton.classList.add('tts-active');
            }
            if (fabIcon) {
                fabIcon.innerHTML = '<path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM192 160H288h32c17.7 0 32 14.3 32 32V320c0 17.7-14.3 32-32 32H288 192 160c-17.7 0-32-14.3-32-32V192c0-17.7 14.3-32 32-32h32z"/>';
            }
            // Show controls
            if (controls) {
                controls.classList.add('visible');
            }
            // Enable pause and stop buttons
            if (pauseButton) {
                pauseButton.disabled = false;
                pauseButton.setAttribute('title', 'Pause reading');
                pauseButton.setAttribute('aria-label', 'Pause reading');
                // Pause icon (two bars)
                if (pauseIcon) {
                    pauseIcon.setAttribute('d', 'M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z');
                }
            }
            if (stopButton) {
                stopButton.disabled = false;
            }
        } else if (isPaused) {
            // Paused state
            button.setAttribute('title', 'Resume reading');
            button.setAttribute('aria-label', 'Resume reading');
            button.classList.add('tts-active');
            // Update FAB button
            if (fabButton) {
                fabButton.setAttribute('title', 'Resume reading');
                fabButton.setAttribute('aria-label', 'Resume reading');
                fabButton.classList.add('tts-active');
            }
            // Show controls
            if (controls) {
                controls.classList.add('visible');
            }
            // Update pause button to show resume icon
            if (pauseButton) {
                pauseButton.disabled = false;
                pauseButton.setAttribute('title', 'Resume reading');
                pauseButton.setAttribute('aria-label', 'Resume reading');
                // Play/resume icon
                if (pauseIcon) {
                    pauseIcon.setAttribute('d', 'M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z');
                }
            }
            if (stopButton) {
                stopButton.disabled = false;
            }
        } else {
            button.setAttribute('title', 'Read page aloud (Alt+R)');
            button.setAttribute('aria-label', 'Read page aloud');
            button.classList.remove('tts-active');
            // Change icon to play/speaker icon
            if (icon) {
                icon.innerHTML = '<path d="M256 80C141.1 80 48 173.1 48 288s93.1 208 208 208 208-93.1 208-208S370.9 80 256 80zm83.8 211.9l-109.4 61.5c-7.7 4.3-17.4-.9-17.4-9.4V236.4c0-8.5 9.7-13.7 17.4-9.4l109.4 61.5c7.5 4.2 7.5 14.6 0 18.8z"/>';
            }
            // Update FAB button
            if (fabButton) {
                fabButton.setAttribute('title', 'Read page aloud (Alt+R)');
                fabButton.setAttribute('aria-label', 'Read page aloud');
                fabButton.classList.remove('tts-active');
            }
            if (fabIcon) {
                fabIcon.innerHTML = '<path d="M256 80C141.1 80 48 173.1 48 288s93.1 208 208 208 208-93.1 208-208S370.9 80 256 80zm83.8 211.9l-109.4 61.5c-7.7 4.3-17.4-.9-17.4-9.4V236.4c0-8.5 9.7-13.7 17.4-9.4l109.4 61.5c7.5 4.2 7.5 14.6 0 18.8z"/>';
            }
            // Hide controls
            if (controls) {
                controls.classList.remove('visible');
            }
            // Disable pause and stop buttons
            if (pauseButton) {
                pauseButton.disabled = true;
            }
            if (stopButton) {
                stopButton.disabled = true;
            }
        }
    }

    function updateSpeed(speed) {
        currentSpeed = parseFloat(speed);
        localStorage.setItem('mdbook-tts-speed', currentSpeed.toString());

        // If currently playing, need to restart with new speed
        if (isPlaying) {
            const wasPlaying = !isPaused;
            stop();
            if (wasPlaying) {
                // Small delay before restarting
                setTimeout(speak, 100);
            }
        }
    }

    // Initialize button
    const ttsButton = document.getElementById('mdbook-tts-toggle');
    if (ttsButton) {
        ttsButton.addEventListener('click', function(e) {
            e.preventDefault();
            speak();
        });
    }

    // Initialize FAB button
    const ttsFabButton = document.getElementById('mdbook-tts-fab');
    if (ttsFabButton) {
        ttsFabButton.addEventListener('click', function(e) {
            e.preventDefault();
            speak();
        });
    }

    // Initialize speed control
    const speedControl = document.getElementById('mdbook-tts-speed');
    if (speedControl) {
        speedControl.value = currentSpeed;
        speedControl.addEventListener('change', function(e) {
            updateSpeed(e.target.value);
        });
        speedControl.addEventListener('input', function(e) {
            const display = document.getElementById('mdbook-tts-speed-value');
            if (display) {
                display.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
            }
        });
    }

    // Initialize speed display
    const speedDisplay = document.getElementById('mdbook-tts-speed-value');
    if (speedDisplay) {
        speedDisplay.textContent = currentSpeed.toFixed(1) + 'x';
    }

    // Initialize pause button
    const pauseButton = document.getElementById('mdbook-tts-pause');
    if (pauseButton) {
        pauseButton.addEventListener('click', function(e) {
            e.preventDefault();
            if (isPaused) {
                resume();
            } else {
                pause();
            }
        });
    }

    // Initialize stop button
    const stopButton = document.getElementById('mdbook-tts-stop');
    if (stopButton) {
        stopButton.addEventListener('click', function(e) {
            e.preventDefault();
            stop();
        });
    }

    // Keyboard shortcut: Alt+R to toggle reading
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.key === 'r') {
            e.preventDefault();
            speak();
        }
    });

    // Clean up when navigating away
    window.addEventListener('beforeunload', function() {
        if (isPlaying) {
            stop();
        }
    });

    // Stop reading when clicking on navigation links
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a[href]');
        if (link && !link.href.includes('#')) {
            if (isPlaying) {
                stop();
            }
        }
    });

    updateButton();
})();
