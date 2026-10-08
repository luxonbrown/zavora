/**
 * Client/server contract check.
 *
 * Extracts every path the client services call and compares it against the
 * route table Express actually registers. This exists because a client calling
 * an endpoint the server does not serve fails only at runtime, in the browser,
 * on one route — which is how `/categories/:slug/products` slipped through
 * earlier (the server filters `/products?category=` instead).
 *
 * Usage: node test/contract.js
 */
const fs = require('fs');
const path = require('path');

const CLIENT_SERVICES = path.join(__dirname, '..', '..', 'client', 'src', 'services');

/** Paths are literals, or template strings whose params get substituted later. */
function clientEndpoints() {
  const found = [];
  for (const file of fs.readdirSync(CLIENT_SERVICES)) {
    if (!file.endsWith('.js')) continue;
    const raw = fs.readFileSync(path.join(CLIENT_SERVICES, file), 'utf8');
    // Ignore commented-out examples (e.g. the future-AI hookup sketch in
    // chat.js) — they are not live endpoints. Service files contain no URLs
    // with `//`, so line-comment stripping cannot corrupt a real path.
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^\S])\/\/.*$/gm, '$1');

    const literal = /api\.(?:get|post|patch|put|delete)\(\s*[`']([^`']+)[`']/g;
    let m;
    while ((m = literal.exec(src)) !== null) {
      found.push({ file, method: null, path: m[1] });
    }

    const withMethod = /api\.(get|post|patch|put|delete)\(\s*[`']([^`']+)[`']/g;
    while ((m = withMethod.exec(src)) !== null) {
      const existing = found.find((f) => f.file === file && f.path === m[2]);
      if (existing) existing.method = m[1].toUpperCase();
    }
  }
  return found;
}

/**
 * Recover a mounted router's path from its layer.
 *
 * Express 4 exposes no mount path directly; it is encoded in the layer's regexp,
 * which looks like `^\/api\/products\/?(?=\/|$)`. Express 5 added `layer.matchers`.
 */
function mountPath(layer) {
  if (Array.isArray(layer.matchers) && typeof layer.matchers[0] === 'string') {
    return layer.matchers[0];
  }
  const src = layer.regexp?.source;
  if (!src) return '';
  return src
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)/g, '') // drop the optional trailing slash
    .replace(/\\\//g, '/')
    .replace(/\\(.)/g, '$1');
}

/** Walk the Express router stack to recover registered method+path pairs. */
function serverRoutes(app) {
  const routes = [];
  const walk = (stack, prefix) => {
    for (const layer of stack) {
      if (layer.route) {
        const full = `${prefix}${layer.route.path}`.replace(/\/+/g, '/') || '/';
        for (const method of Object.keys(layer.route.methods)) {
          if (method === '_all') continue;
          routes.push({ method: method.toUpperCase(), path: full });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        walk(layer.handle.stack, `${prefix}${mountPath(layer)}`);
      }
    }
  };
  walk(app._router.stack, '');
  return routes;
}

/** `/api/addresses/` and `/api/addresses` are the same route to Express. */
const trimSlash = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';

/** Turn `/cart/items/:itemId` into a regex that also matches a concrete path. */
function routeMatches(routePath, requestPath) {
  const pattern = trimSlash(routePath)
    .split('/')
    .map((seg) => {
      if (!seg) return '';
      if (seg === '*') return '.*';
      if (seg.startsWith(':')) return '[^/]+';
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${pattern || '/'}/?$`).test(requestPath);
}

function main() {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const app = require('../app');
  const routes = serverRoutes(app);
  const endpoints = clientEndpoints();

  // A parametrised client path is checked against the shape of the server path
  // by replacing each `:param` with a placeholder token.
  const shapeOf = (p) =>
    p
      .split('/')
      .map((seg) => (seg.startsWith(':') ? ':param' : seg.startsWith('${') ? ':param' : seg))
      .join('/');

  const routeShapes = routes.map((r) => ({ ...r, shape: shapeOf(r.path) }));
  const problems = [];

  console.log(`server routes registered: ${routes.length}`);
  console.log(`client endpoints found:   ${endpoints.length}\n`);

  const seen = new Set();
  for (const ep of endpoints) {
    const shape = shapeOf(ep.path);
    const key = `${ep.method ?? 'ANY'} ${shape}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // The client's baseURL already includes /api.
    const full = trimSlash(`/api${shape.startsWith('/') ? shape : `/${shape}`}`);
    const match = routeShapes.find((r) => trimSlash(r.shape) === full || routeMatches(r.path, shape));
    if (!match) {
      problems.push(`${ep.file}: ${ep.method ?? 'ANY'} ${full} — no matching server route`);
    }
  }

  if (problems.length) {
    console.log('Mismatches:');
    for (const p of problems) console.log(`  - ${p}`);
    console.log(`\n${problems.length} client endpoint(s) do not match a server route.`);
    process.exit(1);
  }

  console.log('Every client endpoint matches a registered server route.');
  console.log('\nRegistered routes:');
  for (const r of routes.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`  ${r.method.padEnd(6)} ${r.path}`);
  }
}

main();