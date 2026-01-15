/**
 * Receipt Generator Service
 * Generates professional PDF receipts for patient payments
 */

import PDFDocument from 'pdfkit';
import { logger } from '../utils/logger.js';

class ReceiptGeneratorService {
  /**
   * Generate a receipt PDF for a payment
   * @param {Object} payment - Payment request data
   * @param {stream.Writable} outputStream - Stream to write PDF to
   * @returns {Promise<void>}
   */
  async generateReceipt(payment, outputStream) {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      // Pipe to output stream
      doc.pipe(outputStream);

      // Header - TSHLA Logo/Branding
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#2563eb')
         .text('TSHLA Medical', { align: 'center' });

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#6b7280')
         .text('Telemedicine & Healthcare Services', { align: 'center' })
         .moveDown(0.5);

      // Receipt Title
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#111827')
         .text('PAYMENT RECEIPT', { align: 'center' })
         .moveDown(1);

      // Receipt Number and Date
      const receiptNumber = payment.id.substring(0, 8).toUpperCase();
      const paidDate = payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'N/A';

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#6b7280')
         .text(`Receipt #: ${receiptNumber}`, { align: 'right' })
         .text(`Date: ${paidDate}`, { align: 'right' })
         .moveDown(1.5);

      // Horizontal line
      doc.strokeColor('#e5e7eb')
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(562, doc.y)
         .stroke()
         .moveDown(1);

      // Patient Information Section
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#111827')
         .text('PATIENT INFORMATION')
         .moveDown(0.5);

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#374151');

      const patientInfoY = doc.y;

      // Left column
      doc.text('Patient Name:', 50, patientInfoY)
         .text('TSHLA ID:', 50, patientInfoY + 15)
         .text('Phone:', 50, patientInfoY + 30);

      if (payment.athena_mrn) {
        doc.text('Medical Record #:', 50, patientInfoY + 45);
      }

      // Right column - values
      doc.font('Helvetica-Bold')
         .text(payment.patient_name, 150, patientInfoY)
         .text(payment.tshla_id, 150, patientInfoY + 15)
         .text(payment.patient_phone, 150, patientInfoY + 30);

      if (payment.athena_mrn) {
        doc.text(payment.athena_mrn, 150, patientInfoY + 45);
      }

      doc.moveDown(4);

      // Horizontal line
      doc.strokeColor('#e5e7eb')
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(562, doc.y)
         .stroke()
         .moveDown(1);

      // Service Information Section
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#111827')
         .text('SERVICE INFORMATION')
         .moveDown(0.5);

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#374151');

      const serviceInfoY = doc.y;

      // Left column
      doc.text('Provider:', 50, serviceInfoY)
         .text('Visit Date:', 50, serviceInfoY + 15)
         .text('Payment Type:', 50, serviceInfoY + 30);

      if (payment.em_code) {
        doc.text('E/M Code:', 50, serviceInfoY + 45);
      }

      // Right column - values
      const visitDate = new Date(payment.visit_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const paymentTypeLabel = payment.payment_type.charAt(0).toUpperCase() +
                               payment.payment_type.slice(1);

      doc.font('Helvetica-Bold')
         .text(payment.provider_name, 150, serviceInfoY)
         .text(visitDate, 150, serviceInfoY + 15)
         .text(paymentTypeLabel, 150, serviceInfoY + 30);

      if (payment.em_code) {
        doc.text(payment.em_code, 150, serviceInfoY + 45);
      }

      doc.moveDown(4);

      // Horizontal line
      doc.strokeColor('#e5e7eb')
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(562, doc.y)
         .stroke()
         .moveDown(1);

      // Payment Details Section
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#111827')
         .text('PAYMENT DETAILS')
         .moveDown(0.5);

      const paymentDetailsY = doc.y;

      // Table header
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .fillColor('#6b7280')
         .text('DESCRIPTION', 50, paymentDetailsY)
         .text('AMOUNT', 450, paymentDetailsY, { align: 'right' });

      doc.moveDown(0.5);

      // Table row
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#374151')
         .text(paymentTypeLabel, 50, doc.y)
         .font('Helvetica-Bold')
         .text(`$${(payment.amount_cents / 100).toFixed(2)}`, 450, doc.y, { align: 'right' });

      doc.moveDown(1);

      // Horizontal line
      doc.strokeColor('#e5e7eb')
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(562, doc.y)
         .stroke()
         .moveDown(0.5);

      // Total
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#111827')
         .text('TOTAL PAID:', 50, doc.y)
         .fillColor('#059669')
         .text(`$${(payment.amount_cents / 100).toFixed(2)}`, 450, doc.y, { align: 'right' });

      doc.moveDown(2);

      // Payment Method
      const paymentMethod = payment.stripe_payment_intent_id ? 'Credit/Debit Card' : 'Cash/Other';

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#6b7280')
         .text(`Payment Method: ${paymentMethod}`, { align: 'center' });

      if (payment.stripe_payment_intent_id) {
        const truncatedPI = payment.stripe_payment_intent_id.substring(0, 20) + '...';
        doc.text(`Transaction ID: ${truncatedPI}`, { align: 'center' });
      }

      doc.moveDown(3);

      // Footer
      doc.fontSize(8)
         .fillColor('#9ca3af')
         .text('This receipt is for your records. Please retain for tax and insurance purposes.',
               { align: 'center' })
         .moveDown(0.5)
         .text('For questions regarding this payment, please contact TSHLA Medical at (832) 400-3930',
               { align: 'center' })
         .moveDown(0.5)
         .text('Thank you for choosing TSHLA Medical for your healthcare needs.',
               { align: 'center', baseline: 'bottom' });

      // Add timestamp at bottom
      doc.moveDown(2)
         .fontSize(7)
         .fillColor('#d1d5db')
         .text(`Generated on ${new Date().toLocaleString('en-US')}`,
               { align: 'center' });

      // Finalize PDF
      doc.end();

      logger.info('ReceiptGenerator', 'Receipt generated successfully', {
        paymentId: payment.id,
        receiptNumber
      });

    } catch (error) {
      logger.error('ReceiptGenerator', 'Error generating receipt', {
        error: error.message,
        paymentId: payment?.id
      });
      throw error;
    }
  }

  /**
   * Get receipt filename for a payment
   * @param {Object} payment - Payment request data
   * @returns {string} Filename
   */
  getReceiptFilename(payment) {
    const receiptNumber = payment.id.substring(0, 8).toUpperCase();
    const date = payment.paid_at ?
      new Date(payment.paid_at).toISOString().split('T')[0] :
      new Date().toISOString().split('T')[0];
    const sanitizedName = payment.patient_name.replace(/[^a-zA-Z0-9]/g, '_');

    return `TSHLA_Receipt_${receiptNumber}_${sanitizedName}_${date}.pdf`;
  }
}

export default new ReceiptGeneratorService();
