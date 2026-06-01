import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../config/index.js';
import { Errors } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

puppeteerExtra.use(StealthPlugin());

let browserPromise = null;
let activePages = 0;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteerExtra.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--no-zygote',
      ],
    }).catch((e) => {
      browserPromise = null;
      logger.error({ err: e.message }, 'puppeteer launch failed');
      throw Errors.extractionFailed(`Puppeteer launch failed: ${e.message}`);
    });
  }
  return browserPromise;
}

export async function withPage(fn, { timeoutMs = 25000 } = {}) {
  if (activePages >= config.maxConcurrentPuppeteer) {
    throw Errors.busy('Puppeteer pool exhausted');
  }
  activePages++;
  let page = null;
  let timer = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });
    return await Promise.race([
      fn(page),
      new Promise((_, rej) => { timer = setTimeout(() => rej(Errors.extractionFailed('Puppeteer timeout')), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (page) page.close().catch(() => {});
    activePages = Math.max(0, activePages - 1);
  }
}

export async function shutdownPuppeteer() {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {}
  browserPromise = null;
}
