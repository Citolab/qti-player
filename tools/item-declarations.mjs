#!/usr/bin/env node
/**
 * Writes public/<package>/declarations.json for every QTI package in public/: the declared default of
 * each item's MAXSCORE, keyed by item-ref identifier. The player seeds these into the test before the
 * first item loads, so test outcome processing can total MAXSCORE over items the candidate never
 * opened — without fetching every item at results time.
 *
 *   node tools/item-declarations.mjs
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../public');
const OUTCOMES = ['MAXSCORE'];

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/** The declared default of each outcome in OUTCOMES, as the string value the test context holds. */
function declaredDefaults(itemXml) {
  const defaults = [];
  for (const [, open, body = ''] of itemXml.matchAll(/(<qti-outcome-declaration\b[^>]*?)(?:\/>|>([\s\S]*?)<\/qti-outcome-declaration>)/g)) {
    const identifier = attr(open, 'identifier');
    if (!OUTCOMES.includes(identifier)) continue;
    const value = body.match(/<qti-default-value>[\s\S]*?<qti-value>([^<]*)<\/qti-value>/)?.[1]?.trim();
    if (value !== undefined) defaults.push({ identifier, value });
  }
  return defaults;
}

for (const pkg of readdirSync(publicDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)) {
  const manifestPath = join(publicDir, pkg, 'imsmanifest.xml');
  if (!existsSync(manifestPath)) continue;
  const testHref = readFileSync(manifestPath, 'utf8').match(/<resource\b[^>]*type="imsqti_test_xmlv3p0"[^>]*>/)?.[0];
  if (!testHref) continue;
  const testPath = join(publicDir, pkg, attr(testHref, 'href'));
  const testXml = readFileSync(testPath, 'utf8');

  const declarations = {};
  for (const [ref] of testXml.matchAll(/<qti-assessment-item-ref\b[^>]*>/g)) {
    const itemPath = join(dirname(testPath), attr(ref, 'href'));
    if (!existsSync(itemPath)) continue;
    const defaults = declaredDefaults(readFileSync(itemPath, 'utf8'));
    if (defaults.length) declarations[attr(ref, 'identifier')] = defaults;
  }
  writeFileSync(join(publicDir, pkg, 'declarations.json'), JSON.stringify(declarations, null, 2) + '\n');
  console.log(`${pkg}: ${Object.keys(declarations).length} items with ${OUTCOMES.join(', ')}`);
}
