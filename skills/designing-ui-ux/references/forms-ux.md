# Formulaires — UX Reference actionnable

Les formulaires sont le point de contact le plus frictionnel entre utilisateur et produit. Chaque micro-décision (label, ordre, validation) a un impact direct sur le taux de complétion.

## Table des matières

1. [Principes fondamentaux](#principes-fondamentaux)
2. [Labels et instructions](#labels-et-instructions)
3. [Validation et erreurs](#validation-et-erreurs)
4. [Types d'inputs spécifiques](#types-dinputs-spécifiques)
5. [Formulaires multi-étapes](#formulaires-multi-étapes)
6. [Soumission et feedback](#soumission-et-feedback)
7. [Mobile specifics](#mobile-specifics)

---

## Principes fondamentaux

### 1. Demander le strict minimum (Parkinson's Law + Tesler's Law)
Chaque champ = friction. Chaque champ retiré = +% de conversion.

**Questions à se poser pour chaque champ** :
- Ai-je vraiment besoin de cette info **maintenant** ?
- Puis-je la déduire automatiquement (géoloc pour pays, date de création côté serveur) ?
- Puis-je la demander plus tard (progressive profiling) ?

**Exemple** : inscription Tesler → email + mot de passe, point. Le reste (nom, téléphone, adresse) se complète au moment où c'est nécessaire.

### 2. Une colonne, pas deux
Les formulaires en **une seule colonne** ont un taux de complétion supérieur (étude CXL 2016). L'œil suit un mouvement vertical naturel, sans hésitation sur le parcours.

Exceptions acceptables : champs manifestement liés (prénom/nom, ville/code postal) peuvent être côte à côte.

### 3. Ordre logique
Suivre l'ordre naturel : le plus facile au plus engageant. Ex : email (facile) avant carte bancaire (engageant).

Pour l'adresse : adresse → code postal → ville (le CP permet de préremplir la ville via API).

### 4. Groupement (Chunking + Law of Common Region)
Regrouper visuellement les champs liés :
- Infos personnelles (nom, prénom, date de naissance)
- Contact (email, téléphone)
- Adresse (rue, CP, ville, pays)
- Paiement (numéro carte, exp, CVC)

Utiliser un **fieldset** avec **legend** ou simplement un intertitre + espacement.

### 5. Respecter le modèle mental
Le format de saisie doit correspondre à **l'expérience physique** de l'info.

- Numéro de carte bancaire : groupement par 4 chiffres avec espaces (comme sur la carte).
- Numéro de téléphone : espaces comme on les dit (01 23 45 67 89 en FR).
- Date : format localisé (JJ/MM/AAAA en FR, MM/DD/YYYY en US).

---

## Labels et instructions

### Position du label
**Au-dessus du champ** : pattern recommandé par défaut.
- L'œil descend naturellement.
- Évite le tronquage sur mobile.
- Compatible RTL.
- Accessible, clair.

**À gauche du champ** : acceptable pour des formulaires courts et denses (admin), mais pose des problèmes de longueur de label et de RTL.

**Placeholder comme label (floating label)** : risqué.
- Floating label (Material Design) : label qui remonte au focus. Plutôt OK si bien implémenté, mais : problème de contraste, placeholder qui disparaît, utilisateur qui oublie ce qu'il devait saisir.
- **Placeholder seul comme label** : mauvais pattern. À l'utilisation, l'utilisateur ne sait plus quel était le champ. Violation d'accessibilité.

### Rédaction des labels
- **Court et concret** : « Email » pas « Votre adresse email ».
- **Sans majuscules tout caps** (plus dur à lire).
- Éviter les points d'interrogation qui font doublon avec le champ.

### Indiquer les champs obligatoires vs optionnels

**Approche recommandée** : marquer les champs **optionnels**, pas les obligatoires.
- Si tous les champs sont essentiels (cas idéal), aucune mention.
- « (optionnel) » à côté du label est plus lisible qu'un `*` rouge partout.

**Approche classique** : `*` pour les obligatoires + mention « Les champs marqués d'un * sont obligatoires ».
- Acceptable, mais signe qu'il y a peut-être trop de champs optionnels.

### Instructions et aide
- **Hint text** (sous le champ, gris, petit) : indication de format ou contexte.
  - Ex : « Nous vous contactons uniquement pour les confirmations de commande. »
- **Tooltip (?)** : pour explications plus longues. L'utiliser avec parcimonie.
- **Exemple dans placeholder** : `ex: jean.dupont@mail.com`. N'est pas un label, c'est un exemple.

### Anti-patterns
- Labels en rouge et gras → confusion avec les erreurs.
- `*` sans explication.
- Tooltips qui contiennent l'info critique (invisible sur mobile/touch).

---

## Validation et erreurs

### Quand valider : timing
**Règle d'or** : ne pas valider trop tôt (anxiogène), ni trop tard (on soumet et on échoue).

**Pattern recommandé (Inline validation)** :
1. L'utilisateur tape.
2. À la **sortie du champ** (blur) → validation déclenchée.
3. Si erreur → affichage sous le champ, icône rouge.
4. Dès que l'utilisateur **revient** dans le champ et tape → re-validation **en temps réel** (on change) pour qu'il voie sa correction.
5. Validation finale à la soumission pour rattraper ce qui aurait manqué.

**Exceptions** :
- Password strength : en temps réel, à chaque frappe (utile car on construit).
- Username disponibilité : après un debounce (300-500 ms après la dernière frappe).

### Messages d'erreur
**Structure** : *ce qui s'est passé* + *ce que l'utilisateur doit faire*.

**Bons messages** :
- « L'adresse email est invalide. Vérifiez le format (exemple : nom@domaine.com). »
- « Le mot de passe doit contenir au moins 8 caractères. Il en contient 5. »
- « Ce nom d'utilisateur est déjà pris. Essayez-en un autre. »

**Mauvais messages** :
- « Erreur » (quoi ? où ?)
- « Champ invalide » (pourquoi ?)
- « Format incorrect » (quel format ?)

### Position du message
- **Sous le champ**, aligné à gauche.
- Icône d'erreur dans le champ (à droite) renforce l'indicateur.
- Couleur rouge + icône (jamais couleur seule pour accessibilité).
- Bordure du champ rouge.

### Erreurs globales
Si plusieurs champs sont en erreur à la soumission :
- Banner d'erreur en haut de formulaire résumant le nombre de champs.
- Scroll automatique vers le **premier** champ en erreur.
- Focus placé sur ce premier champ.
- Chaque champ reste marqué individuellement.

### Succès explicite
Pour les champs critiques (username, password, email), valider visiblement avec une icône verte + éventuellement « Disponible » / « Fort ».

### Anti-patterns
- Valider à chaque frappe dès le premier caractère → anxiogène, faux négatifs.
- Message d'erreur qui réapparaît 500 ms plus tard, pendant que l'utilisateur tape.
- Couleur rouge sans texte → daltoniens ignorés.
- Effacer les champs quand la soumission échoue → perte de tout le travail, inacceptable.
- Erreur serveur générique (« Une erreur est survenue ») après un form rempli.

---

## Types d'inputs spécifiques

### Password
- **Toggle show/hide** (icône œil) indispensable.
- **Jauge de force** si création : feedback en temps réel.
- **Critères visibles** en temps réel : « ✓ 8 caractères min », « ✗ 1 majuscule », etc. Beaucoup mieux qu'une règle cachée qui rejette à la soumission.
- **Pas de "retape ton mot de passe"** si le show/hide existe et fonctionne bien (pattern moderne).
- **Pas de limite max trop basse** (128 caractères min recommandé).
- Ne jamais tronquer silencieusement les caractères spéciaux.

### Email
- `type="email"` pour clavier adapté sur mobile.
- **Auto-correction désactivée** (`autocorrect="off"` `autocapitalize="off"`).
- Validation souple : accepter plusieurs formats valides RFC.
- Suggérer une correction si typo probable : « Voulez-vous dire `nom@gmail.com` ? » (pour `gmial.com`).

### Téléphone
- `type="tel"` pour clavier numérique sur mobile.
- Accepter les espaces, tirets, parenthèses, préfixe international (Postel's Law).
- Auto-format au fur et à mesure si possible.
- Sélecteur de pays pour applications internationales.

### Carte bancaire
- Champ numéro : auto-format en groupes de 4, longueur variable selon type de carte.
- Détection automatique du type de carte (Visa/Mastercard/Amex) via les premiers chiffres → affichage de l'icône.
- Date expiration : MM/AA en un seul champ avec auto-tab après MM.
- CVC : champ court, à côté de la date expi.
- `inputmode="numeric"` pour clavier chiffres.
- **Ne jamais** demander le nom "tel qu'écrit sur la carte" en plus si on a déjà le nom complet → Parkinson's Law.

### Date
**Inputs à éviter pour dates lointaines (birthdate)** :
- Scroll dropdowns iOS → pénibles pour descendre de 30 ans.

**Recommandations** :
- Pour dates proches (réservation, rendez-vous) : date picker calendaire.
- Pour dates lointaines (naissance) : 3 selects séparés (jour/mois/année) ou champ texte qui accepte plusieurs formats (Postel).
- **Toujours** localiser le format.
- Sur mobile : `type="date"` utilise le natif, généralement bon choix.

### Select (dropdown)
- **Dropdown natif** pour ≤ 10 options simples.
- **Combobox (searchable)** pour > 10 options.
- **Radio** pour ≤ 5 options quand elles doivent toutes être visibles.
- Valeur par défaut : si 80 % choisissent la même, la pré-sélectionner.
- **Ne pas** pré-sélectionner arbitrairement si l'utilisateur doit consciemment choisir (ex : « Civilité »).

### Upload de fichier
- Zone de drop visible avec instructions (« Glissez votre fichier ici ou cliquez »).
- Formats acceptés et taille max **affichés avant** la tentative.
- Progress bar pendant l'upload.
- Preview après upload (image, nom + taille + icône pour autres).
- Action "Supprimer" / "Remplacer" accessible.

### Textarea
- Hauteur auto-grow si le contenu dépasse.
- Compteur de caractères si limite (sous le champ, met à jour en temps réel, devient rouge à l'approche du max).

### Search
Voir `ui-patterns.md` → section Search.

---

## Formulaires multi-étapes

### Quand le faire
- Formulaire long (>10 champs) avec étapes logiquement distinctes.
- Pour fragmenter une tâche perçue comme lourde (Goal-Gradient Effect → l'utilisateur voit la progression).
- Checkout e-commerce : livraison, paiement, confirmation.

### Règles
- **Progress indicator** visible en permanence (Stepper).
  - Combien d'étapes au total.
  - Où on en est.
  - Possibilité de revenir (cliquer sur étape validée).
- **Sauvegarder** la progression à chaque étape (localStorage ou backend).
- **Résumé avant soumission finale** (récapitulatif de tout ce qui a été rempli).
- Boutons de navigation : « Précédent » (secondaire, à gauche), « Suivant » (primaire, à droite).
- Ne **jamais** faire reculer l'utilisateur en cas d'erreur (validation à chaque étape avant de passer).

### Quand NE PAS le faire
- Si le formulaire tient en < 7 champs, une seule page suffit.
- Si les étapes ne sont pas logiquement distinctes (artificielles).
- Si l'utilisateur est probablement récurrent (il perd son temps).

### Anti-patterns
- 12 étapes pour une inscription → abandon.
- Pas de possibilité de revenir modifier l'étape 2 depuis l'étape 4.
- Progression reset en cas de rafraîchissement de page.

---

## Soumission et feedback

### Bouton de soumission
- **Libellé explicite** : « Créer mon compte » plutôt que « Envoyer ». L'utilisateur sait ce qui va se passer.
- Placé **en bas, à droite** (ou full-width sur mobile).
- **État disabled** possible si des champs obligatoires manquent, mais avec attention :
  - Si disabled : expliquer pourquoi (tooltip ou message).
  - Alternative préférable : laisser actif, valider au clic, afficher les erreurs.

### États du bouton à la soumission
1. **Default** → cliquable.
2. **Loading** : remplacer le label par un spinner + texte « Envoi en cours... ». Bouton non cliquable. Empêche le double-submit.
3. **Success** : animation courte (checkmark) avant de rediriger.
4. **Error** : retourner à default, afficher l'erreur ailleurs.

### Feedback post-soumission
- **Succès** : redirection vers page de confirmation **ou** toast + reset du form.
- Page de confirmation : indique ce qui s'est passé + next step (Peak-End Rule : soigner la fin).
- **Échec** : ne pas vider le formulaire, afficher erreur contextuelle.

### Auto-save (drafts)
Pour les formulaires très longs (articles, rapports, tickets) : sauvegarder automatiquement toutes les 10-30 s. Indiquer discrètement « Enregistré il y a X secondes ».

### Anti-patterns
- Bouton « Envoyer » générique → l'utilisateur hésite.
- Vider tout le formulaire à la soumission échouée.
- Pas de feedback loading → double-soumission.
- Redirection immédiate sans confirmation lisible.

---

## Mobile specifics

### Clavier adapté à chaque champ
Chaque input doit déclencher le bon clavier mobile :

| Input | Type/inputmode |
|---|---|
| Email | `type="email"` |
| Téléphone | `type="tel"` |
| Nombre | `inputmode="numeric"` |
| URL | `type="url"` |
| Décimal | `inputmode="decimal"` |
| Recherche | `type="search"` |

### Auto-complétion et auto-fill
Ajouter les attributs `autocomplete` pour permettre l'auto-fill par le navigateur/iCloud/Google :
- `autocomplete="email"`, `"given-name"`, `"family-name"`, `"street-address"`, `"postal-code"`, `"cc-number"`, `"one-time-code"` (pour OTP SMS), etc.

C'est **la** fonctionnalité qui double les taux de complétion mobile.

### Tailles et espacements
- Inputs : 44 px de hauteur min (Fitts's Law + iOS guideline).
- Checkbox/Radio : zone tactile de 44×44 px même si le visuel est plus petit.
- Espacement entre champs : 16-24 px.
- CTA en bas : full-width ou très large, sticky bottom si formulaire long.

### Éviter le zoom automatique iOS
Safari iOS zoome sur les inputs dont `font-size < 16px`. Règle simple : **font-size ≥ 16px sur les inputs**. Même si le design veut plus petit, c'est au-dessus de 16 ou zoom.

### Anti-patterns
- Clavier par défaut pour un champ numérique → utilisateur doit switch.
- Pas d'autocomplete attributes → l'auto-fill ne marche pas.
- Inputs 32 px de haut, labels 12 px → utilisateur galère.

---

## Checklist finale avant mise en production

- [ ] Un seul champ obligatoire par défaut (email), le reste différé quand possible.
- [ ] Labels au-dessus, clairs, sans jargon.
- [ ] Champs obligatoires/optionnels signalés de façon cohérente.
- [ ] Validation au blur, re-validation en live après erreur.
- [ ] Messages d'erreur : cause + solution, sous le champ, couleur + icône.
- [ ] Focus visible au clavier (outline).
- [ ] Mobile : types d'input adaptés, `autocomplete` partout, font ≥ 16px.
- [ ] Bouton submit : libellé explicite, states (default/loading/success/error).
- [ ] Pas de double-submit possible.
- [ ] Confirmation claire après soumission.
- [ ] Formulaire multi-étapes : progress visible, possibilité de revenir, persistance.
- [ ] Tests clavier only et screen reader.

## Règle d'or des formulaires

> Chaque champ est une **demande**. Chaque demande exige une **justification**. Si tu ne peux pas expliquer pourquoi un champ est là, il ne devrait pas y être.
