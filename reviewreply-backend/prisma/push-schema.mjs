// push-schema.mjs — Execute migration SQL via Supabase HTTP endpoints
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, 'migration.sql'), 'utf-8');

const PROJECT_REF = 'owbvfbplipogpfiuosjw';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93YnZmYnBsaXBvZ3BmaXVvc2p3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIzNTkxOCwiZXhwIjoyMDg3ODExOTE4fQ.GXc-9q439EAD2QqEnLBjRcIA9uQT6aeSA9QZ03GxvnY';
const BASE = `https://${PROJECT_REF}.supabase.co`;

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Try multiple known Supabase SQL execution endpoints
const endpoints = [
  { path: '/pg/query', body: { query: sql } },
  { path: '/pg', body: { query: sql } },
  { path: '/rest/v1/rpc/query', body: { sql_query: sql } },
];

async function tryEndpoint(ep) {
  try {
    const res = await fetch(`${BASE}${ep.path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(ep.body),
    });
    const text = await res.text();
    return { path: ep.path, status: res.status, body: text.substring(0, 300) };
  } catch (e) {
    return { path: ep.path, error: e.message };
  }
}

console.log('Testing HTTP endpoints for SQL execution...\n');
const results = await Promise.all(endpoints.map(tryEndpoint));
results.forEach(r => {
  console.log(`${r.path} -> ${r.status || 'ERROR'}`);
  console.log(`  ${r.body || r.error}\n`);
});

// Also try Supabase Management API
try {
  const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const mgmtText = await mgmtRes.text();
  console.log(`Management API -> ${mgmtRes.status}`);
  console.log(`  ${mgmtText.substring(0, 300)}\n`);
} catch (e) {
  console.log(`Management API -> ERROR: ${e.message}\n`);
}
