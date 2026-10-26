// Eterna · serviço de comunicação (e-mail).
// Gera e confere o código de acesso do login e envia pelo Microsoft 365 (Graph, app-only com certificado),
// saindo da caixa MAIL_FROM. Sem dependências: Node 22.
//
// POST /auth/codigo    { email }          → envia o código (202)
// POST /auth/verificar { email, codigo }  → { ok, token, exp } ou 401
// GET  /healthz
import http from 'node:http';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

const cfg = {
  port: Number(process.env.PORT || 8090),
  tenantId: process.env.GRAPH_TENANT_ID,
  clientId: process.env.GRAPH_CLIENT_ID,
  certPath: process.env.GRAPH_CERT_PATH || '/run/segredos/graph.crt',
  keyPath: process.env.GRAPH_KEY_PATH || '/run/segredos/graph.key',
  from: process.env.MAIL_FROM || 'ti@maracatour.com.br',
  nomeRemetente: process.env.MAIL_NOME || 'Viva Maracanã',
  mode: process.env.MAIL_MODE || 'graph', // graph | log
  segredo: process.env.APP_SECRET || crypto.randomBytes(32).toString('hex'),
  origens: (process.env.CORS_ORIGENS || 'https://eterna.photo,https://www.eterna.photo,http://127.0.0.1:8765,http://localhost:8765').split(',').map(s => s.trim()),
};

const VALIDADE_MS = 10 * 60e3;
const TENTATIVAS = 5;
const SESSAO_MS = 12 * 3600e3;

// ---------- Graph ----------
const cert = cfg.mode === 'graph' ? { certPem: readFileSync(cfg.certPath, 'utf8'), keyPem: readFileSync(cfg.keyPath, 'utf8') } : null;
let tokenCache = null;

function assercao() {
  const b64u = b => Buffer.from(b).toString('base64url');
  const x5t = b64u(new crypto.X509Certificate(cert.certPem).fingerprint.split(':').map(h => parseInt(h, 16)));
  const s = Math.floor(Date.now() / 1000);
  const cab = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', x5t }));
  const corpo = b64u(JSON.stringify({ aud: `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, iss: cfg.clientId, sub: cfg.clientId, jti: crypto.randomUUID(), nbf: s - 60, iat: s, exp: s + 600 }));
  return `${cab}.${corpo}.${crypto.sign('RSA-SHA256', Buffer.from(`${cab}.${corpo}`), cert.keyPem).toString('base64url')}`;
}

async function tokenGraph() {
  if (tokenCache && tokenCache.exp > Date.now() + 60e3) return tokenCache.valor;
  const r = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials', client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: assercao() }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`token Graph: ${j.error_description || j.error}`);
  tokenCache = { valor: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tokenCache.valor;
}

async function enviar({ para, assunto, html }) {
  if (cfg.mode === 'log') { console.log(JSON.stringify({ t: new Date().toISOString(), ev: 'email-log', para, assunto })); return; }
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.from)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await tokenGraph()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { subject: assunto, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: para } }] }, saveToSentItems: false }),
  });
  if (r.status !== 202) throw new Error(`sendMail HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

// ---------- códigos e limites (memória; reiniciar o serviço invalida códigos pendentes) ----------
const codigos = new Map();   // email → { hash, exp, tentativas }
const pedidos = new Map();   // chave → [timestamps]

function limite(chave, max, janelaMs) {
  const agora = Date.now();
  const lista = (pedidos.get(chave) || []).filter(t => agora - t < janelaMs);
  if (lista.length >= max) { pedidos.set(chave, lista); return false; }
  lista.push(agora); pedidos.set(chave, lista); return true;
}

const hash = (email, codigo) => crypto.createHmac('sha256', cfg.segredo).update(`${email}:${codigo}`).digest('hex');
const emailOk = e => typeof e === 'string' && e.length <= 254 && /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(e);

function tokenSessao(email) {
  const exp = Date.now() + SESSAO_MS;
  const corpo = Buffer.from(JSON.stringify({ email, exp })).toString('base64url');
  return { token: `${corpo}.${crypto.createHmac('sha256', cfg.segredo).update(corpo).digest('base64url')}`, exp };
}

setInterval(() => {
  const agora = Date.now();
  for (const [k, v] of codigos) if (v.exp < agora) codigos.delete(k);
  for (const [k, v] of pedidos) if (!v.some(t => agora - t < 3600e3)) pedidos.delete(k);
}, 60e3).unref();

function emailHtml(codigo) {
  const c = `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0C2340">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#134078;height:6px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#134078;font-weight:700">${cfg.nomeRemetente} · Fotos</td></tr>
<tr><td style="padding:0 28px;font-size:15px;line-height:1.5">Use o código abaixo para entrar. Ele vale por 10 minutos e só funciona uma vez.</td></tr>
<tr><td style="padding:22px 28px;font-size:34px;font-weight:700;letter-spacing:6px;color:#134078">${c}</td></tr>
<tr><td style="padding:0 28px 28px;font-size:12px;color:#5b6573">Se você não pediu este código, ignore este e-mail.</td></tr>
</table></td></tr></table></body></html>`;
}

// ---------- HTTP ----------
function ipDe(req) { return String(req.headers['x-real-ip'] || req.socket.remoteAddress || ''); }

function responder(res, status, corpo, origem) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origem && cfg.origens.includes(origem)) Object.assign(h, { 'Access-Control-Allow-Origin': origem, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
  res.writeHead(status, h); res.end(corpo === undefined ? '' : JSON.stringify(corpo));
}

async function lerJson(req) {
  let t = '';
  for await (const p of req) { t += p; if (t.length > 4096) throw new Error('grande'); }
  return JSON.parse(t || '{}');
}

const servidor = http.createServer(async (req, res) => {
  const origem = req.headers.origin;
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/healthz') return responder(res, 200, { ok: true });
    if (req.method === 'OPTIONS') return responder(res, 204, undefined, origem);
    if (req.method !== 'POST') return responder(res, 404, { erro: 'nao-encontrado' }, origem);
    if (origem && !cfg.origens.includes(origem)) return responder(res, 403, { erro: 'origem' });
    const corpo = await lerJson(req);
    const email = String(corpo.email || '').trim().toLowerCase();
    if (!emailOk(email)) return responder(res, 400, { erro: 'email-invalido' }, origem);

    if (url.pathname === '/auth/codigo') {
      const ip = ipDe(req);
      if (!limite(`m1:${email}`, 1, 30e3) || !limite(`mh:${email}`, 6, 3600e3)) return responder(res, 429, { erro: 'aguarde' }, origem);
      if (!limite(`ip:${ip}`, 30, 3600e3) || !limite('global', 400, 3600e3)) return responder(res, 429, { erro: 'aguarde' }, origem);
      const codigo = String(crypto.randomInt(100000, 1000000));
      await enviar({ para: email, assunto: `Seu código de acesso · ${cfg.nomeRemetente}`, html: emailHtml(codigo) });
      codigos.set(email, { hash: hash(email, codigo), exp: Date.now() + VALIDADE_MS, tentativas: 0 });
      console.log(JSON.stringify({ t: new Date().toISOString(), ev: 'codigo-enviado', dominio: email.split('@')[1] }));
      return responder(res, 202, { ok: true, validadeMin: VALIDADE_MS / 60e3 }, origem);
    }

    if (url.pathname === '/auth/verificar') {
      const codigo = String(corpo.codigo || '').replace(/\D/g, '');
      const c = codigos.get(email);
      if (!c || c.exp < Date.now()) { codigos.delete(email); return responder(res, 401, { erro: 'expirado' }, origem); }
      c.tentativas++;
      const ok = codigo.length === 6 && crypto.timingSafeEqual(Buffer.from(c.hash), Buffer.from(hash(email, codigo)));
      if (!ok) {
        if (c.tentativas >= TENTATIVAS) { codigos.delete(email); return responder(res, 401, { erro: 'expirado' }, origem); }
        return responder(res, 401, { erro: 'incorreto', restantes: TENTATIVAS - c.tentativas }, origem);
      }
      codigos.delete(email);
      return responder(res, 200, { ok: true, ...tokenSessao(email) }, origem);
    }

    return responder(res, 404, { erro: 'nao-encontrado' }, origem);
  } catch (e) {
    console.error(JSON.stringify({ t: new Date().toISOString(), ev: 'erro', rota: url.pathname, msg: String(e.message).slice(0, 300) }));
    return responder(res, e instanceof SyntaxError || e.message === 'grande' ? 400 : 502, { erro: 'falha-envio' }, origem);
  }
});

servidor.listen(cfg.port, () => console.log(`eterna-email ouvindo em :${cfg.port} · modo ${cfg.mode} · remetente ${cfg.from}`));
