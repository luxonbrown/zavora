/**
 * Run a CJ catalogue sync from the command line.
 *
 * Useful because a full Phase A run is ~60 sequential requests at CJ's
 * 1 request/second limit — around a minute, or longer with variant enrichment.
 * That is a poor fit for an HTTP request, so the admin endpoint kicks the sync
 * off in the background while this runs it in the foreground with live output.
 *
 * Usage:
 *   npm run cj:sync                 # default: 60 pages x 100, 25 variant fetches
 *   npm run cj:sync -- --pages=2    # quick smoke run
 *   npm run cj:sync -- --variants=0 # list import only, no variant calls
 */

const config = require('../config');
const sync = require('../services/cj/sync');
const tokenStore = require('../services/cj/token');
const { closePool } = require('../database/pool');

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.split('=')[1]);
  return Number.isFinite(value) ? value : fallback;
}

async function main() {
  const maxPages = arg('pages', config.cj.maxPages);
  const variants = arg('variants', config.cj.maxVariantFetchesPerRun);

  const originalVariants = config.cj.maxVariantFetchesPerRun;
  config.cj.maxVariantFetchesPerRun = variants;

  console.log('CJ catalogue sync');
  console.log(`  pages            : up to ${maxPages} x ${config.cj.pageSize} products`);
  console.log(`  variant fetches  : ${variants}`);
  console.log(`  request spacing  : ${config.cj.minRequestIntervalMs}ms (CJ allows 1/sec)`);

  const status = await tokenStore.status();
  if (!status.configured) {
    console.error('\nCJ apiKey is not configured. Set cj.apiKey in server/config.js.');
    process.exit(1);
  }
  if (!status.hasToken || status.expired) {
    console.log('  authenticating...');
  } else {
    console.log(`  authenticated    : openId ${status.openId}, token valid until ${status.expiresAt}`);
  }

  const started = Date.now();
  const result = await sync.runSync({ maxPages });

  console.log('\nResults');
  console.log(`  status        : ${result.status}`);
  console.log(`  pages fetched : ${result.pagesFetched}`);
  console.log(`  products seen : ${result.seen}`);
  console.log(`  created       : ${result.created}`);
  console.log(`  updated       : ${result.updated}`);
  console.log(`  unchanged     : ${result.skipped}`);
  console.log(`  failed        : ${result.failed}`);
  console.log(`  variants      : ${result.variants || 0}`);
  console.log(`  elapsed       : ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  run id        : ${result.runId}`);
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`\nSync failed: ${err.message}`);
    if (err.cjCode) console.error(`CJ code: ${err.cjCode}  requestId: ${err.requestId}`);
    await closePool().catch(() => {});
    process.exit(1);
  });