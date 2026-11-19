# Format commun des findings

Chaque lentille écrit **un** fichier `<findingsDir>/<lentille>.json`, puis rend en réponse finale
une seule ligne : `OK <n> findings → <chemin>`.

```json
{
  "lens": "clean-code",
  "summary": "2-4 phrases : appréciation globale du diff sous cet angle.",
  "strengths": ["point fort concret, avec fichier si possible"],
  "findings": [
    {
      "path": "src/components/Foo.vue",
      "line": 42,
      "start_line": 38,
      "severity": "P1",
      "category": "correctness",
      "title": "Watch sans cleanup sur une souscription",
      "body": "Explication : le problème, le scénario concret qui casse, la correction.",
      "suggestion": "code de remplacement EXACT des lignes start_line..line (optionnel)",
      "confidence": "high"
    }
  ]
}
```

## Règles

- `path` : relatif à la racine du repo, tel qu'il apparaît dans le diff.
- `line` : en mode PR, numéro de ligne dans la **nouvelle** version du fichier (côté head), en
  visant une ligne **présente dans le diff** (`commentable.json`) chaque fois que c'est possible.
  En mode dossier, numéro de ligne du fichier tel qu'il est dans l'arbre de travail, sans
  contrainte de diff. Un problème
  global (fichier entier, absence de test, architecture) prend `"line": null`.
- `start_line` : optionnel, pour une plage contiguë (≤ 15 lignes) qui se termine à `line`.
- `severity` :
  - `P0` : bloquant (bug certain, faille de sécurité, perte de données, régression, build cassé) ;
  - `P1` : important, à corriger avant merge ;
  - `P2` : amélioration recommandée ;
  - `P3` : suggestion mineure ou nit.
- `title` : une phrase courte en français, sans préfixe de référence de règle (`[F1]`, `[R3]`…) :
  la règle citée va dans le `body`.
- `category` : un slug court (`correctness`, `security`, `performance`, `a11y`, `seo`,
  `architecture`, `typing`, `vue`, `scss`, `clean-code`, `tests`, `naming`, `conventions`).
- `suggestion` : seulement si le remplacement exact des lignes `start_line..line` (ou `line`)
  corrige le problème. Sans indentation approximative, sans « … ».
- `confidence` : `high`, `medium` ou `low`. Pas de finding `low` en P0.
- Mode PR : on ne commente **que** le code modifié par la PR, ou du code existant que la PR rend
  fautif. Pas de dette préexistante sans lien avec le diff.
- Mode dossier : tout le code des fichiers revus est dans le périmètre, dette comprise. On
  priorise ce qui a un impact réel, et un défaut répété donne un seul finding.
- `body` est en **français**, avec ses accents, factuel et sans formule de politesse.
- Zéro finding est un résultat valide : `"findings": []`.
