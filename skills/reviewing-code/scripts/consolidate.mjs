#!/usr/bin/env node
// Consolide les findings des lentilles en deux temps.
//
// 1) node consolidate.mjs <context.json> --propose
//    Lit {findingsDir}/*.json, applique les filtres de périmètre, numérote chaque finding
//    (« lens#i ») et propose des groupes de doublons :
//      - « sûrs »     : même path, lignes distantes de 3 au plus (ou line null des deux côtés) ;
//      - « à juger »  : paires hors groupe sûr dont les textes se ressemblent (même problème
//                       signalé sur un autre fichier, ou loin dans le même fichier).
//    Écrit {outDir}/clusters.json et imprime un listing compact pour la décision.
//
// 2) node consolidate.mjs <context.json> --apply <merge.json>
//    merge.json (seulement les décisions, tout id non cité reste un finding seul) :
//    {
//      "groups":    [ { "ids": ["stack#2", "code-review#2"], "severity"?: "P3", "title"?: "…",
//                       "path"?: "…", "line"?: 11, "start_line"?: 8, "body_from"?: "stack#2",
//                       "note"?: "Remarque de consolidation (vérification, rétrogradation…)" } ],
//      "drop":      [ { "id": "superpowers#14", "reason": "confiance faible" } ],
//      "override":  { "code-reviewer#2": { "severity": "P3", "note": "…" } },
//      "strengths": [ "point fort markdown", … ]     (3 max)
//    }
//    Écrit {outDir}/consolidated.json, puis la sortie du mode :
//      - dir : {context.reportFile} (revue.md) ;
//      - pr  : {outDir}/review.json ({ body, comments }) prêt pour post-review.mjs.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEV = ['P0', 'P1', 'P2', 'P3'];
const ICON = { P0: '🔴', P1: '🟠', P2: '🟡', P3: '🔵' };
const NAME = { P0: 'Bloquant', P1: 'Important', P2: 'Recommandé', P3: 'Suggestion' };
const LENS_LABEL = { 'code-review': '/code-review' };
const LINE_GAP = 3;
const TITLE_SIM = 0.3; // similarité de Jaccard des titres
const TEXT_SIM = 0.17; // similarité de Jaccard titre + body (calibrée sur une revue réelle)

const log = (...a) => console.error('[reviewing-code]', ...a);
const fail = (m) => {
  console.error(`[reviewing-code] ERREUR : ${m}`);
  process.exit(1);
};

const [ctxPath, mode, mergePath] = process.argv.slice(2);
if (!ctxPath || !['--propose', '--apply'].includes(mode) || (mode === '--apply' && !mergePath))
  fail('usage : consolidate.mjs <context.json> --propose | --apply <merge.json>');
const ctx = JSON.parse(readFileSync(ctxPath, 'utf8'));

// ---------- lecture et filtres de périmètre ----------
// Les lentilles préfixent parfois le titre d'une référence de règle (« [F1] », « [R3] »).
// On la retire du titre et, si le body ne la cite pas déjà, on la reporte à la fin du body.
const RULE_TAG = /\s*\[([A-Z][A-Z0-9-]{0,9}\d)\]\s*/g;
const cleanTitle = (t) => (t ?? '').replace(RULE_TAG, ' ').replace(/\s{2,}/g, ' ').trim();
function stripRuleTags(f) {
  const tags = [...(f.title ?? '').matchAll(RULE_TAG)].map((m) => m[1]);
  if (!tags.length) return f;
  const missing = tags.filter((t) => !new RegExp(`\\b${t}\\b`).test(f.body ?? ''));
  const body = missing.length ? `${f.body ?? ''}\n\nRègle de référence : ${missing.join(', ')}.` : f.body;
  return { ...f, title: cleanTitle(f.title), body };
}

function loadFindings() {
  const excluded = new Set(ctx.excludedFiles ?? []);
  const inScope = ctx.mode === 'dir' ? new Set(ctx.files.map((f) => f.path)) : null;
  const all = [];
  const lensReports = [];
  const failedLenses = [];
  const filtered = [];
  for (const file of readdirSync(ctx.findingsDir).filter((f) => f.endsWith('.json')).sort()) {
    let data;
    try {
      data = JSON.parse(readFileSync(join(ctx.findingsDir, file), 'utf8'));
    } catch (e) {
      failedLenses.push({ lens: file.replace(/\.json$/, ''), error: `JSON invalide : ${e.message}` });
      continue;
    }
    const lens = data.lens || file.replace(/\.json$/, '');
    lensReports.push({ lens, summary: data.summary ?? '', strengths: data.strengths ?? [] });
    (data.findings ?? []).forEach((f, i) => {
      const id = `${lens}#${i}`;
      const finding = { id, lens, ...stripRuleTags(f), line: f.line ?? null, start_line: f.start_line ?? null };
      if (excluded.has(f.path)) filtered.push({ id, reason: 'fichier backend exclu' });
      else if (inScope && !inScope.has(f.path)) filtered.push({ id, reason: 'hors du périmètre revu' });
      else if (f.severity === 'P0' && f.confidence === 'low')
        filtered.push({ id, reason: 'P0 en confiance low (interdit par le schéma)' });
      else if (!SEV.includes(f.severity)) filtered.push({ id, reason: `sévérité invalide « ${f.severity} »` });
      else all.push(finding);
    });
  }
  const expected = (ctx.lenses ?? []).filter((l) => !lensReports.some((r) => r.lens === l));
  for (const l of expected)
    if (!failedLenses.some((f) => f.lens === l)) failedLenses.push({ lens: l, error: 'aucun fichier de findings' });
  return { all, lensReports, failedLenses, filtered };
}

// ---------- proposition de groupes ----------
const STOP = new Set(
  'le la les un une des de du d l à a au aux et ou en sur sans dans par pour avec est sont ne pas que qui quand se sa son ses ce cet cette'.split(
    ' ',
  ),
);
const words = (t) =>
  new Set(
    t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
const jaccard = (a, b) => {
  const A = words(a);
  const B = words(b);
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / (A.size + B.size - inter || 1);
};
const near = (a, b) =>
  a.path === b.path &&
  ((a.line == null && b.line == null) ||
    (a.line != null && b.line != null && Math.abs(a.line - b.line) <= LINE_GAP) ||
    (a.line != null && b.start_line != null && b.line != null && a.line >= b.start_line - LINE_GAP && a.line <= b.line + LINE_GAP) ||
    (b.line != null && a.start_line != null && a.line != null && b.line >= a.start_line - LINE_GAP && b.line <= a.line + LINE_GAP));

function unionFind(items, linked) {
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) if (linked(items[i], items[j])) parent[find(i)] = find(j);
  const groups = new Map();
  items.forEach((it, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(it);
  });
  return [...groups.values()];
}

function propose() {
  const { all, lensReports, failedLenses, filtered } = loadFindings();
  const sure = unionFind(all, near).filter((g) => g.length > 1);
  const sureOf = new Map();
  sure.forEach((g, k) => g.forEach((f) => sureOf.set(f.id, k)));
  // candidats « à juger » : paires hors d'un même groupe sûr dont le titre, ou le titre + le body,
  // se ressemblent. Présentées en paires (pas de fusion transitive en chaîne).
  const toJudge = [];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (near(a, b)) continue;
      if (sureOf.get(a.id) !== undefined && sureOf.get(a.id) === sureOf.get(b.id)) continue;
      const t = jaccard(a.title, b.title);
      const tb = jaccard(`${a.title} ${a.body}`, `${b.title} ${b.body}`);
      if (t >= TITLE_SIM || tb >= TEXT_SIM) toJudge.push({ a, b, score: Math.max(t, tb) });
    }
  toJudge.sort((x, y) => y.score - x.score);

  const short = (f) =>
    `${f.id.padEnd(16)} ${f.severity} ${f.confidence?.[0] ?? '?'} ${(f.path.split('/').pop() + ':' + (f.line ?? '—')).padEnd(30)} [${f.category}] ${f.title}`;
  const out = [];
  out.push(`# ${all.length} findings retenus, ${filtered.length} filtrés, ${lensReports.length} lentilles lues`);
  for (const f of failedLenses) out.push(`! lentille en échec : ${f.lens} (${f.error})`);
  for (const f of filtered) out.push(`- filtré ${f.id} : ${f.reason}`);
  out.push('', `## Groupes sûrs (même fichier, lignes à ${LINE_GAP} près) : ${sure.length}`);
  out.push('   ⚠ vérifier qu’il s’agit bien du même problème de fond avant de fusionner');
  sure.forEach((g, k) => {
    out.push(`S${k + 1}:`);
    g.forEach((f) => out.push('   ' + short(f)));
  });
  out.push('', `## Paires à juger (textes proches, hors groupes sûrs) : ${toJudge.length}`);
  toJudge.forEach(({ a, b, score }, k) => {
    out.push(`J${k + 1} (similarité ${score.toFixed(2)}) :`);
    out.push('   ' + short(a), '   ' + short(b));
  });
  const grouped = new Set([...sure.flat(), ...toJudge.flatMap((p) => [p.a, p.b])].map((f) => f.id));
  const alone = all.filter((f) => !grouped.has(f.id));
  out.push('', `## Isolés : ${alone.length}`);
  alone.forEach((f) => out.push('   ' + short(f)));

  writeFileSync(
    join(ctx.outDir, 'clusters.json'),
    JSON.stringify(
      {
        sure: sure.map((g) => g.map((f) => f.id)),
        toJudge: toJudge.map((p) => ({ ids: [p.a.id, p.b.id], score: Number(p.score.toFixed(2)) })),
        alone: alone.map((f) => f.id),
        filtered,
        failedLenses,
      },
      null,
      2,
    ),
  );
  console.log(out.join('\n'));
  log(`propositions → ${join(ctx.outDir, 'clusters.json')}`);
}

// ---------- application des décisions ----------
const lensLabel = (l) => LENS_LABEL[l] ?? l;
const sevRank = (s) => SEV.indexOf(s);
const langOf = (p) => ({ vue: 'vue', ts: 'ts', tsx: 'tsx', js: 'js', mjs: 'js', scss: 'scss', css: 'css', php: 'php' })[p.split('.').pop()] ?? '';

function apply() {
  const merge = JSON.parse(readFileSync(mergePath, 'utf8'));
  const { all, lensReports, failedLenses, filtered } = loadFindings();
  const byId = new Map(all.map((f) => [f.id, f]));
  const seen = new Set();
  const check = (id, where) => {
    if (!byId.has(id)) fail(`${where} : id inconnu ou filtré « ${id} »`);
    if (seen.has(id)) fail(`${where} : « ${id} » apparaît deux fois`);
    seen.add(id);
  };
  const dropped = [...filtered];
  for (const d of merge.drop ?? []) {
    check(d.id, 'drop');
    dropped.push({ id: d.id, reason: d.reason ?? 'écarté à la consolidation' });
  }
  const groups = (merge.groups ?? []).map((g, k) => {
    if (!g.ids?.length) fail(`groups[${k}] sans ids`);
    g.ids.forEach((id) => check(id, `groups[${k}]`));
    return g;
  });
  for (const f of all) if (!seen.has(f.id)) groups.push({ ids: [f.id] });

  const consolidated = groups.map((g) => {
    const fs = g.ids.map((id) => {
      const o = merge.override?.[id] ?? {};
      return { ...byId.get(id), ...o };
    });
    // représentant : sévérité la plus haute, puis confiance, puis body le plus long
    const conf = { high: 0, medium: 1, low: 2 };
    const rep = [...fs].sort(
      (a, b) =>
        sevRank(a.severity) - sevRank(b.severity) ||
        (conf[a.confidence] ?? 3) - (conf[b.confidence] ?? 3) ||
        b.body.length - a.body.length,
    )[0];
    const bodySrc = g.body_from ? fs.find((f) => f.id === g.body_from) : [...fs].sort((a, b) => b.body.length - a.body.length)[0];
    if (g.body_from && !bodySrc) fail(`body_from « ${g.body_from} » n'est pas dans son groupe`);
    const withSugg = fs.filter((f) => f.suggestion);
    const sugg = withSugg.find((f) => f.id === rep.id) ?? withSugg.sort((a, b) => b.suggestion.length - a.suggestion.length)[0];
    const notes = [g.note, ...fs.map((f) => merge.override?.[f.id]?.note)].filter(Boolean);
    const path = g.path ?? rep.path;
    const line = 'line' in g ? g.line : rep.line;
    const start = 'start_line' in g ? g.start_line : 'line' in g ? null : rep.start_line;
    return {
      ids: g.ids,
      severity: g.severity ?? fs.map((f) => f.severity).sort((a, b) => sevRank(a) - sevRank(b))[0],
      category: rep.category,
      title: g.title ? cleanTitle(g.title) : rep.title,
      path,
      line,
      start_line: start != null && line != null && start < line ? start : null,
      body: bodySrc.body,
      suggestion: line != null && sugg && sugg.path === path ? sugg.suggestion : null,
      notes,
      lenses: [...new Set(fs.map((f) => lensLabel(f.lens)))].sort(),
    };
  });
  consolidated.sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || a.path.localeCompare(b.path) || (a.line ?? 0) - (b.line ?? 0));

  const counts = Object.fromEntries(SEV.map((s) => [s, consolidated.filter((c) => c.severity === s).length]));
  const raw = all.length + filtered.length;
  const strengths = (merge.strengths ?? lensReports.flatMap((r) => r.strengths)).slice(0, 3);
  const lensLine = (ctx.lenses ?? [])
    .map((l) =>
      l === 'code-review'
        ? `/code-review (${ctx.level})`
        : l === 'stack'
          ? `stack (${ctx.stack.skills.join(', ')})`
          : l,
    )
    .join(', ');
  const stats =
    `_${raw} findings bruts → ${consolidated.length} après fusion` +
    (dropped.length ? ` ; ${dropped.length} écarté(s) : ${dropped.map((d) => `${d.id} (${d.reason})`).join(', ')}` : '') +
    '._';
  const failedLine = failedLenses.length
    ? `**Lentilles en échec** : ${failedLenses.map((f) => `${f.lens} (${f.error})`).join(', ')}`
    : null;
  const tableRows = SEV.filter((s) => counts[s]).map((s) => `| ${ICON[s]} ${s} | ${counts[s]} |`);
  const loc = (c) => (c.line == null ? c.path : `${c.path}:${c.start_line ? `${c.start_line}-` : ''}${c.line}`);
  const general = consolidated.filter((c) => c.line == null);

  writeFileSync(join(ctx.outDir, 'consolidated.json'), JSON.stringify({ counts, dropped, failedLenses, findings: consolidated }, null, 2));

  if (ctx.mode === 'dir') {
    const health = counts.P0
      ? '⛔ Problèmes bloquants (P0)'
      : counts.P1
        ? '⚠️ Points importants à corriger (P1)'
        : '✅ Rien de bloquant';
    const t = ctx.target;
    const hors = [
      ctx.excludedFiles?.length ? `${ctx.excludedFiles.length} fichier(s) backend` : null,
      ctx.ignoredFiles ? `${ctx.ignoredFiles} fichier(s) généré(s)/binaire(s) ignoré(s)` : null,
    ].filter(Boolean);
    const L = [
      `# Revue de code — ${t.repo} / ${t.dir}`,
      '',
      `_${new Date().toISOString().slice(0, 10)} · HEAD ${t.headSha ? t.headSha.slice(0, 8) : 'n/a'}${t.dirty ? ' · modifications non commitées incluses' : ''} · ${ctx.files.length} fichiers, ${ctx.totalLines} lignes · niveau ${ctx.level}_`,
      '',
      `**Santé du code** : ${health}`,
      '',
      '| Sévérité | Nombre |',
      '|---|---|',
      ...tableRows,
      '',
      `**Lentilles** : ${lensLine}`,
      ...(failedLine ? [failedLine] : []),
      ...(hors.length ? [`**Hors périmètre** : ${hors.join(', ')}`] : []),
      '',
      stats,
    ];
    if (strengths.length) L.push('', '## Points forts', '', ...strengths.map((s) => `- ${s}`));
    if (general.length)
      L.push(
        '',
        '## Remarques générales',
        '',
        ...general.map((c) => `- ${ICON[c.severity]} **${c.severity} · ${c.category}** · ${c.title} — \`${c.path}\` _(${c.lenses.join(', ')})_`),
      );
    for (const s of SEV) {
      const items = consolidated.filter((c) => c.severity === s);
      if (!items.length) continue;
      L.push('', `## ${ICON[s]} ${s} — ${NAME[s]}`);
      for (const c of items) {
        L.push('', `### \`${loc(c)}\` · ${c.category} · ${c.title}`, '', c.body);
        for (const n of c.notes) L.push('', `> **Consolidation** : ${n}`);
        if (c.suggestion) L.push('', '```' + langOf(c.path), c.suggestion, '```');
        L.push('', `_Lentilles : ${c.lenses.join(', ')}_`);
      }
    }
    writeFileSync(ctx.reportFile, L.join('\n') + '\n');
    log(`rapport → ${ctx.reportFile}`);
  } else {
    const verdict = counts.P0 ? '⛔ Bloquant (P0)' : counts.P1 ? '⚠️ À corriger avant merge (P1)' : '✅ OK pour merge';
    const B = [
      '## 🤖 Revue automatique — /reviewing-code',
      '',
      `**Verdict** : ${verdict}`,
      '',
      '| Sévérité | Nombre |',
      '|---|---|',
      ...tableRows,
      '',
      `**Lentilles** : ${lensLine}`,
      ...(failedLine ? [failedLine] : []),
      ...(ctx.excludedFiles?.length
        ? ['', `**Hors périmètre (backend, non revu)** : ${ctx.excludedFiles.map((p) => `\`${p}\``).join(', ')}`]
        : []),
    ];
    if (strengths.length) B.push('', '### Points forts', ...strengths.map((s) => `- ${s}`));
    const key = consolidated.filter((c) => c.severity === 'P0' || c.severity === 'P1');
    if (key.length) B.push('', '### Points clés', ...key.map((c) => `- ${ICON[c.severity]} \`${loc(c)}\` — ${c.title}`));
    if (general.length)
      B.push('', '### Remarques générales', ...general.map((c) => `- ${ICON[c.severity]} **${c.severity}** · ${c.title} — ${c.body.split('\n')[0]}`));
    const comments = consolidated
      .filter((c) => c.line != null)
      .map((c) => {
        const parts = [`**${ICON[c.severity]} ${c.severity} · ${c.category}** · ${c.title}`, '', c.body];
        for (const n of c.notes) parts.push('', `> ${n}`);
        if (c.suggestion) parts.push('', '```suggestion', c.suggestion, '```');
        parts.push(`_Lentilles : ${c.lenses.join(', ')}_`);
        return { path: c.path, line: c.line, ...(c.start_line ? { start_line: c.start_line } : {}), body: parts.join('\n') };
      });
    writeFileSync(join(ctx.outDir, 'review.json'), JSON.stringify({ body: B.join('\n'), comments }, null, 2));
    log(`review → ${join(ctx.outDir, 'review.json')} (${comments.length} commentaire(s) inline)`);
  }
  for (const s of SEV)
    for (const c of consolidated.filter((x) => x.severity === s))
      console.log(`${ICON[s]} ${s} ${c.line == null ? c.path : `${c.path}:${c.line}`} — ${c.title}`);
  log(`${consolidated.length} finding(s) : ${SEV.map((s) => `${s}=${counts[s]}`).join(' ')}`);
}

if (mode === '--propose') propose();
else apply();
