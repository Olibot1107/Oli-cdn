// File: device-id.js

/**
 * DeviceID Library
 * Generates a robust, device-specific ID that persists across private browsing
 * sessions on the same device, but differs across devices.
 */
const DeviceID = (() => {

    // Helper: Canvas fingerprint
    function getCanvasFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("DeviceFingerprintTest", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("DeviceFingerprintTest", 4, 17);
        return canvas.toDataURL();
    }

    // Helper: WebGL fingerprint
    function getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return '';
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : '';
            const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
            return vendor + '|' + renderer;
        } catch (e) {
            return '';
        }
    }

    // Helper: SHA-256 hash
    async function hashString(str) {
        const msgUint8 = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Main function to generate the device ID
    async function generate() {
        const navigatorInfo = [
            navigator.userAgent,
            navigator.language,
            navigator.platform,
            navigator.hardwareConcurrency || 1,
            navigator.deviceMemory || 1,
        ].join("||");

        const screenInfo = [
            screen.width,
            screen.height,
            screen.colorDepth,
            screen.pixelDepth
        ].join("||");

        const timezone = new Date().getTimezoneOffset();

        const rawID = [
            navigatorInfo,
            screenInfo,
            timezone,
            getCanvasFingerprint(),
            getWebGLFingerprint()
        ].join("||");

        return await hashString(rawID);
    }

    return { generate };
})();

// Export for ES modules
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = DeviceID;
} else {
    window.DeviceID = DeviceID;
}
