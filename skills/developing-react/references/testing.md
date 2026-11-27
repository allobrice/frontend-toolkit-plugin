# Tests — Vitest + Testing Library

Tester le comportement que l'utilisateur observe, pas l'implémentation. Un test qui casse lors
d'un refactoring sans changement de comportement est un mauvais test.

## Sommaire

1. Outils et setup
2. Requêtes : par rôle d'abord
3. Interactions : `user-event`
4. Asynchrone, Suspense, Actions
5. Hooks custom
6. Réseau : MSW
7. Fonctions pures d'abord
8. Ce qu'on ne teste pas

---

## 1. Outils et setup

- `vitest` (environnement `jsdom` ou `happy-dom`), `@testing-library/react`,
  `@testing-library/user-event`, `@testing-library/jest-dom` (matchers).
- Réutiliser le setup du projet (`vitest.setup.ts`, helpers `renderWithProviders`). Ne pas
  modifier la config de test sans validation.
- Fichier de test colocalisé : `CartPanel.test.tsx` à côté de `CartPanel.tsx`.
- `act` s'importe de `react` (plus de `react-dom/test-utils`) ; Testing Library l'applique déjà
  pour `render` et `user-event` : ne pas l'ajouter à la main.

Helper de rendu avec providers, créé une fois par projet s'il n'existe pas :

```tsx
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const user = userEvent.setup()
  const result = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  return { user, queryClient, ...result }
}
```

---

## 2. Requêtes : par rôle d'abord

Ordre de préférence : `getByRole` (avec `name`) → `getByLabelText` → `getByText` →
`getByTestId` en dernier recours. Une requête par rôle qui échoue révèle souvent un défaut
d'accessibilité : le corriger dans le composant, pas dans le test.

```tsx
screen.getByRole('button', { name: 'Ajouter au panier' })
screen.getByRole('textbox', { name: 'Adresse e-mail' })
screen.getByRole('alert')
```

- `getBy*` : l'élément doit exister ; `queryBy*` : vérifier l'absence ; `findBy*` : attendre.
- Pas de sélecteurs CSS, pas de `container.querySelector`, pas de test sur des noms de classe.

---

## 3. Interactions : `user-event`

```tsx
it('ajoute le produit et met à jour le total', async () => {
  const { user } = renderWithProviders(<CartPanel initialItems={[]} />)

  await user.click(screen.getByRole('button', { name: 'Ajouter « Clavier »' }))

  expect(screen.getByRole('status')).toHaveTextContent('Total : 49,00 €')
})
```

`userEvent.setup()` une fois par test ; toujours `await` les interactions. `fireEvent` seulement
pour un événement que `user-event` ne sait pas produire.

---

## 4. Asynchrone, Suspense, Actions

```tsx
it("affiche une erreur quand l'inscription échoue", async () => {
  server.use(http.post('/api/signup', () => HttpResponse.json({ message: 'E-mail déjà utilisé' }, { status: 409 })))
  const { user } = renderWithProviders(<SignupForm />)

  await user.type(screen.getByRole('textbox', { name: 'Adresse e-mail' }), 'ada@example.com')
  await user.type(screen.getByLabelText('Mot de passe'), 'correct-horse-battery')
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('E-mail déjà utilisé')
})
```

- `findBy*` / `waitFor` pour l'asynchrone ; jamais de `setTimeout` ni de délai arbitraire.
- Suspense : rendre sous `<Suspense>` et attendre le contenu final avec `findBy*`.
- État en attente : vérifier l'attribut observable (`disabled`, `aria-busy`), pas un état interne.
- `<form action>` réinitialise les champs via `form.reset()`, que `user-event` ne suit pas : la
  saisie suivante se concatène à l'ancienne valeur fantôme. Faire `await user.clear(input)` avant
  de retaper, avec un commentaire qui l'explique ; vérifier le reset réel par `toHaveValue('')`.
- Cas à couvrir pour un formulaire à Action : succès (champ vidé), échec (saisie conservée),
  échec puis succès, envoi par Entrée, double envoi bloqué, saisie pendant l'envoi.
- Timers : `vi.useFakeTimers()` + `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.

---

## 5. Hooks custom

Tester un hook **à travers un composant** quand il est lié à une UI. `renderHook` pour un hook
générique réutilisable :

```tsx
it('bascule hors ligne', () => {
  const { result } = renderHook(() => useOnlineStatus())
  act(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
  })
  expect(result.current).toBe(false)
})
```

---

## 6. Réseau : MSW

Intercepter le réseau avec MSW plutôt que mocker les modules d'API : le test traverse la vraie
couche data (adapters, validation, TanStack Query).

- Handlers par défaut (cas nominal) dans le setup ; surcharge par test avec `server.use(...)`.
- `onUnhandledRequest: 'error'` pour détecter les appels non prévus.
- Mocker un module (`vi.mock`) seulement pour une frontière non réseau (horloge, stockage,
  SDK tiers).

---

## 7. Fonctions pures d'abord

Reducers, adapters, validateurs, calculs de prix : fonctions de module, testées sans React, en
tests rapides et exhaustifs (cas limites, tables `it.each`). Le test de composant vérifie alors
seulement le câblage.

---

## 8. Ce qu'on ne teste pas

- Le fait que React rende (pas de test « le composant s'affiche » sans assertion de comportement).
- Les détails d'implémentation : état interne, nombre de rendus, appels de hooks.
- Les snapshots de gros arbres JSX : fragiles, relus par personne.
- Les librairies tierces elles-mêmes.

Les parcours multi-pages appartiennent aux tests e2e Playwright (agents `playwright-test-*`).
