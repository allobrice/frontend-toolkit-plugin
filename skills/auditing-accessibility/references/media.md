# Images & Médias

Critères WCAG principaux : 1.1.1 (Non-text Content), 1.2.x (Time-based Media),
1.4.5 (Images of Text), 2.3.1 (Three Flashes)

---

## Checklist

### Images (SC 1.1.1 — A)
- [ ] Toutes les images `<img>` ont un attribut `alt`
- [ ] Images informatives : `alt` décrit le contenu et la fonction de l'image
- [ ] Images décoratives : `alt=""` (chaîne vide) — jamais absente
- [ ] Images fonctionnelles (bouton-image, lien-image) : `alt` décrit l'action, pas l'image
- [ ] Images complexes (graphiques, diagrammes) : description longue via `aria-describedby` ou lien vers description
- [ ] Images de texte évitées (préférer du vrai texte CSS) — SC 1.4.5 AA

### Images en CSS (`background-image`)
- [ ] Si purement décorative : OK (pas besoin d'alt)
- [ ] Si informative : ne pas utiliser `background-image`, utiliser `<img alt="...">` à la place
- [ ] Images de fond avec texte par-dessus : contraste vérifié

### SVG
- [ ] SVG informatifs : `<title>` en premier enfant + `aria-labelledby` sur `<svg>`
- [ ] SVG décoratifs : `aria-hidden="true"` + `focusable="false"`
- [ ] SVG cliquables (liens, boutons) : voir section ARIA boutons icône

### Vidéo et audio
- [ ] Vidéos avec paroles : sous-titres disponibles (SC 1.2.2 AA)
- [ ] Vidéos avec contenu visuel essentiel : audio-description (SC 1.2.3 / 1.2.5)
- [ ] Audios seuls : transcription textuelle (SC 1.2.1 A)
- [ ] Pas de lecture automatique avec son (ou bouton de pause accessible) — SC 1.4.2 A
- [ ] Pas de clignotement > 3 fois/seconde (SC 2.3.1 A)

### Animations
- [ ] `prefers-reduced-motion` respecté (voir references/motion.md)

---

## Patterns courants

```html
<!-- ❌ Alt manquant -->
<img src="hero.jpg">

<!-- ❌ Alt non descriptif -->
<img src="hero.jpg" alt="image">

<!-- ✅ Image informative -->
<img src="hero.jpg" alt="Vue panoramique de la baie de Bretignolles-sur-Mer au coucher du soleil">

<!-- ✅ Image décorative -->
<img src="separator.svg" alt="">

<!-- ✅ Image fonctionnelle (dans un bouton) -->
<button>
  <img src="search.svg" alt="Rechercher">
</button>

<!-- ✅ SVG informatif -->
<svg aria-labelledby="chart-title" role="img">
  <title id="chart-title">Évolution des ventes Q1 2025 : +12% par rapport à Q1 2024</title>
  <!-- paths du graphique -->
</svg>

<!-- ✅ SVG décoratif -->
<svg aria-hidden="true" focusable="false">
  <!-- icône décorative -->
</svg>

<!-- ✅ Image complexe avec description étendue -->
<figure>
  <img
    src="architecture-diagram.png"
    alt="Diagramme d'architecture microservices"
    aria-describedby="arch-desc"
  >
  <figcaption id="arch-desc">
    Le système se compose de 3 services : API Gateway (entrée), Service Utilisateurs,
    et Service Paiement. Les communications passent par un message broker (RabbitMQ).
  </figcaption>
</figure>
```

---

## Critères WCAG de référence

| Critère | Niveau | Description |
|---|---|---|
| SC 1.1.1 | A | Alternatives textuelles pour les contenus non-textuels |
| SC 1.2.1 | A | Contenu audio/vidéo pré-enregistré : alternatives |
| SC 1.2.2 | A | Sous-titres pour vidéos |
| SC 1.2.3 | A | Audio-description ou alternative textuelle pour vidéos |
| SC 1.2.5 | AA | Audio-description pour vidéos pré-enregistrées |
| SC 1.4.2 | A | Contrôle du son automatique |
| SC 1.4.5 | AA | Éviter les images de texte |
| SC 2.3.1 | A | Pas de clignotement > 3/seconde |
