# Catalogue des code smells

Chaque entrée suit la même forme : **signal** observable → **coût** réel → **correctif**. Le pattern
n'apparaît que s'il est vraiment la bonne réponse.

Ordre de lecture : les cinq premiers couvrent l'essentiel de ce qu'on rencontre au quotidien.

---

## 1. Nom mystérieux

**Signal** — `data`, `info`, `item`, `manager`, `helper`, `utils`, `process()`, `handle()`, `flag`.
Ou un nom qui ment : `getUser()` qui crée un utilisateur s'il n'existe pas.

**Coût** — chaque lecteur doit ouvrir l'implémentation pour savoir de quoi on parle. Sur un fichier
lu cinquante fois et écrit une, c'est le pire rapport possible.

**Correctif** — renommer. C'est le refactoring le plus rentable et le moins risqué du métier.

```ts
// ❌ Que contient `data` ? Que fait `process` ?
function process(data: any[], flag: boolean) { /* … */ }

// ✅ Le nom porte l'intention ; le booléen positionnel disparaît au passage.
function publishBricks(bricks: Brick[], options: { skipValidation: boolean }) { /* … */ }
```

> Si aucun nom juste ne vient, ce n'est pas un problème de vocabulaire : la fonction fait plusieurs
> choses. Le smell réel est plus bas dans cette liste.

---

## 2. Fonction longue

**Signal** — il faut faire défiler pour la lire ; elle a des « sections » séparées par des lignes
vides ou des commentaires (`// validation`, `// puis on formate`).

**Coût** — impossible à tester par morceaux, impossible à réutiliser, revue de code superficielle.

**Correctif** — extraire une fonction par section, en la nommant d'après son *intention*. Les
commentaires de section deviennent des noms de fonction.

```ts
// ❌ Une fonction, trois responsabilités signalées par des commentaires.
function handleTicket(raw: RawTicket) {
  // validation
  if (!raw.key) throw new Error('missing key')
  if (!raw.fields?.summary) throw new Error('missing summary')

  // normalisation
  const ticket = {
    key: raw.key,
    summary: raw.fields.summary.trim(),
    version: raw.fields.fixVersions?.[0]?.name ?? null,
  }

  // effet
  return persist(ticket)
}

// ✅ Chaque étape est nommée, testable isolément, et le flux principal se lit d'un trait.
function handleTicket(raw: RawTicket) {
  assertTicketComplete(raw)
  return persist(toTicket(raw))
}
```

**Seuil pratique** — au-delà de ~30 lignes de logique, poser la question. Ce n'est pas une règle
mécanique : une longue séquence linéaire sans branches peut rester lisible.

---

## 3. Code dupliqué

**Signal** — le même bloc, littéralement ou à un détail près, à trois endroits.

**Coût** — le bug se corrige dans une copie sur trois. Les copies divergent en silence et personne
ne sait laquelle fait autorité.

**Correctif** — extraire. Mais **attendre la troisième occurrence** : à deux, on ne sait pas encore
ce qui varie, et une abstraction prématurée fige la mauvaise variation.

**Piège** — la duplication *accidentelle* : deux blocs identiques aujourd'hui pour des raisons
différentes. Les fusionner crée un couplage entre deux besoins qui vont diverger. Avant d'extraire,
se demander : **« ces deux blocs changeront-ils toujours ensemble ? »** Si non, laisser en double.

---

## 4. Liste de paramètres trop longue

**Signal** — 5 paramètres ou plus ; plusieurs du même type d'affilée ; des booléens.

**Coût** — `render(page, true, false, true)` est illisible à l'appel et l'inversion de deux
arguments du même type passe le typecheck.

**Correctif** — un objet de paramètres nommés. Les booléens deviennent des champs explicites, ou
mieux, une union de valeurs.

```ts
// ❌ Illisible à l'appel, inversion silencieuse des deux booléens.
function renderPage(slug: string, ssr: boolean, cache: boolean, debug: boolean) { /* … */ }
renderPage('/services', true, false, true)

// ✅ L'appel se documente lui-même, l'ordre n'a plus d'importance.
interface RenderOptions {
  slug: string
  mode: 'ssr' | 'csr'
  cache: boolean
  debug?: boolean
}
function renderPage(options: RenderOptions) { /* … */ }
renderPage({ slug: '/services', mode: 'ssr', cache: false, debug: true })
```

---

## 5. Booléen de commande (flag argument)

**Signal** — un paramètre booléen qui fait *brancher* la fonction sur deux comportements.

**Coût** — la fonction fait deux choses ; son nom ne peut en décrire qu'une.

**Correctif** — deux fonctions, ou une union explicite.

```ts
// ❌ Deux comportements sous un seul nom.
function save(ticket: Ticket, asDraft: boolean) { /* … */ }

// ✅ Deux verbes, deux fonctions. L'appel dit ce qu'il fait.
function saveTicket(ticket: Ticket) { /* … */ }
function saveDraft(ticket: Ticket) { /* … */ }
```

---

## 6. Obsession du primitif

**Signal** — tout est `string` ou `number`. Un `string` peut être un slug, un id, une URL ou un
libellé, et rien n'empêche de les confondre.

**Coût** — passer un `userId` là où un `pageId` est attendu compile parfaitement.

**Correctif** — des types de domaine. En TS, les *branded types* donnent la sécurité sans coût à
l'exécution.

```ts
// ❌ Trois string interchangeables.
function linkPage(pageId: string, userId: string, slug: string) { /* … */ }

// ✅ L'inversion devient une erreur de compilation.
declare const brand: unique symbol
type Brand<T, B> = T & { readonly [brand]: B }

type PageId = Brand<string, 'PageId'>
type UserId = Brand<string, 'UserId'>

const asPageId = (raw: string): PageId => raw as PageId

function linkPage(pageId: PageId, userId: UserId, slug: string) { /* … */ }
```

À réserver aux identifiants qu'on risque réellement de confondre — pas à tous les `string` de la
base de code.

---

## 7. Grappe de données (data clump)

**Signal** — les mêmes 3-4 paramètres voyagent toujours ensemble : `(width, height, unit)`,
`(from, to, timezone)`.

**Coût** — chaque ajout de champ modifie toutes les signatures de la chaîne.

**Correctif** — leur donner un nom et un type. S'ils voyagent ensemble, c'est qu'ils forment un
concept que le code n'a pas encore nommé.

---

## 8. Conditionnels imbriqués

**Signal** — trois niveaux d'indentation ou plus ; le cas nominal est enterré au fond.

**Coût** — les cas manquants deviennent invisibles, et l'œil doit tenir la pile mentalement.

**Correctif** — clauses de garde et retours anticipés. Traiter les cas d'exclusion d'abord, laisser
le cas nominal à plat.

```ts
// ❌ Le cas qui compte est au fond du puits.
function getPriority(finding: Finding): string {
  if (finding) {
    if (finding.severity) {
      if (finding.severity >= 3) {
        return 'P0'
      } else {
        return 'P2'
      }
    }
  }
  return 'inconnu'
}

// ✅ Exclusions en tête, cas nominal à plat.
function getPriority(finding: Finding | null): string {
  if (!finding?.severity) return 'inconnu'
  return finding.severity >= 3 ? 'P0' : 'P2'
}
```

---

## 9. Booléens d'état corrélés

**Signal** — `isLoading`, `hasError`, `isEmpty`, `isReady` cohabitent dans le même objet.

**Coût** — 4 booléens = 16 combinaisons, dont la plupart sont impossibles. `isLoading && hasError`
finira par arriver, et l'interface affichera deux choses à la fois.

**Correctif** — une union discriminée : seuls les états légaux sont représentables, et TypeScript
force à traiter chaque cas.

```ts
// ❌ 16 combinaisons, 4 légales.
interface PageState {
  isLoading: boolean
  hasError: boolean
  isEmpty: boolean
  data: Page | null
}

// ✅ 4 états, et `data` n'existe que là où il a un sens.
type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: Page }
  | { status: 'failed'; error: Error }
```

**Pattern associé** — *State machine*, mais seulement si les **transitions** doivent être contraintes
(interdire `failed → loaded` sans repasser par `loading`). Sinon l'union suffit.

---

## 10. `switch` qui grossit

**Signal** — un `switch` sur un champ `type`, auquel on ajoute un `case` à chaque nouveau besoin ;
et parfois le même `switch` recopié dans plusieurs fichiers.

**Coût** — ajouter un type oblige à retrouver tous les `switch` concernés. Il y en a toujours un
qu'on oublie.

**Correctif** — une map `type → handler`, définie une fois.

```ts
// ❌ Recopié dans le résolveur, le validateur et le sérialiseur.
function resolveBrick(type: string) {
  switch (type) {
    case 'hero': return BrickHero
    case 'faq': return BrickFaq
    default: return BrickUnknown
  }
}

// ✅ Une seule source de vérité, exhaustivité vérifiée par le typage.
const BRICK_COMPONENTS = {
  hero: BrickHero,
  faq: BrickFaq,
} satisfies Record<string, Component>

function resolveBrick(type: string): Component {
  return BRICK_COMPONENTS[type as keyof typeof BRICK_COMPONENTS] ?? BrickUnknown
}
```

**Pattern associé** — *Factory* quand la création demande une logique, *Strategy* quand les handlers
portent un état ou une configuration.

> ⚠️ Un `switch` **exhaustif sur une union discriminée** n'est pas un smell : c'est la bonne
> pratique. TypeScript signale alors le cas manquant à l'ajout d'un variant — ce qu'une map ne fait
> pas. Le smell, c'est le `switch` sur un `string` libre, dupliqué.

---

## 11. Envie de fonctionnalité (feature envy)

**Signal** — une fonction passe son temps à lire les champs d'un autre objet :
`format(order.customer.address.city, order.customer.address.zip)`.

**Coût** — un changement de structure de `Address` casse un fichier qui n'a rien à voir.

**Correctif** — déplacer le comportement là où vivent les données. La loi de Déméter en une phrase :
**ne parle qu'à tes voisins immédiats**.

---

## 12. Changement divergent / chirurgie à répétition

Deux smells symétriques, tous deux résolus par le **SRP** (`references/solid.md`) :

- **Changement divergent** — *un* fichier est modifié pour des raisons sans rapport entre elles
  (« quand l'API change **et** quand le design change »). → Le découper par raison de changer.
- **Chirurgie à répétition** — *une* modification oblige à toucher huit fichiers. → Le concept est
  éparpillé ; le regrouper.

**Le test** : lister les trois derniers commits qui ont touché ce fichier. S'ils n'ont rien en
commun, c'est un changement divergent.

---

## 13. Généralité spéculative

**Signal** — une interface à une seule implémentation ; un paramètre de configuration jamais passé ;
un point d'extension « au cas où » ; un générique `<T>` toujours instancié avec le même type.

**Coût** — de l'indirection payée tous les jours pour un besoin qui n'est jamais arrivé. C'est le
smell le plus courant chez qui vient d'apprendre les design patterns.

**Correctif** — supprimer. On réintroduira le point d'extension quand le deuxième cas existera —
et il aura alors la bonne forme, celle que la réalité aura dictée.

---

## 14. Objet omniscient (god object)

**Signal** — une classe, un store ou un composable qui sait tout : `AppManager`, `useEverything`,
un store Pinia de 600 lignes.

**Coût** — tout en dépend, donc tout casse ensemble ; impossible à tester sans monter la moitié de
l'application.

**Correctif** — découper par domaine, pas par couche technique. `useCart` / `useCheckout` /
`useShipping`, pas `useState` / `useApi` / `useHelpers`.

---

## 15. Couplage temporel

**Signal** — il faut appeler `init()` avant `load()`, sinon ça plante à l'exécution ; rien dans les
types ne le dit.

**Coût** — l'ordre correct s'apprend en cassant les choses, ou en lisant l'implémentation.

**Correctif** — rendre l'ordre impossible à enfreindre : la première étape retourne l'objet qui
porte la seconde.

```ts
// ❌ L'ordre est une convention non écrite.
const client = new ApiClient()
client.configure(token)
await client.fetch('/pages') // plante si configure() a été oublié

// ✅ L'ordre est porté par les types : pas de client sans configuration.
const client = createApiClient({ token })
await client.fetch('/pages')
```

---

## 16. Commentaires qui compensent

**Signal** — un commentaire explique *ce que* fait le bloc suivant.

**Coût** — les commentaires ne sont pas vérifiés par le compilateur : ils mentent dès la première
modification qui les oublie.

**Correctif** — transformer le commentaire en nom de fonction ou de variable.

**À garder, en revanche** : les commentaires qui expliquent le **pourquoi** — une décision non
évidente, un contournement de bug tiers, une contrainte métier, un choix de performance mesuré. Ce
sont les seuls que le code ne peut pas porter lui-même.

```ts
// ✅ Ce commentaire-là mérite d'exister : le code ne peut pas le dire.
// L'API renvoie les dates en UTC sans suffixe Z depuis la v2 — on force
// l'interprétation UTC, sinon le navigateur applique le fuseau local.
const publishedAt = new Date(`${raw.published_at}Z`)
```
