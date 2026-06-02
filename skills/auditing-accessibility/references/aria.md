# Attributs ARIA

Critères WCAG principaux : 4.1.2 (Name, Role, Value), 4.1.3 (Status Messages), 1.3.1, 1.3.4

**Règle d'or : Pas d'ARIA vaut mieux qu'un mauvais ARIA.**  
L'HTML sémantique est toujours préférable. ARIA est un complément pour les cas non couverts.

---

## Checklist

### Labels et noms accessibles
- [ ] Tous les éléments interactifs ont un nom accessible (via `aria-label`, `aria-labelledby`, ou contenu textuel)
- [ ] `aria-label` utilisé uniquement si le texte visible ne suffit pas
- [ ] `aria-labelledby` pointe vers des IDs existants et non vides
- [ ] `aria-describedby` pour les descriptions supplémentaires (ex: aide contextuelle)
- [ ] Les boutons icône (sans texte visible) ont un `aria-label`
- [ ] Les boutons avec texte n'ont pas de `aria-label` redondant

### Rôles ARIA
- [ ] Rôles valides et appropriés (ne pas redéfinir des rôles HTML natifs)
- [ ] Rôles composites correctement implémentés :
  - `role="tablist"` → enfants `role="tab"` → `role="tabpanel"`
  - `role="combobox"` → attributs requis présents (`aria-expanded`, `aria-controls`)
  - `role="dialog"` → `aria-modal="true"`, `aria-labelledby`
  - `role="alertdialog"` → pour les dialogs bloquants nécessitant une réponse
  - `role="menu"` → enfants `role="menuitem"`
  - `role="listbox"` → enfants `role="option"` avec `aria-selected`

### États et propriétés
- [ ] `aria-expanded` sur les éléments qui se développent (accordéons, menus)
- [ ] `aria-selected` sur les items sélectionnables (tabs, options de liste)
- [ ] `aria-checked` sur les checkboxes et switches personnalisés
- [ ] `aria-pressed` sur les boutons toggle
- [ ] `aria-disabled` cohérent avec l'état visuel et fonctionnel
- [ ] `aria-hidden="true"` sur les éléments décoratifs non informatifs
- [ ] `aria-live` pour les zones de contenu dynamique (modéré : `polite` pour notifications, `assertive` uniquement pour erreurs critiques)
- [ ] `aria-busy="true"` pendant les chargements asynchrones

### Messages de statut (SC 4.1.3)
- [ ] Les notifications de succès/erreur sont annoncées via `role="status"` (polite) ou `role="alert"` (assertive)
- [ ] Pas d'annonces abusives (chaque interaction ne doit pas déclencher une annonce)
- [ ] Les compteurs de résultats de recherche sont annoncés dynamiquement

### Erreurs à éviter
- [ ] Pas de `role="presentation"` ou `role="none"` sur des éléments interactifs
- [ ] Pas d'ARIA sur des éléments HTML sémantiques déjà corrects (redondance)
- [ ] Pas d'IDs dupliqués dans la page (cassent `aria-labelledby` et `aria-describedby`)
- [ ] `aria-required` cohérent avec l'attribut HTML `required`

---

## Patterns courants

```html
<!-- ❌ Bouton icône sans label -->
<button>
  <svg><!-- icône croix --></svg>
</button>

<!-- ✅ Bouton icône avec label et icône masquée -->
<button aria-label="Fermer la modale">
  <svg aria-hidden="true" focusable="false"><!-- icône croix --></svg>
</button>

<!-- ❌ Select personnalisé sans ARIA -->
<div class="custom-select" onclick="toggle()">
  <div class="selected-value">Option 1</div>
  <div class="options">...</div>
</div>

<!-- ✅ Select personnalisé avec ARIA complet -->
<div
  role="combobox"
  aria-expanded="false"
  aria-haspopup="listbox"
  aria-controls="options-list"
  aria-labelledby="select-label"
  tabindex="0"
>
  <span id="select-label">Choisir une option</span>
  <div role="listbox" id="options-list" aria-label="Options disponibles">
    <div role="option" aria-selected="true">Option 1</div>
    <div role="option" aria-selected="false">Option 2</div>
  </div>
</div>

<!-- ✅ Zone de notification dynamique -->
<div role="status" aria-live="polite" aria-atomic="true">
  <!-- Le contenu injecté ici sera annoncé -->
</div>

<!-- ✅ Modale accessible -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-desc"
>
  <h2 id="dialog-title">Confirmer la suppression</h2>
  <p id="dialog-desc">Cette action est irréversible.</p>
  <button>Annuler</button>
  <button>Confirmer</button>
</div>
```

---

## Critères WCAG de référence

| Critère | Niveau | Description |
|---|---|---|
| SC 4.1.2 | A | Nom, rôle, valeur disponibles programmatiquement |
| SC 4.1.3 | AA | Les messages de statut sont transmis aux technologies d'assistance |
| SC 1.3.1 | A | L'information et les relations transmises visuellement sont disponibles programmatiquement |
