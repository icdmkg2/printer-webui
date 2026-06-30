import ipp from 'ipp';

/**
 * Sends a PDF buffer directly to the printer via IPP over port 631.
 * 
 * @param printerIp The IP address of the printer.
 * @param pdfBuffer The raw buffer of the PDF file.
 * @param filename The name of the file to print.
 * @returns A promise resolving to the print job ID.
 */
export async function printPdf(printerIp: string, pdfBuffer: Buffer, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const printerUrl = `http://${printerIp}:631/ipp/print`;
    
    // Create the IPP Printer client
    const printer = new ipp.Printer(printerUrl) as any;

    // Set up the print job message
    const msg = {
      'operation-attributes-tag': {
        'requesting-user-name': 'Printer-Gateway',
        'job-name': filename,
        'document-format': 'application/pdf',
      },
      data: pdfBuffer,
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
