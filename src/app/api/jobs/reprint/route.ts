import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db, { insertPrintJob, updatePrintJobStatus } from '@/lib/db';
import { PrinterDiscovery } from '@/lib/discovery';
import { printPdf } from '@/lib/printer';

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get('printer_session')?.value === 'authenticated';
}

export async function POST(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Retrieve original job and PDF blob
    const stmt = db.prepare('SELECT filename, pdf_data FROM print_jobs WHERE id = ?');
    const row = stmt.get(jobId) as { filename: string; pdf_data: Buffer } | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const { filename, pdf_data: pdfBuffer } = row;
    const reprintFilename = `Reprint: ${filename}`;

    // Get Printer IP
    const discovery = PrinterDiscovery.getInstance();
    const printerIp = discovery.getPrinterIp();

    if (!printerIp) {
      // Record failed print job in DB
      insertPrintJob(reprintFilename, pdfBuffer, 'Failed (Printer Offline)');
      return NextResponse.json({ error: 'Printer IP address not discovered. Ensure the printer is online.' }, { status: 503 });
    }

    // Insert new print log entry for this reprint attempt
    const newJobId = insertPrintJob(reprintFilename, pdfBuffer, 'Printing...');

    try {
      // Send print command to printer
      await printPdf(printerIp, pdfBuffer, filename);
      updatePrintJobStatus(newJobId, 'Success');
      return NextResponse.json({ success: true, jobId: newJobId });
    } catch (printError: any) {
      console.error('Re-printing operation failed:', printError);
      updatePrintJobStatus(newJobId, `Failed: ${printError.message || 'IPP Error'}`);
      return NextResponse.json({ error: `Re-printing failed: ${printError.message || 'IPP Error'}` }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Reprint POST Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
