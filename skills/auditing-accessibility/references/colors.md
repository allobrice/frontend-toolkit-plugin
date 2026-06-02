# Contrastes & Couleurs

Critères WCAG principaux : 1.4.1 (Use of Color), 1.4.3 (Contrast Minimum AA),
1.4.6 (Contrast Enhanced AAA), 1.4.11 (Non-text Contrast)

---

## Seuils de contraste requis

| Élément | Niveau AA | Niveau AAA |
|---|---|---|
| Texte normal (< 18pt / < 14pt gras) | 4.5:1 | 7:1 |
| Grand texte (≥ 18pt / ≥ 14pt gras) | 3:1 | 4.5:1 |
| Composants UI et états (bordures, icônes fonctionnels) | 3:1 | — |
| Texte sur image / gradient | 4.5:1 | 7:1 |
| Texte désactivé | Exempté | Exempté |
| Logotypes et marques | Exempté | Exempté |

---

## Checklist

### Contraste du texte (SC 1.4.3 — AA)
- [ ] Texte corps / labels : ratio ≥ 4.5:1
- [ ] Grands titres (≥ 18pt ou ≥ 14pt bold) : ratio ≥ 3:1
- [ ] Texte sur images de fond : ratio respecté sur toute la surface du texte
- [ ] Texte sur gradients ou photos : overlay suffisant ou vérification pixel par pixel
- [ ] Texte en placeholder (input) : ratio ≥ 4.5:1 (le placeholder est du contenu)

### Contraste des composants UI (SC 1.4.11 — AA)
- [ ] Bordures de champs de formulaire visibles : ratio ≥ 3:1 par rapport au fond
- [ ] Icônes fonctionnelles (pas purement décoratifs) : ratio ≥ 3:1
- [ ] Indicateur de focus : ratio ≥ 3:1 entre focus et fond adjacent
- [ ] État actif/inactif des boutons : distinction non basée uniquement sur la couleur
- [ ] Switch / toggle : état on/off distinguable sans la couleur seule

### Usage de la couleur (SC 1.4.1)
- [ ] L'information n'est pas transmise uniquement par la couleur
  - Graphiques : formes, patterns ou labels en complément
  - Champs en erreur : icône + texte d'erreur, pas seulement bordure rouge
  - Liens dans le texte : soulignement ou autre indication non-couleur
- [ ] Les liens inline (dans du texte) ont un ratio ≥ 3:1 par rapport au texte environnant
  OU sont différenciés autrement (soulignement)

### Dark mode / thèmes
- [ ] Les contrastes sont vérifiés dans tous les thèmes disponibles
- [ ] `prefers-color-scheme` respecté si dark mode disponible

---

## Outils de vérification recommandés

- **Contrast Checker** : https://webaim.org/resources/contrastchecker/
- **APCA** (méthode moderne) : https://www.myndex.com/APCA/
- **Browser DevTools** : inspect > Accessibility panel (Lighthouse, Axe)
- **Figma Plugin** : Contrast (Stark), A11y Annotation Kit

---

## Patterns courants

```scss
// ❌ Texte gris trop clair sur fond blanc (ratio ~2.5:1)
.subtitle {
  color: #aaaaaa;
  background: #ffffff;
}

// ✅ Texte gris accessible (ratio ~4.6:1)
.subtitle {
  color: #767676;
  background: #ffffff;
}

// ❌ Erreur communiquée par couleur seule
.input-error {
  border-color: #e53e3e; // rouge seul
}

// ✅ Erreur avec couleur + icône + texte
.input-error {
  border-color: #e53e3e;
  border-width: 2px;
}
// + aria-describedby vers le message d'erreur textuel
// + icône d'erreur avec aria-label
```

```html
<!-- ❌ Lien non distinguable sans la couleur -->
<p>Pour en savoir plus, <a style="color: blue; text-decoration: none">cliquez ici</a>.</p>

<!-- ✅ Lien avec soulignement -->
<p>Pour en savoir plus, <a style="color: blue; text-decoration: underline">cliquez ici</a>.</p>
```

---

## Critères WCAG de référence

| Critère | Niveau | Description |
|---|---|---|
| SC 1.4.1 | A | L'information n'est pas transmise uniquement par la couleur |
| SC 1.4.3 | AA | Contraste minimum du texte (4.5:1 / 3:1) |
| SC 1.4.6 | AAA | Contraste renforcé (7:1 / 4.5:1) |
| SC 1.4.11 | AA | Contraste des composants non-texte (3:1) |
