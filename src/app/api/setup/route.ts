import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import os from 'os';
import { isSetupCompleted, setSetting } from '@/lib/db';
import { PrinterDiscovery } from '@/lib/discovery';

export async function GET() {
  try {
    const discovery = PrinterDiscovery.getInstance();
    
    // Scan local network interfaces (IPv4, non-internal)
    const interfaces = os.networkInterfaces();
    const networkInterfaces: { name: string; ip: string }[] = [];
    for (const [name, info] of Object.entries(interfaces)) {
      if (!info) continue;
      for (const addr of info) {
        if (addr.family === 'IPv4' && !addr.internal) {
          networkInterfaces.push({ name, ip: addr.address });
        }
      }
    }

    return NextResponse.json({
      setupCompleted: isSetupCompleted(),
      discoveredPrinters: discovery.getDiscoveredPrinters(),
      envPinConfigured: !!process.env.APP_PIN,
      networkInterfaces,
    });
  } catch (error) {
    console.error('Setup GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const setupCompleted = isSetupCompleted();
    const cookieStore = await cookies();
    const isAuthenticated = cookieStore.get('printer_session')?.value === 'authenticated';

    // Lock setup if it's already done and the user is not authenticated
    if (setupCompleted && !isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized. Setup is already completed.' }, { status: 401 });
    }

    const { printerName, printerIp, pin } = await request.json();

    if (!printerName) {
      return NextResponse.json({ error: 'Printer name is required' }, { status: 400 });
    }

    // Save printer config to settings DB
    setSetting('printer_name', printerName);
    if (printerIp) {
      setSetting('printer_ip', printerIp);
    } else {
      // Remove custom IP setting to fall back to Bonjour dynamic discovery
      setSetting('printer_ip', '');
    }

    // If APP_PIN environment variable is NOT set, save the custom PIN in the DB
    if (!process.env.APP_PIN) {
      if (!pin || pin.length !== 4 || isNaN(Number(pin))) {
        return NextResponse.json({ error: 'A 4-digit PIN is required' }, { status: 400 });
      }
      setSetting('app_pin', pin);
    }

    // Mark setup as complete in DB
    setSetting('setup_completed', 'true');

    // Log the user in directly on the NextResponse response
    const response = NextResponse.json({ success: true });
    response.cookies.set('printer_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Setup POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
