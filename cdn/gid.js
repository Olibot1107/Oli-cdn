// File: device-id.js
// Large-scope deterministic device fingerprint (no cookies/local storage).
// Returns a SHA-256 hex string (Promise).

const DeviceID = (() => {

    // ----------------------
    // Utility helpers
    // ----------------------
    async function sha256Hex(input) {
        const enc = new TextEncoder().encode(input);
        const buf = await crypto.subtle.digest('SHA-256', enc);
        const arr = Array.from(new Uint8Array(buf));
        return arr.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function sha256HexFromArrayBuffer(buffer) {
        const buf = await crypto.subtle.digest('SHA-256', buffer);
        const arr = Array.from(new Uint8Array(buf));
        return arr.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function safe(fn, fallback = '') {
        try {
            const v = fn();
            if (v instanceof Promise) return v.then(r => r ?? fallback).catch(() => fallback);
            return Promise.resolve(v ?? fallback);
        } catch (e) {
            return Promise.resolve(fallback);
        }
    }

    // ----------------------
    // Canvas fingerprint
    // ----------------------
    function getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 280;
            canvas.height = 60;
            const ctx = canvas.getContext('2d');

            // draw text and shapes with subtleties
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.textBaseline = 'alphabetic';
            ctx.font = "16px 'Arial'";
            ctx.fillStyle = '#069';
            ctx.fillText('DeviceFingerprint — 測試', 2, 20);
            ctx.fillStyle = 'rgba(102,204,0,0.7)';
            ctx.fillText('DeviceFingerprint — 測試', 4, 22);
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgb(200,50,100)';
            ctx.beginPath();
            ctx.arc(50, 35, 20, 0, Math.PI * 2, true);
            ctx.fill();
            return canvas.toDataURL();
        } catch (e) {
            return '';
        }
    }

    // ----------------------
    // WebGL fingerprint
    // ----------------------
    function getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return '';

            // Basic parameters
            const params = [
                gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                gl.getParameter(gl.VERSION),
                gl.getParameter(gl.VENDOR),
                gl.getParameter(gl.RENDERER)
            ].join('||');

            // Some precision info and extensions
            const floatPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
            const precisionStr = [floatPrecision.precision, floatPrecision.rangeMin, floatPrecision.rangeMax].join(',');

            const exts = (gl.getSupportedExtensions() || []).slice(0, 20).join(',');

            // Try to get UNMASKED info (may be blocked)
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            const unmaskedVendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : '';
            const unmaskedRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';

            return [params, precisionStr, exts, unmaskedVendor, unmaskedRenderer].join('||');
        } catch (e) {
            return '';
        }
    }

    // ----------------------
    // Offline Audio fingerprint (renders to buffer and hashes samples)
    // ----------------------
    async function getAudioFingerprint() {
        // Use OfflineAudioContext where possible to avoid audible output
        try {
            const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (!OfflineCtx) return '';

            const sampleRate = 44100;
            const length = 44100; // 1 second
            const ctx = new OfflineCtx(1, length, sampleRate);

            // Oscillator with different nodes to exercise DSP
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 4400;

            const biquad = ctx.createBiquadFilter();
            biquad.type = 'lowpass';
            biquad.frequency.value = 10000;

            const gain = ctx.createGain();
            gain.gain.value = 0.5;

            osc.connect(biquad);
            biquad.connect(gain);
            gain.connect(ctx.destination);

            osc.start(0);
            const rendered = await ctx.startRendering();

            // Collect a small part of the rendered buffer and hash it
            const channelData = rendered.getChannelData(0);
            // Use first N samples (or every Nth sample) to reduce size while keeping signal
            const N = Math.min(2048, channelData.length);
            const float32 = new Float32Array(N);
            for (let i = 0; i < N; i++) float32[i] = channelData[i];

            // Hash the raw bytes of the Float32Array
            return await sha256HexFromArrayBuffer(float32.buffer);
        } catch (e) {
            return '';
        }
    }

    // ----------------------
    // Font detection: measure width differences for a list of fonts
    // ----------------------
    function detectFonts() {
        try {
            const baseFonts = ['monospace', 'serif', 'sans-serif'];
            const testFonts = [
                'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Palatino', 'Segoe UI', 'Roboto',
                'Noto Sans', 'Helvetica', 'Impact', 'Comic Sans MS', 'Verdana', 'Tahoma', 'Lucida Grande'
            ];

            const testString = 'mmmmmmmmmmlli';
            const testSize = '72px';

            const body = document.getElementsByTagName('body')[0] || document.documentElement;
            const span = document.createElement('span');
            span.style.fontSize = testSize;
            span.style.position = 'absolute';
            span.style.left = '-9999px';
            span.innerText = testString;
            body.appendChild(span);

            const detected = [];

            const defaultWidths = {};
            for (const base of baseFonts) {
                span.style.fontFamily = base;
                defaultWidths[base] = span.getBoundingClientRect().width;
            }

            for (const font of testFonts) {
                let found = false;
                for (const base of baseFonts) {
                    span.style.fontFamily = `'${font}', ${base}`;
                    const w = span.getBoundingClientRect().width;
                    if (w !== defaultWidths[base]) {
                        found = true;
                        break;
                    }
                }
                detected.push(`${font}:${found ? 1 : 0}`);
            }

            span.remove();
            return detected.join(',');
        } catch (e) {
            return '';
        }
    }

    // ----------------------
    // Plugins & mime types (older browsers) -- stringify safely
    // ----------------------
    function getPluginsAndMimes() {
        try {
            const plugins = [];
            for (let i = 0; i < (navigator.plugins?.length || 0); i++) {
                const p = navigator.plugins[i];
                plugins.push(p.name + '~' + p.description);
            }
            const mimes = [];
            for (let i = 0; i < (navigator.mimeTypes?.length || 0); i++) {
                const m = navigator.mimeTypes[i];
                mimes.push(m.type + '~' + m.description);
            }
            return `plugins:${plugins.join('|')}|mimes:${mimes.join('|')}`;
        } catch (e) {
            return '';
        }
    }

    // ----------------------
    // Media devices (counts and kinds)
    // ----------------------
    async function getMediaDeviceInfo() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return '';
            const list = await navigator.mediaDevices.enumerateDevices();
            // We only use counts and kinds; avoid labels (require permissions).
            const kindCounts = {};
            list.forEach(d => kindCounts[d.kind] = (kindCounts[d.kind] || 0) + 1);
            return Object.entries(kindCounts).map(([k, v]) => `${k}:${v}`).join(',');
        } catch (e) {
            return '';
        }
    }

    // ----------------------
    // Permissions states (camera/mic/notifications/geolocation)
    // ----------------------
    async function getPermissionStates() {
        try {
            if (!navigator.permissions || !navigator.permissions.query) return '';
            const perms = ['camera', 'microphone', 'geolocation', 'notifications'];
            const out = [];
            for (const p of perms) {
                try {
                    // some browsers may throw for unknown names
                    // eslint-disable-next-line no-await-in-loop
                    const status = await navigator.permissions.query({ name: p });
                    out.push(`${p}:${status.state}`);
                } catch (_) {
                    out.push(`${p}:unknown`);
                }
            }
            return out.join(',');
        } catch (e) {
            return '';
        }
    }

    // ----------------------
    // Battery (take stable-ish bits; note this can change)
    // ----------------------
    async function getBatteryInfo() {
        try {
            if (!navigator.getBattery) return '';
            const b = await navigator.getBattery();
            // only take charging (boolean) and level rounded to 2 decimals
            return `charging:${b.charging ? 1 : 0}|level:${Math.round((b.level || 0) * 100)}`;
        } catch (e) {
            return '';
        }
    }

    // ----------------------
    // Connection info (navigator.connection)
    // ----------------------
    function getConnectionInfo() {
        try {
            const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
            // effectiveType could vary, but include it if available
            return `effectiveType:${c.effectiveType || ''}|downlinkMax:${c.downlinkMax || ''}|rtt:${c.rtt || ''}`;
        } catch (e) {
            return '';
        }
    }

    // ----------------------
    // Misc: Intl, screen, navigator stable fields
    // ----------------------
    function collectStableNavigator() {
        try {
            const nav = navigator || {};
            const i = [
                nav.userAgent || '',
                nav.vendor || '',
                nav.platform || '',
                (nav.languages || []).join(','),
                nav.language || '',
                nav.appVersion || '',
                nav.product || '',
                'hardwareConcurrency:' + (nav.hardwareConcurrency || ''),
                'deviceMemory:' + (nav.deviceMemory || ''),
                'maxTouchPoints:' + (nav.maxTouchPoints || ''),
                'doNotTrack:' + (nav.doNotTrack || '')
            ];
            return i.join('||');
        } catch (e) {
            return '';
        }
    }

    function collectStableScreen() {
        try {
            return [
                screen?.width || '',
                screen?.height || '',
                screen?.colorDepth || '',
                screen?.pixelDepth || '',
                window.devicePixelRatio || ''
            ].join('||');
        } catch (e) {
            return '';
        }
    }

    function collectIntl() {
        try {
            const tzOffset = new Date().getTimezoneOffset();
            const intl = Intl && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions() : {};
            return [
                'tzOffset:' + tzOffset,
                'locale:' + (intl.locale || intl.locale || ''),
                'calendar:' + (intl.calendar || ''),
                'numberingSystem:' + (intl.numberingSystem || ''),
                'timeZone:' + (intl.timeZone || '')
            ].join('||');
        } catch (e) {
            return '';
        }
    }

    function collectMediaQueries() {
        try {
            const mq = [
                'prefersColorScheme:' + (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
                'prefersReducedMotion:' + (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference'),
                'colorGamut:' + ((window.matchMedia && window.matchMedia('(color-gamut: p3)').matches) ? 'p3' : ((window.matchMedia && window.matchMedia('(color-gamut: srgb)').matches) ? 'srgb' : 'unknown')),
                'forced-colors:' + (window.matchMedia && window.matchMedia('(forced-colors: active)').matches ? 'active' : 'none')
            ];
            return mq.join('||');
        } catch (e) {
            return '';
        }
    }

    // ----------------------
    // Main generation function
    // ----------------------
    async function generate(options = {}) {
        // options can allow toggling certain expensive probes (fonts, audio, battery)
        const cfg = Object.assign({
            fonts: true,
            audio: true,
            battery: false,  // battery can be volatile; default off
            mediaDevices: true,
            permissions: true
        }, options);

        const parts = [];

        parts.push('nav:' + collectStableNavigator());
        parts.push('screen:' + collectStableScreen());
        parts.push('intl:' + collectIntl());
        parts.push('mediaQueries:' + collectMediaQueries());
        parts.push('connection:' + getConnectionInfo());
        parts.push('plugins:' + getPluginsAndMimes());

        // fonts
        if (cfg.fonts) {
            parts.push('fonts:' + safe(() => detectFonts(), ''));
        }

        // canvas & webgl
        parts.push('canvas:' + safe(() => getCanvasFingerprint(), ''));
        parts.push('webgl:' + safe(() => getWebGLFingerprint(), ''));

        // audio (async)
        if (cfg.audio) {
            try {
                const audioHash = await getAudioFingerprint();
                parts.push('audio:' + (audioHash || ''));
            } catch (e) {
                parts.push('audio:');
            }
        }

        // finally, join deterministically and hash
        const raw = parts.join('||||');
        return await sha256Hex(raw);
    }

    return { generate };
})();

// export
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = DeviceID;
} else {
    window.DeviceID = DeviceID;
}
