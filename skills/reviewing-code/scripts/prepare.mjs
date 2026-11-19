#!/usr/bin/env node
// Prépare une revue : PR GitHub (checkout dans un worktree en cache, diff, lignes commentables)
// ou dossier local (liste des fichiers, revue en lecture seule de l'arbre de travail).
// Détecte la stack et le périmètre front dans les deux cas.
// Usage : node prepare.mjs <url-pr | owner/repo#n | chemin> [-seo] [-perf] [-archi] [-a11y]
//                          [--no-post] [--level <low|medium|high|xhigh>] [--out <dir>]
// Sortie : chemin du context.json sur stdout (dernière ligne), logs sur stderr.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';

const AUDIT_FLAGS = {
  seo: 'auditing-seo',
  perf: 'auditing-performance',
  archi: 'auditing-architecture',
  a11y: 'auditing-accessibility',
};
const LEVELS = ['low', 'medium', 'high', 'xhigh'];
const CACHE = join(homedir(), '.cache', 'reviewing-code');
const MAX_DIFF_LINES_WARN = 3000;

const log = (...a) => console.error('[reviewing-code]', ...a);
const fail = (msg) => {
  console.error(`[reviewing-code] ERREUR : ${msg}`);
  process.exit(1);
};
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });

// ---------- arguments ----------
function parseArgs(argv) {
  const out = { audits: [], post: true, level: 'medium', outDir: null, target: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const flag = a.replace(/^--?/, '').toLowerCase();
    if (a.startsWith('-') && AUDIT_FLAGS[flag]) {
      if (!out.audits.includes(flag)) out.audits.push(flag);
    } else if (flag === 'no-post' && a.startsWith('-')) {
      out.post = false;
    } else if (flag === 'level' && a.startsWith('-')) {
      const v = argv[++i];
      if (!LEVELS.includes(v)) fail(`--level attend ${LEVELS.join('|')}, reçu « ${v} »`);
      out.level = v;
    } else if (flag === 'out' && a.startsWith('-')) {
      out.outDir = argv[++i];
    } else if (a.startsWith('-')) {
      fail(
        `flag inconnu « ${a} ». Flags valides : ${Object.keys(AUDIT_FLAGS)
          .map((f) => '-' + f)
          .join(' ')} --no-post --level <${LEVELS.join('|')}>`,
      );
    } else if (!out.target) {
      out.target = a;
    } else {
      fail(`argument en trop : « ${a} »`);
    }
  }
  if (!out.target)
    fail('cible manquante. Usage : /reviewing-code <url-pr | dossier> [-seo] [-perf] [-archi] [-a11y]');
  const m =
    out.target.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/) ||
    out.target.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (m) {
    out.mode = 'pr';
    out.owner = m[1];
    out.repo = m[2];
    out.number = Number(m[3]);
    return out;
  }
  const abs = resolve(out.target.replace(/^~(?=$|\/)/, homedir()));
  if (!existsSync(abs))
    fail(
      `« ${out.target} » n'est ni une URL de PR GitHub (https://github.com/<owner>/<repo>/pull/<n>) ni un chemin existant`,
    );
  out.mode = 'dir';
  out.path = abs;
  return out;
}

// ---------- mode dossier : fichiers sans intérêt pour une revue ----------
export function isNoise(path) {
  if (/(^|\/)(node_modules|dist|build|coverage|\.nuxt|\.output|\.next|\.git|vendor|__snapshots__)\//.test(path))
    return true;
  if (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|composer\.lock)$/.test(path)) return true;
  if (/\.min\.(js|css)$/i.test(path)) return true;
  if (/(^|\/)\.(gitkeep|keep|DS_Store)$/.test(path)) return true;
  if (/\.(map|snap|png|jpe?g|gif|webp|avif|ico|bmp|tiff?|svgz|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|pdf|zip|gz|tgz|jar|exe|dll|so|dylib|lockb)$/i.test(path))
    return true;
  return false;
}

// ---------- diff → lignes commentables (côté RIGHT) ----------
export function commentableLines(patch) {
  const result = {};
  let file = null;
  let right = 0;
  let inHunk = false;
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = null;
      inHunk = false;
      continue;
    }
    if (!inHunk && line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      file = p === '/dev/null' ? null : p.replace(/^b\//, '');
      if (file) result[file] ??= [];
      continue;
    }
    const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) {
      right = Number(h[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk || !file) continue;
    if (line.startsWith('+') || line.startsWith(' ')) {
      result[file].push(right);
      right++;
    } else if (line.startsWith('-') || line.startsWith('\\')) {
      // ligne supprimée ou « No newline » : pas de numéro côté RIGHT
    } else if (line === '') {
      // ligne vide de fin de patch
    }
  }
  return result;
}

// ---------- périmètre : exclusion du backend ----------
// Revue front uniquement. Est « backend » :
// - tout .php, SAUF les vues server-side (dossier views/, ex. application/views/**) qui portent
//   du HTML/CSS/JS intégré par les devs front ;
// - le reste de application/ (CodeIgniter : controllers, models, libraries, config, language…) ;
// - tests/ racine d'un projet PHP (PHPUnit), composer.*, phpunit.xml*, *.sql.
export function isBackend(path, hasComposer) {
  const isView = /(^|\/)views\//.test(path);
  if (/\.php$/i.test(path)) return !isView;
  if (/^application\//.test(path)) return !isView;
  if (hasComposer && /^tests\//.test(path)) return true;
  if (/(^|\/)composer\.(json|lock)$/.test(path)) return true;
  if (/(^|\/)phpunit\.xml(\.dist)?$/.test(path)) return true;
  if (/\.sql$/i.test(path)) return true;
  // documentation et conventions propres au back (plans, refs, rules scopées)
  if (/^(docs\/back|docs\/plans\/back|\.claude\/rules\/back)\//.test(path)) return true;
  return false;
}

// Retire du patch les blocs « diff --git » des fichiers exclus.
export function filterPatch(patch, excluded) {
  if (!excluded.size) return patch;
  return patch
    .split(/(?=^diff --git )/m)
    .filter((block) => {
      const m = block.match(/^diff --git a\/.* b\/(.*)$/m);
      return !m || !excluded.has(m[1]);
    })
    .join('');
}

// ---------- détection de stack ----------
function detectStack(wt, files) {
  const changed = files.filter((f) => f.status !== 'D').map((f) => f.path);
  const read = (p) => {
    try {
      return readFileSync(join(wt, p), 'utf8');
    } catch {
      return '';
    }
  };
  const vue = changed.filter((p) => p.endsWith('.vue'));
  const vueSrc = vue.map(read);
  const skills = new Set();
  const front = [];
  if (vue.length) skills.add('developing-vue');
  if (changed.some((p) => /\.(ts|tsx|mts|cts)$/.test(p)) || vueSrc.some((s) => /<script[^>]*lang=["']ts["']/.test(s)))
    skills.add('developing-typescript');
  if (changed.some((p) => /\.(scss|sass)$/.test(p)) || vueSrc.some((s) => /<style[^>]*lang=["']scss["']/.test(s)))
    skills.add('developing-scss');
  // Monorepos (apps/frontend/nuxt.config.ts…) : on remonte de chaque fichier modifié vers la racine.
  const NUXT_CONFIGS = ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs'];
  const nuxtRootOf = (p) => {
    for (let d = dirname(p); ; d = dirname(d)) {
      if (NUXT_CONFIGS.some((f) => existsSync(join(wt, d, f)))) return d;
      if (d === '.' || d === '/' || d === '') return null;
    }
  };
  const nuxtFiles = changed.filter((p) => /\.(vue|ts|js|mjs)$/.test(p) && nuxtRootOf(p) !== null);
  const isNuxt = nuxtFiles.length > 0;
  if (isNuxt) skills.add('developing-with-nuxt4');
  for (const p of changed) if (/\.(vue|ts|tsx|js|jsx|mjs|scss|sass|css)$/.test(p)) front.push(p);
  return {
    nuxt: isNuxt,
    php: existsSync(join(wt, 'composer.json')),
    node: existsSync(join(wt, 'package.json')),
    skills: [...skills],
    frontFiles: front,
  };
}

// ---------- mode PR ----------
function preparePr(args) {
  const slug = `${args.owner}/${args.repo}`;

  log(`PR ${slug}#${args.number} : lecture des métadonnées`);
  let pr;
  try {
    pr = JSON.parse(
      run('gh', [
        'pr', 'view', String(args.number), '-R', slug,
        '--json', 'number,title,body,url,state,isDraft,author,baseRefName,headRefName,headRefOid,additions,deletions,changedFiles',
      ]),
    );
  } catch (e) {
    fail(`gh pr view a échoué (PR inexistante ou accès refusé ?)\n${e.stderr || e.message}`);
  }
  const warnings = [];
  if (pr.state !== 'OPEN') warnings.push(`La PR est ${pr.state} : la review sera publiée sur une PR non ouverte.`);

  // clone partiel en cache
  const clone = join(CACHE, `${args.owner}-${args.repo}`);
  mkdirSync(CACHE, { recursive: true });
  if (!existsSync(join(clone, '.git')) && !existsSync(join(clone, 'HEAD'))) {
    log(`premier clone (partiel) de ${slug} dans ${clone}`);
    run('gh', ['repo', 'clone', slug, clone, '--', '--filter=blob:none', '--no-checkout', '--quiet'], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  }
  const git = (...a) => run('git', ['-C', clone, ...a]).trim();
  // Clone partiel : git va chercher les blobs à la demande (y compris dans le worktree, et pour
  // les lentilles). gh n'installe son credential helper que pendant ses propres commandes : on le
  // fixe dans la config locale du clone.
  git('config', '--replace-all', 'credential.https://github.com.helper', '');
  git('config', '--add', 'credential.https://github.com.helper', '!gh auth git-credential');
  log('fetch de la PR et de sa base');
  git('fetch', '--quiet', '--force', 'origin', `+refs/pull/${args.number}/head:refs/reviewing-code/${args.number}`);
  const headSha = git('rev-parse', `refs/reviewing-code/${args.number}`);
  if (headSha !== pr.headRefOid)
    warnings.push(`HEAD local ${headSha.slice(0, 8)} ≠ headRefOid GitHub ${pr.headRefOid.slice(0, 8)} (push en cours ?).`);
  // PR ouverte : base = tip actuel de la branche cible (comme GitHub).
  // PR fermée/mergée : la branche cible contient déjà le head, ou a été supprimée (release/*
  // terminée) → on prend la base figée par GitHub, fetchée par son SHA.
  let baseRef;
  if (pr.state === 'OPEN') {
    git('fetch', '--quiet', '--force', 'origin',
      `+refs/heads/${pr.baseRefName}:refs/remotes/origin/${pr.baseRefName}`);
    baseRef = `origin/${pr.baseRefName}`;
  } else {
    baseRef = run('gh', ['api', `repos/${slug}/pulls/${args.number}`, '--jq', '.base.sha']).trim();
    git('fetch', '--quiet', 'origin', baseRef);
  }
  const baseSha = git('merge-base', baseRef, headSha);
  if (baseSha === headSha) fail('diff vide : la base contient déjà le head de la PR');

  // worktree détaché par PR
  const wt = join(CACHE, 'wt', `${args.repo}-${args.number}`);
  mkdirSync(join(CACHE, 'wt'), { recursive: true });
  if (existsSync(wt)) {
    try { git('worktree', 'remove', '--force', wt); } catch { /* worktree orphelin */ }
  }
  git('worktree', 'prune');
  log(`worktree ${wt} @ ${headSha.slice(0, 8)}`);
  git('worktree', 'add', '--quiet', '--detach', wt, headSha);

  // diff local (même calcul que GitHub : merge-base...head)
  const fullPatch = run('git', ['-C', wt, 'diff', '--no-color', '-M', baseSha, headSha]);
  const allFiles = run('git', ['-C', wt, 'diff', '--name-status', '-M', baseSha, headSha])
    .trim().split('\n').filter(Boolean)
    .map((l) => {
      const [st, ...paths] = l.split('\t');
      return { status: st[0], path: paths[paths.length - 1], ...(paths.length > 1 ? { from: paths[0] } : {}) };
    });

  // Périmètre front uniquement : le backend est retiré du diff avant toute revue
  const hasComposer = existsSync(join(wt, 'composer.json'));
  const excludedFiles = allFiles.filter((f) => isBackend(f.path, hasComposer)).map((f) => f.path);
  const nameStatus = allFiles.filter((f) => !excludedFiles.includes(f.path));
  if (!nameStatus.length)
    fail(`la PR ne touche que du backend (${excludedFiles.length} fichier(s)) : rien à revoir dans le périmètre front`);
  if (excludedFiles.length)
    log(`${excludedFiles.length} fichier(s) backend exclu(s) de la revue : ${excludedFiles.join(', ')}`);
  const patch = filterPatch(fullPatch, new Set(excludedFiles));
  const commentable = commentableLines(patch);
  const diffLines = patch.split('\n').length;
  if (diffLines > MAX_DIFF_LINES_WARN)
    warnings.push(`Diff volumineux (${diffLines} lignes) : envisager de restreindre la revue à un sous-ensemble de fichiers.`);

  const stack = detectStack(wt, nameStatus);

  const outDir = args.outDir || join(CACHE, 'runs', `${args.repo}-${args.number}-${Date.now()}`);
  mkdirSync(join(outDir, 'findings'), { recursive: true });
  writeFileSync(join(outDir, 'diff.patch'), patch);
  writeFileSync(join(outDir, 'commentable.json'), JSON.stringify(commentable));

  const lenses = lensesFor(stack, args.audits);

  const context = {
    mode: 'pr',
    pr: {
      owner: args.owner, repo: args.repo, number: args.number, url: pr.url, title: pr.title,
      body: pr.body, author: pr.author?.login, state: pr.state, isDraft: pr.isDraft,
      baseRef: pr.baseRefName, headRef: pr.headRefName,
      additions: pr.additions, deletions: pr.deletions, changedFiles: pr.changedFiles,
    },
    baseSha, headSha, clone, worktree: wt, outDir,
    diffFile: join(outDir, 'diff.patch'),
    commentableFile: join(outDir, 'commentable.json'),
    findingsDir: join(outDir, 'findings'),
    files: nameStatus,
    excludedFiles,
    stack,
    audits: args.audits.map((f) => ({ flag: f, skill: AUDIT_FLAGS[f] })),
    lenses,
    level: args.level,
    post: args.post,
    warnings,
  };
  const ctxFile = join(outDir, 'context.json');
  writeFileSync(ctxFile, JSON.stringify(context, null, 2));
  for (const w of warnings) log(`⚠ ${w}`);
  log(`${nameStatus.length} fichier(s), ${diffLines} lignes de diff, lentilles : ${lenses.join(', ')}`);
  console.log(ctxFile);
}

function lensesFor(stack, audits) {
  const lenses = ['code-review', 'code-reviewer', 'superpowers', 'clean-code'];
  if (stack.skills.length) lenses.push('stack');
  for (const a of audits) lenses.push(a);
  return lenses;
}

// ---------- mode dossier ----------
const MAX_DIR_FILES_WARN = 80;
const MAX_DIR_LINES_WARN = 6000;

function prepareDir(args) {
  const warnings = [];
  if (!args.post) warnings.push('--no-post ignoré : le mode dossier ne publie jamais rien.');
  const target = args.path;
  const targetDir = statSync(target).isDirectory() ? target : dirname(target);

  let root;
  let isGit = true;
  try {
    root = run('git', ['-C', targetDir, 'rev-parse', '--show-toplevel']).trim();
  } catch {
    isGit = false;
    root = targetDir;
    warnings.push(`${target} n'est pas dans un repo git : conventions du repo et état git indisponibles.`);
  }
  const rel = relative(root, target) || '.';

  let listed;
  if (isGit) {
    listed = run('git', ['-C', root, 'ls-files', '-co', '--exclude-standard', '--', rel]);
  } else {
    listed = run('find', [rel, '-type', 'f', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*'], {
      cwd: root,
    });
  }
  const all = [...new Set(listed.trim().split('\n').filter(Boolean).map((p) => p.replace(/^\.\//, '')))];
  if (!all.length) fail(`aucun fichier dans ${target}`);

  const hasComposer = existsSync(join(root, 'composer.json'));
  const excludedFiles = all.filter((p) => isBackend(p, hasComposer));
  const noise = all.filter((p) => !excludedFiles.includes(p) && isNoise(p));
  const kept = all.filter((p) => !excludedFiles.includes(p) && !noise.includes(p));
  if (!kept.length)
    fail(
      excludedFiles.length
        ? `le dossier ne contient que du backend (${excludedFiles.length} fichier(s)) : rien à revoir dans le périmètre front`
        : 'aucun fichier de code à revoir (seulement des fichiers générés, binaires ou lockfiles)',
    );
  if (excludedFiles.length) log(`${excludedFiles.length} fichier(s) backend exclu(s) de la revue`);
  if (noise.length) log(`${noise.length} fichier(s) généré(s), binaire(s) ou lockfile(s) ignoré(s)`);

  const fileList = kept.map((p) => {
    let lines = 0;
    try {
      lines = readFileSync(join(root, p), 'utf8').split('\n').length;
    } catch { /* fichier supprimé du worktree mais encore suivi */ }
    return { path: p, lines };
  }).filter((f) => f.lines > 0);
  const totalLines = fileList.reduce((n, f) => n + f.lines, 0);
  if (fileList.length > MAX_DIR_FILES_WARN || totalLines > MAX_DIR_LINES_WARN)
    warnings.push(
      `Périmètre volumineux (${fileList.length} fichiers, ${totalLines} lignes) : envisager de restreindre la revue à un sous-dossier.`,
    );

  let headSha = null;
  let dirty = false;
  if (isGit) {
    try { headSha = run('git', ['-C', root, 'rev-parse', 'HEAD']).trim(); } catch { /* repo sans commit */ }
    dirty = run('git', ['-C', root, 'status', '--porcelain', '--', rel]).trim() !== '';
  }

  // detectStack attend des { path, status } ; « M » = fichier présent
  const stack = detectStack(root, fileList.map((f) => ({ path: f.path, status: 'M' })));

  const slug = (rel === '.' ? 'racine' : rel).replace(/[^\w.-]+/g, '_').slice(0, 60);
  const outDir = args.outDir || join(CACHE, 'runs', `${basename(root)}-${slug}-${Date.now()}`);
  mkdirSync(join(outDir, 'findings'), { recursive: true });
  const fileListFile = join(outDir, 'files.json');
  writeFileSync(fileListFile, JSON.stringify(fileList, null, 2));

  const lenses = lensesFor(stack, args.audits);
  const context = {
    mode: 'dir',
    target: { root, dir: rel, absPath: target, repo: basename(root), git: isGit, headSha, dirty },
    headSha,
    worktree: root,
    outDir,
    fileListFile,
    reportFile: join(outDir, 'revue.md'),
    findingsDir: join(outDir, 'findings'),
    files: fileList.map((f) => ({ path: f.path, status: 'M', lines: f.lines })),
    totalLines,
    excludedFiles,
    ignoredFiles: noise.length,
    stack,
    audits: args.audits.map((f) => ({ flag: f, skill: AUDIT_FLAGS[f] })),
    lenses,
    level: args.level,
    post: false,
    warnings,
  };
  const ctxFile = join(outDir, 'context.json');
  writeFileSync(ctxFile, JSON.stringify(context, null, 2));
  for (const w of warnings) log(`⚠ ${w}`);
  log(`dossier ${rel} (${root}) : ${fileList.length} fichier(s), ${totalLines} lignes, lentilles : ${lenses.join(', ')}`);
  console.log(ctxFile);
}

// ---------- main ----------
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'pr') preparePr(args);
  else prepareDir(args);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
