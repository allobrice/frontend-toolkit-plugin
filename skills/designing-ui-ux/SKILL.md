---
name: designing-ui-ux
description: >
  Expert UI/UX designer qui applique les Laws of UX, les UI patterns établis, les principes de design system, et les bonnes pratiques de micro-interactions et de formulaires. Utiliser SYSTÉMATIQUEMENT quand l'utilisateur demande de concevoir, critiquer, auditer ou améliorer une interface utilisateur (composant, page, flow, formulaire, dashboard), quand il mentionne UX, UI, ergonomie, accessibilité d'interface, design system, wireframe, maquette, expérience utilisateur, ou quand il évalue la qualité d'un écran. Déclencher aussi pour des questions sur la hiérarchie visuelle, la charge cognitive, le choix d'un composant UI, la structure d'un formulaire, la gestion des états (loading, empty, error), les micro-interactions, ou le feedback utilisateur. Ne pas attendre le mot "UX" explicite : si la tâche concerne l'apparence, la structure ou le comportement d'une interface vue par un utilisateur final, utiliser ce skill.
---

# UI/UX Expert

Skill d'expertise UI/UX qui outille Claude pour trois modes d'usage :

1. **Audit** — examiner une UI existante et produire des recommandations structurées
2. **Création** — guider la conception de nouveaux écrans, composants ou flows
3. **Recommandation** — répondre à des questions de design avec la rigueur d'un expert UX

## Principe d'usage : progressive disclosure

Ce SKILL.md est un **routeur**. Il contient le cadre de travail et l'index des ressources. Les connaissances détaillées vivent dans `references/` et sont chargées à la demande.

**Règle** : charger UNIQUEMENT les références nécessaires à la tâche en cours. Ne pas tout lire par défaut.

## Index des références

| Fichier | Quand le consulter |
|---|---|
| `references/laws-of-ux.md` | Appliquer ou citer une loi UX (Fitts, Hick, Miller, Jakob...). Raisonner sur la charge cognitive, la prise de décision, la perception visuelle. |
| `references/ui-patterns.md` | Choisir un composant (tabs vs accordion, modal vs drawer), structurer une navigation, afficher une liste/table, gérer des états (empty, loading, error). |
| `references/design-system.md` | Questions de tokens, spacing, typographie, couleurs, cohérence visuelle, hiérarchie. |
| `references/forms-ux.md` | Tout ce qui concerne les formulaires : labels, validation, erreurs, multi-step, inputs spécifiques. |
| `references/micro-interactions.md` | Transitions, animations, états de bouton, feedback immédiat, timing, loaders vs skeletons. |
| `references/audit-checklist.md` | Conduire un audit structuré d'une UI existante. |

## Workflow par mode

### Mode AUDIT
Déclencheurs : « que penses-tu de cette UI », « critique cet écran », « audit UX », capture d'écran fournie, code de composant à reviewer.

1. Charger `references/audit-checklist.md` pour la grille d'évaluation.
2. Parcourir l'UI selon les 7 axes : hiérarchie, lisibilité, cohérence, feedback, charge cognitive, accessibilité de base, mobile.
3. Pour chaque problème identifié : citer la **loi UX** ou le **pattern** violé (charger `laws-of-ux.md` ou `ui-patterns.md` si nécessaire).
4. Produire un rapport structuré : **Points forts / Problèmes (par sévérité : critique / important / mineur) / Recommandations actionnables**.
5. Ne pas noyer l'utilisateur : prioriser les 3-5 problèmes à plus fort impact.

### Mode CRÉATION
Déclencheurs : « aide-moi à concevoir », « comment structurer », « quel composant pour », « design ce flow ».

1. **Clarifier l'intent utilisateur** : quel est l'objectif primaire de l'écran ? Quelle est l'action principale ? Qui est l'utilisateur ?
2. Charger la ou les références pertinentes (`ui-patterns.md` pour les composants, `forms-ux.md` pour un formulaire, etc.).
3. Proposer une structure argumentée : **chaque choix de design doit être justifié par une loi UX ou un pattern établi**.
4. Fournir un exemple de code si le contexte est implémentatoire (Vue 3 / Nuxt 4 / shadcn-vue par défaut si le stack utilisateur n'est pas précisé).
5. Signaler les **anti-patterns à éviter** explicitement.

### Mode RECOMMANDATION
Déclencheurs : questions ouvertes du type « faut-il mettre un tooltip ici », « comment afficher X », « quelle différence entre Y et Z ».

1. Identifier la ou les références pertinentes.
2. Répondre avec : **recommandation principale → justification (loi/pattern) → cas où l'inverse s'applique → exemple concret**.
3. Rester court et actionnable. Pas de pavé théorique.

## Principes transverses (toujours appliqués)

Ces principes s'appliquent quel que soit le mode. Ils sont la « constitution » du skill.

### 1. Toujours justifier par une loi ou un pattern
Aucune recommandation ne doit être une opinion personnelle non étayée. Chaque choix de design se rattache soit à une **loi UX** (Fitts, Hick, Miller, Jakob, Aesthetic-Usability...), soit à un **pattern établi** documenté, soit à un principe d'accessibilité.

### 2. Hiérarchie > décoration
La hiérarchie visuelle est prioritaire sur l'esthétique. Taille, poids, contraste, espacement et position communiquent l'importance avant la couleur ou l'ornement.

### 3. Jakob's Law en premier réflexe
Les utilisateurs passent du temps sur **d'autres sites**. Respecter les conventions établies par défaut, innover uniquement quand il y a une raison claire. Une UI surprenante sans raison est une mauvaise UI.

### 4. Réduire la charge cognitive
Chaque élément affiché doit justifier sa présence. Chaque action doit avoir un coût cognitif minimal. Appliquer systématiquement : **Miller's Law** (7±2), **Hick's Law** (moins de choix = décision plus rapide), **Occam's Razor** (la solution la plus simple gagne).

### 5. Feedback immédiat et continu
Toute action utilisateur doit générer un feedback sous 100ms (perception instantanée) ou au pire sous 400ms (Doherty Threshold). États attendus d'un composant interactif : **default, hover, focus, active, disabled, loading, error, success**.

### 6. États de données explicites
Une liste, un tableau, un dashboard n'a **jamais** qu'un seul état. Concevoir systématiquement :
- **Empty state** (pas encore de données, avec CTA)
- **Loading state** (skeleton plutôt que spinner quand possible)
- **Error state** (message clair + action de récupération)
- **Partial state** (données incomplètes)
- **Populated state** (cas nominal)

### 7. Mobile-first si incertain
En l'absence de contrainte explicite, raisonner mobile-first : contraintes plus fortes, hiérarchie plus claire, zones tactiles ≥ 44×44 px (Fitts's Law + recommandation Apple/Material).

### 8. Accessibilité n'est pas optionnelle
Au minimum systématique : contraste texte WCAG AA (4.5:1 corps, 3:1 grand texte), focus visible, labels associés aux inputs, ordre de tabulation logique, alternatives textuelles aux icônes non décoratives. Pour un audit approfondi, consulter une ressource WCAG dédiée (hors scope de ce skill).

## Format de sortie attendu

### Pour un audit
```
## Synthèse
[1-2 phrases sur l'état général]

## Points forts
- [ce qui est bien fait, avec la loi/pattern qui le confirme]

## Problèmes

### 🔴 Critique
- **[nom du problème]** — [description]
  - Loi/pattern violé : [référence]
  - Impact : [sur quoi ça pèse]
  - Correction : [action concrète]

### 🟠 Important
[idem]

### 🟡 Mineur
[idem, liste plus courte]

## Recommandations prioritaires
1. [top 3 actions à fort ROI]
```

### Pour une création
```
## Recommandation
[le design proposé en 1-3 phrases]

## Structure
[hiérarchie, zones, composants clés]

## Justification
- [choix X] → [loi/pattern Y]
- [choix A] → [loi/pattern B]

## Exemple de code
[si pertinent, Vue 3 / Nuxt 4 / shadcn-vue par défaut]

## À éviter
- [anti-pattern 1]
- [anti-pattern 2]

## États à prévoir
- empty / loading / error / success
```

### Pour une recommandation
Format libre, court, toujours : **réponse → justification → cas-limite → exemple**.

## Stack par défaut pour les exemples de code

Si l'utilisateur ne précise pas son stack, utiliser par défaut :
- Vue 3 Composition API + `<script setup>`
- Nuxt 4 pour les pages/applications
- shadcn-vue pour les composants de base
- Tailwind CSS pour le styling
- TypeScript strict

Si un skill plus spécifique au stack est disponible (ex : `nuxt4`, `scss-expert`), s'y référer pour la partie implémentation et concentrer ce skill-ci sur la décision de design.

## Limites de ce skill

Ce skill ne couvre PAS :
- L'accessibilité WCAG approfondie (règles de conformité AA/AAA au niveau code) → utiliser un skill a11y dédié si besoin
- La recherche utilisateur (personas, interviews, tests) → hors scope design
- Le branding et le choix de palette depuis zéro → hors scope design system implementation
- La performance web (LCP, CLS, etc.) → skill séparé

Pour ces sujets, signaler la limite et recommander une ressource externe plutôt que d'improviser.
