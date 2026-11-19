---
name: writing-clean-code
description: >
  Diagnostiquer et corriger du code difficile à lire, à modifier ou à tester — code smells,
  principes SOLID, patterns GoF (Strategy, Factory, Adapter, Decorator, Observer, State, Command…)
  en programmation objet comme fonctionnelle, sur TypeScript/JavaScript. L'entrée se fait par le
  symptôme constaté, jamais par le catalogue. Utiliser dès qu'il est question de refactoring, de
  lisibilité, de dette technique, de découpage d'un module, de testabilité, ou dès qu'un pattern est
  envisagé. Déclencher aussi sur : "refactore", "nettoie ce code", "clean code", "c'est illisible",
  "cette fonction est trop longue", "je duplique ce bloc", "trop de paramètres", "des if imbriqués",
  "un switch qui grossit", "c'est intestable", "comment structurer ça", "quel pattern utiliser",
  "SOLID", "couplage", "responsabilité unique", "god object", "code smell", "dette technique",
  "simplifier", "découpler", "rendre testable", "ça sent le sapin".
---

# Écrire du code propre

Le savoir-faire du refactoring : partir d'un **symptôme observé**, en mesurer le coût, appliquer le
**correctif le plus petit qui l'élimine**. Un pattern GoF n'est qu'un correctif parmi d'autres — il
arrive tard dans la liste, pas en premier.

## Le principe directeur

**Le code par défaut est le code direct.** Une fonction qui fait la chose, sans indirection, est le
bon code tant qu'aucune douleur ne s'est manifestée. On n'introduit une structure qu'en réaction à
un problème constaté — jamais en anticipation d'un problème imaginé.

Le corollaire est inconfortable mais tenable : **du code un peu répétitif et parfaitement lisible
vaut mieux qu'une abstraction élégante que personne ne comprend.** L'abstraction prématurée coûte
plus cher que la duplication qu'elle prétend éviter, parce qu'elle est bien plus difficile à défaire.

## Étape 1 — Diagnostiquer

On ne se réveille jamais en se disant « tiens, il me faudrait un Decorator ». On se dit « ce
composant a quatre booléens d'état ». Partir du symptôme :

| Symptôme observé | Ce que ça coûte | Correctif minimal | Pattern seulement si… |
|---|---|---|---|
| 3+ booléens d'état corrélés (`isLoading`, `hasError`, `isDirty`…) | des états impossibles restent représentables (`isLoading && hasError`) | union discriminée | **State machine** si les transitions sont contraintes |
| `switch` / chaîne de `if` sur un type qui grandit | chaque nouveau cas touche N endroits | map `type → handler` | **Strategy** si les handlers portent un état ou une config |
| Fonction à 5+ paramètres | ordre des arguments, appels illisibles, booléens positionnels | objet de paramètres typé | **Builder** — quasi jamais justifié côté applicatif |
| Le même bloc littéral pour la 3ᵉ fois | dérive silencieuse entre les copies | extraire une fonction | — |
| Impossible de tester sans réseau / DB / horloge | tests lents, instables, souvent supprimés | injecter la dépendance en paramètre | **DIP** (voir `references/solid.md`) |
| Un changement d'API casse 12 fichiers | le format externe a fuité dans le domaine | une fonction de mapping en frontière | **Adapter** |
| Conditionnels imbriqués sur 3+ niveaux | charge cognitive, cas manquants invisibles | clauses de garde + retours anticipés | — |
| Une classe/module qui grossit à chaque feature | fusion pénible, revue impossible | découper par **raison de changer** | **SRP** |
| `if (type === 'x')` répété dans plusieurs fichiers | ajout d'un type = chasse au trésor | centraliser dans un résolveur | **Factory** |
| Wrapper `try/catch` + `isLoading` recopié partout | oublis de `finally`, états bloqués | une fonction d'ordre supérieur | **Decorator** |
| Objet muté par plusieurs endroits sans trace | bugs non reproductibles | rendre immuable, retourner une copie | — |
| `data`, `info`, `manager`, `helper`, `utils` | le nom ne dit pas ce que c'est | **renommer** — souvent le seul correctif nécessaire | — |

Catalogue complet des symptômes, avec avant/après : `references/code-smells.md`.

## Étape 2 — Appliquer le correctif minimal

Dans cet ordre, et on s'arrête dès que la douleur disparaît :

1. **Renommer.** Le correctif le plus rentable du métier. Un nom juste supprime le besoin de la
   moitié des commentaires.
2. **Extraire une fonction.** Nommer un bloc, c'est le documenter et le rendre testable.
3. **Remplacer une donnée primitive par un type.** `string` → `type Slug = string & {…}`,
   trois booléens → une union discriminée.
4. **Inverser une dépendance.** Passer la collaboration en paramètre au lieu de l'importer.
5. **Alors seulement**, nommer un pattern — si le besoin correspond réellement à sa forme.

## Étape 3 — Savoir quand ne rien faire

Un pattern **n'est pas rentable** quand :

- il n'y a **qu'un seul appelant** — inline le code, tu abstrairas quand le deuxième arrivera ;
- il ajoute **plus de fichiers que de clarté** ;
- il introduit **plus d'un niveau d'indirection** pour un besoin non prouvé ;
- il faut **lire l'implémentation pour comprendre l'appel** — l'abstraction a échoué ;
- le besoin est **hypothétique** (« au cas où on aurait d'autres types de… »). C'est de la
  *Speculative Generality*, un smell à part entière.

**Règle de trois** : à la deuxième occurrence, on tolère la duplication. À la troisième, on abstrait
— on a enfin assez d'exemples pour savoir ce qui varie vraiment.

Vérifier aussi que le langage ou le framework ne fournit pas déjà la réponse : un module ES *est* un
Singleton ; une union discriminée + `switch` exhaustif remplacent la plupart des hiérarchies de
classes ; les fonctions d'ordre supérieur remplacent Strategy, Decorator et Template Method.

## Comment refactorer sans casser

1. **Filet d'abord.** Si le comportement est testable et non couvert, écrire le test *avant* de
   toucher au code. Sans filet, ce n'est pas un refactoring : c'est une réécriture à l'aveugle.
2. **Un pas à la fois.** Une transformation, une vérification. Ne jamais empiler refactoring et
   changement de comportement dans le même mouvement — quand ça casse, on ne sait plus lequel des
   deux est en cause.
3. **Le comportement observable ne change pas.** Si le test doit être modifié, ce n'est plus un
   refactoring — il faut le dire explicitement.
4. **Vérifier réellement.** Lancer typecheck, lint et tests, et lire leur sortie. Un refactoring
   « qui devrait passer » ne compte pas.

## Fichiers de référence

| Fichier | Contenu | Quand le lire |
|---|---|---|
| [references/code-smells.md](references/code-smells.md) | Catalogue des symptômes : signal, coût, refactoring, avant/après | Diagnostic, revue de code, dette technique |
| [references/solid.md](references/solid.md) | Les 5 principes en TS moderne : signaux de violation, avant/après, et quand les ignorer | Découpage d'un module, couplage, testabilité |
| [references/patterns-oop.md](references/patterns-oop.md) | Patterns GoF en classes — et le critère qui dit quand l'objet bat la fonction | Domaine avec état et invariants, hiérarchie réelle |
| [references/patterns-functional.md](references/patterns-functional.md) | Les mêmes patterns en fonctionnel : closures, HOF, modules, unions discriminées | Code applicatif TS/JS courant — le cas le plus fréquent |

## Frontière avec les autres skills

- **Vue / réactivité** — les patterns qui impliquent `ref`, `computed`, composables ou cycle de vie
  vivent dans `developing-vue`, référence `composable-patterns.md`. Cette skill-ci est agnostique du
  framework : TS/JS pur, back Node compris.
- **Typage avancé** (génériques, inférence, types conditionnels) → `developing-typescript`.
- **Conventions d'un dépôt** (nommage, structure de dossiers, gates CI) → le `CLAUDE.md` du projet,
  qui prime toujours sur les recommandations générales de cette skill.

## Rappels

- **Nommer, c'est concevoir.** Si un nom juste ne vient pas, la responsabilité n'est pas claire.
- **Un commentaire qui explique *ce que* fait le code signale du code à renommer** ; garder les
  commentaires pour le *pourquoi*, en particulier les décisions non évidentes et les contournements.
- **Les patterns sont un vocabulaire avant d'être des recettes.** Leur premier bénéfice est de
  permettre de dire « c'est un Adapter » en revue et d'être compris immédiatement.
- **Supprimer bat ajouter.** Le code mort, la config inutilisée et l'abstraction sans appelant se
  retirent : c'est le refactoring au meilleur rapport gain/risque.
