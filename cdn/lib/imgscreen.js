/**
 * WebsiteCapture - A library for capturing website screenshots pixel by pixel
 * @version 2.0.0
 */

class WebsiteCapture {
  constructor(options = {}) {
    this.options = {
      format: options.format || 'png', // 'png' or 'jpeg'
      quality: options.quality || 0.92, // For JPEG (0-1)
      backgroundColor: options.backgroundColor || '#ffffff',
      scale: options.scale || window.devicePixelRatio || 1,
      ...options
    };
  }

  /**
   * Capture the current viewport as a base64 image (pixel by pixel)
   * @returns {Promise<string>} Base64 encoded image string
   */
  async captureViewport() {
    return new Promise((resolve, reject) => {
      try {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const scale = this.options.scale;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        
        // Scale context for high DPI displays
        ctx.scale(scale, scale);

        // Fill background
        ctx.fillStyle = this.options.backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Use html2canvas library approach or draw directly
        this._captureWithHTML2Canvas(ctx, width, height)
          .then(() => {
            const mimeType = this.options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const base64 = canvas.toDataURL(mimeType, this.options.quality);
            resolve(base64);
          })
          .catch(() => {
            // Fallback: use browser's built-in screenshot capability
            this._captureFallback(canvas, ctx, width, height)
              .then(() => {
                const mimeType = this.options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
                const base64 = canvas.toDataURL(mimeType, this.options.quality);
                resolve(base64);
              })
              .catch(reject);
          });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Capture using HTML to Canvas rendering
   * @private
   */
  async _captureWithHTML2Canvas(ctx, width, height) {
    return new Promise((resolve, reject) => {
      try {
        // Get all elements
        const elements = document.querySelectorAll('body, body *');
        
        // Render each element
        this._renderElements(ctx, elements, width, height);
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Render elements to canvas
   * @private
   */
  _renderElements(ctx, elements, viewportWidth, viewportHeight) {
    elements.forEach(element => {
      try {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        // Skip invisible elements
        if (styles.display === 'none' || styles.visibility === 'hidden' || 
            styles.opacity === '0' || rect.width === 0 || rect.height === 0) {
          return;
        }

        // Skip elements outside viewport
        if (rect.bottom < 0 || rect.top > viewportHeight || 
            rect.right < 0 || rect.left > viewportWidth) {
          return;
        }

        // Save context
        ctx.save();

        // Draw background
        if (styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          ctx.fillStyle = styles.backgroundColor;
          ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
        }

        // Draw background image
        if (styles.backgroundImage && styles.backgroundImage !== 'none') {
          this._drawBackgroundImage(ctx, element, rect, styles);
        }

        // Draw borders
        this._drawBorders(ctx, rect, styles);

        // Draw text content
        if (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3) {
          const text = element.textContent.trim();
          if (text) {
            this._drawText(ctx, text, rect, styles);
          }
        }

        // Draw images
        if (element.tagName === 'IMG' && element.complete) {
          try {
            ctx.drawImage(element, rect.left, rect.top, rect.width, rect.height);
          } catch (e) {
            // Cross-origin images may fail
          }
        }

        // Draw canvas elements
        if (element.tagName === 'CANVAS') {
          try {
            ctx.drawImage(element, rect.left, rect.top, rect.width, rect.height);
          } catch (e) {
            // May fail for tainted canvases
          }
        }

        ctx.restore();
      } catch (e) {
        // Skip elements that cause errors
      }
    });
  }

  /**
   * Draw text on canvas
   * @private
   */
  _drawText(ctx, text, rect, styles) {
    ctx.fillStyle = styles.color || '#000000';
    ctx.font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    ctx.textAlign = styles.textAlign || 'left';
    ctx.textBaseline = 'top';

    const lines = text.split('\n');
    const lineHeight = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.2;
    
    lines.forEach((line, i) => {
      ctx.fillText(line, rect.left + parseFloat(styles.paddingLeft || 0), 
                   rect.top + parseFloat(styles.paddingTop || 0) + (i * lineHeight));
    });
  }

  /**
   * Draw borders on canvas
   * @private
   */
  _drawBorders(ctx, rect, styles) {
    const drawBorder = (side, x, y, w, h) => {
      const borderWidth = parseFloat(styles[`border${side}Width`]) || 0;
      const borderStyle = styles[`border${side}Style`];
      const borderColor = styles[`border${side}Color`];

      if (borderWidth > 0 && borderStyle !== 'none' && borderColor) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(x, y, w, h);
      }
    };

    drawBorder('Top', rect.left, rect.top, rect.width, 0);
    drawBorder('Right', rect.right, rect.top, 0, rect.height);
    drawBorder('Bottom', rect.left, rect.bottom, rect.width, 0);
    drawBorder('Left', rect.left, rect.top, 0, rect.height);
  }

  /**
   * Draw background image
   * @private
   */
  _drawBackgroundImage(ctx, element, rect, styles) {
    const bgImage = styles.backgroundImage;
    const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
    
    if (urlMatch && urlMatch[1]) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = urlMatch[1];
      
      if (img.complete) {
        try {
          ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height);
        } catch (e) {
          // Cross-origin images may fail
        }
      }
    }
  }

  /**
   * Fallback capture method
   * @private
   */
  async _captureFallback(canvas, ctx, width, height) {
    return new Promise((resolve, reject) => {
      try {
        // Create SVG representation
        const svgData = this._createSVGSnapshot(width, height);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to capture'));
        };
        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create SVG snapshot of the page
   * @private
   */
  _createSVGSnapshot(width, height) {
    const serializer = new XMLSerializer();
    const docElement = document.documentElement;
    const html = serializer.serializeToString(docElement);

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          ${html}
        </foreignObject>
      </svg>
    `;
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
        
        const pixel = ctx.getImageData(x * this.options.scale, y * this.options.scale, 1, 1).data;
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
   * Download the captured image
   * @param {string} base64 - Base64 image string
   * @param {string} filename - Output filename
   */
  downloadImage(base64, filename = 'screenshot.png') {
    const link = document.createElement('a');
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebsiteCapture;
}
if (typeof window !== 'undefined') {
  window.WebsiteCapture = WebsiteCapture;
}
