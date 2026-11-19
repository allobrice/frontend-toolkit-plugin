# Référence — Sécurité

## Secrets & Credentials

- [ ] Aucun secret dans le code source, les Dockerfiles, les fichiers de pipeline
- [ ] Aucun secret dans les images Docker (vérifiable avec `docker history`)
- [ ] Rotation des secrets possible sans redéploiement du code
- [ ] Les tokens/clés API ont le scope minimal nécessaire
- [ ] Les credentials de DB prod ne sont pas utilisés en dev/staging

---

## Sécurité applicative

### Authentification & Autorisation
- [ ] JWT : algorithme HS256 minimum, expiration définie, refresh token séparé
- [ ] Pas de token JWT stocké en `localStorage` (préférer `httpOnly cookie`)
- [ ] Les routes sont protégées par défaut (opt-in public, pas opt-in protégé)
- [ ] Rate limiting sur les endpoints sensibles (login, inscription, password reset)
- [ ] Protection CSRF si cookies utilisés pour l'auth

### Headers HTTP de sécurité
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Content-Security-Policy` défini
- [ ] `Strict-Transport-Security` (HSTS) activé
- [ ] `Referrer-Policy` configuré

```ts
// ✅ Nuxt 3 : security headers via nuxt-security ou routeRules
export default defineNuxtConfig({
  routeRules: {
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    }
  }
})
```

### Données & Validation
- [ ] Toutes les inputs utilisateur sont validées/sanitizées côté serveur
- [ ] Les requêtes DB utilisent des requêtes préparées ou un ORM (pas de concaténation de SQL)
- [ ] Les uploads de fichiers valident le type MIME côté serveur (pas seulement l'extension)
- [ ] Les données sensibles (mots de passe) sont hashées avec bcrypt/argon2 (jamais MD5/SHA1)
- [ ] Les données personnelles sont chiffrées au repos si nécessaire (conformité RGPD)

---

## Sécurité des containers

### Image
- [ ] L'image de base est à jour et sans vulnérabilités critiques connues (scan Trivy/Grype)
- [ ] Le container tourne en utilisateur non-root
- [ ] `--read-only` filesystem si possible, avec volumes pour les répertoires en écriture
- [ ] Pas d'outils de debug/shell dans l'image de prod (curl, wget, bash sur alpine)
- [ ] `COPY --chown` utilisé pour éviter des fichiers root dans le container

### Runtime
- [ ] `--cap-drop ALL` et `--cap-add` uniquement les capabilities nécessaires
- [ ] Pas de `--privileged` sur les containers applicatifs
- [ ] Les ports internes ne sont pas exposés inutilement sur l'hôte

---

## Sécurité réseau

- [ ] TLS/HTTPS activé en production (certificats valides, renouvellement automatisé)
- [ ] Pas d'HTTP en clair pour des données sensibles (redirect 301 vers HTTPS)
- [ ] Les services internes (DB, cache) ne sont pas accessibles depuis internet
- [ ] Un reverse proxy (nginx, Traefik, Caddy) gère le TLS et le routing, pas l'app directement
- [ ] Les connexions DB sont chiffrées (SSL/TLS) en production

---

## Sévérités types

| Finding | Sévérité par défaut |
|---|---|
| Secret dans le code source | 🔴 P0 |
| Container en root | 🔴 P0 |
| JWT en localStorage | 🟠 P1 |
| Pas de rate limiting sur /login | 🟠 P1 |
| Vulnérabilités critiques dans l'image | 🔴 P0 |
| SQL par concaténation de chaînes | 🔴 P0 |
| Pas de HTTPS en prod | 🔴 P0 |
| DB accessible depuis internet | 🔴 P0 |
| Mots de passe hashés en MD5/SHA1 | 🔴 P0 |
| Headers HTTP de sécurité absents | 🟡 P2 |
| CORS `*` en prod | 🟠 P1 |
| Uploads sans validation MIME serveur | 🟠 P1 |
