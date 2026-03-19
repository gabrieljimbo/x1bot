import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');
import { createWorker } from 'tesseract.js';
// @ts-ignore
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

@Injectable()
export class OCRService {
    constructor() {
        // PDF.js worker setup if needed
        // pdfjsLib.GlobalWorkerOptions.workerSrc = ...
    }

    /**
     * Process a file (URL) and extract text via OCR
     */
    async extractText(fileUrl: string): Promise<string> {
        const tempDir = os.tmpdir();
        const downloadPath = path.join(tempDir, `ocr_input_${Date.now()}`);
        const processedPath = path.join(tempDir, `ocr_processed_${Date.now()}.png`);

        try {
            console.log(`[OCR_SERVICE] Downloading file: ${fileUrl}`);
            const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data);
            const contentType = response.headers['content-type'] || '';

            if (contentType.includes('pdf') || fileUrl.toLowerCase().endsWith('.pdf')) {
                return await this.processPdf(buffer, processedPath);
            } else {
                return await this.processImage(buffer, processedPath);
            }
        } catch (error: any) {
            console.error(`[OCR_SERVICE] Error: ${error.message}`);
            throw error;
        } finally {
            // Cleanup temp files
            if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
        }
    }

    private async processImage(buffer: Buffer, outputPath: string): Promise<string> {
        console.log(`[OCR_SERVICE] Pre-processing image with multiple attempts`);

        const attempts = [
            // Attempt 1: Classic Binarization
            {
                name: 'Classic Binarization',
                pipeline: () => sharp(buffer).greyscale().normalize().sharpen().threshold(180)
            },
            // Attempt 2: High Contrast (No Threshold)
            {
                name: 'High Contrast',
                pipeline: () => sharp(buffer).greyscale().normalize().sharpen().clahe({ width: 200, height: 200 })
            },
            // Attempt 3: Negate (Dark Mode Support)
            {
                name: 'Negate/Inverted',
                pipeline: () => sharp(buffer).negate().greyscale().normalize()
            },
            // Attempt 4: Blurred/Resized (Noise reduction)
            {
                name: 'Resized Blur-reduction',
                pipeline: () => sharp(buffer).resize(1500).greyscale().normalize().median(1).sharpen()
            }
        ];

        let bestText = "";
        for (let i = 0; i < attempts.length; i++) {
            try {
                const attempt = attempts[i];
                console.log(`[OCR_SERVICE] OCR Attempt ${i + 1}/${attempts.length}: ${attempt.name}`);
                
                await attempt.pipeline().toFile(outputPath);
                const text = await this.runOCR(outputPath);
                
                const lowerText = text.toLowerCase();
                const hasKeywords = lowerText.includes('pix') || lowerText.includes('pagamento') || lowerText.includes('comprovante');
                const hasNumbers = /\d{1,3}(?:\.\d{3})*,\d{2}/.test(text);

                if (hasKeywords && hasNumbers) {
                    console.log(`[OCR_SERVICE] Attempt ${i + 1} (${attempt.name}) successful (keywords and amounts found)`);
                    return text;
                }
                
                if (text.length > bestText.length) bestText = text;
            } catch (err) {
                console.warn(`[OCR_SERVICE] Attempt ${i + 1} failed: ${err.message}`);
            }
        }

        console.log(`[OCR_SERVICE] No attempt was perfect, returning best match (${bestText.length} chars)`);
        return bestText;
    }

    private async processPdf(buffer: Buffer, outputPath: string): Promise<string> {
        console.log(`[OCR_SERVICE] Converting PDF to image`);

        // Note: PDF.js implementation in Node can be tricky. 
        // We'll use a simplified version for now.
        const data = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;

        let fullText = '';

        // Process each page
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR

            // We need a canvas to render the PDF page
            // Using canvas package as required by pdfjs-dist in Node
            const { createCanvas } = require('canvas');
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const pageImageBuffer = canvas.toBuffer('image/png');

            // Pre-process page image before OCR
            const pageProcessedPath = `${outputPath}_page_${i}.png`;
            await sharp(pageImageBuffer)
                .greyscale()
                .normalize()
                .toFile(pageProcessedPath);

            const pageText = await this.runOCR(pageProcessedPath);
            fullText += pageText + '\n';

            // Cleanup page file
            if (fs.existsSync(pageProcessedPath)) fs.unlinkSync(pageProcessedPath);
        }

        return fullText;
    }

    private async runOCR(imagePath: string): Promise<string> {
        console.log(`[OCR_SERVICE] Running Tesseract on: ${imagePath}`);
        const worker = await createWorker('por+eng');

        try {
            const { data: { text } } = await worker.recognize(imagePath);
            return text;
        } finally {
            await worker.terminate();
        }
    }
}
