'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const handler = require('../src/server');

test('login audits after authorization; refresh does not create login events', async t => {
  const old = { fetch: global.fetch, principal: process.env.PRINCIPAL_URL, supabase: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY };
  process.env.PRINCIPAL_URL = 'https://principal.invalid';
  process.env.SUPABASE_URL = 'https://supabase.invalid';
  process.env.SUPABASE_ANON_KEY = 'test-anon';
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const calls = [];
  let auditFails = false;
  global.fetch = async (url, options = {}) => {
    if (String(url).startsWith(base)) return old.fetch(url, options);
    calls.push({ url: String(url), options });
    if (String(url).startsWith('https://supabase.invalid')) return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 });
    if (String(url).includes('/audit-login/')) return auditFails ? Response.json({ error: 'Auditoria indisponível' }, { status: 503 }) : Response.json({ message: 'ok' }, { status: 201 });
    if (String(url).includes('/contexto/')) return Response.json({});
    throw Error('Unexpected mocked route: ' + url);
  };
  t.after(async () => {
    global.fetch = old.fetch;
    for (const [key, value] of [['PRINCIPAL_URL', old.principal], ['SUPABASE_URL', old.supabase], ['SUPABASE_ANON_KEY', old.anon]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await new Promise(resolve => server.close(resolve));
  });
  const request = action => old.fetch(base + '/api/mobile/' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@example.test', password: 'test', refresh_token: 'refresh' })
  });
  assert.equal((await request('login')).status, 200);
  const context=calls.find(call=>call.url.includes('/contexto/'));
  assert.equal(new URL(context.url).searchParams.get('resumo'), '1');
  const audit = calls.find(call => call.url.includes('/audit-login/'));
  assert.equal(audit.options.headers.Authorization, 'Bearer access');
  assert.equal((await request('refresh')).status, 200);
  assert.equal(calls.filter(call => call.url.includes('/audit-login/')).length, 1);
  auditFails = true;
  assert.equal((await request('login')).status, 503);
});
