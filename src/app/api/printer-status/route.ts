import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrinterDiscovery } from '@/lib/discovery';
import { isSetupCompleted } from '@/lib/db';

export async function GET() {
  try {
    // Require authentication if setup has already been completed
    if (isSetupCompleted()) {
      const cookieStore = await cookies();
      const isAuthenticated = cookieStore.get('printer_session')?.value === 'authenticated';
      if (!isAuthenticated) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const discovery = PrinterDiscovery.getInstance();
    return NextResponse.json({
      printerIp: discovery.getPrinterIp(),
      printerName: discovery.getTargetPrinterName(),
      discoveredPrinters: discovery.getDiscoveredPrinters(),
    });
  } catch (error) {
    console.error('Printer Status GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
