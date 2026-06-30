import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAppPin } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin || pin.length !== 4) {
      return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 });
    }

    const correctPin = getAppPin();

    if (!correctPin) {
      return NextResponse.json({ error: 'Application is not configured' }, { status: 400 });
    }

    if (pin === correctPin) {
      // Set session cookie
      const cookieStore = await cookies();
      cookieStore.set('printer_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
  } catch (error) {
    console.error('Auth API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('printer_session');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
