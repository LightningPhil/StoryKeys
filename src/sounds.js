/**
 * @file sounds.js
 * @description Simple audio feedback for typing using Web Audio API.
 * Creates soft, non-intrusive sounds without requiring external audio files.
 */

let audioContext = null;

/**
 * Lazily initializes the Web Audio context (required for user gesture requirement).
 * @returns {AudioContext|null}
 */
function getAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
            return null;
        }
    }
    return audioContext;
}

/**
 * Plays a soft click sound for correct keystrokes.
 * @param {boolean} enabled - Whether sounds are enabled in settings.
 */
export function playClickSound(enabled) {
    if (!enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Soft, short click: high frequency, quick decay
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.03, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
}

/**
 * Plays a soft error sound for incorrect keystrokes.
 * @param {boolean} enabled - Whether sounds are enabled in settings.
 */
export function playErrorSound(enabled) {
    if (!enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Soft low thud for errors
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.08);
}

/**
 * Plays a pleasant ding sound for completing a lesson or earning a badge.
 * @param {boolean} enabled - Whether sounds are enabled in settings.
 */
export function playSuccessSound(enabled) {
    if (!enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    // Play two notes for a pleasant "ding-ding"
    const playNote = (freq, delay, duration) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
        
        oscillator.start(ctx.currentTime + delay);
        oscillator.stop(ctx.currentTime + delay + duration);
    };
    
    playNote(523.25, 0, 0.15);      // C5
    playNote(659.25, 0.12, 0.2);    // E5
}

// --- Text-to-Speech (Read Aloud) ---

let currentUtterance = null;

/**
 * Checks if speech synthesis is available in the browser.
 * @returns {boolean}
 */
export function isSpeechAvailable() {
    return 'speechSynthesis' in window;
}

/**
 * Reads text aloud using the browser's speech synthesis API.
 * @param {string} text - The text to read aloud.
 * @param {function} onEnd - Callback when speech ends.
 * @param {function} onStart - Callback when speech starts.
 * @returns {boolean} Whether speech started successfully.
 */
export function speakText(text, onEnd, onStart) {
    if (!isSpeechAvailable()) {
        return false;
    }
    
    // Stop any current speech
    stopSpeaking();
    
    currentUtterance = new SpeechSynthesisUtterance(text);
    
    // Use a slower, clearer rate for young learners
    currentUtterance.rate = 0.85;
    currentUtterance.pitch = 1.0;
    
    // Try to find a good English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => 
        v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Google') || v.default)
    ) || voices.find(v => v.lang.startsWith('en'));
    
    if (englishVoice) {
        currentUtterance.voice = englishVoice;
    }
    
    currentUtterance.onstart = () => {
        if (onStart) onStart();
    };
    
    currentUtterance.onend = () => {
        currentUtterance = null;
        if (onEnd) onEnd();
    };
    
    currentUtterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        currentUtterance = null;
        if (onEnd) onEnd();
    };
    
    window.speechSynthesis.speak(currentUtterance);
    return true;
}

/**
 * Stops any currently playing speech.
 */
export function stopSpeaking() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null;
}

/**
 * Checks if speech is currently playing.
 * @returns {boolean}
 */
export function isSpeaking() {
    return window.speechSynthesis?.speaking || false;
}
