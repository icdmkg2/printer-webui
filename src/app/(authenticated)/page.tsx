import { getPrintJobs } from '@/lib/db';
import { PrinterDiscovery } from '@/lib/discovery';
import DashboardClient from './DashboardClient';

// Disable caching for this route so print job lists and status are always fresh
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Retrieve history log and printer info server-side
  const initialJobs = getPrintJobs();
  const discovery = PrinterDiscovery.getInstance();
  const printerIp = discovery.getPrinterIp();
  const printerName = discovery.getTargetPrinterName();

  return (
    <DashboardClient
      initialJobs={initialJobs}
      initialPrinterIp={printerIp}
      initialPrinterName={printerName}
    />
  );
}
