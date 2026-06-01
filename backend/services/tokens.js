import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { Errors } from '../utils/errors.js';

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function fromB64url(s) {
  return Buffer.from(s, 'base64url');
}

export function signToken(payload, ttlSeconds = config.tokenTtl) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const json = JSON.stringify(body);
  const data = b64url(json);
  const sig = b64url(
    crypto.createHmac('sha256', config.tokenSecret).update(data).digest()
  );
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) {
    throw Errors.tokenInvalid('Malformed token');
  }
  const [data, sig] = token.split('.');
  const expected = b64url(
    crypto.createHmac('sha256', config.tokenSecret).update(data).digest()
  );
  const a = fromB64url(sig);
  const b = fromB64url(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw Errors.tokenInvalid();
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(data).toString('utf8'));
  } catch {
    throw Errors.tokenInvalid('Token payload unreadable');
  }
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw Errors.tokenExpired();
  }
  return payload;
}
