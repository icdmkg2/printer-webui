import { Bonjour } from 'bonjour-service';
import os from 'os';
import net from 'net';
import ipp from 'ipp';
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
    
    // Start passive mDNS Bonjour discovery
    this.startBonjourDiscovery();
    
    // Start active subnet IPP scanner
    this.runActiveSubnetScan();
    
    // Poll the active scan every 30 seconds to monitor dynamic changes
    setInterval(() => {
      this.runActiveSubnetScan();
    }, 30000);
  }

  public static getInstance(): PrinterDiscovery {
    if (!globalThis.printerDiscoveryInstance) {
      globalThis.printerDiscoveryInstance = new PrinterDiscovery();
    }
    return globalThis.printerDiscoveryInstance;
  }

  /**
   * Method 1: Passive mDNS/Bonjour discovery (Standard)
   */
  private startBonjourDiscovery() {
    try {
      console.log('Bonjour: Initializing discovery...');
      this.bonjour = new Bonjour();
      const browser = this.bonjour.find({ type: 'ipp' });

      browser.on('up', (service) => {
        console.log('Bonjour: IPP service up:', service.name, service.addresses, service.port);
        if (service.addresses && service.addresses.length > 0) {
          const ipv4 = service.addresses.find(addr => !addr.includes(':')) || service.addresses[0];
          const printer: DiscoveredPrinter = {
            name: service.name,
            ip: ipv4,
            port: service.port,
          };
          this.discoveredPrinters.set(service.name, printer);

          // Check if matches target printer name
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
          console.log(`Bonjour: Printer "${targetName}" marked offline via mDNS, maintaining last known IP ${this.printerIp} as fallback.`);
        }
      });
    } catch (error) {
      console.error('Bonjour: Error starting discovery:', error);
    }
  }

  /**
   * Method 2: Active Subnet IPP Port 631 Scanner (Fallback / Router multicast block bypass)
   */
  private async runActiveSubnetScan() {
    try {
      console.log('ActiveScan: Starting IPP subnet scan...');
      const localIps = this.getLocalIps();

      for (const localIp of localIps) {
        const ipParts = localIp.split('.');
        if (ipParts.length !== 4) continue;
        const subnetPrefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
        
        console.log(`ActiveScan: Scanning subnet ${subnetPrefix}.0/24 on port 631...`);
        
        const targetIps: string[] = [];
        for (let i = 1; i <= 254; i++) {
          targetIps.push(`${subnetPrefix}.${i}`);
        }

        // Scan in batches of 30 parallel socket probes to prevent OS resource exhaustion
        const batchSize = 30;
        for (let i = 0; i < targetIps.length; i += batchSize) {
          const batch = targetIps.slice(i, i + batchSize);
          await Promise.all(batch.map(async (ip) => {
            const isIppOpen = await this.checkIppPort(ip);
            if (isIppOpen) {
              console.log(`ActiveScan: Port 631 is open on ${ip}. Querying printer attributes...`);
              const printerName = await this.queryPrinterName(ip);
              
              if (printerName) {
                console.log(`ActiveScan: Discovered printer "${printerName}" at ${ip}`);
                const printer: DiscoveredPrinter = {
                  name: printerName,
                  ip: ip,
                  port: 631,
                };
                this.discoveredPrinters.set(printerName, printer);

                // Check if it matches target printer name
                const targetName = getSetting('printer_name') || this.printerName;
                if (printerName.toLowerCase().includes(targetName.toLowerCase())) {
                  this.printerIp = ip;
                  console.log(`ActiveScan: Target match found! Printer "${targetName}" bound to IP ${this.printerIp}`);
                }
              } else {
                // Device listening on port 631 but did not respond to IPP Get-Printer-Attributes
                const genericName = `Generic IPP Printer (${ip})`;
                this.discoveredPrinters.set(genericName, {
                  name: genericName,
                  ip: ip,
                  port: 631,
                });
              }
            }
          }));
        }
      }
      console.log('ActiveScan: Finished subnet scan cycle.');
    } catch (error) {
      console.error('ActiveScan: Error during subnet scan:', error);
    }
  }

  private getLocalIps(): string[] {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const [name, info] of Object.entries(interfaces)) {
      if (!info) continue;
      for (const addr of info) {
        if (addr.family === 'IPv4' && !addr.internal) {
          ips.push(addr.address);
        }
      }
    }
    return ips;
  }

  private async checkIppPort(ip: string): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(600); // 600ms timeout for rapid checking

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(631, ip);
    });
  }

  private async queryPrinterName(ip: string): Promise<string | null> {
    return new Promise((resolve) => {
      const printerUrl = `http://${ip}:631/ipp/print`;
      const printer = new ipp.Printer(printerUrl) as any;

      const msg = {
        'operation-attributes-tag': {
          'requesting-user-name': 'Printer-Gateway',
          'requested-attributes': ['printer-name', 'printer-make-and-model'],
        },
      };

      printer.execute('Get-Printer-Attributes' as any, msg as any, (err: any, res: any) => {
        if (err) {
          // Fallback check: try querying without requested-attributes
          printer.execute('Get-Printer-Attributes' as any, {
            'operation-attributes-tag': {
              'requesting-user-name': 'Printer-Gateway'
            }
          } as any, (err2: any, res2: any) => {
            if (err2) {
              resolve(null);
            } else {
              const tags = res2?.['printer-attributes-tag'];
              resolve(tags?.['printer-name'] || tags?.['printer-make-and-model'] || null);
            }
          });
        } else {
          const tags = res?.['printer-attributes-tag'];
          const name = tags?.['printer-name'] || tags?.['printer-make-and-model'] || null;
          resolve(name);
        }
      });
    });
  }

  public getPrinterIp(): string | null {
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

declare global {
  var printerDiscoveryInstance: PrinterDiscovery | undefined;
}
