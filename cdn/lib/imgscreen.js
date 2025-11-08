/**
 * WebsiteCapture - A library for capturing website screenshots as base64 images
 * @version 1.0.0
 */

class WebsiteCapture {
  constructor(options = {}) {
    this.options = {
      format: options.format || 'png', // 'png' or 'jpeg'
      quality: options.quality || 0.92, // For JPEG (0-1)
      backgroundColor: options.backgroundColor || '#ffffff',
      ...options
    };
  }

  /**
   * Capture the current viewport as a base64 image
   * @returns {Promise<string>} Base64 encoded image string
   */
  async captureViewport() {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to viewport size
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        // Fill background
        ctx.fillStyle = this.options.backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Use html2canvas approach - render DOM to canvas
        this._renderDOMToCanvas(canvas, ctx)
          .then(() => {
            const mimeType = this.options.format === 'jpeg' 
              ? 'image/jpeg' 
              : 'image/png';
            const base64 = canvas.toDataURL(mimeType, this.options.quality);
            resolve(base64);
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Capture a specific element as a base64 image
   * @param {HTMLElement} element - The element to capture
   * @returns {Promise<string>} Base64 encoded image string
   */
  async captureElement(element) {
    if (!element || !(element instanceof HTMLElement)) {
      throw new Error('Invalid element provided');
    }

    return new Promise((resolve, reject) => {
      try {
        const rect = element.getBoundingClientRect();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx.fillStyle = this.options.backgroundColor;
        ctx.fillRect(0, 0, rect.width, rect.height);

        this._renderElementToCanvas(element, canvas, ctx)
          .then(() => {
            const mimeType = this.options.format === 'jpeg' 
              ? 'image/jpeg' 
              : 'image/png';
            const base64 = canvas.toDataURL(mimeType, this.options.quality);
            resolve(base64);
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get pixel color at specific coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Promise<object>} Color object {r, g, b, a, hex}
   */
  async getPixelColor(x, y) {
    const base64 = await this.captureViewport();
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        resolve({
          r: pixel[0],
          g: pixel[1],
          b: pixel[2],
          a: pixel[3] / 255,
          hex: '#' + [pixel[0], pixel[1], pixel[2]]
            .map(v => v.toString(16).padStart(2, '0'))
            .join('')
        });
      };
      img.onerror = reject;
      img.src = base64;
    });
  }

  /**
   * Render DOM to canvas using foreignObject (modern approach)
   * @private
   */
  async _renderDOMToCanvas(canvas, ctx) {
    const width = canvas.width;
    const height = canvas.height;
    
    // Clone the document body
    const clonedBody = document.body.cloneNode(true);
    
    // Get computed styles
    const styles = this._getPageStyles();
    
    // Create SVG with foreignObject
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <style>${styles}</style>
            ${clonedBody.innerHTML}
          </div>
        </foreignObject>
      </svg>
    `;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to render DOM'));
      };
      img.src = url;
    });
  }

  /**
   * Render specific element to canvas
   * @private
   */
  async _renderElementToCanvas(element, canvas, ctx) {
    const rect = element.getBoundingClientRect();
    const clonedElement = element.cloneNode(true);
    const styles = this._getElementStyles(element);
    
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <style>${styles}</style>
            ${clonedElement.outerHTML}
          </div>
        </foreignObject>
      </svg>
    `;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to render element'));
      };
      img.src = url;
    });
  }

  /**
   * Get all page styles
   * @private
   */
  _getPageStyles() {
    const sheets = Array.from(document.styleSheets);
    let styles = '';
    
    sheets.forEach(sheet => {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          styles += Array.from(rules).map(rule => rule.cssText).join('\n');
        }
      } catch (e) {
        // Cross-origin stylesheets may throw errors
        console.warn('Could not access stylesheet:', e);
      }
    });
    
    return styles;
  }

  /**
   * Get styles for specific element
   * @private
   */
  _getElementStyles(element) {
    const computed = window.getComputedStyle(element);
    let styles = '';
    
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      styles += `${prop}: ${computed.getPropertyValue(prop)};`;
    }
    
    return `* { ${styles} }`;
  }

  /**
   * Download the captured image
   * @param {string} base64 - Base64 image string
   * @param {string} filename - Output filename
   */
  downloadImage(base64, filename = 'screenshot.png') {
    const link = document.createElement('a');
    link.href = base64;
    link.download = filename;
    link.click();
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebsiteCapture;
}
if (typeof window !== 'undefined') {
  window.WebsiteCapture = WebsiteCapture;
}

/* USAGE EXAMPLES:

// Initialize the library
const capture = new WebsiteCapture({
  format: 'png',  // or 'jpeg'
  quality: 0.92,  // for JPEG
  backgroundColor: '#ffffff'
});

// Capture the entire viewport
capture.captureViewport().then(base64 => {
  console.log('Base64 image:', base64);
  // Use the base64 string as needed
});

// Capture a specific element
const element = document.querySelector('.my-element');
capture.captureElement(element).then(base64 => {
  console.log('Element captured:', base64);
});

// Get color of a pixel at coordinates
capture.getPixelColor(100, 200).then(color => {
  console.log('Pixel color:', color);
  // { r: 255, g: 128, b: 64, a: 1, hex: '#ff8040' }
});

// Download the screenshot
capture.captureViewport().then(base64 => {
  capture.downloadImage(base64, 'my-screenshot.png');
});

*/
