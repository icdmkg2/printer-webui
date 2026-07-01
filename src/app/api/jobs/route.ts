import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPrintJobs, insertPrintJob, updatePrintJobStatus } from '@/lib/db';
import { PrinterDiscovery } from '@/lib/discovery';
import { printPdf, checkPdfSecurity, decryptPdf } from '@/lib/printer';

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
    let pdfBuffer: any = Buffer.from(arrayBuffer);

    // 1. PDF Security Verification
    const password = formData.get('password') as string | null;
    const passwordsJson = formData.get('passwords') as string | null;

    let workingPassword: string | undefined;
    let isEncrypted = false;
    let isUnlocked = false;

    // Check with the single password first (if provided)
    if (password) {
      const security = checkPdfSecurity(pdfBuffer, password);
      isEncrypted = security.encrypted;
      if (security.unlocked) {
        isUnlocked = true;
        workingPassword = password;
      }
    } else {
      // Check if the PDF is encrypted at all
      const security = checkPdfSecurity(pdfBuffer);
      isEncrypted = security.encrypted;
      isUnlocked = security.unlocked;
    }

    // Try list of saved passwords if encrypted and not unlocked yet
    if (isEncrypted && !isUnlocked && passwordsJson) {
      try {
        const savedPasswords: string[] = JSON.parse(passwordsJson);
        if (Array.isArray(savedPasswords)) {
          for (const pwd of savedPasswords) {
            if (!pwd) continue;
            const security = checkPdfSecurity(pdfBuffer, pwd);
            if (security.unlocked) {
              isUnlocked = true;
              workingPassword = pwd;
              break;
            }
          }
        }
      } catch (err) {
        console.error('Error parsing saved passwords:', err);
      }
    }

    // Ask for password if encrypted and not unlocked
    if (isEncrypted && !isUnlocked) {
      return NextResponse.json({
        error: 'password_required',
        message: password ? 'Incorrect PDF password' : 'This PDF file is password protected',
      }, { status: 400 });
    }

    // Decrypt if unlocked
    if (isEncrypted && workingPassword) {
      try {
        pdfBuffer = await decryptPdf(pdfBuffer, workingPassword);
        console.log(`IPP: Decrypted password-protected PDF "${filename}" successfully.`);
      } catch (decErr: any) {
        return NextResponse.json({ error: `Decryption failed: ${decErr.message}` }, { status: 400 });
      }
    }

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
      return NextResponse.json({ success: true, jobId, workingPasswordUsed: workingPassword });
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
