# Anti-patterns React

Catalogue de revue : chaque entrée donne le signal à repérer, le coût et le correctif. Pour un
diagnostic de code smell général (nommage, fonctions longues, couplage) : skill
`writing-clean-code`.

## Sommaire

1. Rendu impur
2. État
3. Effets
4. Composants
5. Listes et keys
6. TypeScript
7. Accessibilité
8. Sécurité
9. Idiomes périmés

---

## 1. Rendu impur

| Signal | Coût | Correctif |
|---|---|---|
| `setState` appelé directement dans le corps du composant | boucle de rendu | dériver la valeur ; déplacer dans un gestionnaire |
| Lecture / écriture de `ref.current` pendant le rendu | rendu non déterministe, compilateur désactivé | lire les refs dans les gestionnaires et les effets |
| Mutation d'une prop ou de l'état (`items.push`, `props.user.name = …`) | UI non mise à jour, bugs intermittents | copie immuable (`toSorted`, spread, `with`) |
| `Math.random()`, `Date.now()`, `crypto.randomUUID()` dans le JSX | valeurs différentes à chaque rendu, hydratation cassée | `useId` pour les ids ; valeur calculée dans un gestionnaire ou une initialisation d'état |
| Variable de module mutable lue pendant le rendu | tearing, compilateur incorrect | `useSyncExternalStore` ou état React |

---

## 2. État

| Signal | Coût | Correctif |
|---|---|---|
| État qui se recalcule depuis d'autres états / props | désynchronisation, rendus doublés | calcul pendant le rendu |
| Prop copiée dans un `useState` (`useState(props.value)`) | l'état ignore les changements de prop | utiliser la prop ; ou la nommer `initialValue` si c'est voulu |
| 3+ booléens corrélés (`isLoading`, `isError`, `isSuccess`) | états impossibles représentables | union discriminée / `useReducer` |
| Objet sélectionné stocké en double | copie périmée après mise à jour de la liste | stocker l'id, dériver l'objet |
| Données serveur dans un store global synchronisé à la main | cache maison buggé | TanStack Query |
| `AppContext` géant | tout re-rend à chaque changement | un Context par préoccupation, store externe si fréquent |
| État global pour de l'UI locale (modale ouverte dans Redux) | couplage, bruit | `useState` local |

---

## 3. Effets

| Signal | Coût | Correctif |
|---|---|---|
| `useEffect` + `setState` d'une valeur dérivée | rendu supplémentaire, flash | dériver pendant le rendu |
| Effet qui réagit à un événement utilisateur via un drapeau | logique éclatée, double déclenchement | code dans le gestionnaire |
| Effet de reset sur changement de prop | rendu avec état périmé | `key` |
| `fetch` dans un effet sans annulation | réponse obsolète qui écrase la récente | TanStack Query ; sinon `AbortController` |
| Pas de cleanup (listener, timer, socket) | fuites, doublons en Strict Mode | retourner le cleanup |
| `eslint-disable … exhaustive-deps` | valeurs périmées | corriger la cause (`effects.md` §7) |
| Ref `hasRun` pour « empêcher le double effet » | masque un cleanup manquant | corriger le cleanup |
| Chaîne d'effets qui se déclenchent mutuellement | cascades de rendus, ordre opaque | calculer l'état suivant en un seul gestionnaire |

---

## 4. Composants

| Signal | Coût | Correctif |
|---|---|---|
| Composant défini dans un autre composant | remonté à chaque rendu : perte d'état et de focus | le définir au niveau du module |
| Composant de 300+ lignes, plusieurs sujets | revue et tests difficiles | découper par responsabilité (`component-patterns.md` §1) |
| Pile de props booléennes (`primary`, `large`, `withIcon`) | combinaisons invalides, API qui enfle | prop d'énumération par axe, composition |
| Prop drilling sur 3+ niveaux | intermédiaires couplés à des données inutiles | composition (`children`), puis Context |
| Wrapper qui n'étale pas les props natives | perte de `aria-*`, `disabled`, `ref` | `ComponentProps<'x'>` + `...rest` |
| Fonction `renderXxx()` appelée dans le JSX d'un gros composant | sous-composant caché, sans état propre | vrai composant |
| Ternaires imbriqués dans le JSX | illisible | early returns, sous-composants, objet de correspondance |
| `&&` avec un nombre (`{count && <Badge />}`) | affiche `0` | `{count > 0 && <Badge />}` |

---

## 5. Listes et keys

| Signal | Coût | Correctif |
|---|---|---|
| `key={index}` sur une liste triable / filtrable / éditable | état attaché au mauvais élément | id stable issu des données |
| `key={Math.random()}` ou `crypto.randomUUID()` au rendu | remontage complet à chaque rendu | id stable ; générer l'id à la création de l'élément |
| Clés dupliquées | éléments fusionnés ou perdus | clé composée unique |

---

## 6. TypeScript

| Signal | Correctif |
|---|---|
| `any`, `as any`, `@ts-ignore` | typer ; `unknown` + narrowing ; `@ts-expect-error` commenté en dernier recours |
| `as Type` pour faire taire une erreur | corriger le modèle ; valider à la frontière |
| `React.FC` | fonction avec props typées |
| Props optionnelles partout | rendre obligatoire ce qui l'est ; valeurs par défaut en déstructuration |
| `useState<any>()` / `useState()` sans type pour un objet | `useState<User \| null>(null)` |
| Gestionnaire typé `(e: any)` | type inféré par le JSX, ou `ChangeEvent<HTMLInputElement>` |
| `switch` non exhaustif sur une union | `default: return assertNever(x)` |

---

## 7. Accessibilité

| Signal | Correctif |
|---|---|
| `<div onClick>` | `<button type="button">` ; `<a href>` pour naviguer |
| Input sans `<label>` associé | `<label htmlFor>` + `useId` |
| Bouton icône sans nom accessible | `aria-label` ; icône en `aria-hidden` |
| Erreur de champ non reliée | `aria-invalid` + `aria-describedby` |
| Message d'état asynchrone muet | `role="status"` / `role="alert"` |
| Focus perdu après ouverture / fermeture de modale | `<dialog>` natif, ou focus géré et restitué |
| `outline: none` sans alternative | style `:focus-visible` |

Audit complet : skill `auditing-accessibility`.

---

## 8. Sécurité

| Signal | Risque | Correctif |
|---|---|---|
| `dangerouslySetInnerHTML` avec contenu utilisateur | XSS | rendre du texte ; sinon sanitiser (DOMPurify) ; Trusted Types (pris en charge depuis 19.3) |
| `href={userUrl}` sans contrôle | URL `javascript:` | valider le protocole (`http:` / `https:` / `mailto:`) |
| `target="_blank"` vers un domaine tiers | — (`noopener` implicite dans les navigateurs modernes) | garder `rel="noopener noreferrer"` si la politique du projet l'exige |
| Jeton d'authentification dans `localStorage` | vol par XSS | cookie `HttpOnly` côté serveur |
| Secret dans une variable `VITE_*` | exposé dans le bundle | jamais de secret côté client |
| Spread de props non filtrées venant d'une API sur un élément DOM | injection d'attributs | lister les props transmises |

---

## 9. Idiomes périmés

| Périmé | Moderne |
|---|---|
| Class components (hors Error Boundary) | fonctions + hooks |
| `forwardRef` | `ref` en prop |
| `<Context.Provider>` / `useContext` | `<Context value>` / `use(Context)` |
| `defaultProps`, `propTypes` | valeurs par défaut ES, TypeScript |
| `ReactDOM.render` | `createRoot` |
| HOC pour partager de la logique | hook custom |
| `react-helmet` | `<title>` / `<meta>` natifs |
| `useMemo` / `useCallback` par réflexe | React Compiler |
| Formulaire avec `isSubmitting` / `error` gérés à la main | `useActionState`, `useFormStatus` (voir aussi les pièges des Actions, `react19-idioms.md` §1) |
| `useEffect` + `fetch` | TanStack Query, `use(promise)` |
