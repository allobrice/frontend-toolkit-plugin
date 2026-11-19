#!/usr/bin/env node
// Publie la review consolidée sur la PR (une seule review GitHub : corps + commentaires inline).
// Usage : node post-review.mjs <context.json> <review.json> [--dry-run]
// review.json : { "body": "<markdown>", "comments": [ { "path", "line", "start_line"?, "body" } ] }
// Les commentaires dont la ligne n'est pas dans le diff sont basculés dans le corps : sinon
// GitHub rejette TOUTE la review en 422.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BODY = 65000;
const log = (...a) => console.error('[reviewing-code]', ...a);

const [ctxPath, reviewPath, ...rest] = process.argv.slice(2);
if (!ctxPath || !reviewPath) {
  console.error('Usage : node post-review.mjs <context.json> <review.json> [--dry-run]');
  process.exit(1);
}
const dryRun = rest.includes('--dry-run');
const ctx = JSON.parse(readFileSync(ctxPath, 'utf8'));
if (ctx.mode === 'dir') {
  console.error('[reviewing-code] ERREUR : mode dossier, rien à publier sur GitHub (le rapport est revue.md).');
  process.exit(1);
}
const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
const commentable = JSON.parse(readFileSync(ctx.commentableFile, 'utf8'));
const sets = Object.fromEntries(Object.entries(commentable).map(([p, ls]) => [p, new Set(ls)]));

const excluded = new Set(ctx.excludedFiles ?? []);
const valid = [];
const moved = [];
let dropped = 0;
for (const c of review.comments ?? []) {
  // dernier filet : jamais de commentaire sur un fichier backend exclu du périmètre
  if (excluded.has(c.path)) {
    dropped++;
    continue;
  }
  const s = sets[c.path];
  const line = Number(c.line);
  let start = c.start_line != null ? Number(c.start_line) : null;
  if (start != null && start >= line) start = null;
  const rangeOk =
    s && s.has(line) && (start == null || Array.from({ length: line - start + 1 }, (_, i) => start + i).every((l) => s.has(l)));
  if (rangeOk) {
    valid.push({
      path: c.path,
      line,
      side: 'RIGHT',
      ...(start != null ? { start_line: start, start_side: 'RIGHT' } : {}),
      body: c.body,
    });
  } else if (s && s.has(line)) {
    // plage invalide mais ligne finale valide : on garde la ligne seule
    valid.push({ path: c.path, line, side: 'RIGHT', body: c.body });
  } else {
    moved.push(c);
  }
}

let body = review.body ?? '';
if (moved.length) {
  body +=
    '\n\n### Remarques hors des lignes du diff\n\n' +
    moved
      .map((c) => `- **\`${c.path}${c.line ? `:${c.line}` : ''}\`** : ${c.body.replace(/\n+/g, '\n  ')}`)
      .join('\n');
}
if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY - 200) + '\n\n_(synthèse tronquée : limite GitHub)_';

const payload = { commit_id: ctx.headSha, event: 'COMMENT', body, comments: valid };
const payloadFile = join(ctx.outDir, 'review-payload.json');
writeFileSync(payloadFile, JSON.stringify(payload, null, 2));
if (dropped) log(`${dropped} commentaire(s) sur du backend supprimé(s)`);
log(`${valid.length} commentaire(s) inline, ${moved.length} basculé(s) dans le corps → ${payloadFile}`);

if (dryRun) {
  log('dry-run : rien publié');
  process.exit(0);
}

try {
  const res = JSON.parse(
    execFileSync(
      'gh',
      ['api', '-X', 'POST', `repos/${ctx.pr.owner}/${ctx.pr.repo}/pulls/${ctx.pr.number}/reviews`, '--input', payloadFile],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ),
  );
  console.log(res.html_url);
} catch (e) {
  console.error(`[reviewing-code] ERREUR publication : ${e.stdout || ''}${e.stderr || e.message}`);
  process.exit(1);
}
