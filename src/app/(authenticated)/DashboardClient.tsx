'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Printer,
  LogOut,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  RefreshCcw,
  Sparkles,
  Lock,
} from 'lucide-react';

interface PrintJob {
  id: number;
  filename: string;
  timestamp: string;
  status: string;
}

interface DashboardClientProps {
  initialJobs: PrintJob[];
  initialPrinterIp: string | null;
  initialPrinterName: string;
}

export default function DashboardClient({
  initialJobs,
  initialPrinterIp,
  initialPrinterName,
}: DashboardClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Printer states
  const [printerIp, setPrinterIp] = useState<string | null>(initialPrinterIp);
  const [printerName, setPrinterName] = useState(initialPrinterName);
  
  // Job states
  const [jobs, setJobs] = useState<PrintJob[]>(initialJobs);
  const [pollingJobs, setPollingJobs] = useState(false);

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Action states
  const [reprintingId, setReprintingId] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Password protected PDF states
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [savePassword, setSavePassword] = useState(true);
  const [pwdError, setPwdError] = useState('');

  const getSavedPasswords = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('printgate_pdf_passwords');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const savePasswordToList = (pwd: string) => {
    if (!pwd) return;
    try {
      const current = getSavedPasswords();
      if (!current.includes(pwd)) {
        const updated = [pwd, ...current].slice(0, 10); // store last 10 passwords
        localStorage.setItem('printgate_pdf_passwords', JSON.stringify(updated));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const maskPassword = (pwd: string): string => {
    if (pwd.length <= 2) return '••';
    return `${pwd.slice(0, 2)}•••`;
  };

  // Fetch jobs list
  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch print jobs:', err);
    }
  };

  // Fetch printer connection status
  const fetchPrinterStatus = async () => {
    try {
      const res = await fetch('/api/printer-status');
      if (res.ok) {
        const data = await res.json();
        setPrinterIp(data.printerIp);
        setPrinterName(data.printerName);
      }
    } catch (err) {
      console.error('Failed to fetch printer status:', err);
    }
  };

  // Poll printer status and job logs
  useEffect(() => {
    const interval = setInterval(() => {
      setPollingJobs(true);
      Promise.all([fetchJobs(), fetchPrinterStatus()]).finally(() => {
        setPollingJobs(false);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Logout Handler
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch('/api/auth', { method: 'DELETE' });
      if (res.ok) {
        router.replace('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to log out:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  // Drag-and-drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setSelectedFile(file);
        setErrorMsg('');
        setSuccessMsg('');
      } else {
        setErrorMsg('Only PDF files are supported for direct printing.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  // Print Submission Handler
  const handlePrintSubmit = async (overridePassword?: string) => {
    if (!selectedFile) return;
    setPrinting(true);
    setErrorMsg('');
    setSuccessMsg('');
    setPwdError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    if (overridePassword) {
      formData.append('password', overridePassword);
    }

    const savedPasswords = getSavedPasswords();
    formData.append('passwords', JSON.stringify(savedPasswords));

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('Document successfully transmitted to printer!');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setPasswordModalOpen(false);
        setPdfPassword('');

        if (overridePassword && savePassword) {
          savePasswordToList(overridePassword);
        } else if (data.workingPasswordUsed && savePassword) {
          savePasswordToList(data.workingPasswordUsed);
        }

        fetchJobs();
      } else {
        if (data.error === 'password_required') {
          setPasswordModalOpen(true);
          if (overridePassword) {
            setPwdError('Incorrect PDF password. Please try again.');
          }
        } else {
          setErrorMsg(data.error || 'transmitting document failed.');
        }
      }
    } catch (err) {
      setErrorMsg('Network error occurred while submitting print job.');
      console.error(err);
    } finally {
      setPrinting(false);
    }
  };

  // Re-print Handler
  const handleReprint = async (jobId: number) => {
    setReprintingId(jobId);
    try {
      const res = await fetch('/api/jobs/reprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (res.ok) {
        fetchJobs();
      } else {
        const data = await res.json();
        alert(data.error || 'Re-printing failed');
      }
    } catch (err) {
      console.error('Network error during reprint:', err);
    } finally {
      setReprintingId(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col">
      {/* Background glow animations */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />

      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-900 bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-550/20">
              <Printer className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                PrintGate Gateway
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              </span>
              <span className="text-[10px] text-slate-500 font-medium">HP DeskJet 5275 Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Status Badge */}
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${printerIp ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${printerIp ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                {printerIp ? (
                  <>Online <span className="font-mono text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-355 ml-1">{printerIp}</span></>
                ) : (
                  `Searching network for "${printerName}"...`
                )}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 sm:hidden">
                {printerIp ? 'Online' : 'Offline'}
              </span>
            </div>

            <Button
              variant="ghost"
              disabled={loggingOut}
              onClick={handleLogout}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-850 h-9 px-3 rounded-lg text-xs flex items-center gap-1.5"
            >
              {loggingOut ? 'Logging out...' : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* COLUMN 1: UPLOAD ZONE (SPAN 5) */}
          <section className="lg:col-span-5 space-y-6">
            <Card className="border-slate-900 bg-slate-900/50 backdrop-blur-xl shadow-xl h-fit">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  Print Queue
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Upload standard PDF documents to transmit directly to the HP DeskJet printer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-lg bg-red-950/40 border border-red-900 text-red-400 text-xs flex items-center gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
                    dragActive
                      ? 'border-indigo-500 bg-indigo-500/5 shadow-inner'
                      : 'border-slate-800 bg-slate-950/30 hover:border-slate-700 hover:bg-slate-950/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="p-3 bg-slate-950 border border-slate-850 text-slate-400 rounded-xl mb-4 shadow-md group-hover:scale-105 transition-all">
                    <FileText className="w-6 h-6 text-indigo-455" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">
                    {selectedFile ? selectedFile.name : 'Choose a file or drag it here'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">
                    {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 'Only PDF documents accepted'}
                  </span>
                </div>

                {/* Print Button */}
                <Button
                  onClick={() => handlePrintSubmit()}
                  disabled={!selectedFile || printing}
                  className="w-full bg-gradient-to-r from-indigo-500 to-violet-650 hover:from-indigo-600 hover:to-violet-750 text-white font-semibold text-xs py-5 rounded-xl shadow-lg shadow-indigo-500/10 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {printing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Transmitting file...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      Print Document
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* COLUMN 2: PRINT LOGS TABLE (SPAN 7) */}
          <section className="lg:col-span-7">
            <Card className="border-slate-900 bg-slate-900/50 backdrop-blur-xl shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Printer className="w-4 h-4 text-indigo-400" />
                    Print Log History
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Persistent sqlite logs of previous print transmissions.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                  {pollingJobs && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-650" />}
                  <span>AUTO-SYNC</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-b-xl border-t border-slate-900 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-950/70">
                      <TableRow className="border-slate-900">
                        <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-6">Filename</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Timestamp</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="bg-slate-900/10">
                      {jobs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-48 text-center text-xs text-slate-550 pl-6 pr-6">
                            No print jobs in database history. Upload a PDF above to print.
                          </TableCell>
                        </TableRow>
                      ) : (
                        jobs.map((job) => {
                          const isReprinting = reprintingId === job.id;
                          const isSuccess = job.status === 'Success';
                          const isFailed = job.status.startsWith('Failed');
                          const isPrinting = job.status === 'Printing...';

                          return (
                            <TableRow key={job.id} className="border-slate-900/80 hover:bg-slate-900/40">
                              {/* Filename */}
                              <TableCell className="font-medium text-xs text-slate-200 pl-6 max-w-[200px] truncate">
                                <div className="flex flex-col">
                                  <span className="font-semibold line-clamp-1">{job.filename}</span>
                                  <span className="text-[9px] text-slate-500 sm:hidden mt-0.5 font-mono">{job.timestamp}</span>
                                </div>
                              </TableCell>
                              {/* Timestamp */}
                              <TableCell className="text-xs text-slate-400 font-mono hidden sm:table-cell">
                                {job.timestamp}
                              </TableCell>
                              {/* Status */}
                              <TableCell>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isSuccess
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : isFailed
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                    : isPrinting
                                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}>
                                  {job.status}
                                </span>
                              </TableCell>
                              {/* Reprint Action */}
                              <TableCell className="text-right pr-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isReprinting || printing || !printerIp}
                                  onClick={() => handleReprint(job.id)}
                                  className="h-8 w-8 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/5 rounded-lg active:scale-95 disabled:opacity-30 border border-transparent hover:border-indigo-500/10 cursor-pointer"
                                  title={!printerIp ? 'Printer offline' : 'Re-print document'}
                                >
                                  {isReprinting ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCcw className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>

        </div>
      </main>

      {/* Password Protected PDF Decryption Modal */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm border border-slate-800 bg-slate-900/90 rounded-2xl p-6 shadow-2xl scale-95 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              Password Protected PDF
            </h3>
            <p className="text-xs text-slate-450 mb-4">
              &quot;{selectedFile?.name}&quot; requires a password to unlock and rasterize.
            </p>

            {pwdError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-950/40 border border-red-905 text-red-405 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{pwdError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
                  PDF Password
                </label>
                <Input
                  type="password"
                  placeholder="Enter file password"
                  value={pdfPassword}
                  onChange={(e) => {
                    setPdfPassword(e.target.value);
                    setPwdError('');
                  }}
                  autoFocus
                  className="bg-slate-950 border-slate-850 text-slate-100 text-sm h-10 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="save-pdf-pwd"
                  checked={savePassword}
                  onChange={(e) => setSavePassword(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-955 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-3.5 h-3.5 cursor-pointer accent-indigo-500"
                />
                <label htmlFor="save-pdf-pwd" className="text-xs text-slate-300 select-none cursor-pointer">
                  Save password for easy access
                </label>
              </div>

              {/* Saved Passwords Quick Select */}
              {getSavedPasswords().length > 0 && (
                <div className="border-t border-slate-850/60 pt-3 mt-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Or select a saved password:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto custom-scrollbar">
                    {getSavedPasswords().map((savedPwd, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPdfPassword(savedPwd);
                          setPwdError('');
                        }}
                        className="text-[10px] px-2 py-1 rounded-md bg-slate-950 border border-slate-850 hover:bg-slate-800 hover:border-slate-700 text-slate-300 font-mono transition-all max-w-[120px] truncate cursor-pointer"
                        title="Click to use this password"
                      >
                        {maskPassword(savedPwd)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPasswordModalOpen(false);
                    setPdfPassword('');
                    setPwdError('');
                  }}
                  className="flex-1 border-slate-800 hover:bg-slate-800 text-slate-200 text-xs h-10 rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handlePrintSubmit(pdfPassword)}
                  disabled={printing || !pdfPassword}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-10 rounded-xl cursor-pointer shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {printing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Unlocking...
                    </>
                  ) : (
                    <>Unlock &amp; Print</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
