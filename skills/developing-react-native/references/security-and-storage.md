# Sécurité et stockage

> Vérifié le 2026-11-27 sur la doc de `expo-secure-store`, `expo-sqlite` (SDK 58) et le guide
> Expo « Store data ». Ce qui est propre au projet (durées de rétention, RGPD, liste des données
> sensibles) vient de son `CLAUDE.md`.

## Sommaire

1. Matrice de stockage
2. Tokens et secrets : `expo-secure-store`
3. Données sensibles au repos : SQLite chiffrée
4. Purge au logout
5. Sauvegardes et transfert d'appareil
6. Masquage dans le sélecteur d'apps et captures
7. Logs et télémétrie
8. Secrets de build et bundle client

---

## 1. Matrice de stockage

| Donnée | Stockage | Jamais |
|---|---|---|
| Access token, refresh token, clé de chiffrement, identifiant de session | `expo-secure-store` (Keychain iOS, Keystore Android) | AsyncStorage, SQLite en clair, MMKV non chiffré, `app.config`, état global persisté |
| Données personnelles ou métier sensibles hors ligne (messages, adresses, documents) | SQLite chiffrée (SQLCipher), clé en SecureStore | SQLite en clair, fichiers JSON dans `FileSystem` |
| Cache serveur non sensible (catalogue public) | Cache TanStack Query persisté, SQLite | — |
| Préférences UI (thème, onboarding vu, langue) | AsyncStorage | — |

AsyncStorage **n'est pas chiffré**. Il sert aux préférences et à l'état d'app non sensible, rien
d'autre. SecureStore est limité en taille et lent : il ne sert pas de base de données.

## 2. Tokens et secrets : `expo-secure-store`

On enveloppe le module dans un seul fichier, typé et mockable :

```ts
// shared/lib/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  dbKey: 'db.encryptionKey',
} as const;

export type SecureKey = keyof typeof KEYS;

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function readSecure(key: SecureKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS[key], OPTIONS);
  } catch {
    // Keychain ou Keystore illisible (clé invalidée, appareil restauré) : on traite comme absent
    // et la session repart d'un login.
    return null;
  }
}

export async function writeSecure(key: SecureKey, value: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS[key], value, OPTIONS);
}

export async function clearSecure(): Promise<void> {
  await Promise.all(
    Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k, OPTIONS)),
  );
}
```

- **`keychainAccessible` (iOS)** : la valeur par défaut est `WHEN_UNLOCKED`. Les variantes
  `_THIS_DEVICE_ONLY` ne sont **pas restaurées** depuis une sauvegarde ou sur un nouvel appareil :
  c'est le choix par défaut pour un token. `ALWAYS` et `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` sont
  dépréciées. Les mêmes options servent à lire et à écrire une clé.
- **`requireAuthentication: true`** : l'accès exige la biométrie ou le code de l'appareil. La clé
  est **invalidée si la biométrie change** (la lecture renvoie alors `null`). Ce n'est pas
  disponible dans Expo Go. À réserver aux secrets qui le justifient (déverrouillage d'un coffre),
  pas au refresh token lu à chaque démarrage. Toujours dans un `try/catch`.
- **Android** : les clés Keystore disparaissent à la désinstallation.
- Jamais de token dans un store global persisté (Zustand `persist`, cache Query persisté). En
  mémoire, le token vit dans le client HTTP ou le hook de session.

## 3. Données sensibles au repos : SQLite chiffrée

`expo-sqlite` chiffre avec SQLCipher via l'option du config plugin :

```ts
// app.config.ts (extrait)
plugins: [['expo-sqlite', { useSQLCipher: true }]],
```

```ts
// shared/lib/db/openEncryptedDb.ts
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { readSecure, writeSecure } from '@/shared/lib/secureStorage';

async function getOrCreateDbKey(): Promise<string> {
  const existing = await readSecure('dbKey');
  if (existing) return existing;
  const bytes = Crypto.getRandomBytes(32);
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await writeSecure('dbKey', key);
  return key;
}

export async function openEncryptedDb(name: string): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(name);
  const key = await getOrCreateDbKey();
  await db.execAsync(`PRAGMA key = "x'${key}'"`);
  const row = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!row?.cipher_version) {
    throw new Error('SQLCipher absent : la base ne serait pas chiffrée');
  }
  return db;
}
```

- **Sans SQLCipher, `PRAGMA key` est ignoré en silence** : le contrôle `cipher_version` est
  obligatoire.
- La clé est générée aléatoirement et vit en SecureStore. Elle n'est jamais en dur, jamais
  dérivée de l'identifiant utilisateur.
- SQLCipher n'est pas disponible dans Expo Go et demande un dev build.
- `expo-crypto` est une dépendance à valider si le projet ne l'a pas déjà.

## 4. Purge au logout

Le logout est une **fonction unique**, testée, qui efface tout ce qui appartient à l'utilisateur :

```ts
// features/auth/signOut.ts
import type { QueryClient } from '@tanstack/react-query';
import { clearSecure } from '@/shared/lib/secureStorage';
import { wipeLocalDatabase } from '@/shared/lib/db/wipeLocalDatabase';
import { clearOutbox } from '@/features/sync/outbox';

export async function signOut(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear(); // cache mémoire et, via le persister, cache disque
  await Promise.all([clearSecure(), wipeLocalDatabase(), clearOutbox()]);
}
```

Les écritures en attente d'un utilisateur ne doivent pas partir sous la session du suivant : la
file d'attente se vide (ou se bloque) au logout. On prévient l'utilisateur s'il reste des
écritures non synchronisées. Voir `data-and-offline.md`.

## 5. Sauvegardes et transfert d'appareil

- **iOS** : SecureStore en `_THIS_DEVICE_ONLY` n'est ni sauvegardé ni migré. Les fichiers de
  l'app (SQLite) partent dans la sauvegarde iCloud par défaut : c'est une raison de plus de
  chiffrer la base et de garder la clé en `_THIS_DEVICE_ONLY`.
- **Android** : les données SecureStore sont exclues automatiquement de la sauvegarde, **sauf si
  le projet définit sa propre configuration de backup**. Dans ce cas, il faut y exclure
  explicitement le fichier `sharedpref` de SecureStore. Une restauration sans la clé Keystore
  rend la valeur illisible : `readSecure` renvoie `null` (§2).
- `android.allowBackup` (config d'app, `true` par défaut comme sur Android) : à `false`, il coupe
  sauvegarde et restauration de toute l'app. C'est pertinent quand l'app stocke des données
  sensibles hors ligne, mais se décide avec le projet : l'utilisateur perd aussi ses préférences
  lors d'un changement d'appareil. Le changer demande un nouveau build.

## 6. Masquage dans le sélecteur d'apps et captures

Pour un écran qui affiche des données sensibles (coordonnées bancaires, documents d'identité) :

Module `expo-screen-capture` :

| Plateforme | API | Effet |
|---|---|---|
| Android | `usePreventScreenCapture(key?)` ou `preventScreenCaptureAsync(key?)` / `allowScreenCaptureAsync(key?)` | pose `FLAG_SECURE` : capture bloquée et **aperçu vide dans les apps récentes** |
| iOS | `enableAppSwitcherProtectionAsync(blurIntensity)` / `disableAppSwitcherProtectionAsync()` | **floute l'app dans le sélecteur d'apps**, en arrière-plan et lors d'une interruption |

```tsx
// features/payment/useSensitiveScreen.ts
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

export function useSensitiveScreen(key: string): void {
  ScreenCapture.usePreventScreenCapture(key);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void ScreenCapture.enableAppSwitcherProtectionAsync(0.8);
    return () => {
      void ScreenCapture.disableAppSwitcherProtectionAsync();
    };
  }, []);
}
```

À limiter aux écrans concernés (paiement, pièces d'identité, coffre), jamais à toute l'app par
défaut : cela gêne le support et l'utilisateur.

## 7. Logs et télémétrie

- **Aucune donnée personnelle dans les logs** : ni email, ni téléphone, ni adresse, ni token, ni
  corps de requête ou de réponse.
- Les intercepteurs HTTP journalisent la méthode, le chemin sans query string, le statut et la
  durée, rien d'autre.
- Pas de `console.log` laissé dans le code livré. Un logger central filtre par environnement
  et **masque** les champs sensibles avant tout envoi à un service tiers (Sentry ou autre :
  `beforeSend`, scrubbing).
- Les messages d'erreur affichés n'exposent ni pile d'appel ni réponse brute du serveur.

## 8. Secrets de build et bundle client

- **Tout ce qui est dans le bundle JS est public** : `EXPO_PUBLIC_*`, `app.config.ts` lu via
  `Constants.expoConfig`, assets. On n'y met jamais une clé d'API privée, un secret OAuth ou une
  clé de signature.
- Les variables EAS en visibilité « secret » servent au build (signature, téléchargement privé),
  pas au code client. Voir `build-and-release.md`.
- Un secret qu'il faudrait côté client appartient en réalité au serveur : on ajoute un endpoint
  backend.
- Liens entrants et paramètres d'URL : entrées non fiables, à valider (voir
  `project-and-architecture.md` §5).

## Sources (vérifié le 2026-11-27)

- https://docs.expo.dev/versions/latest/sdk/securestore/
- https://docs.expo.dev/versions/latest/sdk/sqlite/
- https://docs.expo.dev/develop/user-interface/store-data/
- https://docs.expo.dev/eas/environment-variables/
- https://docs.expo.dev/workflow/configuration/
- https://docs.expo.dev/versions/latest/sdk/screen-capture/
- https://docs.expo.dev/versions/latest/config/app/ (`android.allowBackup`)
