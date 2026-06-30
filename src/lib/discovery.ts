import { Bonjour } from 'bonjour-service';
import { getSetting } from './db';

export interface DiscoveredPrinter {
  name: string;
  ip: string;
  port: number;
}

export class PrinterDiscovery {
  private static instance: PrinterDiscovery;
  private bonjour: Bonjour | null = null;
  private discoveredPrinters: Map<string, DiscoveredPrinter> = new Map();
  private printerIp: string | null = null;
  private printerName: string;

  private constructor() {
    this.printerName = process.env.PRINTER_NAME || 'HP DeskJet 5275';
    this.printerIp = process.env.PRINTER_FALLBACK_IP || null;
    this.startDiscovery();
  }

  public static getInstance(): PrinterDiscovery {
    if (!globalThis.printerDiscoveryInstance) {
      globalThis.printerDiscoveryInstance = new PrinterDiscovery();
    }
    return globalThis.printerDiscoveryInstance;
  }

  private startDiscovery() {
    try {
      console.log('Bonjour: Initializing discovery...');
      this.bonjour = new Bonjour();
      const browser = this.bonjour.find({ type: 'ipp' });

      browser.on('up', (service) => {
        console.log('Bonjour: IPP service up:', service.name, service.addresses, service.port);
        if (service.addresses && service.addresses.length > 0) {
          // Prefer IPv4 address
          const ipv4 = service.addresses.find(addr => !addr.includes(':')) || service.addresses[0];
          const printer: DiscoveredPrinter = {
            name: service.name,
            ip: ipv4,
            port: service.port,
          };
          this.discoveredPrinters.set(service.name, printer);

          // Check if it matches the target printer name
          const targetName = getSetting('printer_name') || this.printerName;
          if (service.name.toLowerCase().includes(targetName.toLowerCase())) {
            this.printerIp = ipv4;
            console.log(`Bonjour: Match found! Printer "${targetName}" is at ${this.printerIp}`);
          }
        }
      });

      browser.on('down', (service) => {
        console.log('Bonjour: IPP service down:', service.name);
        this.discoveredPrinters.delete(service.name);
        
        const targetName = getSetting('printer_name') || this.printerName;
        if (service.name.toLowerCase().includes(targetName.toLowerCase())) {
          // We keep the last known IP as fallback so printing doesn't break
          // if mDNS misses a heartbeat, but we log the status.
          console.log(`Bonjour: Printer "${targetName}" marked as offline via mDNS, keeping last known IP ${this.printerIp} as fallback.`);
        }
      });
    } catch (error) {
      console.error('Bonjour: Error starting discovery:', error);
    }
  }

  public getPrinterIp(): string | null {
    // Check if there is a configured IP in settings (saved by setup wizard)
    const configuredIp = getSetting('printer_ip');
    if (configuredIp) {
      return configuredIp;
    }
    return this.printerIp;
  }

  public getDiscoveredPrinters(): DiscoveredPrinter[] {
    return Array.from(this.discoveredPrinters.values());
  }

  public getTargetPrinterName(): string {
    return getSetting('printer_name') || this.printerName;
  }
}

// Global declaration to prevent duplicate instances during Next.js hot reloads
declare global {
  var printerDiscoveryInstance: PrinterDiscovery | undefined;
}
