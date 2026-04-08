import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { xml2js } from 'xml-js';
import { TCreatedPdf } from 'pdfmake/build/pdfmake';
import { generateFA1 } from '../lib-public/FA1-generator';
import { generateFA2 } from '../lib-public/FA2-generator';
import { generateFA3 } from '../lib-public/FA3-generator';
import { generateFARR } from '../lib-public/FARR-generator';
import { Faktura as Faktura1 } from '../lib-public/types/fa1.types';
import { Faktura as Faktura2 } from '../lib-public/types/fa2.types';
import { Faktura as Faktura3 } from '../lib-public/types/fa3.types';
import { FaRR } from '../lib-public/types/FaRR.types';
import { AdditionalDataTypes } from '../lib-public/types/common.types';
import { stripPrefix } from '../shared/XML-parser';

const PORT = parseInt(process.env.PORT || '3000', 10);
const INVOICES_DIR = process.env.INVOICES_DIR || '/faktury';

function parseXMLString(xmlStr: string): unknown {
  return xml2js(xmlStr, {
    compact: true,
    cdataKey: '_text',
    trim: true,
    elementNameFn: stripPrefix,
    attributeNameFn: stripPrefix,
  });
}

function generatePdfBuffer(xml: any, nrKSeF: string): Promise<Buffer> {
  const wersja = xml?.Faktura?.Naglowek?.KodFormularza?._attributes?.kodSystemowy;
  const additionalData: AdditionalDataTypes = { nrKSeF, isMobile: false };

  let pdf: TCreatedPdf;

  switch (wersja) {
    case 'FA (1)':
      pdf = generateFA1(xml.Faktura as Faktura1, additionalData);
      break;
    case 'FA (2)':
      pdf = generateFA2(xml.Faktura as Faktura2, additionalData);
      break;
    case 'FA (3)':
      pdf = generateFA3(xml.Faktura as Faktura3, additionalData);
      break;
    case 'FA_RR (1)':
    case 'FA_RR(1)':
      pdf = generateFARR(xml.Faktura as FaRR, additionalData);
      break;
    default:
      return Promise.reject(new Error(`Unsupported invoice version: ${wersja}`));
  }

  return new Promise((resolve, reject) => {
    pdf.getBuffer((buffer: Buffer) => {
      if (buffer) {
        resolve(buffer);
      } else {
        reject(new Error('Failed to generate PDF buffer'));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  const ksefNumber = req.url?.replace(/^\//, '').replace(/\/$/, '');

  if (!ksefNumber || ksefNumber.includes('/') || ksefNumber.includes('..')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  const xmlPath = path.join(INVOICES_DIR, `${ksefNumber}.xml`);

  if (!fs.existsSync(xmlPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Invoice not found: ${ksefNumber}`);
    return;
  }

  try {
    const xmlStr = fs.readFileSync(xmlPath, 'utf-8');
    const xml = parseXMLString(xmlStr);
    const pdfBuffer = await generatePdfBuffer(xml, ksefNumber);

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${ksefNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (err: any) {
    console.error(`Error generating PDF for ${ksefNumber}:`, err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Internal Server Error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`KSeF PDF server listening on port ${PORT}`);
  console.log(`Invoices directory: ${INVOICES_DIR}`);
});
