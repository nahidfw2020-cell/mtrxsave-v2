import fs from 'node:fs/promises';
import path from 'node:path';
import cron from 'node-cron';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

async function sweep() {
  const dir = config.tempDir;
  const cutoff = Date.now() - config.tempMaxAgeMinutes * 60 * 1000;
  let removed = 0;
  try {
    await fs.mkdir(dir, { recursive: true });
    const entries = await fs.readdir(dir);
    for (const name of entries) {
      const full = path.join(dir, name);
      try {
        const stat = await fs.stat(full);
        if (stat.mtimeMs < cutoff) {
          await fs.rm(full, { recursive: true, force: true });
          removed++;
        }
      } catch (e) {
        logger.warn({ name, err: e.message }, 'cleanup entry failed');
      }
    }
  } catch (e) {
    logger.warn({ err: e.message }, 'cleanup sweep failed');
  }
  if (removed) logger.info({ removed }, 'temp cleanup');
}

export function startCleanupCron() {
  cron.schedule('*/5 * * * *', sweep);
  sweep().catch(() => {});
}
