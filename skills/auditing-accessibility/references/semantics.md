# Sémantique & Structure HTML

Critères WCAG principaux : 1.3.1 (Info and Relationships), 1.3.2 (Meaningful Sequence),
2.4.6 (Headings and Labels), 4.1.1 (Parsing), 4.1.2 (Name, Role, Value)

---

## Checklist

### Hiérarchie des titres
- [ ] Un seul `<h1>` par page
- [ ] Hiérarchie logique et continue (h1 → h2 → h3, pas de saut h1 → h3)
- [ ] Titres descriptifs du contenu de la section
- [ ] Titres non utilisés uniquement pour leur style visuel

### Landmarks et régions
- [ ] `<header>` présent (ou `role="banner"`)
- [ ] `<nav>` pour chaque navigation (+ `aria-label` si plusieurs navs)
- [ ] `<main>` unique par page (ou `role="main"`)
- [ ] `<footer>` présent (ou `role="contentinfo"`)
- [ ] `<aside>` pour le contenu complémentaire (ou `role="complementary"`)
- [ ] `<section>` avec `aria-labelledby` si utilisée comme landmark

### Éléments sémantiques
- [ ] `<button>` pour les actions, `<a>` pour la navigation (jamais de `<div>` cliquable sans rôle)
- [ ] `<ul>` / `<ol>` / `<li>` pour les listes (pas de listes en `<div>` / `<span>`)
- [ ] `<table>` avec `<caption>`, `<th scope="">` pour les données tabulaires
- [ ] `<em>` / `<strong>` pour l'emphase sémantique (pas `<i>` / `<b>` pour du sens)
- [ ] `<abbr title="">` pour les abréviations
- [ ] `<time datetime="">` pour les dates et durées
- [ ] `<figure>` + `<figcaption>` pour les images avec légende

### Langue
- [ ] `lang` défini sur `<html>` (ex: `lang="fr"`)
- [ ] `lang` sur les fragments en langue différente (ex: `<span lang="en">Read more</span>`)

### Structure du document
- [ ] `<title>` présent, unique et descriptif (format : "Page — Site")
- [ ] Pas d'éléments `<div>` ou `<span>` utilisés pour du contenu structurant sans rôle ARIA
- [ ] Ordre de lecture DOM cohérent avec l'ordre visuel

---

## Patterns anti a11y courants

```html
<!-- ❌ Div cliquable sans sémantique -->
<div onclick="submit()">Envoyer</div>

<!-- ✅ Bouton sémantique -->
<button type="submit">Envoyer</button>

<!-- ❌ Navigation sans landmark -->
<div class="nav">...</div>

<!-- ✅ Navigation avec landmark et label -->
<nav aria-label="Navigation principale">...</nav>

<!-- ❌ Saut de niveau de titre -->
<h1>Titre principal</h1>
<h3>Sous-section (h2 manquant)</h3>

<!-- ✅ Hiérarchie continue -->
<h1>Titre principal</h1>
<h2>Section</h2>
<h3>Sous-section</h3>
```

---

## Critères WCAG de référence

| Critère | Niveau | Description |
|---|---|---|
| SC 1.3.1 | A | L'information et les relations transmises visuellement sont disponibles programmatiquement |
| SC 1.3.2 | A | L'ordre de lecture est cohérent avec la signification |
| SC 2.4.1 | A | Mécanisme pour contourner les blocs répétés (skip links) |
| SC 2.4.2 | A | Titre de page descriptif |
| SC 2.4.6 | AA | Les titres et labels sont descriptifs |
| SC 4.1.1 | A | HTML valide (pas d'erreurs de parsing bloquantes) |
| SC 4.1.2 | A | Nom, rôle, valeur disponibles programmatiquement |
