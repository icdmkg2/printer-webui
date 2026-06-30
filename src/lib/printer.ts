import ipp from 'ipp';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Converts a standard PDF buffer into a printer-supported format (application/PCLm or image/pwg-raster)
 * using Ghostscript. If Ghostscript is not available or fails, it falls back to raw PDF.
 */
async function convertPdfToPrintFormat(pdfBuffer: Buffer): Promise<{ data: Buffer; format: string }> {
  return new Promise((resolve) => {
    const tempDir = os.tmpdir();
    const uniqId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const inputPath = path.join(tempDir, `print_${uniqId}.pdf`);
    const outputPath = path.join(tempDir, `print_${uniqId}.pwg`);

    fs.writeFileSync(inputPath, pdfBuffer);

    // Convert PDF directly to PWG Raster at 300 DPI (standard printing resolution)
    const cmd = `gs -dNOPAUSE -dBATCH -sDEVICE=pwgraster -r300 -sOutputFile="${outputPath}" "${inputPath}"`;
    
    exec(cmd, (err, stdout, stderr) => {
      // Clean up input PDF
      try { fs.unlinkSync(inputPath); } catch {}

      if (!err && fs.existsSync(outputPath)) {
        try {
          const buffer = fs.readFileSync(outputPath);
          // Cleanup output file
          try { fs.unlinkSync(outputPath); } catch {}
          console.log('IPP: Successfully converted PDF to image/pwg-raster at 300 DPI using Ghostscript.');
          return resolve({ data: buffer, format: 'image/pwg-raster' });
        } catch (readErr) {
          // Fall through
        }
      }

      console.error('IPP: PWG Raster conversion failed:', err);
      console.warn('IPP: Falling back to raw application/pdf.');
      resolve({ data: pdfBuffer, format: 'application/pdf' });
    });
  });
}

/**
 * Sends a PDF buffer directly to the printer via IPP over port 631.
 * 
 * @param printerIp The IP address of the printer.
 * @param pdfBuffer The raw buffer of the PDF file.
 * @param filename The name of the file to print.
 * @returns A promise resolving to the print job ID.
 */
export async function printPdf(printerIp: string, pdfBuffer: Buffer, filename: string): Promise<string> {
  // Convert PDF to compatible format
  const { data: printData, format: printFormat } = await convertPdfToPrintFormat(pdfBuffer);

  return new Promise((resolve, reject) => {
    const printerUrl = `http://${printerIp}:631/ipp/print`;
    
    // Create the IPP Printer client
    const printer = new ipp.Printer(printerUrl) as any;

    // Set up the print job message
    const msg = {
      'operation-attributes-tag': {
        'requesting-user-name': 'Printer-Gateway',
        'job-name': filename,
        'document-format': printFormat,
      },
      data: printData,
    };

    // Execute the print job operation
    printer.execute('Print-Job', msg, (err: any, res: any) => {
      if (err) {
        console.error('IPP: Print job execution failed:', err);
        return reject(err);
      }

      // Check the response status code
      if (res && res.statusCode === 'successful-ok') {
        const jobId = res['job-attributes-tag']?.['job-id']?.toString() || 'unknown';
        console.log(`IPP: Successfully submitted print job. Job ID: ${jobId}`);
        resolve(jobId);
      } else {
        const statusCode = res?.statusCode || 'Unknown';
        console.error(`IPP: Failed to print, status code: ${statusCode}`);
        reject(new Error(`IPP failed with status code: ${statusCode}`));
      }
    });
  });
}
