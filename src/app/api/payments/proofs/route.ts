import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseId, requireRole } from '@/lib/authz';
import {
  buildPaymentProofPath,
  deletePaymentProof,
  getPaymentProofMaxBytes,
  uploadPaymentProof,
} from '@/lib/payment-proof-storage';
import { submitPaymentProofSchema } from '@/features/invoices/invoices.validation';

const ALLOWED_PROOF_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function decimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;

  try {
    const session = await requireRole(['TENANT']);
    const formData = await request.formData();
    const proofFile = formData.get('proofFile');

    const parsed = submitPaymentProofSchema.safeParse({
      invoiceId: formData.get('invoiceId'),
      paidAmount: formData.get('paidAmount'),
      paymentMethod: formData.get('paymentMethod'),
      transferReference: formData.get('transferReference') || '',
      paymentNote: formData.get('paymentNote') || '',
    });

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        errors: parsed.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    if (!(proofFile instanceof File) || proofFile.size === 0) {
      return jsonError('Payment proof file is required');
    }

    if (!ALLOWED_PROOF_TYPES.has(proofFile.type)) {
      return jsonError('Proof file must be a PDF, JPG, PNG, or WEBP file');
    }

    if (proofFile.size > getPaymentProofMaxBytes()) {
      return jsonError('Proof file is too large');
    }

    const tenantId = parseId(session.userId);
    const invoiceId = parseId(parsed.data.invoiceId);
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        lease: {
          tenantId,
        },
      },
      include: {
        payments: {
          select: {
            paidAmount: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (!invoice) {
      return jsonError('Invoice not found', 404);
    }

    const pendingPayment = invoice.payments.find(
      (payment) => payment.verificationStatus === 'PENDING'
    );
    if (pendingPayment) {
      return jsonError('This invoice already has a payment waiting for review');
    }

    const verifiedPaidTotal = invoice.payments
      .filter((payment) => payment.verificationStatus === 'VERIFIED')
      .reduce((sum, payment) => sum.plus(payment.paidAmount), decimal(0));
    const remainingBalance = invoice.totalAmount.minus(verifiedPaidTotal);

    if (remainingBalance.lte(0) || invoice.status === 'PAID') {
      return jsonError('This invoice is already paid');
    }

    const paidAmount = decimal(parsed.data.paidAmount);
    if (paidAmount.gt(remainingBalance)) {
      return jsonError('Payment amount cannot exceed the remaining invoice balance');
    }

    uploadedPath = buildPaymentProofPath({
      invoiceId: invoice.id.toString(),
      tenantId: tenantId.toString(),
      fileName: proofFile.name || 'payment-proof',
    });

    await uploadPaymentProof({ path: uploadedPath, file: proofFile });

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          payerId: tenantId,
          paymentMethod: parsed.data.paymentMethod,
          transferReference: parsed.data.transferReference || null,
          paidAmount,
          paymentProofPath: uploadedPath,
          paymentNote: parsed.data.paymentNote || null,
          verificationStatus: 'PENDING',
        },
        select: { id: true },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'PENDING_REVIEW' },
      });

      return created;
    });

    uploadedPath = null;

    return NextResponse.json({
      success: true,
      message: 'Payment proof submitted',
      data: { paymentId: payment.id.toString() },
    });
  } catch (error) {
    if (uploadedPath) {
      try {
        await deletePaymentProof(uploadedPath);
      } catch (cleanupError) {
        console.error('Failed to clean uploaded payment proof', cleanupError);
      }
    }

    if (error instanceof Error) {
      if (error.message === 'UNAUTHORIZED') {
        return jsonError('Unauthorized', 401);
      }

      if (error.message === 'FORBIDDEN') {
        return jsonError('Forbidden', 403);
      }

      if (error.message === 'SUPABASE_STORAGE_NOT_CONFIGURED') {
        return jsonError('Payment proof storage is not configured', 500);
      }
    }

    console.error('submit payment proof error:', error);
    return jsonError('Failed to submit payment proof', 500);
  }
}
