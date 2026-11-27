# Effets

Un effet **synchronise un composant avec un système externe** : DOM impératif, réseau, socket,
timer, API navigateur, widget tiers. Tout le reste a une meilleure place.

## Sommaire

1. Tu n'as probablement pas besoin d'un effet
2. Écrire un effet correct
3. Données : races et annulation
4. `useEffectEvent` pour la logique non réactive
5. `useLayoutEffect`
6. Strict Mode : le double montage est un test
7. Lint : ne pas le faire taire

---

## 1. Tu n'as probablement pas besoin d'un effet

| Intention | ❌ Avec effet | ✅ Sans effet |
|---|---|---|
| Dériver une valeur | `useEffect(() => setFull(first + ' ' + last), [first, last])` | `` const full = `${first} ${last}` `` |
| Filtrer / trier une liste | `useEffect(() => setVisible(filter(items)), [items])` | `const visible = filter(items)` |
| Réagir à un clic, une soumission | effet qui observe un drapeau `submitted` | code dans le gestionnaire d'événement |
| Réinitialiser l'état quand une prop change | `useEffect(() => reset(), [userId])` | `<Profile key={userId} />` |
| Ajuster une partie de l'état sur changement de prop | effet + `setState` | dériver ; à défaut, comparer la prop précédente pendant le rendu |
| Notifier le parent d'un changement | `useEffect(() => onChange(value), [value])` | appeler `onChange` dans le même gestionnaire que `setValue` |
| Chaîne d'effets qui se déclenchent l'un l'autre | effet A → `setState` → effet B | calculer l'état suivant en une fois dans le gestionnaire |
| Initialiser l'app une fois | `useEffect(init, [])` | code de module exécuté avant `createRoot` |
| Charger des données | `useEffect` + `fetch` + `setState` | TanStack Query, loader de route, `use(promise)` |
| S'abonner à un store | effet + `setState` | `useSyncExternalStore` |

Le linter (`set-state-in-effect`) signale le `setState` synchrone dans un effet : c'est presque
toujours un état dérivé déguisé.

---

## 2. Écrire un effet correct

```tsx
useEffect(() => {
  const intervalId = setInterval(() => setNow(new Date()), 1_000)
  return () => clearInterval(intervalId)
}, [])
```

Règles :

- **Un effet = une synchronisation.** Deux systèmes externes → deux effets.
- **Cleanup systématique** pour tout ce qui est ouvert : listener, timer, observer, socket,
  abonnement, requête.
- **Dépendances honnêtes** : tout ce qui est lu et réactif est déclaré. Si la liste relance trop
  souvent, changer le code (déplacer la logique, `useEffectEvent`, objet créé dans l'effet), pas
  la liste.
- Pas d'objet ou de fonction créés pendant le rendu en dépendance : les créer **dans** l'effet.

```tsx
// ❌ `options` est un nouvel objet à chaque rendu → reconnexion permanente
const options = { serverUrl, roomId }
useEffect(() => {
  const connection = createConnection(options)
  connection.connect()
  return () => connection.disconnect()
}, [options])

// ✅ Dépendre des primitives
useEffect(() => {
  const connection = createConnection({ serverUrl, roomId })
  connection.connect()
  return () => connection.disconnect()
}, [serverUrl, roomId])
```

---

## 3. Données : races et annulation

En dernier recours (pas de TanStack Query, pas de loader), un fetch dans un effet doit gérer
l'annulation : sinon une réponse lente écrase une réponse plus récente.

```tsx
useEffect(() => {
  const controller = new AbortController()

  fetchResults(query, controller.signal)
    .then(setResults)
    .catch((error: unknown) => {
      if (controller.signal.aborted) return
      setError(toError(error))
    })

  return () => controller.abort()
}, [query])
```

Si ce motif apparaît deux fois, c'est le signe qu'il faut TanStack Query, pas un hook maison.

---

## 4. `useEffectEvent` pour la logique non réactive (19.2+)

Quand un effet doit **lire** une valeur sans **réagir** à ses changements :

```tsx
function PageTracker({ url, userId }: { url: string; userId: string }) {
  const trackVisit = useEffectEvent((visitedUrl: string) => {
    analytics.track('page_view', { url: visitedUrl, userId })
  })

  useEffect(() => {
    trackVisit(url)
  }, [url]) // un changement de userId seul ne retrace pas la page
}
```

Avant 19.2, ou pour un projet en React 18 : ne pas désactiver le lint ; restructurer.

---

## 5. `useLayoutEffect`

Uniquement pour **mesurer le DOM et ajuster avant l'affichage** (position d'un tooltip, hauteur
d'un élément) afin d'éviter un clignotement. Il bloque la peinture : ne rien y faire d'autre.

---

## 6. Strict Mode : le double montage est un test

En développement, React monte, démonte, puis remonte chaque composant (et, depuis 19.3, aussi
pendant l'hydratation). Un effet qui casse sous ce double appel a un cleanup manquant ou
incorrect. Ne jamais « corriger » avec une ref `hasRun` : corriger le cleanup.

---

## 7. Lint : ne pas le faire taire

`// eslint-disable-next-line react-hooks/exhaustive-deps` cache un bug de synchronisation (valeur
périmée, effet qui ne se relance pas). Traiter la cause :

| Le linter réclame… | Cause probable | Correctif |
|---|---|---|
| une fonction définie dans le composant | la fonction n'a pas besoin d'être dans le composant | la sortir du composant, ou la déclarer dans l'effet |
| une valeur qu'on veut lire sans réagir | logique d'événement mélangée à la synchro | `useEffectEvent` |
| un objet recréé à chaque rendu | dépendance non primitive | dépendre des champs primitifs |
| l'état qu'on met à jour | mise à jour fonctionnelle oubliée | `setX((prev) => …)` |
