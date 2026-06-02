# Navigation Clavier & Gestion du Focus

Critères WCAG principaux : 2.1.1 (Keyboard), 2.1.2 (No Keyboard Trap), 2.4.3 (Focus Order),
2.4.7 (Focus Visible), 2.4.11 (Focus Appearance — WCAG 2.2)

---

## Checklist

### Accessibilité clavier de base
- [ ] Toutes les interactions souris sont réalisables au clavier (Tab, Shift+Tab, Enter, Espace, Flèches)
- [ ] Aucune fonctionnalité ne requiert un mouvement de souris précis ou un drag-and-drop non alternatif
- [ ] Gestes multi-touch (swipe, pinch) ont une alternative clavier ou bouton

### Ordre du focus
- [ ] L'ordre de tabulation est logique et suit l'ordre visuel du contenu
- [ ] Pas d'attributs `tabindex` positifs (> 0) qui perturbent l'ordre naturel
- [ ] Les éléments masqués visuellement (`display:none`, `visibility:hidden`) sont exclus du focus
- [ ] Éléments interactifs non focusables (`tabindex="-1"`) uniquement si gérés programmatiquement

### Visibilité du focus
- [ ] Indicateur de focus visible et suffisamment contrasté sur TOUS les éléments interactifs
- [ ] Pas de `outline: none` ou `outline: 0` sans remplacement (WCAG 2.2 SC 2.4.11)
- [ ] L'indicateur de focus ne dépend pas uniquement de la couleur
- [ ] Surface minimale de l'indicateur : périmètre de l'élément (WCAG 2.2 SC 2.4.12 AAA)

### Pièges clavier (Keyboard Trap)
- [ ] Aucun composant ne piège le focus indéfiniment
- [ ] Les modales/dialogs confinent correctement le focus (focus trap intentionnel avec Escape)
- [ ] Les menus déroulants ferment avec Escape et retournent le focus au déclencheur
- [ ] Les tooltips/popovers sont accessibles et ferment avec Escape

### Gestion programmatique du focus
- [ ] Après ouverture d'une modale : focus déplacé sur le premier élément focusable
- [ ] Après fermeture d'une modale : focus retourné sur l'élément déclencheur
- [ ] Après navigation SPA (changement de route) : focus géré (annonce + repositionnement)
- [ ] Après soumission de formulaire : focus sur la confirmation ou le premier champ en erreur
- [ ] Les notifications dynamiques n'interrompent pas le flux de navigation

### Skip Links
- [ ] Lien "Aller au contenu principal" présent et visible au focus
- [ ] Skip links fonctionnels (le focus se déplace réellement sur `<main>`)
- [ ] Si navigation complexe : skip links additionnels pour les sections répétées

---

## Patterns courants

```html
<!-- ❌ Focus invisible -->
<style>
*:focus { outline: none; }
</style>

<!-- ✅ Focus visible personnalisé -->
<style>
*:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
  border-radius: 2px;
}
</style>

<!-- ❌ tabindex positif qui perturbe l'ordre -->
<button tabindex="3">Action 1</button>
<button tabindex="1">Action 2</button>

<!-- ✅ Ordre naturel du DOM -->
<button>Action 2 (apparaît en premier dans le DOM)</button>
<button>Action 1</button>

<!-- ✅ Focus trap pour modale (Vue) -->
<script setup>
import { onMounted, ref } from 'vue'
const dialogRef = ref(null)

onMounted(() => {
  // Déplacer le focus sur le premier élément focusable
  const focusable = dialogRef.value?.querySelector(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  focusable?.focus()
})
</script>

<!-- ✅ Skip link -->
<a href="#main-content" class="skip-link">Aller au contenu principal</a>
<!-- ... navigation ... -->
<main id="main-content" tabindex="-1">...</main>

<style>
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
}
.skip-link:focus {
  top: 0;
}
</style>
```

---

## Critères WCAG de référence

| Critère | Niveau | Description |
|---|---|---|
| SC 2.1.1 | A | Toutes les fonctionnalités accessibles au clavier |
| SC 2.1.2 | A | Pas de piège clavier |
| SC 2.4.1 | A | Mécanisme pour contourner les blocs répétés |
| SC 2.4.3 | A | Ordre du focus logique |
| SC 2.4.7 | AA | Focus visible |
| SC 2.4.11 | AA (2.2) | Focus non masqué |
| SC 2.4.12 | AAA (2.2) | Focus suffisamment grand |
