import JsBarcode from 'jsbarcode';

export interface BarcodeOptions {
  format?: 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  textPosition?: 'bottom' | 'top';
  textMargin?: number;
  fontOptions?: string;
  font?: string;
  fontColor?: string;
  background?: string;
  lineColor?: string;
  margin?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

export class BarcodeGenerator {
  static generateBarcodeNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return timestamp.slice(-8) + random;
  }

  static generateEAN13(): string {
    // Generate 12 digits, then calculate check digit
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += Math.floor(Math.random() * 10);
    }

    // Calculate EAN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    return code + checkDigit;
  }

  static generateUPC(): string {
    // Generate 11 digits, then calculate check digit
    let code = '';
    for (let i = 0; i < 11; i++) {
      code += Math.floor(Math.random() * 10);
    }

    // Calculate UPC check digit
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(code[i]);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    return code + checkDigit;
  }

  static generateBarcode(
    value: string,
    canvas: HTMLCanvasElement,
    options: BarcodeOptions = {}
  ): boolean {
    try {
      const defaultOptions: BarcodeOptions = {
        format: 'CODE128',
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 20,
        textAlign: 'center',
        textPosition: 'bottom',
        textMargin: 2,
        fontOptions: '',
        font: 'monospace',
        fontColor: '#000000',
        background: '#ffffff',
        lineColor: '#000000',
        margin: 10,
        marginTop: undefined,
        marginBottom: undefined,
        marginLeft: undefined,
        marginRight: undefined,
      };

      const finalOptions = { ...defaultOptions, ...options };

      JsBarcode(canvas, value, finalOptions);
      return true;
    } catch (error) {
      console.error('Error generating barcode:', error);
      return false;
    }
  }

  static generateBarcodeDataURL(
    value: string,
    options: BarcodeOptions = {}
  ): string | null {
    try {
      const canvas = document.createElement('canvas');
      const success = this.generateBarcode(value, canvas, options);

      if (success) {
        return canvas.toDataURL('image/png');
      }
      return null;
    } catch (error) {
      console.error('Error generating barcode data URL:', error);
      return null;
    }
  }

  static generateBarcodeWithCaptionDataURL(
    value: string,
    caption: string,
    options: BarcodeOptions = {}
  ): string | null {
    try {
      // First render the barcode to a canvas
      const barcodeCanvas = document.createElement('canvas');
      const success = this.generateBarcode(value, barcodeCanvas, options);
      if (!success) return null;

      const barcodeWidth = barcodeCanvas.width;
      const barcodeHeight = barcodeCanvas.height;

      // Prepare caption area (below the barcode)
      const captionMargin = 8; // px
      const baseSize = options.fontSize || 20;
      const sizePx = Math.max(16, Math.round(baseSize * 0.95));
      const captionFont = `${sizePx}px ${options.font || 'monospace'}`;

      // Create composed canvas: barcode on top, caption below
      const composed = document.createElement('canvas');
      const ctx = composed.getContext('2d');
      if (!ctx) return null;

      // Measure caption width to choose canvas width
      ctx.font = captionFont;
      const textMetrics = ctx.measureText(caption);
      const captionHeight = sizePx * 1.2; // include line height
      const composedWidth = Math.max(barcodeWidth, Math.ceil(textMetrics.width) + 20);
      const composedHeight = barcodeHeight + captionMargin + captionHeight + 10;

      composed.width = composedWidth;
      composed.height = composedHeight;

      // White background
      ctx.fillStyle = options.background || '#ffffff';
      ctx.fillRect(0, 0, composedWidth, composedHeight);

      // Draw barcode centered
      const barcodeX = Math.floor((composedWidth - barcodeWidth) / 2);
      ctx.drawImage(barcodeCanvas, barcodeX, 0);

      // Draw caption centered at bottom part
      ctx.fillStyle = options.fontColor || '#000000';
      ctx.font = captionFont;
      ctx.textAlign = 'center';
      const captionX = Math.floor(composedWidth / 2);
      const captionY = barcodeHeight + captionMargin + (captionHeight * 0.8);
      ctx.fillText(caption, captionX, captionY);

      return composed.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating barcode with caption:', error);
      return null;
    }
  }

  static generateFullLabelDataURL(
    value: string,
    mrp: string,
    ssPrice: string,
    productName: string,
    options: BarcodeOptions = {}
  ): string | null {
    try {
      // Target dimensions for 4cm x 4cm at ~300 DPI
      // 4cm = ~472px
      const targetWidth = 472;
      const targetHeight = 472;

      // 1. Generate Barcode Canvas (smaller)
      const barcodeCanvas = document.createElement('canvas');
      // Force specific options for this compact size
      const compactOptions = {
        ...options,
        width: 2, // Width of bars
        height: 80, // Height of bars (increased for 4cm height)
        displayValue: true,
        fontSize: 16,
        margin: 0
      };
      const success = this.generateBarcode(value, barcodeCanvas, compactOptions);
      if (!success) return null;

      // 2. Define Fonts
      const shopName = "SASHVIKA SAREES";
      const font = options.font || 'sans-serif';

      const shopNameFont = `bold 24px ${font}`;
      const productFont = `24px ${font}`;
      const mrpFont = `24px ${font}`;
      const ssPriceFont = `bold 30px ${font}`;

      // 3. Create Final Canvas
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';

      // Layout Calculation
      const centerX = targetWidth / 2;
      let currentY = 50; // Start Y

      // Draw Barcode (Moved to top)
      const barcodeWidth = barcodeCanvas.width;
      const barcodeHeight = barcodeCanvas.height;
      const barcodeX = (targetWidth - barcodeWidth) / 2;
      ctx.drawImage(barcodeCanvas, barcodeX, currentY);
      currentY += barcodeHeight + 15;

      // Draw Product Name
      ctx.font = productFont;
      ctx.fillText(productName, centerX, currentY + 15);
      currentY += 40;

      // Draw MRP (Strikethrough)
      if (mrp) {
        ctx.font = mrpFont;
        const mrpText = `MRP: ${mrp}`;
        ctx.fillText(mrpText, centerX, currentY + 10);

        // Strikethrough line
        const mrpMetrics = ctx.measureText(mrpText);
        const lineStart = centerX - (mrpMetrics.width / 2);
        const lineEnd = centerX + (mrpMetrics.width / 2);
        const lineY = currentY + 2; // Middle of text

        ctx.beginPath();
        ctx.moveTo(lineStart, lineY);
        ctx.lineTo(lineEnd, lineY);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        currentY += 35;
      }

      // Draw Shop Name (Moved below MRP)
      ctx.font = shopNameFont;
      ctx.fillText(shopName, centerX, currentY + 10);
      currentY += 35;

      // Draw Price (Show only value)
      ctx.font = ssPriceFont;
      const priceValue = ssPrice.replace(/SS Price:\s*/i, '').trim();
      ctx.fillText(priceValue, centerX, currentY + 10);

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating full label:', error);
      return null;
    }
  }


  static validateBarcode(value: string, format: string = 'CODE128'): boolean {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, value, { format: format as any });
      return true;
    } catch (error) {
      return false;
    }
  }

  static printBarcode(
    value: string,
    options: BarcodeOptions = {},
    productName?: string,
    mrp?: string,
    ssPrice?: string
  ): void {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Could not open print window');
      }

      const canvas = document.createElement('canvas');
      this.generateBarcode(value, canvas, {
        ...options,
        width: (options.width ?? 2),
        height: (options.height ?? 50),
        margin: (options.margin ?? 0),
        displayValue: true,
        fontSize: 12
      });

      const barcodeDataURL = canvas.toDataURL('image/png');
      const priceText = ssPrice ? ssPrice : '';

      (printWindow as any).document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Barcode</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              text-align: center;
            }
            .barcode-container {
              display: inline-block;
              margin: 10px;
              padding: 10px;
              border: 1px dashed #ddd; /* Dashed border to show cut line */
              width: 4cm;
              height: 4cm;
              box-sizing: border-box;
              overflow: hidden;
              position: relative;
            }
            .shop-name-bottom {
              font-size: 14px;
              font-weight: bold;
              margin-top: 5px;
              color: #000;
              text-transform: uppercase;
            }
            .product-name {
              font-size: 12px;
              font-weight: normal;
              margin-top: 5px;
              color: #333;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .barcode-image {
              display: block;
              margin: 0 auto;
              max-width: 100%;
              height: 50px; /* Force smaller height for print */
            }
            .mrp-price {
              font-size: 12px;
              text-decoration: line-through;
              color: #666;
              margin-top: 5px;
            }
            .ss-price {
              font-size: 16px;
              font-weight: 700;
              color: #000;
              margin-top: 2px;
            }
            .barcode-value {
              font-size: 10px;
              margin-top: 2px;
              color: #666;
              font-family: monospace;
            }
            @media print {
              body { margin: 0; }
              .barcode-container {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            <img src="${barcodeDataURL}" alt="Barcode" class="barcode-image" />
            ${productName ? `<div class="product-name">${productName}</div>` : ''}
            ${mrp ? `<div class="mrp-price">MRP: ${mrp}</div>` : ''}
            <div class="shop-name-bottom">Sashvika Sarees</div>
            ${priceText ? `<div class="ss-price">${priceText}</div>` : ''}
            <div class="barcode-value">${value}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
        </html>
      `);

      (printWindow as any).document.close();
    } catch (error) {
      console.error('Error printing barcode:', error);
      alert('Error printing barcode. Please try again.');
    }
  }

  static printMultipleBarcodes(
    barcodes: Array<{ value: string; productName?: string; mrp?: string; ssPrice?: string }>,
    options: BarcodeOptions = {}
  ): void {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Could not open print window');
      }

      let barcodeHTML = '';

      barcodes.forEach(({ value, productName, mrp, ssPrice }) => {
        const canvas = document.createElement('canvas');
        this.generateBarcode(value, canvas, {
          ...options,
          width: (options.width ?? 2),
          height: (options.height ?? 50),
          margin: (options.margin ?? 0),
          displayValue: true,
          fontSize: 12
        });

        const barcodeDataURL = canvas.toDataURL('image/png');
        const priceText = ssPrice ? ssPrice : '';

        barcodeHTML += `
          <div class="barcode-container">
            <img src="${barcodeDataURL}" alt="Barcode" class="barcode-image" />
            ${productName ? `<div class="product-name">${productName}</div>` : ''}
            ${mrp ? `<div class="mrp-price">MRP: ${mrp}</div>` : ''}
            <div class="shop-name-bottom">Sashvika Sarees</div>
            ${priceText ? `<div class="ss-price">${priceText}</div>` : ''}
            <div class="barcode-value">${value}</div>
          </div>
        `;
      });

      (printWindow as any).document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Multiple Barcodes</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .barcode-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(4cm, 1fr));
              gap: 10px;
            }
            .barcode-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 10px;
              border: 1px dashed #ddd;
              width: 4cm;
              height: 4cm;
              box-sizing: border-box;
              overflow: hidden;
              text-align: center;
            }
            .shop-name-bottom {
              font-size: 14px;
              font-weight: bold;
              margin-top: 5px;
              color: #000;
              text-transform: uppercase;
            }
            .product-name {
              font-size: 12px;
              font-weight: normal;
              margin-top: 5px;
              color: #333;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .barcode-image {
              display: block;
              margin: 0 auto;
              max-width: 100%;
              height: 50px;
            }
            .mrp-price {
              font-size: 12px;
              text-decoration: line-through;
              color: #666;
              margin-top: 5px;
            }
            .ss-price {
              font-size: 16px;
              font-weight: 700;
              color: #000;
              margin-top: 2px;
            }
            .barcode-value {
              font-size: 10px;
              margin-top: 2px;
              color: #666;
              font-family: monospace;
            }
            @media print {
              body { margin: 0; }
              .barcode-container {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="barcode-grid">
            ${barcodeHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
        </html>
      `);

      (printWindow as any).document.close();
    } catch (error) {
      console.error('Error printing multiple barcodes:', error);
      alert('Error printing barcodes. Please try again.');
    }
  }
}
