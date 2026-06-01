export class AppError extends Error {
  constructor(code, status, message, cause) {
    super(message);
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

export const Errors = {
  invalidUrl: (msg = 'Invalid URL') => new AppError('INVALID_URL', 400, msg),
  unsupportedPlatform: (msg = 'Unsupported platform') => new AppError('UNSUPPORTED_PLATFORM', 400, msg),
  contentUnavailable: (msg = 'Content unavailable') => new AppError('CONTENT_UNAVAILABLE', 404, msg),
  rateLimited: (msg = 'Too many requests') => new AppError('RATE_LIMITED', 429, msg),
  extractionFailed: (msg = 'Extraction failed', cause) => new AppError('EXTRACTION_FAILED', 502, msg, cause),
  tokenInvalid: (msg = 'Invalid token') => new AppError('TOKEN_INVALID', 401, msg),
  tokenExpired: (msg = 'Token expired') => new AppError('TOKEN_EXPIRED', 410, msg),
  notFound: (msg = 'Not found') => new AppError('NOT_FOUND', 404, msg),
  internal: (msg = 'Internal error', cause) => new AppError('INTERNAL', 500, msg, cause),
  busy: (msg = 'Server busy') => new AppError('BUSY', 503, msg),
};
