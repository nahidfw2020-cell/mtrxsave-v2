import { randomUUID } from 'node:crypto';

export function requestId(req, res, next) {
  const hdr = req.get('x-request-id');
  req.id = hdr && hdr.length < 64 ? hdr : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
