# Audit Checklist — Grille d'évaluation structurée

Grille d'audit UI/UX en 7 axes. À utiliser pour évaluer une UI existante (capture d'écran, prototype, composant, page).

## Format d'audit recommandé

```markdown
## Synthèse
[1-2 phrases sur l'état général de l'UI]

## Points forts
- [ce qui est bien fait, avec loi/pattern qui le confirme]

## Problèmes

### 🔴 Critique (bloquant ou forte friction)
- **[titre court du problème]**
  - Axe : [hiérarchie / cohérence / ...]
  - Description : [ce qui pose problème concrètement]
  - Loi/pattern violé : [référence]
  - Impact utilisateur : [ce qu'il ressent]
  - Correction : [action concrète et réalisable]

### 🟠 Important (friction notable)
[idem]

### 🟡 Mineur (amélioration qualitative)
[liste plus courte]

## Recommandations prioritaires
1. [Top 1 — plus fort ROI]
2. [Top 2]
3. [Top 3]
```

**Ne PAS lister plus de 10-12 problèmes au total.** Prioriser = valeur. Un audit qui signale tout sans hiérarchie est ingérable.

---

## Les 7 axes d'audit

### Axe 1 — Hiérarchie visuelle
Questions à se poser :

- [ ] Test du "squint" : en plissant les yeux, les 3 éléments qui ressortent sont-ils bien les 3 que le designer voulait mettre en avant ?
- [ ] Y a-t-il **un seul** CTA primaire par zone de décision ? (Von Restorff)
- [ ] Les titres sont-ils clairement plus proéminents que le corps ? (Taille + poids + couleur)
- [ ] L'espace blanc est-il utilisé pour créer des groupes visuels clairs ? (Gestalt — Proximity)
- [ ] Les éléments secondaires sont-ils visuellement au niveau approprié (pas en compétition avec le primaire) ?
- [ ] Les niveaux de hiérarchie sont-ils au plus 3 (primaire, secondaire, tertiaire) ?

Lois mobilisées : Von Restorff, Prägnanz, Proximity, Similarity, Selective Attention.

### Axe 2 — Lisibilité et typographie
Questions à se poser :

- [ ] Le contraste du texte est-il ≥ 4.5:1 (WCAG AA) sur tous les fonds ?
- [ ] La taille du body est-elle ≥ 16 px (ou équivalent) ?
- [ ] Le line-height est-il d'environ 1.5 pour les paragraphes ?
- [ ] La longueur de ligne est-elle entre 50 et 75 caractères ?
- [ ] Y a-t-il au plus 2-3 poids de police utilisés ?
- [ ] Au plus 2 familles de police ?
- [ ] L'échelle typographique est-elle cohérente (pas de 15px et 17px arbitraires) ?
- [ ] Pas de texte en all caps sur du contenu long ?

Lois mobilisées : Aesthetic-Usability Effect, Cognitive Load.

### Axe 3 — Cohérence
Questions à se poser :

- [ ] Les mêmes actions ont-elles le même style à travers l'interface ? (Similarity)
- [ ] Les espacements suivent-ils une échelle (4/8 px grid) ?
- [ ] Les couleurs viennent-elles toutes du design system ?
- [ ] Les border-radius sont-ils cohérents entre éléments adjacents ?
- [ ] Les icônes sont-elles d'une même famille, même stroke, même style ?
- [ ] Le vocabulaire est-il cohérent (ex : pas alterner « Enregistrer » et « Sauvegarder » pour la même action) ?
- [ ] Les états (hover, focus, disabled) sont-ils définis et cohérents partout ?

Lois mobilisées : Jakob's Law, Similarity, Law of Common Region.

### Axe 4 — Feedback et états
Questions à se poser :

- [ ] Toute action a-t-elle un feedback visible en < 100 ms ?
- [ ] Les boutons ont-ils tous les états (default/hover/focus/active/disabled/loading) ?
- [ ] Le focus ring est-il visible au clavier ? (Pas `outline: none` nu)
- [ ] Les opérations longues ont-elles un indicateur de progression ?
- [ ] Les états vides, de chargement, et d'erreur sont-ils conçus ?
- [ ] Les messages de succès sont-ils clairs et rassurants ?
- [ ] Les messages d'erreur expliquent-ils quoi faire ?

Lois mobilisées : Doherty Threshold, Peak-End Rule.

### Axe 5 — Charge cognitive et décision
Questions à se poser :

- [ ] Le nombre d'options simultanées est-il raisonnable (< 7 en navigation, < 10 en listes courtes) ? (Hick + Miller)
- [ ] Chaque élément affiché justifie-t-il sa présence ? (Occam)
- [ ] Y a-t-il des choix qui pourraient être pré-remplis par défaut intelligent ?
- [ ] Le parcours d'action principale est-il direct (peu de clics, peu de décisions) ?
- [ ] Les infos sont-elles regroupées en chunks lisibles ? (Chunking)
- [ ] Les labels et actions utilisent-ils le vocabulaire utilisateur, pas le jargon interne ? (Mental Model)
- [ ] L'utilisateur doit-il mémoriser une info entre deux écrans ? (Working Memory)

Lois mobilisées : Hick's Law, Miller's Law, Occam's Razor, Tesler's Law, Cognitive Load, Mental Model.

### Axe 6 — Accessibilité de base
Questions à se poser :

- [ ] Zones tactiles ≥ 44×44 px sur les actions principales ? (Fitts)
- [ ] Contraste texte ≥ 4.5:1 ?
- [ ] Contraste UI (bordures, icônes) ≥ 3:1 ?
- [ ] L'info n'est-elle jamais communiquée par la couleur seule ?
- [ ] Les icônes sans texte ont-elles un label accessible (aria-label ou tooltip) ?
- [ ] L'ordre de tabulation est-il logique ?
- [ ] Les inputs ont-ils tous un label associé ?
- [ ] `prefers-reduced-motion` est-il respecté ?

Note : ceci est un audit **de base**. Pour un audit WCAG complet, utiliser un skill a11y dédié.

### Axe 7 — Mobile et responsive
Questions à se poser :

- [ ] Les zones tactiles principales sont-elles dans la zone accessible au pouce (bas d'écran) ?
- [ ] Font-size ≥ 16 px sur inputs (pour éviter zoom iOS) ?
- [ ] Les tableaux s'adaptent-ils (scroll horizontal prévu, cartes empilées...) ?
- [ ] Les modales/drawers prennent-ils une hauteur adaptée sur mobile ?
- [ ] Les formulaires utilisent-ils les bons `type` / `inputmode` / `autocomplete` ?
- [ ] Pas d'actions en hover-only ?
- [ ] Les textes et espacements sont-ils ajustés pour l'écran mobile ?

Lois mobilisées : Fitts's Law, Jakob's Law.

---

## Questions à poser avant de juger

Si le contexte est incomplet, ne pas improviser. Demander :

1. **Qui est l'utilisateur cible ?** (débutant, expert, récurrent)
2. **Quel est l'objectif primaire de cet écran ?** (acquisition, conversion, rétention, usage quotidien)
3. **Contraintes techniques ?** (stack, design system existant, legacy)
4. **Plateforme principale ?** (desktop, mobile, tablette)
5. **Quelle friction observée en analytics/retours utilisateurs ?**

Sans ces réponses, un audit reste des suppositions. Mieux vaut clarifier avant qu'après.

---

## Prioriser : matrice impact / effort

Pour la section "Recommandations prioritaires", penser chaque problème selon :

| | Effort faible | Effort élevé |
|---|---|---|
| **Impact fort** | 🟢 Quick wins — à faire en premier | 🟠 À planifier — gros chantier rentable |
| **Impact faible** | 🟡 Nice to have — si temps | 🔴 À éviter — mauvais ROI |

Mettre en avant les quick wins (impact fort + effort faible) même si ce sont des détails : c'est ce qui transforme le plus vite un produit.

---

## Exemples de recommandations actionnables (vs vagues)

### Mauvaise recommandation
❌ « Améliorer la hiérarchie. »

### Bonne recommandation
✅ « Le titre h1 et le CTA partagent la même taille et le même poids visuel, ce qui crée une ambiguïté sur l'élément principal. Réduire le titre à 24px et renforcer le CTA avec un fond coloré plein (actuellement en outline) pour le positionner comme action primaire unique. (Violation : Von Restorff — aucun élément ne se détache.) »

### Mauvaise recommandation
❌ « Formulaire trop long. »

### Bonne recommandation
✅ « Le formulaire d'inscription comporte 11 champs, dont 6 sont optionnels (adresse, téléphone, date de naissance, genre, société, profession). Proposer de ne garder que email + mot de passe + prénom à l'inscription, et différer les autres infos au moment où elles sont utiles dans le parcours (progressive profiling). Gain attendu : taux de complétion estimé +30-50 % (études Unbounce, HubSpot sur formulaires courts). »

---

## Règle d'or de l'audit

> Un audit n'est utile que s'il est **actionnable**. Chaque problème signalé doit pouvoir être corrigé par le destinataire sans nouvelle recherche. Un audit qui dit « ce n'est pas bien » sans expliquer **pourquoi** ni **comment corriger** est du bruit.
