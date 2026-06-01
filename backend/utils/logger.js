import pino from 'pino';
import { config } from '../config/index.js';

const transport = config.env === 'production'
  ? undefined
  : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } };

export const logger = pino({
  level: config.logLevel,
  base: { svc: 'mtrxsave' },
  transport,
});
