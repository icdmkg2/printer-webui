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
import { Input } from '@/components/ui/input';
import { Lock, RefreshCw, AlertCircle } from 'lucide-react';

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

            {/* Simple Standard Password/Numeric Input */}
            <div className="w-full max-w-[200px] py-2">
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, ''); // numbers only
                  setPin(val);
                  setError('');
                }}
                disabled={loading}
                autoFocus
                placeholder="••••"
                className="bg-slate-950 border-slate-850 text-slate-100 text-3xl font-extrabold text-center h-14 tracking-[0.6em] pl-[0.6em] rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
              />
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold py-1">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Authenticating PIN...
              </div>
            )}
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
