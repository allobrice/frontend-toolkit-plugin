# Format Agent Handoff

Ce fichier définit le format du bloc de passation qui termine chaque rapport d'audit.
Il est conçu pour être consommé directement par un agent développeur (`vue-developer`,
`developing-vue`, ou tout agent frontend) sans reformulation.

---

## Règles de génération

1. **Une tâche = un finding** : chaque P0, P1, et P2 significatif devient une tâche numérotée
2. **Ordre par priorité** : P0 → P1 → P2 → P3
3. **Atomicité** : chaque tâche est indépendante et implémentable en une session
4. **Critères d'acceptance** : chaque tâche a des critères vérifiables par l'agent
5. **Diff minimal** : pour P0 et P1, inclure le code avant/après

---

## Format du bloc

````markdown
---

## 🤖 Agent Handoff — Plan de correction accessibilité

> **À destination de** : agent `vue-developer` (ou tout agent frontend)  
> **Stack** : [Vue 3 / Nuxt 4 / HTML vanilla / ...]  
> **Niveau WCAG cible** : AA  
> **Fichiers concernés** : `[liste des fichiers à modifier]`

### Contexte

[2-3 phrases résumant l'état actuel et ce qui est attendu en sortie]

---

### Tâches de correction

#### TÂCHE A1 — [Titre court] 🔴 P0

**Critère WCAG** : SC X.X.X — [Nom du critère]  
**Impact utilisateur** : [Qui est bloqué et pourquoi]  
**Localisation** : `[fichier]:[ligne ou section]`

**Avant** :
```html
[code problématique]
```

**Après** :
```html
[code corrigé]
```

**Critères d'acceptance** :
- [ ] [Vérification 1 — ex: "L'élément a un attribut aria-label non vide"]
- [ ] [Vérification 2 — ex: "Le bouton est atteignable via Tab"]
- [ ] [Vérification 3 — ex: "VoiceOver annonce correctement le nom et le rôle"]

---

#### TÂCHE A2 — [Titre court] 🟠 P1

**Critère WCAG** : SC X.X.X  
**Impact utilisateur** : ...  
**Localisation** : `[fichier]`

**Avant** :
```html
[code]
```

**Après** :
```html
[code corrigé]
```

**Critères d'acceptance** :
- [ ] ...

---

#### TÂCHE A3 — [Titre court] 🟡 P2

**Critère WCAG** : SC X.X.X  
**Description** : [Explication sans code si la correction est évidente]  
**Localisation** : `[fichier]`

**Critères d'acceptance** :
- [ ] ...

---

[Répéter pour chaque tâche]

---

### Checklist de validation globale

Une fois toutes les tâches complétées, l'agent doit vérifier :

**Navigation clavier**
- [ ] Toute l'interface est navigable au clavier (Tab, Shift+Tab, Enter, Espace, Flèches)
- [ ] Aucun focus trap non intentionnel
- [ ] Skip link présent et fonctionnel

**Lecteur d'écran**
- [ ] Tous les éléments interactifs ont un nom accessible
- [ ] Les états dynamiques (expanded, selected, invalid) sont annoncés
- [ ] Les messages d'erreur de formulaire sont liés aux champs

**Structure**
- [ ] Hiérarchie de titres cohérente (h1 → h2 → h3)
- [ ] Landmarks présents (header, nav, main, footer)
- [ ] Images décoratives avec `alt=""`

**Contrastes**
- [ ] Texte normal ≥ 4.5:1
- [ ] Grand texte et composants UI ≥ 3:1

**Outils recommandés pour validation**
- axe DevTools (extension Chrome/Firefox) — vérification automatique
- Lighthouse (onglet Accessibility) — score de référence
- Navigation clavier manuelle — Tab sur toute la page
- NVDA (Windows) ou VoiceOver (macOS/iOS) — test lecteur d'écran

---

### Notes pour l'agent

- Respecter la stack Vue 3 Composition API + TypeScript détectée
- Utiliser `radix-vue` pour les composants complexes (Dialog, Select) si disponible dans le projet
- Consulter le skill `developing-vue` pour les patterns Vue
- Tester avec `@vue/test-utils` + `jest-axe` pour automatiser la validation des critères WCAG
````

---

## Exemple concret minimal

````markdown
## 🤖 Agent Handoff — Plan de correction accessibilité

> **À destination de** : agent `vue-developer`  
> **Stack** : Vue 3, Nuxt 4, TypeScript  
> **Niveau WCAG cible** : AA  
> **Fichiers concernés** : `components/SearchBar.vue`, `components/Modal.vue`, `pages/index.vue`

### Contexte

L'audit a identifié 2 blocages P0 (bouton de recherche sans label, modale sans focus trap)
et 3 P1 (champs de formulaire sans association label/input, focus invisible, pas de skip link).
Ces corrections sont nécessaires avant mise en production.

---

### Tâches de correction

#### TÂCHE A1 — Ajouter un label au bouton de recherche 🔴 P0

**Critère WCAG** : SC 4.1.2 — Name, Role, Value  
**Impact utilisateur** : Les utilisateurs de lecteurs d'écran entendent "bouton" sans savoir ce que fait le bouton  
**Localisation** : `components/SearchBar.vue:34`

**Avant** :
```html
<button @click="search">
  <svg><!-- icône loupe --></svg>
</button>
```

**Après** :
```html
<button @click="search" aria-label="Lancer la recherche">
  <svg aria-hidden="true" focusable="false"><!-- icône loupe --></svg>
</button>
```

**Critères d'acceptance** :
- [ ] Le bouton possède un `aria-label` non vide
- [ ] L'icône SVG a `aria-hidden="true"` pour éviter la double annonce
- [ ] VoiceOver/NVDA annonce "Lancer la recherche, bouton"
````
