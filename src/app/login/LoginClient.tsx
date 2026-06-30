'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Lock, Delete, RefreshCw, AlertCircle } from 'lucide-react';

export default function LoginClient() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  // Auto-submit when the 4-digit PIN is fully entered
  useEffect(() => {
    if (pin.length === 4) {
      handleLogin(pin);
    }
  }, [pin]);

  const handleLogin = async (enteredPin: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });

      if (res.ok) {
        // Redirect and reload page state
        router.replace('/');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Incorrect PIN');
        setShake(true);
        setPin(''); // Reset PIN input
        setTimeout(() => setShake(false), 500);
      }
    } catch (err) {
      setError('Network error occurred');
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (loading) return;

    if (val === 'backspace') {
      setPin(prev => prev.slice(0, -1));
      setError('');
    } else if (val === 'clear') {
      setPin('');
      setError('');
    } else {
      if (pin.length < 4) {
        setPin(prev => prev + val);
        setError('');
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 overflow-hidden">
      {/* Background glow overlay */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />

      <div className={`w-full max-w-sm z-10 transition-all duration-300 ${shake ? 'animate-bounce' : ''}`}>
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-3 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white w-fit mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-100">Gateway Locked</CardTitle>
            <CardDescription className="text-slate-400">
              Enter the 4-digit security PIN to unlock the printing gateway.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex flex-col items-center">
            {error && (
              <div className="w-full p-2.5 rounded-lg bg-red-950/40 border border-red-900 text-red-400 text-[11px] flex items-center justify-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Input OTP Slots */}
            <div className="flex justify-center py-2 scale-110">
              <InputOTP
                maxLength={4}
                value={pin}
                readOnly
                disabled
              >
                <InputOTPGroup className="gap-2.5">
                  <InputOTPSlot index={0} className="w-12 h-14 bg-slate-950 border-slate-800 text-slate-100 text-xl font-bold rounded-xl" />
                  <InputOTPSlot index={1} className="w-12 h-14 bg-slate-950 border-slate-800 text-slate-100 text-xl font-bold rounded-xl" />
                  <InputOTPSlot index={2} className="w-12 h-14 bg-slate-950 border-slate-800 text-slate-100 text-xl font-bold rounded-xl" />
                  <InputOTPSlot index={3} className="w-12 h-14 bg-slate-950 border-slate-800 text-slate-100 text-xl font-bold rounded-xl" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold py-1">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Authenticating PIN...
              </div>
            )}

            {/* Dial Pad Numeric Keypad */}
            <div className="w-full max-w-[280px] grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={loading}
                  onClick={() => handleKeypadPress(num)}
                  className="h-12 rounded-xl bg-slate-950 border border-slate-850 hover:bg-slate-800 hover:border-slate-700 active:scale-95 text-slate-200 font-bold text-lg transition-all flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleKeypadPress('clear')}
                className="h-12 rounded-xl bg-slate-950/40 border border-slate-855 text-slate-400 hover:bg-red-950/30 hover:border-red-900/40 hover:text-red-400 active:scale-95 font-medium text-xs transition-all flex items-center justify-center cursor-pointer uppercase tracking-wider"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleKeypadPress('0')}
                className="h-12 rounded-xl bg-slate-950 border border-slate-850 hover:bg-slate-800 hover:border-slate-700 active:scale-95 text-slate-200 font-bold text-lg transition-all flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleKeypadPress('backspace')}
                className="h-12 rounded-xl bg-slate-950/40 border border-slate-855 text-slate-400 hover:bg-slate-800 hover:text-slate-100 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
          <CardFooter className="text-center justify-center pb-6">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">
              PRINTGATE v1.0 • SECURED GATEWAY
            </span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
