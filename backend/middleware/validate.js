import { ZodError } from 'zod';
import { Errors } from '../utils/errors.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(Errors.invalidUrl(err.issues[0]?.message || 'Invalid request body'));
      } else {
        next(err);
      }
    }
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    try {
      req.validatedQuery = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(Errors.invalidUrl(err.issues[0]?.message || 'Invalid query'));
      } else {
        next(err);
      }
    }
  };
}
