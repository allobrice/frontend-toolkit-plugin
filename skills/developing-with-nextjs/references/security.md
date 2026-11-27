# Sécurité des données

Les Server Components et les Server Functions déplacent la frontière de confiance **à l'intérieur**
du code React. Une erreur de découpage peut faire fuir des données privées vers le navigateur, ou
ouvrir un endpoint sans contrôle.

## Sommaire

1. Modèle de menace en trois phrases
2. Data Access Layer : authentifier, autoriser, réduire
3. Server Functions : endpoints publics
4. Ce qui fuit vers le client
5. Cache et données personnelles
6. Variables d'environnement et secrets
7. `proxy.ts`, Route Handlers, CSRF
8. Checklist d'audit

---

## 1. Modèle de menace

- Tout ce qui est passé à un Client Component (props, retour d'action, closure d'action) **est
  lisible** dans le navigateur.
- Toute Server Function exportée et utilisée est **appelable par un `POST` direct**, avec des
  arguments arbitraires.
- Tout segment `[param]`, `searchParams`, champ de formulaire ou en-tête est une **entrée
  utilisateur**.

---

## 2. Data Access Layer

```ts
// data/auth.ts
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get('session')?.value
  if (!token) return null
  return verifySession(token) // vérifie la signature et l'expiration
})

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthenticatedError()
  return user
}
```

```ts
// data/projects.ts
import 'server-only'

export async function renameProject({ projectId, name }: { projectId: string; name: string }) {
  const user = await requireUser()
  const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } })
  if (!project || project.ownerId !== user.id) throw new ProjectAccessError('Projet introuvable.')
  await db.project.update({ where: { id: projectId }, data: { name } })
}
```

Règles :

- **Authentification** (qui est-ce ?) **et autorisation** (a-t-il le droit sur *cette* ressource ?)
  à chaque lecture et écriture sensible — l'oubli de la seconde est une IDOR.
- Refuser par un message neutre (« introuvable ») pour ne pas révéler l'existence d'une ressource.
- Renvoyer des **DTO** : uniquement les champs nécessaires, calculés selon les droits du lecteur.
- Requêtes paramétrées uniquement (ORM ou template SQL sûr), jamais de concaténation.
- La DAL est le **seul** endroit qui lit `process.env` des secrets et importe le client de base.

---

## 3. Server Functions : endpoints publics

- Une vérification faite par la page (`redirect('/login')`) ou par `proxy.ts` **ne protège pas**
  les actions définies ou importées dans cette page : chaque action ré-authentifie.
- Valider **tous** les arguments avec un schéma : un `FormData` peut contenir n'importe quoi, un id
  caché peut être remplacé.
- Renvoyer un état minimal (`{ status: 'success' }`), jamais l'enregistrement mis à jour.
- Variables capturées par une action inline : chiffrées, mais **transmises** au client et retour ;
  ne pas y capturer de secret. Préférer relire la donnée côté serveur.
- Opérations coûteuses ou abusables (e-mails, SMS, paiements, création de comptes) : rate limiting.
- Les actions inutilisées sont retirées au build, mais ne pas en exporter « au cas où ».

---

## 4. Ce qui fuit vers le client

| Fuite | Prévention |
|---|---|
| Objet de base complet passé en prop à un Client Component | DTO ; props du Client Component typées étroitement |
| Retour d'action = enregistrement brut | état discriminé minimal |
| Champ sensible inclus « pour plus tard » | ne sélectionner que les colonnes utiles (`select`) |
| Secret dans une closure d'action inline | relire côté serveur |
| Message d'erreur détaillé (stack, SQL) renvoyé à l'UI | message générique ; détail dans les logs serveur |

Garde-fou supplémentaire (jamais suffisant seul) : les API Taint de React
(`experimental_taintObjectReference`, `experimental_taintUniqueValue`) avec `experimental.taint` —
à n'activer qu'avec validation, la DAL reste la vraie protection.

---

## 5. Cache et données personnelles

**Une fonction `'use cache'` est un point d'entrée serveur.** Le build l'enregistre comme référence
serveur (`server-reference-manifest.json`), appelable par un `POST` portant son identifiant, avec
des arguments arbitraires — comme une Server Action. Son identifiant n'est pas envoyé au navigateur
et ne pas l'exporter ne change rien : la seule protection est alors le secret d'un identifiant
stable d'un build à l'autre. Vérifié sur Next 16.4.5 : un appel direct sans cookie renvoyait
l'enregistrement complet d'une fonction cachée dont l'autorisation était faite par l'appelant.

Règles :

1. **Ce qu'une fonction cachée renvoie doit pouvoir être vu par n'importe qui** possédant ses
   arguments. Projeter en DTO **dans** la fonction cachée, jamais après ; ne jamais y renvoyer un
   enregistrement brut ni un champ interne.
2. **Donnée publique** (catalogue, contenu éditorial, référentiels) → `'use cache'`.
3. **Donnée dépendant de l'utilisateur ou de ses droits** → au choix :
   - pas de cache serveur : lecture directe dans la DAL, autorisation à chaque requête (défaut sûr) ;
   - `'use cache: private'` avec l'autorisation **dans** la fonction (elle peut lire `cookies()`),
     qui renvoie un DTO ou `null` — rien n'est stocké côté serveur entre requêtes, le résultat est
     caché dans le navigateur.
4. **Ne jamais** faire l'autorisation hors d'une fonction `'use cache'` qui, elle, renvoie la donnée
   protégée : appelée directement, elle contourne le contrôle.

```ts
// ✅ Donnée par utilisateur : autorisation et projection dans le scope privé
async function getOwnedProject(projectId: string): Promise<ProjectDetail | null> {
  'use cache: private'
  cacheLife({ stale: 60 })
  cacheTag(projectTags.detail(projectId))

  const user = await getCurrentUser()
  const project = await db.project.findUnique({ where: { id: projectId } })
  return user && project?.ownerId === user.id ? toProjectDetail(project) : null
}

// ✅ Donnée publique : cache partagé, DTO public
async function getPublicCategories(): Promise<Category[]> {
  'use cache'
  cacheLife('weeks')
  cacheTag('categories')
  return (await db.category.findMany()).map(toCategory)
}
```

Signaler ce comportement dans la restitution s'il est rencontré : il mérite d'être porté à la
connaissance de l'équipe Next.js par son canal de sécurité, à la décision de l'utilisateur.

---

## 6. Variables d'environnement et secrets

- Seules les variables `NEXT_PUBLIC_*` sont incluses dans le bundle client : elles sont **publiques**.
- Valider la configuration au démarrage (schéma) dans un module `server-only` ; ailleurs, importer ce
  module plutôt que `process.env`.
- `import 'server-only'` dans tout module qui touche un secret : l'import depuis un Client Component
  échoue au build.
- Pas de secret dans `next.config.ts` exposé via `env` ou `publicRuntimeConfig` (supprimé en 16).

---

## 7. `proxy.ts`, Route Handlers, CSRF

- `proxy.ts` et `route.ts` ont beaucoup de pouvoir : les auditer avec soin.
- `proxy.ts` sert aux redirections optimistes ; l'autorisation réelle reste dans la DAL.
- Route Handler : authentifier chaque méthode, valider le corps, vérifier la signature des webhooks.
- Server Actions : `POST` uniquement, comparaison `Origin` / `Host` intégrée ; derrière un proxy
  inverse, configurer `serverActions.allowedOrigins` (validation requise : modification de config).
- Mutation jamais déclenchée par un `GET` ni pendant le rendu.
- En-têtes de sécurité et CSP : guide « Content Security Policy » de la doc embarquée.

---

## 8. Checklist d'audit

- [ ] Une DAL `server-only` existe ; aucun import de base de données ni de `process.env` secret
      hors de la DAL
- [ ] Fichiers `'use client'` : les props attendent-elles des données privées ? Types trop larges ?
- [ ] Fichiers `'use server'` : arguments validés ? Utilisateur ré-authentifié ? Propriété de la
      ressource vérifiée ? Retour filtré ?
- [ ] Dossiers `[param]` : paramètres validés ?
- [ ] Fonctions `'use cache'` : traitées comme des endpoints ? Renvoient-elles uniquement un DTO
      public ? Aucune autorisation faite « par l'appelant » ?
- [ ] `proxy.ts` et `route.ts` : audités comme des endpoints publics
- [ ] Aucune variable secrète préfixée `NEXT_PUBLIC_`
