# Mutations : Server Functions et Route Handlers

Une Server Function (`'use server'`) est une fonction async exécutée sur le serveur et appelable
depuis le client par un `POST`. Utilisée pour une mutation, on l'appelle Server Action.
**Chaque Server Function est un endpoint public**, même si aucune UI ne l'appelle.

## Sommaire

1. Anatomie d'une action de production
2. Où déclarer les actions
3. Formulaire client avec `useActionState`
4. Erreurs attendues et exceptions
5. Revalider après une mutation
6. `redirect`, `notFound`, cookies
7. Mises à jour optimistes
8. Appels hors formulaire
9. Route Handlers
10. Checklist d'une action

---

## 1. Anatomie d'une action de production

Une action **mince** : valider → déléguer à la DAL (qui authentifie et autorise) → invalider →
renvoyer un état sérialisable minimal.

```ts
// features/projects/schemas.ts — serveur (actions, DAL) ; types d'état dans form.ts (voir ci-dessous)
import { z } from 'zod'

export const renameProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(3, 'Au moins 3 caractères.').max(80, '80 caractères maximum.'),
})

export type RenameProjectState =
  | { status: 'idle' }
  | { status: 'invalid'; fieldErrors: Partial<Record<'name', string>>; values: { name: string } }
  | { status: 'failed'; message: string }
  | { status: 'success' }
```

```ts
// app/projects/[projectId]/actions.ts
'use server'

import { updateTag } from 'next/cache'
import { renameProject, ProjectAccessError } from '@/data/projects'
import { projectTags } from '@/data/cache-tags'
import { renameProjectSchema, type RenameProjectState } from '@/features/projects/schemas'

export async function renameProjectAction(
  _previous: RenameProjectState,
  formData: FormData,
): Promise<RenameProjectState> {
  const parsed = renameProjectSchema.safeParse({
    projectId: formData.get('projectId'),
    name: formData.get('name'),
  })
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === 'name')
    return {
      status: 'invalid',
      fieldErrors: { name: nameIssue?.message },
      values: { name: String(formData.get('name') ?? '') },
    }
  }

  try {
    await renameProject(parsed.data) // la DAL ré-authentifie et vérifie la propriété
  } catch (error) {
    if (error instanceof ProjectAccessError) return { status: 'failed', message: error.message }
    throw error // erreur inattendue : remonte à l'error boundary et aux logs
  }

  updateTag(projectTags.detail(parsed.data.projectId))
  return { status: 'success' }
}
```

Utiliser la librairie de validation déjà présente dans le projet ; n'en ajouter une qu'avec
validation.

**Attention au bundle** : un Client Component qui importe *quoi que ce soit* depuis `schemas.ts`
(même un type d'état ou une constante) tire la librairie de validation dans le bundle client
(~30 Ko gzip pour zod). Séparer :

- `features/<domaine>/form.ts` — types d'état (`RenameProjectState`), constantes (`NAME_MAX_LENGTH`),
  sans dépendance ; importable partout ;
- `features/<domaine>/schemas.ts` — schémas, importés par les actions et la DAL ; côté client
  seulement si une validation client est réellement exécutée (choix conscient de poids).

---

## 2. Où déclarer les actions

| Emplacement | Quand |
|---|---|
| Fichier `actions.ts` avec `'use server'` en tête, colocalisé à la route ou à la feature | **défaut** ; importable par les Client Components |
| Fonction inline `'use server'` dans un Server Component | action triviale propre à ce composant ; capture des valeurs par closure (chiffrées, mais envoyées au client : ne pas y capturer de secret) |

- Un Client Component **ne peut pas** définir d'action ; il l'importe ou la reçoit en prop
  (`xxxAction`).
- Exporter uniquement des fonctions async depuis un fichier `'use server'`.
- Mettre `import 'server-only'` dans la DAL ; l'action reste un fichier fin d'orchestration.

---

## 3. Formulaire client avec `useActionState`

```tsx
// features/projects/components/RenameProjectForm.tsx
'use client'

import { useActionState, useId } from 'react'
import { renameProjectAction } from '@/app/projects/[projectId]/actions'
import type { RenameProjectState } from '@/features/projects/form'

const INITIAL_STATE: RenameProjectState = { status: 'idle' }

export function RenameProjectForm({ projectId, currentName }: { projectId: string; currentName: string }) {
  const [state, formAction, isPending] = useActionState(renameProjectAction, INITIAL_STATE)
  const inputId = useId()
  const messageId = `${inputId}-message`

  const nameError = state.status === 'invalid' ? state.fieldErrors.name : undefined
  const message = nameError ?? (state.status === 'failed' ? state.message : undefined)
  const defaultName = state.status === 'invalid' ? state.values.name : currentName

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <label htmlFor={inputId}>Nom du projet</label>
      <input
        id={inputId}
        name="name"
        defaultValue={defaultName}
        readOnly={isPending}
        aria-invalid={nameError ? true : undefined}
        aria-describedby={message ? messageId : undefined}
      />
      {message && <p id={messageId} role="alert">{message}</p>}
      {state.status === 'success' && <p role="status">Projet renommé.</p>}
      <button type="submit" disabled={isPending}>{isPending ? 'Enregistrement…' : 'Renommer'}</button>
    </form>
  )
}
```

- Fonctionne **avant hydratation** (amélioration progressive) : la soumission est mise en file puis
  traitée. Un formulaire dans un Server Component, sans état client, fonctionne même sans JavaScript.
- Les pièges des Actions de formulaire (champ `readOnly` pendant l'envoi, reset automatique, message
  relié au champ) sont détaillés dans `developing-react` → `references/react19-idioms.md`.
- Un `projectId` en champ caché est une **entrée utilisateur** : la DAL vérifie que l'utilisateur a
  le droit d'agir dessus.

---

## 4. Erreurs attendues et exceptions

| Nature | Traitement |
|---|---|
| Validation, règle métier, conflit, accès refusé « normal » | **valeur de retour** de l'action (état discriminé), affichée par le formulaire |
| Bug, panne d'infrastructure, invariant violé | **exception** : remonte à `error.tsx` / `catchError`, est journalisée |

Ne pas `try/catch` tout le corps d'une action pour transformer chaque exception en message
générique : on perd le signal des vrais bugs.

---

## 5. Revalider après une mutation

| API | Effet | Où |
|---|---|---|
| `updateTag(tag)` | expire le tag et relit immédiatement : l'utilisateur voit **sa propre écriture** | Server Action uniquement |
| `revalidateTag(tag, 'max')` | stale-while-revalidate : sert l'ancien contenu et régénère en arrière-plan | Server Action, Route Handler |
| `refresh()` | rafraîchit le routeur pour les données **non cachées** ; ne touche pas au cache | Server Action uniquement |
| `revalidatePath(path)` | invalide une route entière | quand aucun tag ne cible la donnée |

- Toute revalidation appelée depuis une action vide aussi le cache client du routeur.
- Invalider le **plus petit ensemble** de tags concernés ; `revalidatePath('/')` est un aveu
  d'absence de tags.
- `revalidateTag(tag)` à un seul argument est déprécié.

---

## 6. `redirect`, `notFound`, cookies

- `redirect()` et `notFound()` **lèvent** une exception de contrôle : rien ne s'exécute après, et un
  `try/catch` englobant les avale. Les appeler **après** le bloc `try`, une fois la revalidation
  faite.
- `cookies().set()` / `.delete()` dans une action re-rend la page courante et ses layouts sur le
  serveur, en conservant l'état client.
- Jamais de modification de cookie pendant le rendu d'un Server Component : une action.

```ts
export async function createProjectAction(_prev: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const parsed = createProjectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toInvalidState(parsed.error, formData)

  const project = await createProject(parsed.data)
  updateTag(projectTags.list(project.ownerId))
  redirect(`/projects/${project.id}`) // en dernier, hors try/catch
}
```

---

## 7. Mises à jour optimistes

`useOptimistic` dans le Client Component, la Server Action en transition ; à la fin de la
transition, la vérité serveur (rendue par `updateTag` / `refresh`) remplace l'état optimiste.
Patron complet : `developing-react` → `references/react19-idioms.md` §1.

---

## 8. Appels hors formulaire

- Depuis un gestionnaire d'événement : `startTransition(async () => { await likeAction(postId) })`
  pour obtenir l'état en attente et la gestion d'erreur par les boundaries.
- Les actions sont **dispatchées une à la fois** par le client : ne pas les utiliser pour charger des
  données, ni en paralléliser plusieurs. Pour lire : Server Component, ou Route Handler.
- Une action déclenchée dans un `useEffect` (compteur de vues) reste une exception justifiée.

---

## 9. Route Handlers

`app/**/route.ts` exporte des fonctions nommées par méthode HTTP (`GET`, `POST`…), sur les API Web
`Request` / `Response`.

```ts
// app/api/projects/[projectId]/route.ts
import type { NextRequest } from 'next/server'
import { getProjectForApi } from '@/data/projects'

export async function GET(_request: NextRequest, context: RouteContext<'/api/projects/[projectId]'>) {
  const { projectId } = await context.params
  const project = await getProjectForApi(projectId) // auth + autorisation dans la DAL
  if (!project) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(project)
}
```

- Usages : webhooks, clients tiers (mobile, autres services), lectures depuis un Client Component,
  réponses non HTML (fichiers, flux, RSS).
- Pas de `route.ts` au même niveau qu'un `page.tsx`.
- Avec Cache Components, un `GET` suit le modèle des pages : pré-rendu s'il n'accède à rien de
  dynamique, `'use cache'` dans une fonction auxiliaire (jamais dans le corps du handler).
- Webhook : vérifier la signature **avant** de lire le corps comme fiable.
- Un Route Handler n'est jamais appelé par un Server Component de la même app : appeler la DAL
  directement (pas d'aller-retour HTTP interne).

---

## 10. Checklist d'une action

- [ ] Entrées validées par un schéma (y compris les ids en champ caché)
- [ ] Authentification **et** autorisation sur la ressource, dans l'action ou la DAL
- [ ] Logique métier et accès aux données dans la DAL `server-only`, pas dans l'action
- [ ] Erreurs attendues renvoyées comme état ; exceptions inattendues non avalées
- [ ] Invalidation ciblée (`updateTag` / `revalidateTag(tag, profil)` / `refresh`)
- [ ] `redirect` en dernier, hors `try/catch`
- [ ] Valeur de retour minimale et sérialisable (pas d'enregistrement brut)
- [ ] Rate limiting envisagé pour une opération coûteuse (e-mail, paiement, écriture massive)
