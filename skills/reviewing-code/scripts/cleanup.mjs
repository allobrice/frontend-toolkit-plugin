#!/usr/bin/env node
// Retire le worktree de la PR ; le clone partiel en cache est conservé. Sans effet en mode dossier.
// Usage : node cleanup.mjs <context.json>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ctx = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (ctx.mode === 'dir') {
  console.error('[reviewing-code] mode dossier : aucun worktree à retirer');
  process.exit(0);
}
try {
  execFileSync('git', ['-C', ctx.clone, 'worktree', 'remove', '--force', ctx.worktree], { stdio: 'inherit' });
  execFileSync('git', ['-C', ctx.clone, 'worktree', 'prune'], { stdio: 'inherit' });
  console.error(`[reviewing-code] worktree retiré : ${ctx.worktree}`);
} catch (e) {
  console.error(`[reviewing-code] nettoyage partiel : ${e.message}`);
}
