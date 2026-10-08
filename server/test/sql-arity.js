/**
 * Static check: every INSERT in the server must bind exactly one value per
 * placeholder. A mismatch is silent-ish (the driver accepts it, the data lands
 * in the wrong column), so it is worth asserting mechanically.
 *
 * Usage: node test/sql-arity.js
 */
const fs = require('fs');
const path = require('path');

const FILES = [
  'controllers/auth.js',
  'controllers/cart.js',
  'controllers/addresses.js',
  'controllers/orders.js',
  'controllers/checkout.js',
  'controllers/wishlist.js',
  'controllers/account.js',
  'controllers/admin.insights.js',
  'database/seed.js',
];

let problems = 0;

/** Split a JS call's arguments at the top level, respecting nesting/quotes. */
function splitArgs(text) {
  const args = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const prev = text[i - 1];
    if (quote) {
      current += ch;
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/** Find the matching close paren for the one at `open`. */
function matchParen(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Count top-level commas inside an argument list -> number of values. */
function countValues(argText) {
  const inner = argText.slice(1, -1);
  if (!inner.trim()) return 0;
  return splitArgs(inner).length;
}

for (const file of FILES) {
  const full = path.join(__dirname, '..', file);
  const src = fs.readFileSync(full, 'utf8');

  // Every execute/query call whose first argument contains a placeholder.
  const callRe = /\b(?:execute|query)\s*\(/g;
  let m;
  while ((m = callRe.exec(src)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(src, open);
    if (close === -1) continue;
    const args = splitArgs(src.slice(open + 1, close));
    const sql = args[0];
    if (!sql || !sql.includes('?')) continue;
    const paramsArg = args[1];
    if (paramsArg === undefined) continue;

    const placeholders = (sql.match(/\?/g) || []).length;
    const values = countValues(paramsArg);

    if (placeholders !== values) {
      problems += 1;
      const lineNo = src.slice(0, m.index).split('\n').length;
      console.log(
        `MISMATCH ${file}:${lineNo}  ${placeholders} placeholder(s) vs ${values} value(s)`
      );
      console.log(`  ${sql.replace(/\s+/g, ' ').trim().slice(0, 150)}`);
    }
  }
}

if (problems) {
  console.log(`\n${problems} statement(s) bind the wrong number of values.`);
  process.exit(1);
}
console.log('All INSERT/SELECT statements bind the correct number of values.');