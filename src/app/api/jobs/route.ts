import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPrintJobs, insertPrintJob, updatePrintJobStatus } from '@/lib/db';
import { PrinterDiscovery } from '@/lib/discovery';
import { printPdf } from '@/lib/printer';

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get('printer_session')?.value === 'authenticated';
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobs = getPrintJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Jobs GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const filename = file.name;
    if (!filename.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Get Printer IP
    const discovery = PrinterDiscovery.getInstance();
    const printerIp = discovery.getPrinterIp();

    if (!printerIp) {
      // Record failed print job in DB
      insertPrintJob(filename, pdfBuffer, 'Failed (Printer Offline)');
      return NextResponse.json({ error: 'Printer IP address not discovered. Ensure the printer is online.' }, { status: 503 });
    }

    // Insert job in DB as printing
    const jobId = insertPrintJob(filename, pdfBuffer, 'Printing...');

    try {
      // Send print command to printer
      await printPdf(printerIp, pdfBuffer, filename);
      updatePrintJobStatus(jobId, 'Success');
      return NextResponse.json({ success: true, jobId });
    } catch (printError: any) {
      console.error('Printing operation failed:', printError);
      updatePrintJobStatus(jobId, `Failed: ${printError.message || 'IPP Error'}`);
      return NextResponse.json({ error: `Printing failed: ${printError.message || 'IPP Error'}` }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Jobs POST Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
