# UI Patterns — Référence actionnable

Patterns d'interaction et de composants établis. Chaque pattern suit le format :
**Quand l'utiliser → Règles → Alternatives → Anti-patterns**.

## Table des matières

1. [Navigation](#navigation)
2. [Affichage de données](#affichage-de-données)
3. [États de contenu](#états-de-contenu)
4. [Disclosure et révélation progressive](#disclosure-et-révélation-progressive)
5. [Dialogues et overlays](#dialogues-et-overlays)
6. [Sélection et actions](#sélection-et-actions)
7. [Search et filtrage](#search-et-filtrage)
8. [Notifications et feedback](#notifications-et-feedback)

---

## Navigation

### Navigation principale horizontale (top nav)
**Quand l'utiliser** : Applications web standard, 3-7 sections de premier niveau, desktop prioritaire.

**Règles** :
- Logo à gauche = retour home (convention Jakob's Law).
- Ordre : items de navigation au centre/gauche, actions utilitaires (search, profil, notif) à droite.
- Section courante : indicateur visuel clair (souligné, fond, couleur).
- Sur mobile : collapse en hamburger ou bottom nav.

**Alternatives** : sidebar (si 8+ sections ou beaucoup de sous-niveaux), bottom nav (mobile-first apps).

**Anti-patterns** :
- 10+ items en top nav → l'œil ne scan plus.
- Hamburger sur desktop sans raison → découverte des fonctionnalités pénalisée.

---

### Sidebar navigation
**Quand l'utiliser** : Applications avec nombreuses sections, hiérarchie sur 2+ niveaux, back-office, dashboards.

**Règles** :
- Largeur : 240-280 px typique.
- Collapsable sur desktop pour gagner de l'espace.
- Icônes + labels (pas seulement icônes, sauf si l'utilisateur est expert récurrent).
- Sous-menus : indentation ou accordéon, pas de hover-only (inaccessible tactile).
- Section courante : indicateur visuel fort (fond + border left).

**Alternatives** : top nav + secondary nav, command palette.

**Anti-patterns** :
- Sidebar fixe sur mobile → vole trop d'espace.
- Sidebar à 3 niveaux d'imbrication → perte de repère.

---

### Bottom navigation (mobile)
**Quand l'utiliser** : Apps mobiles, 3-5 sections principales, utilisation fréquente au pouce.

**Règles** :
- 3 à 5 items maximum. 6+ = impossible à scanner et cibles trop petites (Fitts's Law).
- Icône + label (icônes seules = taux d'erreur 2x supérieur selon études Nielsen).
- Ne pas masquer au scroll sauf si vraiment peu d'espace.
- Section active : icône pleine + couleur, inactive : contour.

**Anti-patterns** :
- 6+ items → overflow ou tap imprécis.
- Action principale (compose, add) dissimulée dans la bottom nav au lieu d'être un FAB visible.

---

### Breadcrumbs
**Quand l'utiliser** : Hiérarchies profondes (3+ niveaux), sites à arborescence claire (doc, e-commerce, file browser).

**Règles** :
- Séparateur cohérent (`/`, `>`, `›`).
- Dernier item = page courante, **non cliquable**, mis en avant.
- Tous les items précédents sont cliquables.
- Toujours visible en haut du contenu principal, pas dans le header global.

**Alternatives** : arborescence latérale, back button enrichi.

**Anti-patterns** :
- Breadcrumbs sur sites à arborescence plate → bruit inutile.
- Derniers items tronqués sans tooltip → perte d'info.

---

### Tabs
**Quand l'utiliser** : Plusieurs vues d'un même objet (ex : détails / activité / paramètres d'un user), toutes équivalentes en importance.

**Règles** :
- 2 à 7 tabs max. Au-delà, utiliser une sidebar ou un sélecteur dropdown.
- Labels courts (1-2 mots).
- Tab actif : indicateur clair (souligné, fond).
- Même URL pour la même vue si possible (deep linking).
- Contenu de même nature : ne pas mélanger des vues totalement indépendantes.

**Alternatives** : sections scrollables, sidebar.

**Anti-patterns** :
- Tabs pour des actions différentes (Enregistrer / Supprimer / Modifier) → doit être des boutons.
- Tabs qui changent complètement la page (devrait être une nav).

---

## Affichage de données

### Liste vs Tableau vs Grille — matrice de choix

| Type de donnée | Composant recommandé |
|---|---|
| Items similaires, 1-2 attributs visibles, ordre peu important | **Liste** |
| Items comparables sur plusieurs colonnes, tri/filtre nécessaires | **Tableau** |
| Items à fort contenu visuel (images, previews), consommation | **Grille de cards** |
| Items très nombreux, recherche fréquente | **Liste virtualisée** + search |
| Comparaison détaillée entre items | **Tableau** ou **side-by-side** |

### Tableau de données (data table)
**Règles** :
- Headers sticky si scroll vertical.
- Tri par colonne : indicateur visuel clair (flèche) sur la colonne active.
- Actions ligne par ligne : cachées par défaut, révélées au hover (desktop) ou via menu kebab (mobile).
- Pagination ou scroll infini : pagination si l'utilisateur doit "revenir", scroll infini si consommation continue.
- Empty state si 0 résultat, skeleton rows pendant le chargement.
- Sélection multiple : checkbox en première colonne + action bar qui apparaît.
- Nombres alignés à droite, texte à gauche, dates au format localisé.

**Anti-patterns** :
- Tableau à 15 colonnes → scroll horizontal pénible, aucune lecture possible.
- Cellules dont le contenu wrap sur 4 lignes → préférer truncate + tooltip ou voir détail.
- Couleurs alternées (zebra) **et** bordures **et** hover → surcharge visuelle.

---

### Card
**Quand l'utiliser** : Objet consommable avec plusieurs attributs (produit, article, user, projet).

**Règles** :
- 1 card = 1 objet = 1 action principale.
- Structure verticale : media/icône → titre → metadata → actions.
- Zone cliquable entière si action principale = "voir détail".
- Élévation (shadow) discrète, radius cohérent avec le design system.
- Hover : légère élévation ou changement de bordure (feedback Doherty Threshold).

**Anti-patterns** :
- Card avec 5 actions différentes → ambiguïté sur où cliquer.
- Card très lourde en contenu → ce n'est plus un card, c'est un panneau.

---

## États de contenu

**Principe fondamental** : une liste, un tableau, un dashboard a **toujours** au moins 4 états à concevoir. Oublier un état = bug visuel quand il survient.

### Empty state
**Quand** : pas encore de données (premier usage) OU filtre trop restrictif OU donnée supprimée.

**Règles** :
- Illustration ou icône (pas de vide total, désorientant).
- Message clair : ce qui devrait être là, pourquoi c'est vide.
- CTA qui permet d'avancer (créer, inviter, modifier le filtre).
- Différencier : "pas encore rempli" vs "pas de résultat pour ce filtre" vs "erreur" → trois messages différents.

**Exemple** :
- First-time : « Vous n'avez encore aucun projet. Créez-en un pour démarrer. » [Nouveau projet]
- Filter : « Aucun résultat pour "xyz". » [Réinitialiser les filtres]

**Anti-patterns** :
- Écran blanc.
- « Aucune donnée. » sans suggestion d'action.

---

### Loading state
**Règles** :
- < 400 ms : aucun loader (Doherty Threshold, l'œil ne perçoit pas).
- 400 ms – 1 s : skeleton ou spinner discret.
- 1 s – 10 s : skeleton réaliste (reproduisant la structure à venir) OU progress bar si on connaît l'avancement.
- > 10 s : progress bar avec ETA + possibilité d'annuler.
- **Skeleton > spinner** pour le contenu structurable : réduit la charge perçue.
- Optimistic UI : préférer quand l'opération est probablement réussie (like, bookmark).

**Anti-patterns** :
- Spinner plein écran pour une opération de 200 ms → flicker désagréable.
- Aucun feedback sur un clic → l'utilisateur re-clique.

---

### Error state
**Règles** :
- Message clair : **ce qui a échoué** + **ce que l'utilisateur peut faire**.
- Ton neutre à empathique, jamais accusateur.
- Action de récupération (Réessayer, Revenir, Contacter support).
- Ne jamais afficher un stacktrace ou un code d'erreur brut à l'utilisateur final.
- Distinguer erreur réseau / erreur serveur / erreur de validation / erreur de droit.

**Exemple** :
- « Impossible de charger les données. Vérifiez votre connexion. » [Réessayer]

**Anti-patterns** :
- « Error 500 » seul.
- « Une erreur est survenue » sans plus de contexte ni action.

---

### Partial / stale state
**Quand** : données incomplètes, ou potentiellement obsolètes (cache, mode offline).

**Règles** :
- Indiquer l'état : « Dernière mise à jour il y a 2h », « Hors ligne ».
- Permettre de rafraîchir manuellement.
- Ne pas masquer la donnée : mieux vaut donnée ancienne + avertissement que rien.

---

## Disclosure et révélation progressive

### Accordion
**Quand l'utiliser** : contenu secondaire / optionnel, où l'utilisateur choisit ce qu'il développe. FAQ, paramètres avancés, sections détaillées.

**Règles** :
- Icône chevron qui pivote pour indiquer l'état (fermé vers le bas, ouvert vers le haut).
- Une seule section ouverte à la fois OU plusieurs : choix à assumer, mais cohérent dans l'app.
- Label cliquable entier (pas seulement l'icône, Fitts's Law).
- Transition smooth (200-300 ms) pour montrer l'ouverture.

**Alternatives** : tabs (si sections équivalentes en importance), drawer (si lourd).

**Anti-patterns** :
- Accordion pour du contenu essentiel → l'utilisateur rate l'info.
- Tous les accordéons ouverts par défaut → annule l'intérêt.

---

### Progressive disclosure (revelation progressive)
**Principe** : n'afficher que le strict nécessaire, révéler le détail à la demande.

**Patterns associés** :
- « Voir plus » sur une description tronquée.
- « Paramètres avancés » repliés par défaut.
- Tooltips pour infos contextuelles.
- Inputs dépendants : le champ B n'apparaît que si A est coché.

**Règles** :
- Ne pas cacher une info critique. La disclosure progressive est pour du **secondaire**.
- Laisser l'utilisateur contrôler : ne pas re-replier si il a ouvert.

---

### Tooltip vs Popover vs Hover card

| Pattern | Quand |
|---|---|
| **Tooltip** | Info brève (1 phrase), label d'icône, raccourci clavier. Pas d'interaction. |
| **Popover** | Mini panneau interactif : actions, formulaire court, confirmation. |
| **Hover card** | Preview enrichi d'une entité (profil user, preview d'un lien). Non interactif. |

**Règles tooltip** :
- Delay à l'ouverture (500 ms) pour éviter le déclenchement parasite au survol.
- Pas de tooltip tactile : sur mobile, le contenu doit être visible ou accessible au tap.
- Jamais d'info essentielle en tooltip (invisible au clavier, au touch, aux lecteurs d'écran sans attention particulière).

---

## Dialogues et overlays

### Modale (dialog)
**Quand l'utiliser** : action qui nécessite une décision avant de poursuivre, confirmation destructive, création rapide d'entité.

**Règles** :
- Backdrop semi-transparent pour focus.
- Escape ferme la modale. Clic en dehors : ferme (si pas de saisie en cours).
- Focus trappé dans la modale (accessibilité clavier).
- Action primaire à droite, secondaire (Annuler) à gauche (convention desktop/Jakob).
- Titre clair, action explicite (« Supprimer le projet » pas « OK »).
- Éviter les modales empilées (modale dans modale) → refactor le flow.

**Alternatives** : drawer (pour contenu long), inline edit, page dédiée (pour création complexe).

**Anti-patterns** :
- Modale pour une info qui aurait pu être inline.
- Modale obligatoire au chargement (cookies mal faits, « évaluez-nous »).
- Action destructive avec « OK / Annuler » sans explicite → utilisateur clique OK par réflexe.

---

### Confirmation destructive
**Règles** :
- Libellé explicite de l'action : « Supprimer définitivement » pas « Confirmer ».
- Couleur dangereuse (rouge) sur le bouton de confirmation.
- Pour action réellement irréversible et critique : demander de retaper le nom de l'objet (pattern GitHub delete repo).
- Proposer un undo post-action quand c'est techniquement possible → souvent meilleur que confirmation (Nielsen, Gmail).

---

### Drawer / Sheet (side panel)
**Quand l'utiliser** : contenu contextuel riche, édition longue, filtres avancés. Garde le contexte visible derrière.

**Règles** :
- Largeur : 320-480 px (desktop) ; plein écran ou 80 % (mobile).
- Bouton close explicite + escape + clic backdrop.
- Header sticky avec titre et actions principales.
- Footer sticky pour les actions de validation si formulaire long.

**Alternatives** : modale (si action rapide), page dédiée (si contenu très lourd).

---

### Toast / Snackbar
**Quand l'utiliser** : feedback non bloquant après action (succès, info, erreur légère).

**Règles** :
- Position : bas-centre ou haut-droite (selon convention de l'app, Jakob's Law).
- Auto-dismiss après 4-6 secondes pour les succès, manuel pour les erreurs.
- 1 à 2 toasts simultanés max. Empiler plutôt qu'afficher 10.
- Toujours inclure une action si l'utilisateur peut réagir (« Annuler » sur suppression).
- Jamais pour une info critique → utiliser une alert inline ou une modale.

**Anti-patterns** :
- Toast qui disparaît trop vite pour être lu.
- Toast pour info critique → utilisateur la rate.
- Toast qui couvre une action interactive.

---

## Sélection et actions

### Boutons : hiérarchie
**Règles** :
- **1 seul bouton primaire** par zone de décision (Von Restorff, clarté).
- Secondaire : action alternative / moins importante.
- Tertiaire (ghost, link) : action optionnelle / navigation.
- Danger : actions destructives uniquement.
- Icon-only : uniquement pour actions universellement reconnues, avec label accessible (aria-label).

**Tailles** :
- Standard : 36-40 px de hauteur (desktop).
- Touch : 44×44 px min (iOS) / 48×48 px (Material).
- Padding horizontal : ~1.5× la hauteur.

**États obligatoires** : default, hover, focus (outline visible !), active, disabled, loading.

**Anti-patterns** :
- 3 boutons primaires côte à côte → aucune hiérarchie.
- Bouton disabled sans explication du pourquoi.
- Bouton « Submit » au lieu d'une action explicite (« Créer le compte »).

---

### Checkbox vs Radio vs Switch

| Pattern | Quand |
|---|---|
| **Checkbox** | Sélection multiple possible (0 à N items), options indépendantes. |
| **Radio** | Exactement une option parmi plusieurs, toutes visibles. |
| **Switch (toggle)** | Action immédiate, binaire (on/off), généralement applicable en live. |
| **Select (dropdown)** | Choix unique parmi 5+ options, économise l'espace. |

**Règles switch** :
- Applique l'effet **immédiatement** (pas besoin de "Sauvegarder"). Si pas immédiat → utiliser un radio ou checkbox dans un formulaire.
- Label toujours à gauche du switch, état visible (ON/OFF différenciable).

**Anti-patterns** :
- Radio pour 2 options opposées (activé/désactivé) → switch plus clair.
- Checkbox pour un choix unique → radio.

---

### Segmented control
**Quand l'utiliser** : 2 à 5 options exclusives, changement de vue/mode immédiat. Alternative visuelle aux radio boutons.

**Règles** :
- 2 à 5 segments max.
- Libellés courts et équivalents (même nature).
- Segment actif : fond contrasté.
- Application immédiate (pas de bouton submit).

**Alternatives** : tabs, radio buttons, dropdown.

---

## Search et filtrage

### Search input
**Règles** :
- Icône loupe à gauche (convention Jakob).
- Clear button (×) à droite dès qu'il y a du texte.
- Placeholder descriptif : « Rechercher par nom, email... » (indique le scope).
- **Instant search** (débounce 200-300 ms) si le dataset le permet, sinon search on Enter.
- Afficher les résultats ou empty state dès la première saisie.
- Search récentes / suggestions si pertinent.

**Anti-patterns** :
- Search avec bouton « Rechercher » séparé sans Enter support.
- Pas de feedback pendant la recherche (loader absent).

---

### Filtres (faceted search)
**Règles** :
- Filtres appliqués : visibles sous forme de chips supprimables.
- Nombre de résultats à jour en permanence.
- Bouton « Réinitialiser tout » accessible.
- Mobile : filtres dans un drawer/bottom sheet, pas étalés.
- Filtres fréquents : en haut/sidebar. Filtres rares : collapsés.
- Éviter les filtres qui masquent tout → empty state si 0 résultat avec suggestion de relâcher.

**Anti-patterns** :
- Réinitialisation involontaire des filtres à chaque changement de page.
- Filtres qui modifient l'URL d'une façon non sharable.

---

## Notifications et feedback

### Hiérarchie des communications

| Type | Urgence | Pattern |
|---|---|---|
| Erreur système bloquante | Immédiate | Modale ou banner persistent |
| Erreur de validation | Contextuelle | Inline sous le champ |
| Succès d'action | Transitoire | Toast |
| Info générale | Non urgente | Banner dismissible |
| Promotionnel | Optionnel | Banner ou notification center |
| Statut système (maintenance) | Informatif | Banner en haut |

### Inline validation (formulaires)
**Règles** :
- Valider **à la sortie du champ** (blur), pas à chaque frappe (trop anxiogène).
- Valider à nouveau pendant la frappe **une fois que l'erreur est affichée**, pour que l'utilisateur voie sa correction.
- Message précis sous le champ, icône d'état visible.
- Ne jamais valider avant que l'utilisateur ait eu le temps de finir de taper.

**Voir `forms-ux.md` pour les détails complets.**

---

### Banner
**Quand l'utiliser** : info persistante (maintenance, compte non vérifié, essai qui expire).

**Règles** :
- Position : haut de page, full width.
- Couleur sémantique : info (bleu), warning (orange), critique (rouge), succès (vert).
- Dismissible si non critique, persistant si critique.
- Une seule action principale dans le banner.

**Anti-patterns** :
- Banner qui réapparaît à chaque page load malgré le dismiss → violation du respect utilisateur.
- 3 banners empilés → pollue la vue.

---

## Matrice de décision rapide : quel pattern choisir ?

| Besoin | Pattern |
|---|---|
| Confirmer une action avant exécution | Modale de confirmation (ou undo si possible) |
| Montrer un détail sans quitter la page | Drawer / Popover |
| Feedback d'une action réussie | Toast |
| Afficher plusieurs vues d'un même objet | Tabs |
| Choix exclusif rapide | Radio ou Segmented control |
| Paramètre on/off immédiat | Switch |
| Naviguer entre sections | Top nav / Sidebar / Bottom nav |
| Lister beaucoup d'objets avec tri | Tableau |
| Présenter des objets visuels | Grille de cards |
| Guider dans un parcours long | Stepper + Progress bar |
| Montrer une info complémentaire | Tooltip ou Popover |
| Collecter des infos structurées | Formulaire (voir `forms-ux.md`) |
| Chercher dans un dataset | Search + Filtres |

## Règle d'or des patterns

> Le meilleur pattern est **celui que l'utilisateur a déjà vu ailleurs** (Jakob's Law). Avant d'inventer, demander : comment le font Apple, Google, les 3 leaders de mon secteur ? Diverger seulement si gain clair, pas par originalité.
