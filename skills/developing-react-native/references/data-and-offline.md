# Données et hors ligne

> Vérifié le 2026-11-27 : TanStack Query v5 (guide React Native, modes réseau, mutations,
> persisters), `expo-network` ~58, `@react-native-community/netinfo` 12.0.1 recommandé par le SDK 58,
> `expo-sqlite` ~58. Les principes communs (cache serveur, clés de requête, état dérivé) sont dans
> `developing-react` → `references/state-and-data.md` et ne sont pas répétés ici.

## Sommaire

1. Choisir sa stratégie hors ligne
2. TanStack Query en React Native : focus et réseau
3. Modes réseau et mutations en pause
4. Persistance du cache et des mutations
5. Base locale : `expo-sqlite`
6. File d'écritures en attente (outbox)
7. Synchronisation et conflits
8. Réseau instable

---

## 1. Choisir sa stratégie hors ligne

```
Hors ligne, l'utilisateur doit pouvoir…
├── relire ce qu'il a déjà vu → cache TanStack Query persisté (§4)
├── faire une action courte et rejouable (favori, like) → mutation en pause + persistance (§3, §4)
├── créer ou éditer des contenus riches, en nombre, sur la durée (brouillons, formulaires, photos)
│   → base locale SQLite + outbox (§5, §6) : source de vérité locale, synchronisée ensuite
└── rien de tout ça → état réseau affiché, actions désactivées avec une explication
```

Choisir le niveau le plus simple qui couvre le besoin. Le niveau « base locale + sync » est une
décision d'architecture : on la valide avec le projet.

## 2. TanStack Query en React Native : focus et réseau

Sur le web, TanStack Query écoute `window` (focus, online). En RN, il faut brancher les managers
**une fois**, au démarrage de l'app :

```ts
// shared/lib/query/setupQueryManagers.ts
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import { focusManager, onlineManager } from '@tanstack/react-query';

export function setupQueryManagers(): () => void {
  onlineManager.setEventListener((setOnline) => {
    void Network.getNetworkStateAsync().then((state) => setOnline(!!state.isConnected));
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(!!state.isConnected);
    });
    return () => subscription.remove();
  });

  const onAppStateChange = (status: AppStateStatus) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
  };
  const appStateSubscription = AppState.addEventListener('change', onAppStateChange);

  return () => appStateSubscription.remove();
}
```

- Alternative documentée : `NetInfo.addEventListener((state) => setOnline(!!state.isConnected))`
  avec `@react-native-community/netinfo`. On garde celle que le projet utilise déjà.
- `expo-network` expose aussi `useNetworkState()` pour l'UI (bandeau « Hors ligne »). Sur iOS,
  `isInternetReachable` vaut `isConnected`.
- `isConnected` ne garantit pas que l'API répond (portail captif, réseau saturé) : les timeouts
  (§8) restent nécessaires.
- Rafraîchir à l'écran actif : `useFocusEffect` d'Expo Router + `refetch` sur les écrans dont
  la fraîcheur compte. Ne pas le généraliser.

## 3. Modes réseau et mutations en pause

| `networkMode` | Hors ligne |
|---|---|
| `'online'` (défaut) | la requête ne part pas, `fetchStatus` passe à `'paused'`, reprise au retour du réseau |
| `'offlineFirst'` | un essai (utile si un cache HTTP ou un service local peut répondre), puis pause des retries |
| `'always'` | ignore l'état réseau, jamais de pause ; `refetchOnReconnect` passe à `false` |

- En `'online'`, une mutation lancée hors ligne est **mise en pause** puis rejouée dans l'ordre au
  retour du réseau. `queryClient.resumePausedMutations()` la relance à la demande.
- L'UI distingue `isPending` (en cours) et `isPaused` (en attente de réseau) : afficher « En
  attente de connexion », pas un spinner infini.

## 4. Persistance du cache et des mutations

Paquets : `@tanstack/react-query-persist-client` (`PersistQueryClientProvider`) et un persister
(`@tanstack/query-async-storage-persister`, `createAsyncStoragePersister`).

```tsx
// shared/providers/AppProviders.tsx (rendu par src/app/_layout.tsx)
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from '@/shared/lib/query/queryClient';

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
      onSuccess={() => void queryClient.resumePausedMutations()}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
```

```ts
// shared/lib/query/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { toggleFavorite } from '@/features/favorites/api/favoritesApi';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 1000 * 60 * 60 * 24 } },
});

// Une mutation restaurée après redémarrage n'a plus sa mutationFn : sans ce défaut,
// la reprise échoue (« No mutationFn found »).
queryClient.setMutationDefaults(['favorites', 'toggle'], { mutationFn: toggleFavorite });
```

- **Le persister AsyncStorage écrit en clair.** On ne persiste pas de requête qui contient des
  données sensibles : on les exclut avec `dehydrateOptions.shouldDehydrateQuery`, ou on passe à
  SQLite chiffrée (`security-and-storage.md`). Jamais de token dans le cache.
- `gcTime` doit être supérieur ou égal au `maxAge` de persistance, sinon les données sont
  collectées avant d'être restaurées.
- `queryClient.clear()` au logout vide aussi le cache persisté.

## 5. Base locale : `expo-sqlite`

API actuelle : `openDatabaseAsync`, ou `<SQLiteProvider databaseName onInit useSuspense>` +
`useSQLiteContext()`. Requêtes `runAsync` / `getAllAsync` / `getFirstAsync`, transactions
`withTransactionAsync`.

```ts
// shared/lib/db/migrate.ts
import type { SQLiteDatabase } from 'expo-sqlite';

const MIGRATIONS: readonly string[] = [
  `CREATE TABLE outbox (
     id TEXT PRIMARY KEY NOT NULL,
     kind TEXT NOT NULL,
     payload TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     attempts INTEGER NOT NULL DEFAULT 0,
     last_error TEXT
   );`,
  `CREATE TABLE listing_drafts (
     id TEXT PRIMARY KEY NOT NULL,
     title TEXT NOT NULL,
     price_cents INTEGER,
     updated_at INTEGER NOT NULL
   );`,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
```

```tsx
<SQLiteProvider databaseName="app.db" onInit={migrate} useSuspense>
  {children}
</SQLiteProvider>
```

- **Migrations versionnées, en avant seulement, jamais modifiées une fois livrées** : une app
  installée peut sauter plusieurs versions. Chaque migration est testée depuis chaque version
  antérieure livrée.
- Toujours des requêtes paramétrées (`runAsync('… WHERE id = ?', [id])`), jamais de concaténation.
- Données sensibles : base chiffrée (`security-and-storage.md` §3).
- Alternatives : Drizzle ORM sur `expo-sqlite` (intégration tierce, migrations générées), ou une
  librairie de synchronisation dédiée. **Jamais sans validation** : c'est une décision
  d'architecture.
- Les lectures de la base passent par des hooks de feature. Un composant n'exécute pas de SQL.

## 6. File d'écritures en attente (outbox)

Pour un formulaire qui doit s'enregistrer sans réseau (dépôt d'annonce, rapport terrain) :

```ts
// features/sync/outbox.ts
import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export type OutboxKind = 'listing.create' | 'listing.update';

export type OutboxEntry = {
  id: string; // clé d'idempotence envoyée au serveur
  kind: OutboxKind;
  payload: string;
  createdAt: number;
  attempts: number;
};

export async function enqueue(db: SQLiteDatabase, kind: OutboxKind, payload: unknown): Promise<string> {
  const id = Crypto.randomUUID();
  await db.runAsync(
    'INSERT INTO outbox (id, kind, payload, created_at) VALUES (?, ?, ?, ?)',
    [id, kind, JSON.stringify(payload), Date.now()],
  );
  return id;
}

export async function pending(db: SQLiteDatabase): Promise<OutboxEntry[]> {
  return db.getAllAsync<OutboxEntry>(
    'SELECT id, kind, payload, created_at AS createdAt, attempts FROM outbox ORDER BY created_at',
  );
}
```

```ts
// features/sync/flushOutbox.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import { pending } from './outbox';
import { sendOutboxEntry, isRetryable } from './syncApi';

const MAX_ATTEMPTS = 8;

export async function flushOutbox(db: SQLiteDatabase): Promise<void> {
  for (const entry of await pending(db)) {
    if (entry.attempts >= MAX_ATTEMPTS) continue; // marquée en échec, visible dans l'UI
    try {
      await sendOutboxEntry(entry); // en-tête Idempotency-Key: entry.id, timeout
      await db.runAsync('DELETE FROM outbox WHERE id = ?', [entry.id]);
    } catch (error) {
      await db.runAsync(
        'UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?',
        [error instanceof Error ? error.name : 'unknown', entry.id],
      );
      if (isRetryable(error)) break; // réseau coupé : on garde l'ordre et on attend
    }
  }
}
```

- **L'écriture locale est la confirmation pour l'utilisateur** : « Enregistré, sera envoyé dès que
  possible ». L'élément apparaît tout de suite dans la liste, avec un statut « En attente ».
- **Idempotence** : un identifiant généré côté client accompagne chaque envoi (`Idempotency-Key` ou
  id de ressource client). Un renvoi après timeout ne crée pas de doublon. Cela se décide avec le
  backend.
- **Ordre** : on traite les entrées dans l'ordre et on s'arrête à la première erreur réseau. Une
  erreur métier (400, 409, 422) ne bloque pas la file : l'entrée passe en échec et l'utilisateur
  peut la corriger.
- **Déclencheurs** du `flushOutbox` : retour réseau (`onlineManager.subscribe`), app au premier
  plan, succès d'une autre requête. Un verrou en mémoire empêche deux vidages simultanés.
- `last_error` stocke un code, **jamais** le corps de la réponse ni des données personnelles.
- Les entrées appartiennent à un utilisateur : purge ou blocage au logout
  (`security-and-storage.md` §4).
- Les photos et fichiers sont copiés dans le répertoire de l'app avant la mise en file. L'URI
  temporaire du sélecteur peut disparaître.

## 7. Synchronisation et conflits

- Récupérer les changements du serveur par curseur (`updatedSince`, jeton de sync), pas par
  rechargement complet.
- Règle de conflit **explicite**, décidée avec le produit : « dernier qui écrit gagne » (horodatage
  serveur), fusion par champ, ou conflit présenté à l'utilisateur. Jamais d'écrasement silencieux
  de données saisies hors ligne.
- Après un envoi réussi, invalider les requêtes concernées (`queryClient.invalidateQueries`) pour
  remplacer la version locale par celle du serveur.

## 8. Réseau instable

- **Timeout sur chaque appel** : `signal: AbortSignal.timeout(15_000)` combiné au `signal` fourni
  par TanStack Query (`AbortSignal.any` si disponible dans le moteur, sinon un `AbortController`
  partagé). Sans timeout, une requête sur un réseau mobile dégradé reste en attente indéfiniment.
- **Retry borné avec backoff** : le retry par défaut de TanStack Query (3, exponentiel) convient
  aux lectures. Pas de retry automatique sur une mutation non idempotente.
- Ne pas réessayer sur 4xx (sauf 408 et 429, avec `Retry-After`).
- Uploads lourds : reprise ou découpage en morceaux si l'API le permet, et uniquement en Wi-Fi si le
  produit le demande (`Network.getNetworkStateAsync().type`).
- Tester en conditions réelles : mode avion pendant un envoi, réseau lent (Network Link
  Conditioner sur iOS, profil réseau de l'émulateur Android), app tuée avec des écritures en
  attente.

## Sources (vérifié le 2026-11-27)

- https://tanstack.com/query/latest/docs/framework/react/react-native
- https://tanstack.com/query/latest/docs/framework/react/guides/network-mode
- https://tanstack.com/query/latest/docs/framework/react/guides/mutations
- https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
- https://tanstack.com/query/latest/docs/framework/react/plugins/createAsyncStoragePersister
- https://docs.expo.dev/versions/latest/sdk/network/ · https://docs.expo.dev/versions/latest/sdk/netinfo/
- https://docs.expo.dev/versions/latest/sdk/sqlite/
