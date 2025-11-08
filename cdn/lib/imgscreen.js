/**
 * WebsiteCapture - True pixel-by-pixel screen capture
 * @version 4.0.0 - Direct pixel reading
 */

class WebsiteCapture {
  constructor(options = {}) {
    this.options = {
      format: options.format || 'png',
      quality: options.quality || 0.92,
      ...options
    };
  }

  /**
   * Capture viewport by reading every pixel
   */
  async captureViewport() {
    try {
      // Use html2canvas if available, otherwise use native browser API
      if (typeof html2canvas !== 'undefined') {
        return await this._captureWithHtml2Canvas();
      } else {
        return await this._captureWithNativeAPI();
      }
    } catch (error) {
      console.error('Capture failed:', error);
      throw error;
    }
  }

  /**
   * Capture using html2canvas library (best quality)
   * @private
   */
  async _captureWithHtml2Canvas() {
    const canvas = await html2canvas(document.body, {
      allowTaint: true,
      useCORS: true,
      logging: false,
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    });

    const mimeType = this.options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return canvas.toDataURL(mimeType, this.options.quality);
  }

  /**
   * Capture using native browser APIs
   * @private
   */
  async _captureWithNativeAPI() {
    return new Promise((resolve, reject) => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Method 1: Use foreignObject SVG (captures everything pixel-perfect)
      const data = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <html xmlns="http://www.w3.org/1999/xhtml">
              <head>
                <style>
                  ${this._getAllStyles()}
                </style>
              </head>
              <body style="margin: 0; padding: 0; width: ${width}px; height: ${height}px; overflow: hidden;">
                ${document.body.innerHTML}
              </body>
            </html>
          </foreignObject>
        </svg>
      `;

      const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        // Draw image pixel by pixel to canvas
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        const mimeType = this.options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const base64 = canvas.toDataURL(mimeType, this.options.quality);
        resolve(base64);
      };

      img.onerror = (error) => {
        URL.revokeObjectURL(url);
        // Fallback to manual pixel reading
        this._captureManually(canvas, ctx, width, height)
          .then(resolve)
          .catch(reject);
      };

      img.src = url;
    });
  }

  /**
   * Manually capture by drawing each element
   * @private
   */
  async _captureManually(canvas, ctx, width, height) {
    return new Promise((resolve) => {
      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Get all elements sorted by rendering order
      const elements = this._getAllElementsInOrder();

      // Draw each element
      for (const el of elements) {
        this._drawElementComplete(ctx, el);
      }

      const mimeType = this.options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const base64 = canvas.toDataURL(mimeType, this.options.quality);
      resolve(base64);
    });
  }

  /**
   * Get all styles from the page
   * @private
   */
  _getAllStyles() {
    let styles = '';
    
    // Get all stylesheets
    for (let sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          for (let rule of rules) {
            styles += rule.cssText + '\n';
          }
        }
      } catch (e) {
        // Cross-origin stylesheets
      }
    }

    // Get inline styles
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      if (el.style.cssText) {
        const id = el.id || `el-${Math.random().toString(36).substr(2, 9)}`;
        if (!el.id) el.id = id;
        styles += `#${id} { ${el.style.cssText} }\n`;
      }
    });

    return styles;
  }

  /**
   * Get all elements in rendering order
   * @private
   */
  _getAllElementsInOrder() {
    const elements = Array.from(document.querySelectorAll('body, body *'));
    
    // Sort by z-index and DOM order
    return elements.sort((a, b) => {
      const styleA = window.getComputedStyle(a);
      const styleB = window.getComputedStyle(b);
      
      const zIndexA = parseInt(styleA.zIndex) || 0;
      const zIndexB = parseInt(styleB.zIndex) || 0;
      
      if (zIndexA !== zIndexB) {
        return zIndexA - zIndexB;
      }
      
      // If same z-index, maintain DOM order
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  /**
   * Draw element completely with all properties
   * @private
   */
  _drawElementComplete(ctx, el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    // Skip invisible elements
    if (rect.width === 0 || rect.height === 0 ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        parseFloat(style.opacity) === 0) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = parseFloat(style.opacity) || 1;

    // Background
    if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    }

    // Borders
    if (parseFloat(style.borderWidth) > 0) {
      ctx.strokeStyle = style.borderColor || '#000';
      ctx.lineWidth = parseFloat(style.borderWidth);
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
    }

    // Images
    if (el.tagName === 'IMG' && el.complete) {
      try {
        ctx.drawImage(el, rect.left, rect.top, rect.width, rect.height);
      } catch (e) {}
    }

    // Canvas
    if (el.tagName === 'CANVAS') {
      try {
        ctx.drawImage(el, rect.left, rect.top, rect.width, rect.height);
      } catch (e) {}
    }

    // Video
    if (el.tagName === 'VIDEO' && el.readyState >= 2) {
      try {
        ctx.drawImage(el, rect.left, rect.top, rect.width, rect.height);
      } catch (e) {}
    }

    // Text (only for elements with direct text content)
    const text = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent)
      .join('')
      .trim();

    if (text && !this._hasBlockChildren(el)) {
      ctx.fillStyle = style.color || '#000';
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.textBaseline = 'top';
      
      const x = rect.left + parseFloat(style.paddingLeft || 0);
      const y = rect.top + parseFloat(style.paddingTop || 0);
      
      ctx.fillText(text, x, y, rect.width);
    }

    ctx.restore();
  }

  /**
   * Check if element has block-level children
   * @private
   */
  _hasBlockChildren(el) {
    return Array.from(el.children).some(child => {
      const display = window.getComputedStyle(child).display;
      return ['block', 'flex', 'grid', 'table'].includes(display);
    });
  }

  /**
   * Get pixel color at coordinates
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
   * Download screenshot
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

// Auto-load html2canvas if not present
if (typeof window !== 'undefined' && typeof html2canvas === 'undefined') {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  script.async = true;
  document.head.appendChild(script);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebsiteCapture;
}
if (typeof window !== 'undefined') {
  window.WebsiteCapture = WebsiteCapture;
}
