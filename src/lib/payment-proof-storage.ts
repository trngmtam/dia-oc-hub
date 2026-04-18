import 'server-only';

import { createClient } from '@supabase/supabase-js';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 10;

function getSupabaseStorageClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getPaymentProofBucket() {
  const bucket = process.env.SUPABASE_PAYMENT_PROOFS_BUCKET || 'payment-proofs';
  return bucket;
}

export function getPaymentProofMaxBytes() {
  const configured = Number(process.env.PAYMENT_PROOF_MAX_MB || 5);
  const maxMb = Number.isFinite(configured) && configured > 0 ? configured : 5;
  return maxMb * 1024 * 1024;
}

export function buildPaymentProofPath({
  invoiceId,
  tenantId,
  fileName,
}: {
  invoiceId: string;
  tenantId: string;
  fileName: string;
}) {
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : 'bin';
  const safeExtension = extension && /^[a-z0-9]+$/.test(extension) ? extension : 'bin';
  const unique = `${Date.now()}-${crypto.randomUUID()}`;
  return `invoices/${invoiceId}/tenant-${tenantId}/${unique}.${safeExtension}`;
}

export async function uploadPaymentProof({
  path,
  file,
}: {
  path: string;
  file: File;
}) {
  const supabase = getSupabaseStorageClient();
  const { error } = await supabase.storage
    .from(getPaymentProofBucket())
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (error) {
    throw new Error(`PAYMENT_PROOF_UPLOAD_FAILED:${error.message}`);
  }

  return path;
}

export async function deletePaymentProof(path: string) {
  const supabase = getSupabaseStorageClient();
  await supabase.storage.from(getPaymentProofBucket()).remove([path]);
}

export async function createPaymentProofSignedUrl(
  path: string,
  expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS
) {
  const supabase = getSupabaseStorageClient();
  const { data, error } = await supabase.storage
    .from(getPaymentProofBucket())
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error('PAYMENT_PROOF_SIGNED_URL_FAILED');
  }

  return data.signedUrl;
}
