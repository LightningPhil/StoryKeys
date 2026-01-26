/**
 * @file sounds.js
 * @description Audio feedback and text-to-speech for StoryKeys.
 * Provides typing sounds and high-quality Kokoro TTS or browser speech fallback.
 */

import { speechEngine, isKokoroSupported, DEFAULT_VOICES, VOICES, getVoices, getLanguages } from '../kokoro/kokoro-tts.js';

// ============================================================================
// Web Audio Context (for typing sounds)
// ============================================================================

let audioContext = null;

/**
 * Lazily initializes the Web Audio context.
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

// ============================================================================
// Silent Tone Keeper - prevents audio fade-in on first playback
// ============================================================================

let silentToneOscillator = null;
let silentToneGain = null;
let silentToneActive = false;

/**
 * Starts a near-inaudible 5Hz tone to keep the audio pipeline warm.
 * This prevents the slow volume ramp-up that occurs when audio hasn't
 * played for a while (common on Windows).
 */
function startSilentTone() {
    if (silentToneActive) return;
    
    const ctx = getAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') ctx.resume();
    
    silentToneOscillator = ctx.createOscillator();
    silentToneGain = ctx.createGain();
    
    silentToneOscillator.connect(silentToneGain);
    silentToneGain.connect(ctx.destination);
    
    // 5Hz is below human hearing threshold
    silentToneOscillator.frequency.setValueAtTime(5, ctx.currentTime);
    silentToneOscillator.type = 'sine';
    
    // Extremely low volume - effectively silent but keeps audio active
    silentToneGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    
    silentToneOscillator.start();
    silentToneActive = true;
}

/**
 * Temporarily pauses the silent tone (e.g., during speech playback).
 */
function pauseSilentTone() {
    if (!silentToneActive || !silentToneGain) return;
    
    const ctx = getAudioContext();
    if (!ctx) return;
    
    silentToneGain.gain.setValueAtTime(0, ctx.currentTime);
}

/**
 * Resumes the silent tone after speech ends.
 */
function resumeSilentTone() {
    if (!silentToneActive || !silentToneGain) return;
    
    const ctx = getAudioContext();
    if (!ctx) return;
    
    silentToneGain.gain.setValueAtTime(0.0001, ctx.currentTime);
}

/**
 * Initializes the silent tone keeper if speech is available.
 * Call this once after user interaction to ensure audio context is allowed.
 */
export function initAudioKeepAlive() {
    if ('speechSynthesis' in window || isKokoroSupported()) {
        startSilentTone();
    }
}

// ============================================================================
// Typing Sound Effects
// ============================================================================

/**
 * Plays a soft click sound for correct keystrokes.
 * @param {boolean} enabled - Whether sounds are enabled.
 */
export function playClickSound(enabled) {
    if (!enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
}

/**
 * Plays a soft error sound for incorrect keystrokes.
 * @param {boolean} enabled - Whether sounds are enabled.
 */
export function playErrorSound(enabled) {
    if (!enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
}

/**
 * Plays a pleasant ding sound for completing a lesson or earning a badge.
 * @param {boolean} enabled - Whether sounds are enabled.
 */
export function playSuccessSound(enabled) {
    if (!enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') ctx.resume();

    const playNote = (freq, delay, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.08, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
        
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
    };
    
    playNote(523.25, 0, 0.15);      // C5
    playNote(659.25, 0.12, 0.2);    // E5
}

// ============================================================================
// Text-to-Speech
// ============================================================================

/** Current browser speech utterance */
let currentUtterance = null;

/** Audio element for Kokoro playback */
let currentAudio = null;
let currentAudioUrl = null;

/** Token for cancellation */
let playbackToken = 0;

/** Cache for generated speech */
const speechCache = new Map();

/** High-quality speech status: 'idle' | 'buffering' | 'playing' */
let kokoroStatus = 'idle';

/** Queue for serializing speech synthesis requests (ONNX can only handle one at a time) */
let synthesisQueue = Promise.resolve();

/**
 * Queue a speech synthesis operation to run sequentially.
 * @param {Function} operation - Async function to run
 * @returns {Promise} Result of the operation
 */
function queueSynthesis(operation) {
    const result = synthesisQueue.then(operation).catch(err => {
        console.warn('Synthesis operation failed:', err);
        return null;
    });
    // Update the queue to wait for this operation (whether it succeeds or fails)
    synthesisQueue = result.then(() => {}).catch(() => {});
    return result;
}

/**
 * Normalize text for speech.
 * @param {string} text 
 * @returns {string}
 */
function normalizeText(text) {
    return (text || '').toString().trim();
}

/**
 * Clamp a number within bounds.
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
function clamp(value, min, max) {
    const num = Number(value);
    if (Number.isNaN(num)) return min;
    return Math.min(max, Math.max(min, num));
}

/**
 * Resolve the Kokoro voice ID from options.
 * @param {Object} options - { voice?: string, gender?: string, language?: string }
 * @returns {string} Voice ID
 */
function resolveVoice(options = {}) {
    // If explicit voice provided, validate and use it
    if (options.voice && VOICES[options.voice]) {
        return options.voice;
    }
    
    // Resolve from language and gender
    const language = options.language || 'en-gb';
    const gender = options.gender || 'female';
    const defaults = DEFAULT_VOICES[language] || DEFAULT_VOICES['en-gb'];
    
    return defaults[gender] || defaults.female;
}

/**
 * Generate cache key for speech.
 * @param {string} text 
 * @param {Object} options 
 * @returns {string}
 */
function getCacheKey(text, options = {}) {
    const voice = resolveVoice(options);
    const speed = clamp(options.speed ?? 1, 0.5, 2);
    return `${voice}::${speed}::${normalizeText(text)}`;
}

/**
 * Clean up audio playback resources.
 */
function cleanupAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.onplay = null;
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio = null;
    }
    if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
    }
}

/**
 * Prepare high-quality speech (pre-buffer).
 * @param {string} text 
 * @param {Object} options 
 * @returns {Promise<Blob>}
 */
async function prepareKokoroSpeech(text, options = {}) {
    const normalized = normalizeText(text);
    if (!normalized) return null;
    
    const key = getCacheKey(normalized, options);
    const cached = speechCache.get(key);
    
    if (cached) {
        if (cached.status === 'ready') return cached.blob;
        if (cached.status === 'pending') return cached.promise;
        if (cached.status === 'error') speechCache.delete(key);
    }
    
    const entry = { status: 'pending', promise: null, blob: null };
    
    // Queue the synthesis to prevent concurrent ONNX model access
    const promise = queueSynthesis(async () => {
        const voice = resolveVoice(options);
        const speed = clamp(options.speed ?? 1, 0.5, 2);
        return await speechEngine.speak(normalized, { voice, speed });
    });
    
    entry.promise = promise;
    speechCache.set(key, entry);
    
    try {
        const blob = await promise;
        if (blob) {
            entry.status = 'ready';
            entry.blob = blob;
        } else {
            entry.status = 'error';
        }
        return blob;
    } catch (error) {
        entry.status = 'error';
        throw error;
    }
}

/**
 * Play high-quality Kokoro speech.
 * @param {string} text 
 * @param {Function} onEnd 
 * @param {Function} onStart 
 * @param {Object} options 
 * @returns {Promise<boolean>}
 */
async function playKokoroSpeech(text, onEnd, onStart, options = {}) {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    
    const key = getCacheKey(normalized, options);
    const cached = speechCache.get(key);
    const needsBuffer = !cached || cached.status !== 'ready';
    const token = ++playbackToken;
    
    kokoroStatus = needsBuffer ? 'buffering' : 'playing';
    
    if (needsBuffer && options.onBufferStart) {
        options.onBufferStart();
    }
    
    let blob;
    try {
        blob = await prepareKokoroSpeech(normalized, options);
    } catch (error) {
        if (token === playbackToken) {
            kokoroStatus = 'idle';
            if (options.onBufferEnd) options.onBufferEnd();
            if (onEnd) onEnd();
        }
        console.warn('Kokoro speech failed:', error);
        return false;
    }
    
    // Check if cancelled
    if (token !== playbackToken) {
        if (options.onBufferEnd) options.onBufferEnd();
        return true;
    }
    
    if (options.onBufferEnd) options.onBufferEnd();
    
    // Play audio
    cleanupAudio();
    currentAudioUrl = URL.createObjectURL(blob);
    currentAudio = new Audio(currentAudioUrl);
    
    currentAudio.onplay = () => {
        if (token !== playbackToken) return;
        pauseSilentTone(); // Stop background tone during speech
        kokoroStatus = 'playing';
        if (onStart) onStart();
    };
    
    currentAudio.onended = () => {
        if (token !== playbackToken) return;
        cleanupAudio();
        kokoroStatus = 'idle';
        resumeSilentTone(); // Resume background tone after speech
        if (onEnd) onEnd();
    };
    
    currentAudio.onerror = () => {
        if (token !== playbackToken) return;
        cleanupAudio();
        kokoroStatus = 'idle';
        resumeSilentTone(); // Resume background tone after error
        if (onEnd) onEnd();
    };
    
    try {
        await currentAudio.play();
        return true;
    } catch (error) {
        if (token === playbackToken) {
            cleanupAudio();
            kokoroStatus = 'idle';
            if (onEnd) onEnd();
        }
        console.warn('Audio playback failed:', error);
        return false;
    }
}

/**
 * Play browser speech synthesis.
 * @param {string} text 
 * @param {Function} onEnd 
 * @param {Function} onStart 
 * @param {Object} options 
 * @returns {boolean}
 */
function playBrowserSpeech(text, onEnd, onStart, options = {}) {
    if (!('speechSynthesis' in window)) return false;
    
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = clamp(options.speed ?? 0.85, 0.5, 2);
    currentUtterance.pitch = 1.0;
    
    // Try to find matching voice
    const preferFemale = (options.gender || 'female') === 'female';
    const voices = window.speechSynthesis.getVoices();
    
    const femaleKeywords = ['female', 'zira', 'hazel', 'susan', 'samantha', 'karen', 'moira', 'fiona', 'victoria', 'kate'];
    const maleKeywords = ['male', 'david', 'mark', 'james', 'daniel', 'george', 'alex'];
    const genderKeywords = preferFemale ? femaleKeywords : maleKeywords;
    
    let voice = voices.find(v =>
        v.lang.startsWith('en') &&
        genderKeywords.some(kw => v.name.toLowerCase().includes(kw))
    );
    
    if (!voice && preferFemale) {
        voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
    }
    
    if (!voice) {
        voice = voices.find(v => v.lang.startsWith('en'));
    }
    
    if (voice) currentUtterance.voice = voice;
    
    currentUtterance.onstart = () => { pauseSilentTone(); if (onStart) onStart(); };
    currentUtterance.onend = () => { currentUtterance = null; resumeSilentTone(); if (onEnd) onEnd(); };
    currentUtterance.onerror = () => { currentUtterance = null; resumeSilentTone(); if (onEnd) onEnd(); };
    
    window.speechSynthesis.speak(currentUtterance);
    return true;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if speech synthesis is available.
 * @param {Object} options - { highQuality?: boolean }
 * @returns {boolean}
 */
export function isSpeechAvailable(options = {}) {
    const browserAvailable = 'speechSynthesis' in window;
    if (options.highQuality) {
        return isKokoroSupported() || browserAvailable;
    }
    return browserAvailable;
}

/**
 * Check if high-quality speech is pre-buffered for text.
 * @param {string} text 
 * @param {Object} options 
 * @returns {boolean}
 */
export function isSpeechReady(text, options = {}) {
    if (!options.highQuality) return true;
    if (!isKokoroSupported()) return true;
    const normalized = normalizeText(text);
    if (!normalized) return false;
    const key = getCacheKey(normalized, options);
    return speechCache.get(key)?.status === 'ready';
}

/**
 * Pre-buffer high-quality speech.
 * @param {string} text 
 * @param {Object} options 
 * @returns {Promise<boolean>}
 */
export async function prepareSpeech(text, options = {}) {
    if (!options.highQuality || !isKokoroSupported()) return false;
    const normalized = normalizeText(text);
    if (!normalized) return false;
    
    try {
        await prepareKokoroSpeech(normalized, options);
        return true;
    } catch (error) {
        console.warn('Failed to prepare speech:', error);
        return false;
    }
}

/**
 * Pre-buffer multiple words sequentially (for spelling lessons).
 * Words are queued and processed one at a time to avoid ONNX conflicts.
 * @param {string[]} words - Array of words to pre-buffer
 * @param {Object} options - Speech options
 * @returns {Promise<void>}
 */
export async function prepareSpeechBatch(words, options = {}) {
    if (!options.highQuality || !isKokoroSupported()) return;
    
    for (const word of words) {
        const normalized = normalizeText(word);
        if (normalized) {
            try {
                await prepareKokoroSpeech(normalized, options);
            } catch (error) {
                // Continue with other words even if one fails
                console.warn('Failed to prepare word:', word, error);
            }
        }
    }
}

/**
 * Initialize the Kokoro engine (for pre-loading).
 * @param {Function} onProgress - Progress callback (percent, message)
 * @returns {Promise<boolean>}
 */
export async function initializeKokoro(onProgress = null) {
    if (!isKokoroSupported()) return false;
    
    try {
        await speechEngine.load(onProgress);
        return true;
    } catch (error) {
        console.error('Failed to initialize Kokoro:', error);
        return false;
    }
}

/**
 * Check if Kokoro engine is ready.
 * @returns {boolean}
 */
export function isKokoroReady() {
    return speechEngine.isReady;
}

/**
 * Get Kokoro engine status.
 * @returns {{ isReady: boolean, isInitializing: boolean, computeDevice: string|null }}
 */
export function getKokoroStatus() {
    return {
        isReady: speechEngine.isReady,
        isLoading: speechEngine.isLoading,
        accelerationMode: speechEngine.accelerationMode
    };
}

/**
 * Speak text aloud.
 * Uses Kokoro TTS when highQuality is enabled and available, otherwise browser speech.
 * 
 * @param {string} text - Text to speak
 * @param {Function} onEnd - Callback when speech ends
 * @param {Function} onStart - Callback when speech starts
 * @param {Object} options - Speech options
 * @param {boolean} options.highQuality - Use Kokoro TTS
 * @param {string} options.voice - Kokoro voice ID
 * @param {string} options.gender - 'female' or 'male'
 * @param {string} options.language - 'en-gb' or 'en-us'
 * @param {number} options.speed - Speech rate 0.5-2.0
 * @param {Function} options.onBufferStart - Called when buffering starts
 * @param {Function} options.onBufferEnd - Called when buffering ends
 * @returns {Promise<boolean>} Whether speech started successfully
 */
export async function speakText(text, onEnd, onStart, options = {}) {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    
    stopSpeaking();
    
    if (options.highQuality && isKokoroSupported()) {
        const started = await playKokoroSpeech(normalized, onEnd, onStart, options);
        if (started) return true;
    }
    
    return playBrowserSpeech(normalized, onEnd, onStart, options);
}

/**
 * Stop any currently playing speech.
 */
export function stopSpeaking() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    playbackToken++;
    kokoroStatus = 'idle';
    cleanupAudio();
    currentUtterance = null;
}

/**
 * Check if speech is currently playing or buffering.
 * @param {Object} options - { highQuality?: boolean }
 * @returns {boolean}
 */
export function isSpeaking(options = {}) {
    const browserSpeaking = window.speechSynthesis?.speaking || false;
    if (!options.highQuality) {
        return browserSpeaking;
    }
    return kokoroStatus !== 'idle' || browserSpeaking;
}

// Re-export voice utilities for settings UI
export { getVoices, getLanguages };
