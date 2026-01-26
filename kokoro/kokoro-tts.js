/**
 * @file kokoro-tts.js
 * @description Neural text-to-speech integration for StoryKeys using the Kokoro 82M ONNX model.
 * Handles model acquisition, IndexedDB persistence, and audio synthesis with multiple voice options.
 */

import { KokoroTTS, TextSplitterStream, detectWebGPU } from './kokoro-bundle.es.js';

// ============================================================================
// Configuration
// ============================================================================

const HUGGINGFACE_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const MODEL_WEIGHTS_URL = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx';
const STORAGE_KEY = 'kokoro-82M';
const MODEL_SIZE_MB = 82;

// ============================================================================
// Voice Catalogue
// ============================================================================

/**
 * Complete voice registry. IDs use the format: {region}{gender}_{name}
 * Regions: af/am = American, bf/bm = British. Gender: f = female, m = male.
 * Quality grades range from A (excellent) to F (poor).
 */
export const VOICES = Object.freeze({
    // US English - Female
    af_heart:   { name: 'Heart',    language: 'en-us', gender: 'female', quality: 'A' },
    af_bella:   { name: 'Bella',    language: 'en-us', gender: 'female', quality: 'A-' },
    af_nicole:  { name: 'Nicole',   language: 'en-us', gender: 'female', quality: 'B-' },
    af_aoede:   { name: 'Aoede',    language: 'en-us', gender: 'female', quality: 'C+' },
    af_kore:    { name: 'Kore',     language: 'en-us', gender: 'female', quality: 'C+' },
    af_sarah:   { name: 'Sarah',    language: 'en-us', gender: 'female', quality: 'C+' },
    af_alloy:   { name: 'Alloy',    language: 'en-us', gender: 'female', quality: 'C' },
    af_nova:    { name: 'Nova',     language: 'en-us', gender: 'female', quality: 'C' },
    af_sky:     { name: 'Sky',      language: 'en-us', gender: 'female', quality: 'C-' },
    af_jessica: { name: 'Jessica',  language: 'en-us', gender: 'female', quality: 'D' },
    af_river:   { name: 'River',    language: 'en-us', gender: 'female', quality: 'D' },
    // US English - Male
    am_fenrir:  { name: 'Fenrir',   language: 'en-us', gender: 'male', quality: 'C+' },
    am_michael: { name: 'Michael',  language: 'en-us', gender: 'male', quality: 'C+' },
    am_puck:    { name: 'Puck',     language: 'en-us', gender: 'male', quality: 'C+' },
    am_echo:    { name: 'Echo',     language: 'en-us', gender: 'male', quality: 'D' },
    am_eric:    { name: 'Eric',     language: 'en-us', gender: 'male', quality: 'D' },
    am_liam:    { name: 'Liam',     language: 'en-us', gender: 'male', quality: 'D' },
    am_onyx:    { name: 'Onyx',     language: 'en-us', gender: 'male', quality: 'D' },
    am_santa:   { name: 'Santa',    language: 'en-us', gender: 'male', quality: 'D-' },
    am_adam:    { name: 'Adam',     language: 'en-us', gender: 'male', quality: 'F+' },
    // UK English - Female
    bf_emma:    { name: 'Emma',     language: 'en-gb', gender: 'female', quality: 'B-' },
    bf_isabella:{ name: 'Isabella', language: 'en-gb', gender: 'female', quality: 'C' },
    bf_alice:   { name: 'Alice',    language: 'en-gb', gender: 'female', quality: 'D' },
    bf_lily:    { name: 'Lily',     language: 'en-gb', gender: 'female', quality: 'D' },
    // UK English - Male
    bm_george:  { name: 'George',   language: 'en-gb', gender: 'male', quality: 'C' },
    bm_fable:   { name: 'Fable',    language: 'en-gb', gender: 'male', quality: 'C' },
    bm_lewis:   { name: 'Lewis',    language: 'en-gb', gender: 'male', quality: 'D+' },
    bm_daniel:  { name: 'Daniel',   language: 'en-gb', gender: 'male', quality: 'D' }
});

/** Recommended default voice for each language/gender combination */
export const DEFAULT_VOICES = Object.freeze({
    'en-us': { female: 'af_heart', male: 'am_michael' },
    'en-gb': { female: 'bf_emma', male: 'bm_george' }
});

/** Maps quality grades to sort priority (lower = better) */
const QUALITY_RANK = Object.freeze({
    'A': 1, 'A-': 2, 'B': 3, 'B-': 4, 'C+': 5, 'C': 6, 'C-': 7,
    'D+': 8, 'D': 9, 'D-': 10, 'F+': 11, 'F': 12
});

/**
 * Retrieves voices matching the given criteria, ordered by quality.
 * @param {{ language?: string, gender?: string }} filters
 * @returns {Array<{ id: string, name: string, language: string, gender: string, quality: string }>}
 */
export function getVoices(filters = {}) {
    const matchesFilter = ([_, voice]) => {
        if (filters.language && voice.language !== filters.language) return false;
        if (filters.gender && voice.gender !== filters.gender) return false;
        return true;
    };
    
    const byQuality = (a, b) => (QUALITY_RANK[a.quality] ?? 99) - (QUALITY_RANK[b.quality] ?? 99);
    
    return Object.entries(VOICES)
        .filter(matchesFilter)
        .map(([id, voice]) => ({ id, ...voice }))
        .sort(byQuality);
}

/**
 * Returns the list of supported language options.
 * @returns {Array<{ id: string, name: string }>}
 */
export function getLanguages() {
    return [
        { id: 'en-gb', name: 'British English' },
        { id: 'en-us', name: 'American English' }
    ];
}

// ============================================================================
// IndexedDB Model Storage
// ============================================================================

/**
 * Persists large model weights in IndexedDB for offline access and faster subsequent loads.
 */
class ModelStorage {
    #database = null;
    #databaseName = 'storykeys-tts-models';
    #storeName = 'weights';
    
    /** Opens or creates the database connection */
    async #connect() {
        if (this.#database) return this.#database;
        
        return new Promise((resolve, reject) => {
            const openRequest = indexedDB.open(this.#databaseName, 1);
            
            openRequest.onerror = () => reject(new Error('IndexedDB unavailable for model storage'));
            
            openRequest.onsuccess = () => {
                this.#database = openRequest.result;
                resolve(this.#database);
            };
            
            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.#storeName)) {
                    db.createObjectStore(this.#storeName);
                }
            };
        });
    }
    
    /** Retrieves stored model weights by key, or null if not found */
    async retrieve(key) {
        const db = await this.#connect();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.#storeName, 'readonly');
            const getRequest = transaction.objectStore(this.#storeName).get(key);
            
            getRequest.onsuccess = () => resolve(getRequest.result?.weights ?? null);
            getRequest.onerror = () => reject(getRequest.error);
        });
    }
    
    /** Stores model weights with metadata for cache management */
    async store(key, weights, info = {}) {
        const db = await this.#connect();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.#storeName, 'readwrite');
            const record = {
                weights,
                storedAt: Date.now(),
                byteSize: weights.byteLength || weights.length,
                ...info
            };
            
            transaction.objectStore(this.#storeName).put(record, key);
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });
    }
    
    /** Removes a stored model */
    async remove(key) {
        const db = await this.#connect();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.#storeName, 'readwrite');
            transaction.objectStore(this.#storeName).delete(key);
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });
    }
    
    /** Deletes entries older than the specified number of days */
    async purgeStale(maxAgeDays = 30) {
        const db = await this.#connect();
        const cutoffTime = Date.now() - (maxAgeDays * 86400000);
        
        return new Promise((resolve) => {
            const transaction = db.transaction(this.#storeName, 'readwrite');
            const cursorRequest = transaction.objectStore(this.#storeName).openCursor();
            
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) return;
                
                if (cursor.value?.storedAt < cutoffTime) {
                    cursor.delete();
                }
                cursor.continue();
            };
            
            transaction.oncomplete = resolve;
            transaction.onerror = resolve; // Don't fail on cleanup errors
        });
    }
}

// ============================================================================
// Speech Synthesis Engine
// ============================================================================

/**
 * Manages the Kokoro TTS model lifecycle and provides speech synthesis.
 * Designed as a singleton - use the exported `speechEngine` instance.
 */
class SpeechEngine {
    #synthesizer = null;
    #storage = new ModelStorage();
    #loadingPromise = null;
    #progressCallback = null;
    
    /** Current hardware acceleration mode: 'webgpu' or 'wasm' */
    accelerationMode = null;
    
    /** Whether the engine is currently loading */
    isLoading = false;
    
    /** True when the synthesizer is ready to generate speech */
    get isReady() {
        return this.#synthesizer !== null;
    }
    
    /**
     * Prepares the engine for use. Downloads the model on first run.
     * Safe to call multiple times - subsequent calls return immediately.
     * @param {(percent: number, status: string) => void} onProgress - Optional progress updates
     */
    async load(onProgress = null) {
        if (this.#synthesizer) return;
        if (this.#loadingPromise) return this.#loadingPromise;
        
        this.isLoading = true;
        this.#progressCallback = onProgress;
        
        try {
            this.#loadingPromise = this.#performLoad();
            await this.#loadingPromise;
        } finally {
            this.#loadingPromise = null;
            this.isLoading = false;
            this.#progressCallback = null;
        }
    }
    
    #reportProgress(percent, status) {
        this.#progressCallback?.(percent, status);
    }
    
    async #performLoad() {
        try {
            // Determine best available compute backend
            this.#reportProgress(5, 'Checking hardware...');
            const gpuAvailable = await detectWebGPU();
            this.accelerationMode = gpuAvailable ? 'webgpu' : 'wasm';
            
            // Remove outdated cached models
            await this.#storage.purgeStale().catch(() => {});
            
            // Attempt to load from cache
            this.#reportProgress(10, 'Looking for cached model...');
            let modelWeights = await this.#storage.retrieve(STORAGE_KEY);
            
            if (!modelWeights || modelWeights.length === 0) {
                this.#reportProgress(15, `Downloading model (${MODEL_SIZE_MB}MB)...`);
                modelWeights = await this.#fetchModelWeights();
                
                this.#reportProgress(90, 'Saving to cache...');
                await this.#storage.store(STORAGE_KEY, modelWeights, { modelVersion: '82M-v1.0' })
                    .catch(err => console.warn('Cache write failed:', err));
            } else {
                this.#reportProgress(50, 'Loading from cache...');
            }
            
            // Instantiate the synthesizer
            this.#reportProgress(95, 'Starting engine...');
            
            const quantization = this.accelerationMode === 'wasm' ? 'q8' : 'fp32';
            this.#synthesizer = await KokoroTTS.from_pretrained(HUGGINGFACE_MODEL_ID, {
                dtype: quantization,
                device: this.accelerationMode,
                load_fn: async () => modelWeights
            });
            
            this.#reportProgress(100, 'Ready');
            
        } catch (error) {
            // Corrupted cache is a common failure mode - clear it
            await this.#storage.remove(STORAGE_KEY).catch(() => {});
            this.#synthesizer = null;
            throw error;
        }
    }
    
    async #fetchModelWeights() {
        const response = await fetch(MODEL_WEIGHTS_URL);
        if (!response.ok) {
            throw new Error(`Model download failed with status ${response.status}`);
        }
        
        const totalBytes = parseInt(response.headers.get('Content-Length') || '0', 10);
        const reader = response.body.getReader();
        const chunks = [];
        let receivedBytes = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            receivedBytes += value.length;
            
            if (totalBytes > 0) {
                const downloadPercent = Math.round((receivedBytes / totalBytes) * 100);
                const overallPercent = 15 + Math.round((receivedBytes / totalBytes) * 70);
                this.#reportProgress(overallPercent, `Downloading: ${downloadPercent}%`);
            }
        }
        
        const combined = new Blob(chunks);
        return new Uint8Array(await combined.arrayBuffer());
    }
    
    /**
     * Converts text to speech audio.
     * @param {string} text - The text to speak
     * @param {{ voice?: string, speed?: number }} options
     * @returns {Promise<Blob>} Audio data as a WAV blob
     */
    async speak(text, options = {}) {
        if (!this.#synthesizer) {
            await this.load();
        }
        
        const cleanText = (text || '').trim();
        if (!cleanText) {
            throw new Error('Cannot synthesize empty text');
        }
        
        const voiceId = options.voice || 'af_heart';
        const speechRate = Math.max(0.5, Math.min(2.0, options.speed ?? 1.0));
        
        // Feed text through the splitter for proper chunking
        const textStream = new TextSplitterStream();
        textStream.push(cleanText);
        textStream.close();
        
        // Collect generated audio segments
        const audioSegments = [];
        const outputStream = this.#synthesizer.stream(textStream, {
            voice: voiceId,
            speed: speechRate,
            streamAudio: false
        });
        
        for await (const { audio } of outputStream) {
            if (audio) audioSegments.push(audio);
        }
        
        if (audioSegments.length === 0) {
            throw new Error('Synthesis produced no audio output');
        }
        
        // Combine all audio segments if multiple were generated
        if (audioSegments.length === 1) {
            return this.#convertToBlob(audioSegments[0]);
        }
        
        // Multiple segments - need to concatenate audio
        return this.#combineAudioSegments(audioSegments);
    }
    
    async #combineAudioSegments(segments) {
        // Convert all segments to blobs first
        const blobs = await Promise.all(
            segments.map(seg => Promise.resolve(this.#convertToBlob(seg)))
        );
        
        // For WAV files, we need to properly concatenate the audio data
        // Each segment is a complete WAV file, so we need to extract just the audio data
        const audioDataArrays = await Promise.all(
            blobs.map(async blob => {
                const buffer = await blob.arrayBuffer();
                const view = new DataView(buffer);
                
                // WAV header is 44 bytes, audio data follows
                // For simplicity, skip the header of all but the first segment
                return new Uint8Array(buffer);
            })
        );
        
        // Calculate total length (first file complete + data from rest)
        const firstFileLength = audioDataArrays[0].length;
        const additionalDataLength = audioDataArrays.slice(1).reduce(
            (sum, arr) => sum + (arr.length - 44), 0  // Skip 44-byte WAV header
        );
        const totalLength = firstFileLength + additionalDataLength;
        
        // Create combined buffer
        const combined = new Uint8Array(totalLength);
        combined.set(audioDataArrays[0], 0);
        
        let offset = firstFileLength;
        for (let i = 1; i < audioDataArrays.length; i++) {
            // Skip 44-byte header, copy only audio data
            const audioData = audioDataArrays[i].slice(44);
            combined.set(audioData, offset);
            offset += audioData.length;
        }
        
        // Update the data chunk size and file size in the header
        const view = new DataView(combined.buffer);
        // Bytes 4-7: file size - 8
        view.setUint32(4, totalLength - 8, true);
        // Bytes 40-43: data chunk size (total - 44 header bytes)
        view.setUint32(40, totalLength - 44, true);
        
        return new Blob([combined], { type: 'audio/wav' });
    }
    
    #convertToBlob(audioData) {
        if (typeof audioData.toBlob === 'function') return audioData.toBlob();
        if (audioData instanceof Blob) return audioData;
        if (audioData instanceof ArrayBuffer) return new Blob([audioData], { type: 'audio/wav' });
        if (audioData.buffer instanceof ArrayBuffer) return new Blob([audioData.buffer], { type: 'audio/wav' });
        throw new Error('Unknown audio data format');
    }
    
    /** Releases resources. The engine can be reloaded after this. */
    unload() {
        this.#synthesizer = null;
        this.#loadingPromise = null;
    }
}

// ============================================================================
// Exports
// ============================================================================

/** Shared speech synthesis engine instance */
export const speechEngine = new SpeechEngine();

// Legacy alias for backwards compatibility
export const kokoroEngine = speechEngine;

/**
 * Tests whether this browser supports the required APIs for neural TTS.
 * @returns {boolean}
 */
export function isKokoroSupported() {
    return typeof window !== 'undefined' &&
        typeof Audio !== 'undefined' &&
        typeof fetch !== 'undefined' &&
        typeof WebAssembly !== 'undefined' &&
        typeof indexedDB !== 'undefined';
}
