# Formulaires

Critères WCAG principaux : 1.3.1, 1.3.5 (Identify Input Purpose), 2.4.6, 3.3.1 (Error Identification),
3.3.2 (Labels or Instructions), 3.3.3 (Error Suggestion), 3.3.4 (Error Prevention)

---

## Checklist

### Labels et associations
- [ ] Chaque champ de saisie a un `<label>` associé via `for`/`id` (ou `aria-labelledby`)
- [ ] Les labels `<label>` sont positionnés avant le champ (sauf cases à cocher/boutons radio)
- [ ] Pas de placeholder comme unique label (disparaît à la saisie, contrast insuffisant)
- [ ] Les fieldsets avec plusieurs champs liés ont une `<legend>` descriptive
- [ ] Les boutons radio et checkboxes en groupe sont dans un `<fieldset>` + `<legend>`
- [ ] Champs requis : marqués avec `required` ET indication visuelle (pas uniquement `*`)

### Aide contextuelle
- [ ] Format attendu expliqué avant ou dans le label (ex: "JJ/MM/AAAA")
- [ ] Contraintes de saisie documentées (longueur max, caractères autorisés)
- [ ] `aria-describedby` pointe vers les messages d'aide (hint text)
- [ ] `autocomplete` défini pour les champs personnels (SC 1.3.5 AA)

### Gestion des erreurs (SC 3.3.1 / 3.3.3 — A/AA)
- [ ] Les erreurs sont identifiées par texte (pas uniquement par couleur ou icône seule)
- [ ] Le message d'erreur est lié au champ via `aria-describedby` ou `aria-errormessage`
- [ ] `aria-invalid="true"` sur le champ en erreur
- [ ] Le message d'erreur suggère la correction quand c'est possible
- [ ] Focus déplacé sur le premier champ en erreur ou sur un résumé des erreurs

### Soumission et confirmation
- [ ] Après soumission réussie : feedback visible ET annoncé (role="status")
- [ ] Pour les actions destructives ou irréversibles : étape de confirmation (SC 3.3.4)
- [ ] Les champs pré-remplis sont vérifiables et modifiables avant soumission

### Autocomplete (SC 1.3.5 — AA)
- [ ] `autocomplete="name"` pour le nom complet
- [ ] `autocomplete="email"` pour l'email
- [ ] `autocomplete="tel"` pour le téléphone
- [ ] `autocomplete="current-password"` / `autocomplete="new-password"`
- [ ] `autocomplete="street-address"`, `"postal-code"`, `"country-name"` etc.

---

## Patterns courants

```html
<!-- ❌ Placeholder comme seul label -->
<input type="email" placeholder="Votre email">

<!-- ✅ Label visible + placeholder complémentaire -->
<label for="email">Adresse email</label>
<input
  type="email"
  id="email"
  name="email"
  placeholder="exemple@domaine.fr"
  autocomplete="email"
  required
  aria-describedby="email-hint email-error"
  aria-invalid="false"
>
<p id="email-hint" class="hint">Utilisez votre adresse professionnelle</p>
<p id="email-error" role="alert" aria-live="polite" hidden>
  Format invalide — ex: nom@domaine.fr
</p>

<!-- ❌ Groupe radio sans fieldset/legend -->
<div>
  <p>Civilité</p>
  <input type="radio" id="mr" name="civility" value="mr">
  <label for="mr">M.</label>
  <input type="radio" id="mrs" name="civility" value="mrs">
  <label for="mrs">Mme</label>
</div>

<!-- ✅ Groupe radio avec fieldset/legend -->
<fieldset>
  <legend>Civilité</legend>
  <input type="radio" id="mr" name="civility" value="mr">
  <label for="mr">M.</label>
  <input type="radio" id="mrs" name="civility" value="mrs">
  <label for="mrs">Mme</label>
</fieldset>

<!-- ✅ Résumé d'erreurs de formulaire (Vue) -->
<div role="alert" aria-live="assertive" v-if="hasErrors">
  <h3>{{ errors.length }} erreur(s) à corriger :</h3>
  <ul>
    <li v-for="error in errors" :key="error.field">
      <a :href="`#${error.field}`">{{ error.message }}</a>
    </li>
  </ul>
</div>
```

---

## Valeurs autocomplete recommandées (SC 1.3.5)

```
name, given-name, family-name, email, tel, username,
current-password, new-password, one-time-code,
street-address, address-line1, address-line2,
postal-code, city, country, country-name,
bday, bday-day, bday-month, bday-year,
sex, url, photo, language, organization
```

---

## Critères WCAG de référence

| Critère | Niveau | Description |
|---|---|---|
| SC 1.3.1 | A | Relations programmatiques (labels ↔ champs) |
| SC 1.3.5 | AA | Identification de l'objectif du champ |
| SC 2.4.6 | AA | Labels descriptifs |
| SC 3.3.1 | A | Identification des erreurs |
| SC 3.3.2 | A | Labels et instructions |
| SC 3.3.3 | AA | Suggestion pour corriger les erreurs |
| SC 3.3.4 | AA | Prévention des erreurs pour données légales/financières |
