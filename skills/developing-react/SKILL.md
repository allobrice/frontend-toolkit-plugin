---
name: developing-react
description: >
  Expertise React 19+ (19.3) pour écrire, refactorer ou relire du code React moderne de haute
  qualité en TypeScript strict : composants fonctionnels, hooks custom, Actions et formulaires
  (useActionState, useOptimistic, useFormStatus), use(), Suspense, Error Boundaries, état et
  données (useReducer, Context, TanStack Query), effets, performance avec React Compiler, tests
  Vitest + Testing Library, styles en CSS Modules. Applique SOLID, DRY et clean code adaptés à
  React. Utiliser dès qu'il y a du code React : fichiers .tsx/.jsx, useState, useEffect, useRef,
  useContext, useMemo, useCallback, useTransition, forwardRef, Context.Provider, createRoot,
  Vite + React. Déclencher aussi sur : "composant React", "hook custom", "refactore ce composant",
  "migre vers React 19", "trop de useEffect", "re-renders", "prop drilling", "formulaire React",
  "revue de code React", "bonnes pratiques React". Périmètre : React côté client (Vite SPA) ;
  pour Next.js, combiner avec la skill developing-with-nextjs.
---

# React 19+ — code de production

Écrire du React qui se lit comme du métier : des composants petits, un état minimal, des effets
rares, des types qui interdisent les états impossibles. **La version de référence est React 19.3**
(septembre 2026), avec React Compiler 1.0.

## Principes directeurs

1. **Le rendu est une fonction pure.** Props + état → JSX. Pas de mutation, pas d'effet de bord,
   pas de lecture de `ref.current` pendant le rendu.
2. **État minimal, tout le reste se dérive.** Ce qui se calcule à partir des props ou de l'état
   se calcule pendant le rendu — jamais stocké, jamais synchronisé par un effet.
3. **Un effet synchronise avec un système externe**, et rien d'autre. Pas d'effet pour calculer,
   pour réagir à un événement utilisateur ni pour enchaîner des `setState`.
4. **Composition avant configuration.** `children` et slots plutôt qu'une pile de props booléennes.
5. **Les types modélisent le domaine.** Unions discriminées pour les états, props explicites,
   zéro `any`.
6. **Le compilateur mémoïse.** Pas de `useMemo` / `useCallback` / `memo` par réflexe.
7. **Le code direct d'abord.** Une abstraction (hook custom, pattern) répond à une douleur constatée,
   pas à une hypothèse.

## Détecter le contexte avant d'écrire

| Signal dans le projet | Conséquence |
|---|---|
| `react` ≥ 19 dans `package.json` | Idiomes 19 (table ci-dessous). Vérifier la mineure : `<Activity>` / `useEffectEvent` ≥ 19.2, `<ViewTransition>` / Fragment refs ≥ 19.3 |
| `react` 18 | Ne pas utiliser les API 19 ; signaler la migration sans la faire d'office |
| `babel-plugin-react-compiler` ou `reactCompilerPreset` dans la config Vite | Mémoïsation manuelle inutile dans le code neuf |
| `eslint-plugin-react-hooks` en preset `recommended` / `recommended-latest` | Les règles du compilateur sont actives : le lint est une gate |
| `next`, dossier `app/` avec `layout.tsx`, `'use client'` | Projet Next.js : charger aussi `developing-with-nextjs` (Server Components, cache, actions) |
| `*.module.scss` | CSS Modules + SCSS : skill `developing-scss` pour le style |
| `@tanstack/react-query`, `zustand`, `react-router` | Réutiliser l'existant ; ne pas introduire de concurrent |

## Idiomes React 19 — écrire ça, plus ça

| Écrire | Plus | Depuis |
|---|---|---|
| `function Input({ ref, ...props }: ComponentProps<'input'>)` | `forwardRef(...)` | 19.0 |
| `<ThemeContext value={theme}>` | `<ThemeContext.Provider value={theme}>` | 19.0 |
| `const [state, formAction, isPending] = useActionState(action, initial)` | `isLoading` / `error` gérés à la main autour d'un `onSubmit` | 19.0 |
| `<form action={formAction}>` + `FormData` | `onSubmit` + `e.preventDefault()` + état par champ, pour un formulaire non contrôlé | 19.0 |
| `useFormStatus()` dans le bouton d'envoi | prop `isSubmitting` passée à travers l'arbre | 19.0 |
| `useOptimistic(state, reducer)` | état local dupliqué + rollback manuel | 19.0 |
| `use(promise)` sous `<Suspense>`, `use(Context)` conditionnel | `useEffect` + `fetch` + `setState` | 19.0 |
| `<title>`, `<meta>`, `<link>` rendus dans le composant | `react-helmet` | 19.0 |
| Callback ref qui **retourne** une fonction de cleanup | callback ref appelé avec `null` | 19.0 |
| Valeurs par défaut en déstructuration ES | `Component.defaultProps` (supprimé pour les fonctions) | 19.0 |
| `useEffectEvent(fn)` pour la logique non réactive d'un effet | désactiver `exhaustive-deps` ou ref « latest » bricolée | 19.2 |
| `<Activity mode={visible ? 'visible' : 'hidden'}>` pour garder l'état d'un écran masqué | `{visible && <Page />}` quand l'état doit survivre | 19.2 |
| `<ViewTransition>` + `startTransition` (+ `addTransitionType`) | librairie d'animation pour enter/exit/shared element | 19.3 |
| `<Fragment ref={ref}>` pour focus / observers sur un groupe | `<div>` d'emballage ajouté pour obtenir une ref | 19.3 |

Détail, signatures et exemples complets : `references/react19-idioms.md`.

## Arbres de décision

### Où vit cet état ?

```
La valeur se calcule à partir des props / d'un autre état ?
├── Oui → la calculer pendant le rendu. Pas de useState.
└── Non → elle vient du serveur ?
    ├── Oui → cache serveur : TanStack Query (ou use(promise) + Suspense si lecture simple)
    └── Non → elle doit survivre à l'URL / au partage de lien ?
        ├── Oui → paramètres d'URL (router)
        └── Non → utilisée par un seul composant ?
            ├── Oui → useState ; useReducer si 3+ champs ou transitions contraintes
            └── Non → partagée par un sous-arbre ?
                ├── Proche → remonter l'état au parent commun
                ├── Profond, change rarement → Context (un Context par préoccupation)
                └── Global, change souvent → store externe (Zustand / useSyncExternalStore)
```

### Ai-je besoin d'un effet ?

```
Le code s'exécute parce que…
├── l'utilisateur a fait quelque chose → dans le gestionnaire d'événement
├── une valeur se dérive d'une autre → calcul pendant le rendu
├── un état doit être réinitialisé quand une prop change → `key` sur le composant
├── il faut charger des données → TanStack Query / use() ; effet + AbortController en dernier recours
└── il faut se synchroniser avec un système externe (DOM, socket, timer, API navigateur)
    └── useEffect, avec cleanup systématique ; useSyncExternalStore pour s'abonner à un store
```

### Mémoïser ?

```
React Compiler actif ?
├── Oui → ne rien mémoïser à la main. Exception mesurée : dépendance d'effet qui doit rester stable.
└── Non → mémoïser seulement si le Profiler montre un coût réel
    (liste longue, calcul lourd, enfant memo() qui reçoit une callback)
```

## SOLID, DRY et patterns appliqués à React

| Principe | Forme React | Signal de violation |
|---|---|---|
| **S**RP | un composant = une raison de changer ; logique → hook, présentation → composant | composant > ~150 lignes, 3+ `useEffect`, fetch + mise en forme + layout au même endroit |
| **O**CP | composition : `children`, slots, render props, map `variante → composant` | chaque nouvelle variante ajoute une prop booléenne ou une branche au `switch` |
| **L**SP | un composant qui enveloppe un élément natif accepte et transmet `ComponentProps<'button'>` | wrapper qui casse `disabled`, `aria-*`, `ref` ou `className` |
| **I**SP | props minimales et ciblées ; passer `user.name`, pas `user` entier | composant qui reçoit un objet de 20 champs pour en lire 2 |
| **D**IP | dépendances injectées : props, Context, paramètres de hook | `fetch` / client HTTP importé en dur dans un composant de présentation |
| DRY | règle de trois : extraire au **troisième** usage, en hook ou en composant | abstraction créée au premier usage, paramétrée par des booléens |

Avant de nommer un pattern, vérifier que React ne le fournit pas déjà : un hook custom *est* une
Strategy ou un Decorator, Context *est* une injection de dépendances, la composition *est* l'OCP,
`useReducer` + union discriminée *est* une machine à états.

Patterns de hooks (Strategy, Adapter, Decorator, machine à états, Command/undo) :
`references/hook-patterns.md`. Diagnostic par symptôme hors React : skill `writing-clean-code`.

## Conventions

### Nommage et fichiers

- Composants : `PascalCase`, un composant exporté par fichier, `UserCard.tsx`.
- Hooks : `useXxx`, nom qui dit **ce que** le hook fournit (`useCartTotal`, pas `useCartLogic`).
- Gestionnaires : `handleXxx` dans le composant, prop `onXxx` dans l'API publique.
- Booléens : `isXxx`, `hasXxx`, `canXxx`.
- Exports nommés ; `export default` seulement si l'outillage l'exige (lazy routes).
- Colocation par feature : `features/cart/{CartPanel.tsx, CartPanel.module.scss, useCart.ts, CartPanel.test.tsx}`.

### Ordre dans un composant

```tsx
// 1. imports (externes, internes, styles)
// 2. types des props
// 3. export function Component({ ...props }: Props) {
//      hooks (contexte, état, données, refs)
//      valeurs dérivées
//      gestionnaires d'événements
//      effets (rares)
//      early returns (chargement, erreur, vide)
//      JSX
//    }
```

### TypeScript

- Props : `type Props = { … }` ; étendre les éléments natifs avec `ComponentProps<'button'>`.
- `children: ReactNode` ; slots typés en `ReactNode`, render props typées.
- Événements : `ChangeEvent<HTMLInputElement>`, `FormEvent<HTMLFormElement>` — ou inférés via le JSX.
- Pas de `React.FC`. Pas de `any`, `@ts-ignore`, ni `as` de confort. Typage avancé : skill `developing-typescript`.

### Styles

CSS Modules + SCSS (`Component.module.scss`, `import styles from './Component.module.scss'`).
Variantes par classes composées (`clsx` si présent), jamais de style inline pour du statique.
Tokens, mixins, responsive, thème : skill `developing-scss`.

## Rappels critiques

- **JAMAIS** de `setState` pendant le rendu, ni de lecture/écriture de `ref.current` pendant le rendu.
- **JAMAIS** d'index comme `key` sur une liste qui bouge ; une `key` stable issue des données.
- **JAMAIS** de composant défini à l'intérieur d'un autre composant (remontage à chaque rendu).
- **JAMAIS** de `dangerouslySetInnerHTML` sur du contenu non sanitisé, ni d'URL `javascript:`.
- **TOUJOURS** un cleanup pour un abonnement, un timer, un listener, une requête en vol.
- **TOUJOURS** un `<Suspense>` et un Error Boundary autour de ce qui suspend ou peut échouer.
- **TOUJOURS** du HTML sémantique : `<button>` pour une action, `<a>` pour une navigation, `<label>` associé.
- **PRÉFÉRER** une union discriminée (`{ status: 'idle' | 'loading' | 'success' | 'error' }`) à plusieurs booléens.
- **PRÉFÉRER** réinitialiser par `key` plutôt que par effet.
- **NE PAS** désactiver `react-hooks/exhaustive-deps` : la règle signale un défaut de conception.

## Fichiers de référence

| Fichier | Contenu | Quand le lire |
|---|---|---|
| [references/react19-idioms.md](references/react19-idioms.md) | Actions, formulaires, `use`, `useOptimistic`, ref en prop, Context, métadonnées, `useEffectEvent`, `<Activity>`, `<ViewTransition>`, Fragment refs, React Compiler | Écriture de code neuf, migration 18 → 19, doute sur une API |
| [references/component-patterns.md](references/component-patterns.md) | Composition, slots, compound components, contrôlé / non contrôlé, composants génériques, wrappers de natifs, polymorphisme | Conception d'un composant ou d'une librairie de composants |
| [references/hook-patterns.md](references/hook-patterns.md) | Hooks custom bien conçus, patterns GoF / SOLID en hooks | Logique réutilisable, composant qui grossit, choix d'une structure |
| [references/state-and-data.md](references/state-and-data.md) | État local / dérivé / URL / serveur / global, `useReducer`, Context découpé, stores externes, TanStack Query, Suspense, Error Boundaries, routing | Choix d'état, chargement de données, gestion d'erreurs |
| [references/effects.md](references/effects.md) | Quand un effet est légitime, cleanup, races, `AbortController`, `useEffectEvent`, `useSyncExternalStore` | Tout `useEffect` à écrire ou à relire |
| [references/performance.md](references/performance.md) | React Compiler, mémoïsation manuelle, transitions, `useDeferredValue`, lazy, virtualisation, Profiler | Lenteur, re-renders, bundle, listes longues |
| [references/testing.md](references/testing.md) | Vitest + Testing Library + user-event, requêtes par rôle, hooks, MSW, formulaires et Actions | Écriture ou revue de tests |
| [references/anti-patterns.md](references/anti-patterns.md) | Catalogue avant / après des erreurs courantes, sécurité | Revue de code, refactoring, debugging |

## Frontière avec les autres skills

- **Typage avancé** (génériques, inférence, unions, typage d'API) → `developing-typescript`.
- **Styles** (SCSS, tokens, BEM, responsive, thème) → `developing-scss`.
- **Code smells, SOLID, patterns hors React** → `writing-clean-code`.
- **JavaScript pur, Node, sécurité JS** → `developing-javascript`.
- **Next.js** (RSC, Server Actions, App Router, cache) → `developing-with-nextjs`.
- **Conventions du dépôt** → le `CLAUDE.md` du projet, qui prime toujours sur cette skill.
