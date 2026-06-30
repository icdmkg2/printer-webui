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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Printer,
  Search,
  Lock,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Wifi,
  XCircle,
  Sparkles,
} from 'lucide-react';

interface DiscoveredPrinter {
  name: string;
  ip: string;
  port: number;
}

export default function SetupClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  
  // Step 1 states
  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);
  const [scanning, setScanning] = useState(true);
  const [selectedPrinter, setSelectedPrinter] = useState<DiscoveredPrinter | null>(null);
  const [customPrinterName, setCustomPrinterName] = useState('HP DeskJet 5275');
  const [customPrinterIp, setCustomPrinterIp] = useState('');
  const [isManualIp, setIsManualIp] = useState(false);
  const [networkInterfaces, setNetworkInterfaces] = useState<{ name: string; ip: string }[]>([]);

  // Step 2 states
  const [envPinConfigured, setEnvPinConfigured] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isConfirming, setIsConfirming] = useState(false); // Sub-step to confirm PIN

  // Global states
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch discovered printers
  const fetchStatus = async () => {
    try {
      setScanning(true);
      const res = await fetch('/api/setup');
      if (res.ok) {
        const data = await res.json();
        setDiscoveredPrinters(data.discoveredPrinters || []);
        setEnvPinConfigured(data.envPinConfigured || false);
        setNetworkInterfaces(data.networkInterfaces || []);

        // Auto-select HP DeskJet 5275 if found
        if (data.discoveredPrinters && data.discoveredPrinters.length > 0 && !selectedPrinter) {
          const hpPrinter = data.discoveredPrinters.find((p: DiscoveredPrinter) =>
            p.name.toLowerCase().includes('hp deskjet 5275') || p.name.toLowerCase().includes('hp')
          );
          if (hpPrinter) {
            setSelectedPrinter(hpPrinter);
          } else if (!isManualIp) {
            setSelectedPrinter(data.discoveredPrinters[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to scan network:', err);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 4 seconds during step 1
    let interval: NodeJS.Timeout;
    if (step === 1) {
      interval = setInterval(fetchStatus, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step]);

  // Keypad Actions
  const handleKeypadPress = (val: string) => {
    const activePin = isConfirming ? confirmPin : pin;
    const setActivePin = isConfirming ? setConfirmPin : setPin;

    if (val === 'backspace') {
      setActivePin(prev => prev.slice(0, -1));
      setPinError('');
    } else if (val === 'clear') {
      setActivePin('');
      setPinError('');
    } else {
      if (activePin.length < 4) {
        setActivePin(prev => prev + val);
        setPinError('');
      }
    }
  };

  // Next steps
  const handleStep1Next = () => {
    if (isManualIp) {
      if (!customPrinterName.trim()) {
        setError('Please enter a printer name');
        return;
      }
      if (!customPrinterIp.trim()) {
        setError('Please enter a printer IP address');
        return;
      }
      // Simple IP validation
      const ipPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
      if (!ipPattern.test(customPrinterIp.trim())) {
        setError('Please enter a valid IP address (e.g. 192.168.1.50)');
        return;
      }
    } else if (!selectedPrinter) {
      setError('Please select a printer or choose manual configuration');
      return;
    }
    setError('');
    
    if (envPinConfigured) {
      // Skip PIN step if already set in environment
      setStep(3);
    } else {
      setStep(2);
    }
  };

  const handleStep2Next = () => {
    if (!isConfirming) {
      if (pin.length !== 4) {
        setPinError('PIN must be exactly 4 digits');
        return;
      }
      setIsConfirming(true);
      setPinError('');
    } else {
      if (confirmPin.length !== 4) {
        setPinError('Confirmation PIN must be 4 digits');
        return;
      }
      if (pin !== confirmPin) {
        setPinError('PINs do not match. Try again.');
        setConfirmPin('');
        return;
      }
      setPinError('');
      setStep(3);
    }
  };

  const handleBackToStep1 = () => {
    if (isConfirming) {
      setIsConfirming(false);
      setConfirmPin('');
    } else {
      setStep(1);
    }
    setPinError('');
  };

  const handleSaveSetup = async () => {
    setSaving(true);
    setError('');
    
    const printerName = isManualIp ? customPrinterName : selectedPrinter?.name || 'HP DeskJet 5275';
    const printerIp = isManualIp ? customPrinterIp : selectedPrinter?.ip || '';

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName,
          printerIp,
          pin: envPinConfigured ? undefined : pin,
        }),
      });

      if (res.ok) {
        router.replace('/');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to complete setup');
      }
    } catch (err) {
      setError('Network error occurred during setup');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center py-12 px-4 overflow-hidden bg-slate-950">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8 flex flex-col items-center justify-center space-y-2">
          <div className="p-3 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white animate-pulse">
            <Printer className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            PrintGate Setup
          </h1>
          <p className="text-slate-400 text-sm">
            Self-hosted HP DeskJet 5275 Printing Gateway
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="flex items-center justify-between px-6 mb-6">
          <div className="flex items-center space-x-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step >= 1 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>1</span>
            <span className={`text-xs font-medium transition-colors ${step >= 1 ? 'text-indigo-400 font-semibold' : 'text-slate-500'}`}>Printer</span>
          </div>
          <div className="flex-1 h-[2px] mx-4 bg-slate-800 relative">
            <div className={`absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-500 ${step === 2 ? 'w-1/2' : step === 3 ? 'w-full' : 'w-0'}`} />
          </div>
          <div className="flex items-center space-x-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step >= 2 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>2</span>
            <span className={`text-xs font-medium transition-colors ${step >= 2 ? 'text-indigo-400 font-semibold' : 'text-slate-500'}`}>Security</span>
          </div>
          <div className="flex-1 h-[2px] mx-4 bg-slate-800 relative">
            <div className={`absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-500 ${step === 3 ? 'w-full' : 'w-0'}`} />
          </div>
          <div className="flex items-center space-x-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step >= 3 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>3</span>
            <span className={`text-xs font-medium transition-colors ${step >= 3 ? 'text-indigo-400 font-semibold' : 'text-slate-500'}`}>Finish</span>
          </div>
        </div>

        {/* STEP 1: PRINTER DISCOVERY */}
        {step === 1 && (
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-100">
                <Wifi className="w-5 h-5 text-indigo-400 animate-pulse" />
                Printer Discovery
              </CardTitle>
              <CardDescription className="text-slate-400">
                Scanning your local network for HP DeskJet 5275 (via mDNS IPP).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Mode Toggle */}
              <div className="flex bg-slate-950/80 p-1 rounded-lg border border-slate-800">
                <Button
                  type="button"
                  variant={!isManualIp ? 'secondary' : 'ghost'}
                  onClick={() => setIsManualIp(false)}
                  className={`flex-1 text-xs py-1.5 h-auto ${!isManualIp ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Search className="w-3.5 h-3.5 mr-2" />
                  Auto Scan
                </Button>
                <Button
                  type="button"
                  variant={isManualIp ? 'secondary' : 'ghost'}
                  onClick={() => setIsManualIp(true)}
                  className={`flex-1 text-xs py-1.5 h-auto ${isManualIp ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Printer className="w-3.5 h-3.5 mr-2" />
                  Manual IP
                </Button>
              </div>

              {!isManualIp ? (
                // Auto Scan Content
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>Discovered Devices ({discoveredPrinters.length})</span>
                    <div className="flex items-center gap-1.5">
                      {scanning && <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />}
                      <span className="text-slate-500">{scanning ? 'Scanning...' : 'Idle'}</span>
                    </div>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {discoveredPrinters.length === 0 ? (
                      <div className="py-8 text-center flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                        <div className="w-10 h-10 rounded-full border border-dashed border-slate-800 flex items-center justify-center mb-3 animate-spin duration-1000">
                          <RefreshCw className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="text-xs text-slate-500 font-medium">Searching subnet...</span>
                        
                        {networkInterfaces.length > 0 && (
                          <div className="mt-3 text-left w-full max-w-[280px] bg-slate-950/80 p-2.5 rounded-lg border border-slate-850/80">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Scanning Network Adapters:
                            </span>
                            <div className="space-y-0.5 max-h-[80px] overflow-y-auto font-mono text-[9px] text-slate-450">
                              {networkInterfaces.map(iface => (
                                <div key={iface.name} className="flex justify-between">
                                  <span className="text-indigo-400">{iface.name}:</span>
                                  <span>{iface.ip}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <span className="text-[10px] text-slate-500 mt-2.5 max-w-[280px] leading-relaxed">
                          Ensure the printer is online and on the same Wi-Fi network. If discovery fails, your router may be blocking multicast packets. Switch to the <strong>Manual IP</strong> tab above to configure it directly.
                        </span>
                      </div>
                    ) : (
                      discoveredPrinters.map((printer) => {
                        const isSelected = selectedPrinter?.name === printer.name;
                        const isHP = printer.name.toLowerCase().includes('hp deskjet 5275') || printer.name.toLowerCase().includes('5275');
                        return (
                          <div
                            key={printer.name}
                            onClick={() => setSelectedPrinter(printer)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-indigo-500/10 border-indigo-500 shadow-md shadow-indigo-500/5'
                                : 'bg-slate-950/40 border-slate-850 hover:border-slate-700 hover:bg-slate-950/80'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                                <Printer className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="text-xs font-semibold text-slate-200 line-clamp-1">{printer.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{printer.ip}:{printer.port}</span>
                              </div>
                            </div>
                            {isHP && (
                              <span className="text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                Match
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                // Manual IP Configuration
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">Printer Name / Model</label>
                    <Input
                      type="text"
                      placeholder="e.g. HP DeskJet 5275"
                      value={customPrinterName}
                      onChange={(e) => setCustomPrinterName(e.target.value)}
                      className="bg-slate-950/60 border-slate-800 focus-visible:ring-indigo-500 text-xs h-10 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">Printer IP Address</label>
                    <Input
                      type="text"
                      placeholder="e.g. 192.168.1.50"
                      value={customPrinterIp}
                      onChange={(e) => setCustomPrinterIp(e.target.value)}
                      className="bg-slate-950/60 border-slate-800 focus-visible:ring-indigo-500 text-xs h-10 text-slate-100"
                    />
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end pt-2">
              <Button
                onClick={handleStep1Next}
                className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-medium text-xs shadow-md shadow-indigo-500/10 px-6 py-5 rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
              >
                Continue Setup
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* STEP 2: SECURITY CONFIGURATION */}
        {step === 2 && (
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-100">
                <Lock className="w-5 h-5 text-indigo-400" />
                {isConfirming ? 'Confirm PIN Code' : 'Set Gateway Security PIN'}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {isConfirming
                  ? 'Re-enter your 4-digit PIN to verify it is correct.'
                  : 'Establish a 4-digit numeric code to protect the gateway access.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 flex flex-col items-center justify-center">
              {pinError && (
                <div className="w-full p-2.5 rounded-lg bg-red-950/40 border border-red-900 text-red-450 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              {/* Simple Standard Password/Numeric Input */}
              <div className="w-full max-w-[200px] py-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={isConfirming ? confirmPin : pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, ''); // numbers only
                    if (isConfirming) {
                      setConfirmPin(val);
                    } else {
                      setPin(val);
                    }
                    setPinError('');
                  }}
                  autoFocus
                  placeholder="••••"
                  className="bg-slate-950 border-slate-850 text-slate-100 text-3xl font-extrabold text-center h-14 tracking-[0.6em] pl-[0.6em] rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t border-slate-850/60 pt-4">
              <Button
                variant="ghost"
                onClick={handleBackToStep1}
                className="text-slate-450 hover:text-slate-200 hover:bg-slate-800 text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleStep2Next}
                disabled={(isConfirming ? confirmPin : pin).length !== 4}
                className="bg-indigo-500 hover:bg-indigo-650 text-white font-medium text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isConfirming ? 'Verify PIN' : 'Next Step'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* STEP 3: CONFIRM & COMPLETE */}
        {step === 3 && (
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-100">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Ready to Initialize
              </CardTitle>
              <CardDescription className="text-slate-400">
                Confirm your printer configuration to deploy the self-hosted gateway.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="rounded-xl border border-slate-800 bg-slate-950/65 divide-y divide-slate-850 overflow-hidden">
                {/* Printer Info */}
                <div className="p-4 flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 mt-0.5">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Printer Destination</span>
                    <span className="text-xs font-semibold text-slate-200 mt-0.5">
                      {isManualIp ? customPrinterName : selectedPrinter?.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      IP Address: {isManualIp ? customPrinterIp : selectedPrinter?.ip || 'Discovered dynamically'}
                    </span>
                  </div>
                </div>

                {/* Security Info */}
                <div className="p-4 flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 mt-0.5">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Access Protection</span>
                    <span className="text-xs font-semibold text-slate-200 mt-0.5">
                      {envPinConfigured ? 'Using Environment PIN (APP_PIN)' : '4-Digit Gateway PIN configured'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Session cookies will remain persistently cached locally.
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-950 bg-emerald-950/20 text-emerald-450 text-[11px] leading-relaxed flex gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <strong className="font-semibold text-emerald-350">Setup is ready.</strong> When you initialize, mDNS discovery singleton will monitor network presence of this printer name to route direct PDF print jobs.
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t border-slate-850/60 pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(envPinConfigured ? 1 : 2)}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleSaveSetup}
                disabled={saving}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-xs px-6 py-5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/20 active:scale-95"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
