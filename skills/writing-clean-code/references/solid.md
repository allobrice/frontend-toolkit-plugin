# SOLID en TypeScript moderne

Les cinq principes ont été formulés pour la POO à héritage. En TypeScript applicatif — modules,
fonctions, unions discriminées — ils restent pertinents, mais **leur mise en œuvre change** : la
plupart s'appliquent sans écrire une seule classe.

Pour chacun : l'énoncé, le **signal de violation** observable, l'avant/après, et **quand l'ignorer**.

---

## S — Single Responsibility

> Un module doit avoir **une seule raison de changer**.

Le mot important est *raison*, pas *chose*. Une fonction qui valide puis normalise fait deux choses
mais peut n'avoir qu'une raison de changer (le contrat d'entrée). À l'inverse, un fichier qui change
« quand l'API évolue » **et** « quand le design évolue » a deux raisons — c'est celui-là qu'il faut
couper.

**Signal de violation** — ouvrir l'historique git du fichier : si les trois derniers commits qui
l'ont touché n'ont rien en commun, il porte plusieurs responsabilités.

```ts
// ❌ Trois raisons de changer : le format de l'API, les règles métier, le stockage.
async function importPage(raw: RawPage) {
  const page = { slug: raw.page_slug, title: raw.meta.title }
  if (page.title.length > 60) page.title = `${page.title.slice(0, 57)}…`
  await db.pages.upsert(page)
}

// ✅ Une raison chacun ; chaque morceau se teste sans les autres.
const toPage = (raw: RawPage): Page => ({ slug: raw.page_slug, title: raw.meta.title })
const truncateTitle = (page: Page): Page => /* règle métier */ page
const savePage = (page: Page) => db.pages.upsert(page)

const importPage = async (raw: RawPage) => savePage(truncateTitle(toPage(raw)))
```

**Quand l'ignorer** — sur un script ponctuel, une migration jetable, un prototype. Le SRP paie sur
le code qu'on relira ; il coûte sur le code qu'on supprimera dans deux semaines.

---

## O — Open/Closed

> Ouvert à l'extension, fermé à la modification : ajouter un cas ne doit pas obliger à rouvrir le
> code existant.

**Signal de violation** — chaque nouveau type de contenu, de paiement ou de notification impose
d'éditer le même `switch`, souvent dans plusieurs fichiers.

```ts
// ❌ Chaque nouveau canal rouvre cette fonction.
function notify(kind: string, payload: Payload) {
  if (kind === 'email') return sendEmail(payload)
  if (kind === 'push') return sendPush(payload)
  // et un jour : sms, webhook, slack…
}

// ✅ Ajouter un canal = ajouter une entrée. Le dispatch ne bouge plus.
type Channel = (payload: Payload) => Promise<void>

const CHANNELS: Record<string, Channel> = {
  email: sendEmail,
  push: sendPush,
}

function notify(kind: string, payload: Payload) {
  const channel = CHANNELS[kind]
  if (!channel) throw new Error(`Canal inconnu : ${kind}`)
  return channel(payload)
}
```

**Le piège** — l'OCP est le principe le plus détourné pour justifier de la sur-ingénierie. On ne
construit pas un point d'extension pour un deuxième cas hypothétique : on le construit **quand le
deuxième cas arrive**, et il a alors la bonne forme.

**Quand l'ignorer** — tant qu'il n'y a qu'un ou deux cas et qu'ils sont stables. Un `if/else` sur
deux valeurs figées est parfait.

---

## L — Liskov Substitution

> Un sous-type doit pouvoir remplacer son type de base sans casser l'appelant.

**Signal de violation** — une implémentation qui lève `NotSupportedError`, ignore un paramètre, ou
renforce une précondition. Et son marqueur le plus fiable : un `instanceof` chez l'appelant pour
« traiter le cas particulier ».

```ts
// ❌ ReadOnlyStore ment sur le contrat : l'appelant ne peut plus faire confiance au type.
interface Store { read(k: string): string | null; write(k: string, v: string): void }

class ReadOnlyStore implements Store {
  read(k: string) { return cache.get(k) ?? null }
  write() { throw new Error('lecture seule') } // 💥 casse tout appelant de Store
}

// ✅ Le contrat dit la vérité ; on ne peut pas passer un store en lecture seule là où on écrit.
interface ReadableStore { read(k: string): string | null }
interface WritableStore extends ReadableStore { write(k: string, v: string): void }
```

En TypeScript fonctionnel, la LSP se traduit surtout par : **une fonction ne doit pas retourner
`undefined` là où son type promet une valeur**, et les unions doivent être traitées exhaustivement.

**Quand l'ignorer** — jamais vraiment. Une violation de LSP est un bug qui attend son heure.

---

## I — Interface Segregation

> Mieux vaut plusieurs interfaces spécifiques qu'une interface générale.

**Signal de violation** — pour appeler une fonction, il faut construire un objet dont elle n'utilise
que deux champs. Le symptôme apparaît d'abord **dans les tests** : des mocks énormes pour tester
trois lignes.

```ts
// ❌ Il faut un User complet pour afficher un avatar — et donc dans chaque test.
function renderAvatar(user: User) {
  return `<img src="${user.avatarUrl}" alt="${user.displayName}">`
}

// ✅ La signature dit exactement ce dont la fonction a besoin.
function renderAvatar(user: Pick<User, 'avatarUrl' | 'displayName'>) { /* … */ }
```

`Pick`, `Omit` et les types structurels rendent l'ISP quasi gratuit en TypeScript : nul besoin de
déclarer une interface séparée.

**Quand l'ignorer** — quand le découpage produit plus de types que de clarté. Trois interfaces d'un
champ chacune, c'est le remède devenu pire que le mal.

---

## D — Dependency Inversion

> Dépendre d'abstractions, pas d'implémentations concrètes.

C'est **le principe qui rend le code testable** — et de loin le plus rentable des cinq au quotidien.

**Signal de violation** — impossible de tester sans réseau, base de données, horloge système ou
variable d'environnement. Ou bien les tests utilisent des mocks de modules globaux.

```ts
// ❌ Intestable : dépend du réseau et de l'horloge réelle.
async function buildReport() {
  const findings = await fetch('/api/findings').then((r) => r.json())
  return { generatedAt: new Date().toISOString(), findings }
}

// ✅ Les dépendances entrent par la porte. Le test injecte ce qu'il veut.
interface ReportDeps {
  loadFindings: () => Promise<Finding[]>
  now: () => Date
}

async function buildReport({ loadFindings, now }: ReportDeps) {
  return { generatedAt: now().toISOString(), findings: await loadFindings() }
}

// Production
buildReport({ loadFindings: fetchFindings, now: () => new Date() })

// Test — déterministe, instantané, sans réseau
buildReport({ loadFindings: async () => [stubFinding], now: () => new Date('2026-01-01') })
```

Noter qu'aucune interface abstraite n'est nécessaire : **le type de la fonction *est* l'abstraction**.
C'est la forme moderne de l'injection de dépendances.

**Quand l'ignorer** — pour un import stable et pur (`lodash`, un module de constantes, une fonction
mathématique). L'injecter n'apporte aucune testabilité, seulement de la cérémonie.

---

## Récapitulatif

| Principe | Signal de violation | Correctif en TS moderne |
|---|---|---|
| **S**RP | commits sans rapport sur le même fichier | découper par raison de changer |
| **O**CP | un `switch` rouvert à chaque ajout | map `clé → handler` |
| **L**SP | `instanceof` chez l'appelant, méthode qui `throw` | interfaces qui disent la vérité |
| **I**SP | mocks énormes dans les tests | `Pick<T, …>` dans la signature |
| **D**IP | intestable sans réseau/horloge/DB | passer la dépendance en paramètre |

**Si tu n'en retiens qu'un** : le DIP. Il paie immédiatement en testabilité, et il tire les quatre
autres derrière lui — du code injectable est presque toujours du code à responsabilité unique.

**Le contre-poids** : SOLID décrit une direction, pas un quota. Du code qui viole allègrement l'OCP
mais reste lisible et couvert vaut mieux qu'une architecture conforme que personne ne sait modifier.
