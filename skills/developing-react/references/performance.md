# Performance

Mesurer d'abord, optimiser ensuite. Avec React Compiler, la plupart des optimisations manuelles
d'hier sont du bruit. Pour un audit complet (Core Web Vitals, bundle, Lighthouse) : skill
`auditing-performance`.

## Sommaire

1. Ordre des leviers
2. React Compiler et mémoïsation manuelle
3. Réduire le travail de rendu sans mémoïser
4. Réactivité perçue : transitions et `useDeferredValue`
5. Listes longues
6. Bundle : lazy et découpage
7. Mesurer

---

## 1. Ordre des leviers

1. **Architecture d'état** : état placé au plus près de son usage, pas de Context global qui
   change souvent, pas d'état serveur recopié. C'est la première cause de re-renders inutiles.
2. **Composition** : passer des éléments en `children` pour qu'ils ne re-rendent pas avec le parent.
3. **Transitions** pour garder l'UI réactive pendant un rendu lourd.
4. **Virtualisation** pour les listes longues.
5. **Lazy loading** des routes et des composants lourds.
6. **Mémoïsation manuelle** — seulement si le Profiler la justifie et que le compilateur ne la
   fournit pas.

---

## 2. React Compiler et mémoïsation manuelle

| Situation | Conduite |
|---|---|
| Compilateur actif, code neuf | aucun `useMemo` / `useCallback` / `memo` |
| Compilateur actif, identité stable requise par un tiers (dépendance d'effet d'une lib, comparaison par référence) | `useMemo` / `useCallback` ciblé, en échappatoire |
| Compilateur actif, code existant mémoïsé | laisser en place ; retirer seulement avec tests |
| Pas de compilateur | mémoïser seulement après mesure : calcul lourd, liste longue, enfant `memo()` qui reçoit une callback |
| Composant que le compilateur refuse d'optimiser | corriger la violation des règles de React signalée par le linter |

Le compilateur suppose un code **pur** : pas de mutation de props ou d'état, pas de lecture de
`ref.current` pendant le rendu, pas de valeur globale mutable lue pendant le rendu. Un composant
qui viole ces règles n'est pas optimisé (et peut se comporter différemment).

---

## 3. Réduire le travail de rendu sans mémoïser

### Descendre l'état

```tsx
// ❌ Taper dans la recherche re-rend toute la page
function Page() {
  const [query, setQuery] = useState('')
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <SearchResults query={query} />
      <ExpensiveDashboard />
    </>
  )
}

// ✅ L'état vit dans la partie qui en a besoin
function Page() {
  return (
    <>
      <Search />
      <ExpensiveDashboard />
    </>
  )
}
```

### Monter le contenu

```tsx
// `children` est créé par le parent : il ne re-rend pas quand l'état de ScrollTracker change
function ScrollTracker({ children }: { children: ReactNode }) {
  const scrollY = useScrollY()
  return <div data-scrolled={scrollY > 0}>{children}</div>
}

<ScrollTracker><HeavyContent /></ScrollTracker>
```

### Keys stables

Une `key` instable (index sur une liste triée, `Math.random()`, `crypto.randomUUID()` au rendu)
détruit et recrée les composants : perte d'état et coût de montage.

---

## 4. Réactivité perçue

### `useTransition` / `startTransition`

Marque une mise à jour comme non urgente : la saisie reste fluide, l'UI précédente reste visible
au lieu d'un fallback Suspense.

```tsx
const [isPending, startTransition] = useTransition()

function handleTabChange(tab: Tab) {
  startTransition(() => setActiveTab(tab))
}

<div aria-busy={isPending} className={clsx(styles.panel, isPending && styles.stale)}>…</div>
```

### `useDeferredValue`

Pour une valeur qui pilote un rendu coûteux et qu'on ne contrôle pas à la source :

```tsx
const deferredQuery = useDeferredValue(query)
const isStale = query !== deferredQuery

<SearchResults query={deferredQuery} className={clsx(isStale && styles.stale)} />
```

Le debounce reste pertinent pour **limiter les appels réseau**, pas pour la fluidité du rendu.

---

## 5. Listes longues

Au-delà de quelques centaines d'éléments rendus, virtualiser (`@tanstack/react-virtual` si
présent). Alternatives d'abord : pagination, chargement incrémental, `content-visibility: auto`
en CSS pour des sections longues mais non homogènes.

---

## 6. Bundle

- Routes en `lazy` ; composants lourds et rarement affichés (éditeur riche, graphiques, carte)
  en `lazy(() => import('./Chart'))` sous `<Suspense>`.
- Précharger au survol / à l'intention (`import()` déclenché sur `onPointerEnter`) pour les
  navigations probables.
- Imports nommés et librairies tree-shakables ; pas d'import global d'une librairie d'icônes
  ou d'utilitaires.
- Pas de nouvelle dépendance sans vérifier son poids et sans validation.
- `<Activity mode="hidden">` (19.2) pour pré-rendre un écran probable sans l'afficher.

---

## 7. Mesurer

- **React DevTools Profiler** : quels composants rendent, combien de temps, pourquoi
  (« Highlight updates » et « Record why each component rendered »). Badge « Memo ✨ » = compilé.
- **Performance Tracks** de Chrome DevTools (19.2) : piste Scheduler (priorités blocking /
  transition) et piste Components.
- Mesurer en build de production pour les chiffres absolus ; le mode dev est plus lent.
- Ne déclarer une optimisation que si la mesure avant / après la confirme.
