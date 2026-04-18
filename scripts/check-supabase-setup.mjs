import 'dotenv/config';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PAYMENT_PROOFS_BUCKET',
];

function maskHost(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return 'invalid-url';
  }
}

function withPgSslCompat(rawUrl) {
  if (!rawUrl) return rawUrl;

  if (rawUrl.includes('sslmode=require')) {
    return rawUrl.replace('sslmode=require', 'sslmode=require&uselibpqcompat=true');
  }

  const joiner = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${joiner}sslmode=require&uselibpqcompat=true`;
}

async function checkPostgres(label, rawUrl) {
  if (!rawUrl) {
    console.log(`❌ ${label}: missing`);
    return false;
  }

  const pool = new Pool({
    connectionString: withPgSslCompat(rawUrl),
    connectionTimeoutMillis: 10_000,
  });

  try {
    const result = await pool.query(`
      select
        current_database() as database,
        current_schema() as schema,
        now() as checked_at
    `);

    console.log(`✅ ${label}: connected`);
    console.log(`   host: ${maskHost(rawUrl)}`);
    console.log(`   database: ${result.rows[0].database}`);
    console.log(`   schema: ${result.rows[0].schema}`);
    return true;
  } catch (error) {
    console.log(`❌ ${label}: failed`);
    console.log(`   host: ${maskHost(rawUrl)}`);
    console.log(`   error: ${error.code || error.name} ${error.message}`);
    return false;
  } finally {
    await pool.end().catch(() => {});
  }
}

async function checkSupabaseStorage() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = process.env.SUPABASE_PAYMENT_PROOFS_BUCKET || 'payment-proofs';

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('❌ Supabase Storage: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return false;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      console.log('❌ Supabase Storage: failed');
      console.log(`   error: ${error.message}`);
      return false;
    }

    console.log('✅ Supabase Storage: connected');

    const bucket = data.find((item) => item.name === bucketName);

    if (!bucket) {
      console.log(`⚠️  Bucket "${bucketName}" does not exist yet`);
      return false;
    }

    console.log(`✅ Bucket "${bucketName}": exists`);
    console.log(`   public: ${bucket.public ? 'yes' : 'no/private'}`);

    return true;
  } catch (error) {
    console.log('❌ Supabase Storage: failed');
    console.log(`   error: ${error.name} ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Checking .env keys...\n');

  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.log('❌ Missing env keys:');
    for (const key of missing) {
      console.log(`   - ${key}`);
    }
    console.log('');
  } else {
    console.log('✅ All required env keys are present\n');
  }

  console.log('Checking database connections...\n');

  const pooledOk = await checkPostgres('DATABASE_URL pooled connection', process.env.DATABASE_URL);
  console.log('');
  const directOk = await checkPostgres('DIRECT_URL direct connection', process.env.DIRECT_URL);

  console.log('\nChecking Supabase Storage...\n');

  const storageOk = await checkSupabaseStorage();

  console.log('\nSummary');
  console.log(`DATABASE_URL: ${pooledOk ? 'OK' : 'FAILED'}`);
  console.log(`DIRECT_URL: ${directOk ? 'OK' : 'FAILED'}`);
  console.log(`Storage: ${storageOk ? 'OK' : 'FAILED / NEEDS SETUP'}`);

  if (!pooledOk || !storageOk || missing.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected setup check failure:', error);
  process.exit(1);
});
