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
 * @param {object} options - Voice options { gender: 'female'|'male', speed: 0.5-1.5 }
 * @returns {boolean} Whether speech started successfully.
 */
export function speakText(text, onEnd, onStart, options = {}) {
    if (!isSpeechAvailable()) {
        return false;
    }
    
    // Stop any current speech
    stopSpeaking();
    
    currentUtterance = new SpeechSynthesisUtterance(text);
    
    // Use provided speed or default to slower, clearer rate for young learners
    const speed = options.speed ?? 0.85;
    currentUtterance.rate = speed;
    currentUtterance.pitch = 1.0;
    
    // Try to find an English voice matching the preferred gender
    const preferFemale = options.gender !== 'male';
    const voices = window.speechSynthesis.getVoices();
    
    // Keywords that typically indicate female vs male voices
    const femaleKeywords = ['female', 'zira', 'hazel', 'susan', 'samantha', 'karen', 'moira', 'fiona', 'victoria', 'kate'];
    const maleKeywords = ['male', 'david', 'mark', 'james', 'daniel', 'george', 'alex'];
    
    const genderKeywords = preferFemale ? femaleKeywords : maleKeywords;
    
    // First try: find English voice matching gender preference
    let voice = voices.find(v => 
        v.lang.startsWith('en') && 
        genderKeywords.some(kw => v.name.toLowerCase().includes(kw))
    );
    
    // Second try: any English Google voice (usually female and high quality)
    if (!voice && preferFemale) {
        voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
    }
    
    // Fallback: any English voice
    if (!voice) {
        voice = voices.find(v => v.lang.startsWith('en'));
    }
    
    if (voice) {
        currentUtterance.voice = voice;
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
