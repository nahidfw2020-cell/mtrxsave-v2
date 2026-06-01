import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError('NOT_FOUND', 404, `Route not found: ${req.method} ${req.path}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const isApp = err instanceof AppError;
  const status = isApp ? err.status : 500;
  const code = isApp ? err.code : 'INTERNAL';
  const message = isApp ? err.message : 'Internal error';

  const log = logger.child({ reqId: req.id, code, status, path: req.path });
  if (status >= 500) log.error({ err: err.stack || err.message }, 'request failed');
  else log.warn({ msg: err.message }, 'request rejected');

  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(status).json({ error: { code, message } });
}
