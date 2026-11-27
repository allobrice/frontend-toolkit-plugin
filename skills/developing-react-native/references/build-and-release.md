# Build et publication : EAS Build, Submit, Update

> Vérifié le 2026-11-27 sur la doc EAS (`eas.json`, variables d'environnement, versions
> d'app, EAS Update) et le changelog SDK 58. **Lancer un build, une soumission ou une
> publication OTA est une action visible des utilisateurs : jamais sans validation explicite.**

## Sommaire

1. Profils `eas.json`
2. Variables d'environnement et secrets
3. Versions et numéros de build
4. EAS Submit
5. EAS Update (OTA) et ses limites
6. `runtimeVersion`
7. Ce changement demande-t-il un build ?

---

## 1. Profils `eas.json`

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "base": { "node": "22" },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development",
      "env": { "APP_VARIANT": "development" }
    },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "channel": "preview",
      "environment": "preview",
      "env": { "APP_VARIANT": "preview" }
    },
    "production": {
      "extends": "base",
      "channel": "production",
      "environment": "production",
      "autoIncrement": true
    }
  },
  "submit": { "production": {} }
}
```

- Trois profils usuels : **development** (dev build, distribution interne), **preview** (build
  de test interne, QA) et **production** (stores).
- `extends` permet de factoriser (profondeur maximale : 5).
- `channel` relie le build aux mises à jour OTA de ce canal. Il n'a pas d'effet quand
  `developmentClient` vaut `true`.
- `environment` (`development` / `preview` / `production`) sélectionne les variables EAS du
  même nom (§2).
- La version de Node (`"node": "22"` ci-dessus) est un exemple : aligner sur celle du projet.

## 2. Variables d'environnement et secrets

| Visibilité EAS | Lisible | Usage |
|---|---|---|
| Plain text | partout (dashboard, logs, CLI) | URL d'API publique, flags |
| Sensitive | masquée dans les logs, lisible par la CLI ou via un interrupteur | identifiants peu critiques |
| Secret | jamais hors des serveurs EAS | jetons de téléchargement privés, clés de signature |

- **Rien de ce qui arrive dans le bundle client n'est secret**, quelle que soit sa visibilité
  EAS. Une variable `EXPO_PUBLIC_*` est lisible dans l'app installée.
- Les variables se sélectionnent par l'`environment` du profil, ou par
  `eas update --environment <env>` pour une mise à jour OTA. La même source sert ainsi au build et
  à l'update : on évite qu'une OTA parte avec les variables de développement.
- En local : `eas env:pull --environment development` génère un `.env` local, qui reste ignoré
  par git.

## 3. Versions et numéros de build

- `cli.appVersionSource: "remote"` est recommandé (depuis EAS CLI 12). Sans ce réglage, la CLI
  retombe sur `local` avec un avertissement.
- En mode remote, EAS gère `buildNumber` (iOS) et `versionCode` (Android) : les valeurs locales
  sont ignorées. `autoIncrement` vaut `false` par défaut : l'activer sur le profil production.
  Ce mode n'est pas compatible avec la politique `runtimeVersion: nativeVersion`.
- La **version marketing** (`version` dans `app.config.ts`, par exemple `1.4.0`) reste un choix
  produit : ne pas l'incrémenter de sa propre initiative.

## 4. EAS Submit

- `eas submit --platform ios|android --profile production` envoie un build vers App Store
  Connect ou Google Play. Les identifiants (clé API App Store Connect, compte de service Play) se
  configurent dans EAS, jamais dans le dépôt.
- `eas build --auto-submit` enchaîne build et soumission : à n'utiliser que dans un pipeline
  validé par l'équipe.

## 5. EAS Update (OTA) et ses limites

Une mise à jour OTA remplace **le JS, les styles et les images**. Elle ne peut pas changer :

- du code natif ou une dépendance native (ajout, retrait, montée de version) ;
- une permission, un réglage de `app.config.ts` qui touche au natif, un config plugin ;
- la version du SDK Expo, l'icône, le splash natif, le `scheme`.

Règles :

- Une update ne s'applique qu'aux builds dont la `runtimeVersion` correspond (§6). Une erreur de
  compatibilité fait planter l'app au démarrage.
- Publier d'abord sur `preview`, tester sur un build preview, puis promouvoir en production.
- Prévoir le retour arrière (`eas update:rollback` ou republication de la version précédente).
- Le diff de bytecode est actif par défaut depuis SDK 56 : les mises à jour sont plus légères,
  mais la règle de compatibilité ne change pas.
- Les règles des stores (Apple, Google) interdisent de changer la nature de l'app par OTA.

## 6. `runtimeVersion`

Politiques disponibles : `appVersion`, `nativeVersion`, `fingerprint`, ou une chaîne fixe.

- `fingerprint` calcule une empreinte du natif : une update ne vise que les builds au natif
  identique. C'est le choix le plus sûr contre les incompatibilités.
- SDK 58 annonce une « nouvelle empreinte par défaut ». Que la politique par défaut ait changé
  n'est **pas vérifié** : lire la valeur configurée dans le projet au lieu de supposer.
- Changer de politique se décide avec l'équipe : cela coupe le lien entre les builds existants et
  les futures updates.

## 7. Ce changement demande-t-il un build ?

```
Le changement touche…
├── seulement du TS/JS, des styles, des images importées → OTA possible (canal preview d'abord)
├── package.json : dépendance avec du code natif ajoutée, retirée ou mise à jour → nouveau build
├── app.config.ts (permissions, plugins, scheme, icône, splash, identifiants) → nouveau build
├── montée de SDK Expo / React Native → nouveau build, puis tests sur les deux plateformes
└── doute → comparer l'empreinte (npx expo-updates fingerprint, si disponible) ou considérer
    qu'un build est nécessaire
```

Le compte rendu de l'agent indique toujours « nécessite un nouveau build natif : oui / non ».

## Sources (vérifié le 2026-11-27)

- https://docs.expo.dev/build/eas-json/ · https://docs.expo.dev/eas/json/
- https://docs.expo.dev/eas/environment-variables/
- https://docs.expo.dev/build-reference/app-versions/
- https://docs.expo.dev/eas-update/introduction/
- https://docs.expo.dev/eas-update/runtime-versions/ · https://docs.expo.dev/versions/latest/sdk/updates/
- https://expo.dev/changelog/sdk-58 · https://expo.dev/changelog/sdk-55
