import PDFDocument from 'pdfkit';
import { env } from '../config/env';
import type { PaymentMethod } from '../models/Payment';
import { formatINR } from '../utils/money';
import { METHOD_LABELS } from './payment.service';

export interface ReceiptData {
  receiptNumber: string;
  transactionId: string;
  paidAt: Date;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  balanceAfter: number;
  student: { fullName: string; studentId: string; course: string; batch: string };
  parentName?: string;
  fee: { title: string; amount: number; dueDate: Date };
  recordedBy?: string;
}

const fmt = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** Renders a single-page A4 PDF receipt and resolves with the bytes. */
export function renderReceiptPdf(r: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Receipt ${r.receiptNumber}`, Author: env.INSTITUTE_NAME } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const indigo = '#4338ca';
    const muted = '#64748b';
    const W = doc.page.width - 100;

    doc.rect(0, 0, doc.page.width, 110).fill(indigo);
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(env.INSTITUTE_NAME, 50, 38);
    doc.fontSize(10).font('Helvetica').text('Fee Payment Receipt', 50, 68);
    doc.fontSize(10).text(r.receiptNumber, 50, 38, { width: W, align: 'right' });
    doc.text(fmt(r.paidAt), 50, 54, { width: W, align: 'right' });

    let y = 140;
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('Received from', 50, y);
    doc.text('Student details', 320, y);
    y += 18;
    doc.font('Helvetica').fillColor('#334155').fontSize(10);
    doc.text(r.parentName ?? r.student.fullName, 50, y);
    doc.text(`${r.student.fullName} (${r.student.studentId})`, 320, y);
    doc.text(`${r.student.course} · ${r.student.batch}`, 320, y + 15);

    y += 55;
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#e2e8f0').stroke();
    y += 15;

    const row = (label: string, value: string, bold = false) => {
      doc.font('Helvetica').fillColor(muted).fontSize(10).text(label, 50, y);
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a').text(value, 250, y, { width: W - 200, align: 'right' });
      y += 22;
    };
    row('Fee', r.fee.title);
    row('Fee amount', formatINR(r.fee.amount));
    row('Due date', fmt(r.fee.dueDate));
    row('Payment method', METHOD_LABELS[r.method]);
    if (r.reference) row('Reference', r.reference);
    row('Transaction ID', r.transactionId);
    row('Payment date', fmt(r.paidAt));

    y += 6;
    doc.roundedRect(50, y, W, 64, 8).fill('#eef2ff');
    doc.fillColor(indigo).font('Helvetica-Bold').fontSize(12).text('Amount paid', 70, y + 14);
    doc.fontSize(20).text(formatINR(r.amount), 50, y + 12, { width: W - 20, align: 'right' });
    doc.fillColor(muted).font('Helvetica').fontSize(10).text(
      r.balanceAfter === 0 ? 'This fee is fully paid.' : `Balance remaining on this fee: ${formatINR(r.balanceAfter)}`,
      70,
      y + 40,
    );
    y += 90;

    doc.fillColor(muted).fontSize(9).font('Helvetica').text(
      'This payment was recorded manually by institute staff. Online payments shown on this receipt were not processed or verified through a payment gateway by this system.',
      50,
      y,
      { width: W },
    );
    y += 40;
    if (r.recordedBy) doc.text(`Recorded by: ${r.recordedBy}`, 50, y);
    doc.text('This is a computer-generated receipt and does not require a signature.', 50, doc.page.height - 80, { width: W, align: 'center' });
    doc.end();
  });
}
