# Laws of UX — Référence actionnable

Source : https://lawsofux.com/ (Jon Yablonski). Adapté pour usage pratique en design d'interface.

Les 29 lois sont regroupées par catégorie cognitive. Chaque loi suit le format :
**Définition → Application → Exemple concret → Anti-pattern**.

## Table des matières

1. [Lois de la décision et des choix](#lois-de-la-décision-et-des-choix)
   - Hick's Law, Choice Overload, Occam's Razor, Tesler's Law, Pareto Principle, Parkinson's Law
2. [Lois de la mémoire et de l'attention](#lois-de-la-mémoire-et-de-lattention)
   - Miller's Law, Working Memory, Chunking, Serial Position Effect, Zeigarnik Effect, Selective Attention, Von Restorff Effect, Peak-End Rule
3. [Lois de la perception visuelle (Gestalt)](#lois-de-la-perception-visuelle-gestalt)
   - Law of Proximity, Law of Similarity, Law of Common Region, Law of Uniform Connectedness, Law of Prägnanz
4. [Lois de l'interaction physique et temporelle](#lois-de-linteraction-physique-et-temporelle)
   - Fitts's Law, Doherty Threshold, Goal-Gradient Effect
5. [Lois de la familiarité et des modèles mentaux](#lois-de-la-familiarité-et-des-modèles-mentaux)
   - Jakob's Law, Mental Model, Paradox of the Active User, Postel's Law
6. [Lois de la perception et du biais](#lois-de-la-perception-et-du-biais)
   - Aesthetic-Usability Effect, Cognitive Bias, Cognitive Load, Flow

---

## Lois de la décision et des choix

### Hick's Law
**Définition** : Le temps de décision augmente avec le nombre et la complexité des choix proposés.

**Application** :
- Limiter les options visibles simultanément. Regrouper les actions secondaires derrière un menu.
- Dans une navigation principale : viser 5-7 items max.
- Dans un formulaire : une question par écran pour les flows complexes.

**Exemple concret** : Un menu dropdown avec 20 actions → diviser en catégories avec sous-menus, ou exposer les 3-5 actions fréquentes et regrouper le reste dans "Plus".

**Anti-pattern** : Panneau de configuration avec 40 options à plat. L'utilisateur abandonne avant de trouver ce qu'il cherche.

---

### Choice Overload
**Définition** : Quand un utilisateur fait face à trop d'options, il est paralysé (paradox of choice) et peut renoncer à choisir.

**Application** :
- Pré-filtrer intelligemment (recommandations, "populaire", tri par défaut pertinent).
- Proposer une valeur par défaut raisonnable.
- Segmenter : montrer 6-9 options, puis "Voir plus".

**Exemple concret** : Une app de streaming qui propose directement une sélection curée plutôt que 10 000 titres à plat.

**Anti-pattern** : Un e-commerce qui affiche 200 produits par défaut sans tri pertinent ni filtre mis en avant.

---

### Occam's Razor
**Définition** : Entre plusieurs solutions équivalentes, la plus simple (moins d'hypothèses) doit être préférée.

**Application** :
- Supprimer tout élément qui ne sert pas directement l'objectif de l'écran.
- Préférer un composant natif familier à un composant custom complexe.
- Retirer des fonctionnalités plutôt qu'en ajouter quand le doute est permis.

**Exemple concret** : Un bouton « S'inscrire » suffit ; pas besoin de 3 variantes « Créer un compte », « Devenir membre », « Rejoindre » sur la même page.

**Anti-pattern** : Dashboard saturé de widgets « au cas où », dont 80 % ne sont jamais consultés.

---

### Tesler's Law (Loi de conservation de la complexité)
**Définition** : Pour tout système, il existe une complexité irréductible. La question est : qui l'absorbe — le concepteur ou l'utilisateur ?

**Application** :
- Toujours s'efforcer d'absorber la complexité côté système.
- Valeurs par défaut intelligentes plutôt que champs à remplir.
- Détection automatique (format de carte, pays, devise) plutôt que sélection manuelle.

**Exemple concret** : Un champ date qui accepte "demain", "12/04", "2025-04-12" et normalise en interne, au lieu d'imposer un format strict à l'utilisateur.

**Anti-pattern** : Message d'erreur « Format invalide, utilisez JJ/MM/AAAA » alors que le système pourrait parser plusieurs formats.

---

### Pareto Principle (80/20)
**Définition** : 80 % des effets viennent de 20 % des causes. En UX : 80 % des utilisateurs utilisent 20 % des fonctionnalités.

**Application** :
- Identifier les parcours critiques et les optimiser en priorité.
- Mettre en avant les 20 % de fonctionnalités qui couvrent 80 % des usages.
- Cacher (sans supprimer) les fonctionnalités avancées derrière un "Plus" ou un mode expert.

**Exemple concret** : Un éditeur de texte qui expose gras/italique/souligné en barre principale et déplace les 30 options typographiques avancées dans un panneau secondaire.

**Anti-pattern** : Traiter toutes les fonctionnalités avec le même poids visuel, ce qui dilue les parcours critiques.

---

### Parkinson's Law
**Définition** : Une tâche se dilate pour remplir le temps alloué. En UX : si on offre trop de champs/étapes, l'utilisateur les remplit tous, même superflus.

**Application** :
- Demander le strict minimum dans un formulaire d'inscription.
- Fixer des limites claires (nombre de caractères, temps imparti) quand c'est pertinent.
- Auto-compléter et anticiper pour raccourcir les tâches.

**Exemple concret** : Stripe Checkout qui pré-remplit pays, devise et formate la carte automatiquement → parcours de 30 secondes au lieu de 2 minutes.

**Anti-pattern** : Formulaire d'inscription à 15 champs obligatoires alors que 3 suffiraient pour démarrer.

---

## Lois de la mémoire et de l'attention

### Miller's Law
**Définition** : Un humain retient en moyenne 7±2 éléments en mémoire de travail. Chiffre souvent surestimé : en pratique, 4±1 pour du contenu non familier.

**Application** :
- Navigation : max 7 items de niveau 1.
- Numéros de téléphone, codes : les découper en chunks (06 12 34 56 78).
- Étapes d'un process : max 5-7 ; si plus, grouper en phases.

**Exemple concret** : IBAN affiché groupé par 4 caractères plutôt qu'en un bloc continu.

**Anti-pattern** : Stepper de checkout à 12 étapes linéaires, sans regroupement.

---

### Working Memory
**Définition** : La mémoire de travail est limitée et temporaire. Elle est drainée par chaque décision et chaque élément visible simultanément.

**Application** :
- Ne pas forcer l'utilisateur à mémoriser une info entre deux écrans : la rappeler.
- Afficher les valeurs sélectionnées dans un récapitulatif persistant.
- Permettre de revenir en arrière sans perdre le contexte.

**Exemple concret** : Un checkout qui affiche toujours le panier en latéral → l'utilisateur n'a pas à mémoriser ses articles.

**Anti-pattern** : Flow à plusieurs étapes qui fait disparaître les choix précédents, obligeant l'utilisateur à les garder en tête.

---

### Chunking
**Définition** : Regrouper des informations en unités signifiantes rend leur mémorisation et leur traitement plus faciles.

**Application** :
- Grouper les champs de formulaire par catégorie (infos perso, adresse, paiement).
- Diviser les tableaux de données en sections avec séparateurs visuels.
- Fractionner les longs textes en paragraphes courts avec intertitres.

**Exemple concret** : Paramètres d'un compte organisés en sections (Profil, Sécurité, Notifications, Facturation) plutôt qu'en une longue liste.

**Anti-pattern** : Formulaire de 20 champs sans regroupement ni séparation visuelle.

---

### Serial Position Effect
**Définition** : On se souvient mieux du premier (primacy) et du dernier (recency) élément d'une série.

**Application** :
- Placer les items les plus importants en début et fin de liste/menu.
- Ancrer le CTA principal à une position de forte mémorisation.
- Dans une navigation horizontale : extrêmes = items clés.

**Exemple concret** : Barre de navigation avec logo/marque à gauche, CTA de conversion à droite, items utilitaires au centre.

**Anti-pattern** : Placer l'action la plus importante au milieu d'une liste de 10 items secondaires.

---

### Zeigarnik Effect
**Définition** : On se souvient mieux d'une tâche incomplète que d'une tâche terminée. La tension cognitive pousse à la compléter.

**Application** :
- Barres de progression visibles sur les formulaires multi-étapes.
- Indiquer les profils à compléter (« Votre profil est à 70 % »).
- Gamification légère : checklists d'onboarding avec état.

**Exemple concret** : LinkedIn qui montre « Profil incomplet » avec un % → pousse l'utilisateur à compléter.

**Anti-pattern** : Abuser de la tension au point de créer de l'anxiété (notifications de rappel agressives, CTA culpabilisants).

---

### Selective Attention
**Définition** : L'utilisateur filtre activement son environnement visuel pour se concentrer sur ce qui sert son objectif. Il ignore le reste (banner blindness).

**Application** :
- Ne pas noyer l'action principale dans des éléments secondaires visuellement similaires.
- Utiliser la hiérarchie visuelle pour guider l'attention.
- Éviter les zones "ad-like" pour des infos importantes : bandeau haut coloré, colonne droite → souvent ignorées.

**Exemple concret** : Un message d'erreur critique affiché dans le flux (inline) plutôt qu'en banner coloré en haut de page.

**Anti-pattern** : Afficher un CTA essentiel dans un emplacement qui ressemble à une publicité.

---

### Von Restorff Effect (Effet d'isolement)
**Définition** : Un élément qui diffère visuellement des autres est mieux mémorisé et remarqué.

**Application** :
- **Un seul** CTA primaire par écran, visuellement distinct.
- Mettre en évidence l'offre recommandée dans un pricing table.
- Utiliser la couleur vive avec parcimonie pour attirer l'œil où c'est stratégique.

**Exemple concret** : Pricing à 3 plans, où celui recommandé a une bordure colorée et un badge "Populaire".

**Anti-pattern** : Tous les boutons sont primaires → aucun ne l'est vraiment. L'utilisateur ne sait pas où cliquer.

---

### Peak-End Rule
**Définition** : L'expérience est jugée majoritairement sur son moment fort (peak) et sa fin (end), pas sur la moyenne.

**Application** :
- Soigner le moment de succès (paiement confirmé, tâche accomplie) : animation, message personnalisé, next step.
- Soigner la fin de flow : page de confirmation claire, pas juste un "OK".
- Transformer un moment de friction inévitable en moment positif (attente avec illustration sympa, micro-copy).

**Exemple concret** : Duolingo qui célèbre la fin d'une leçon avec animation + encouragement → l'utilisateur associe l'app à une sensation positive.

**Anti-pattern** : Parcours d'achat fluide qui se termine par une page blanche "Commande validée." sans contexte ni suite.

---

## Lois de la perception visuelle (Gestalt)

Les lois de Gestalt décrivent comment l'œil humain groupe spontanément les éléments.

### Law of Proximity
**Définition** : Les éléments proches sont perçus comme liés.

**Application** :
- Label et input associés : proches. Input et input du champ suivant : plus éloignés.
- Actions d'un card : groupées visuellement à l'intérieur du card.
- Espacement entre sections : plus grand qu'entre items d'une section.

**Exemple concret** : Un card produit avec image/titre/prix groupés serré et un bouton "Ajouter" légèrement détaché → l'œil comprend instantanément l'unité du produit et l'action.

**Anti-pattern** : Label d'un champ à 40px au-dessus, ou à équidistance du champ précédent et du sien → ambiguïté sur l'association.

---

### Law of Similarity
**Définition** : Les éléments visuellement similaires sont perçus comme appartenant au même groupe ou ayant la même fonction.

**Application** :
- Même type d'action = même style visuel (tous les boutons secondaires ont le même style).
- Différents types d'info = styles différents (prix en gras, description normale, avis en couleur différente).
- Cohérence absolue sur les icônes : même famille, même stroke, même taille.

**Exemple concret** : Dans une table, les badges de statut partagent un style (pill + couleur sémantique) → l'œil les scanne instantanément.

**Anti-pattern** : Trois styles de bouton primaire différents dans la même interface selon les pages.

---

### Law of Common Region
**Définition** : Des éléments dans une région délimitée (bordure, fond) sont perçus comme groupés, même s'ils sont éloignés.

**Application** :
- Card, panneau, section avec fond différencié pour grouper des infos.
- Fieldset dans un formulaire pour grouper des champs liés.
- Sidebar avec un fond distinct → scope de navigation clair.

**Exemple concret** : Dashboard où chaque widget est dans un card avec fond blanc et ombre légère → chaque unité d'info est lisible.

**Anti-pattern** : Tout poser sur un fond uniforme sans aucune délimitation → difficile de savoir ce qui va ensemble.

---

### Law of Uniform Connectedness
**Définition** : Des éléments visuellement connectés (ligne, rail, fond commun) sont perçus comme liés, plus fortement même que par similarité ou proximité.

**Application** :
- Stepper : les étapes reliées par une ligne montrent la séquence.
- Breadcrumbs : les séparateurs `/` ou `>` connectent la hiérarchie.
- Relations de données : lignes dans un diagramme, arbres, graphes.

**Exemple concret** : Timeline de commande avec points reliés par une ligne → progression claire.

**Anti-pattern** : Étapes d'un process présentées comme des cards indépendantes sans indication de séquence.

---

### Law of Prägnanz (Loi de la simplicité / bonne forme)
**Définition** : L'œil interprète les formes complexes comme leur version la plus simple possible.

**Application** :
- Préférer les formes simples et reconnaissables (rectangle, cercle) aux formes complexes.
- Icônes : silhouettes simples, pas de détails superflus.
- Illustrations UI : géométrie claire plutôt que photo complexe.

**Exemple concret** : Icône de dossier stylisée à 3 traits → reconnue instantanément. Une photo réaliste de dossier serait plus lente à traiter.

**Anti-pattern** : Icônes custom ultra-détaillées à 16×16 px, illisibles à cette taille.

---

## Lois de l'interaction physique et temporelle

### Fitts's Law
**Définition** : Le temps pour atteindre une cible est fonction de sa **distance** et de sa **taille**. Plus proche et plus grand = plus rapide à atteindre.

**Application** :
- Boutons tactiles : minimum 44×44 px (iOS) / 48×48 px (Material Design).
- Actions primaires : grosses, accessibles au pouce sur mobile (zone inférieure).
- Regrouper physiquement les actions liées à leur cible (contextuel plutôt que distant).
- Les coins et bords d'écran ont une taille "infinie" en pratique (souris) → zones précieuses (macOS dock, barre de menus).

**Exemple concret** : FAB (Floating Action Button) en bas à droite sur mobile → accessible au pouce.

**Anti-pattern** : Bouton "Supprimer" petit et isolé en haut à droite sur mobile → zone inaccessible au pouce, utilisateur forcé de changer de prise.

---

### Doherty Threshold
**Définition** : La productivité monte en flèche quand le système répond en moins de 400 ms. Au-delà, l'utilisateur décroche.

**Application** :
- Feedback visuel immédiat au clic (< 100 ms), même si l'opération réelle est plus longue.
- Optimistic UI : afficher le résultat attendu avant confirmation serveur.
- Si une opération > 400 ms est inévitable : loader, skeleton, progress bar.
- Si > 10 s : progress bar avec ETA, possibilité d'annuler.

**Exemple concret** : Like sur Twitter → le cœur se remplit instantanément, la requête serveur part en arrière-plan.

**Anti-pattern** : Bouton qui reste inerte 2 secondes après le clic → l'utilisateur re-clique, soumet deux fois.

---

### Goal-Gradient Effect
**Définition** : Plus on approche d'un but, plus on accélère pour l'atteindre.

**Application** :
- Progress bars sur formulaires longs, achievements.
- Montrer que l'étape courante est "presque finie" (pré-remplir, pré-valider).
- Dans un programme de fidélité : afficher combien il reste à gagner la récompense.

**Exemple concret** : Checkout e-commerce avec "Étape 3 sur 3" et une barre à 90 % → l'utilisateur sent qu'il est presque arrivé.

**Anti-pattern** : Flow sans indication de progression, où l'utilisateur ne sait pas combien d'étapes restent.

---

## Lois de la familiarité et des modèles mentaux

### Jakob's Law
**Définition** : Les utilisateurs passent la majorité de leur temps sur **d'autres sites**. Ils s'attendent à ce que ton site fonctionne comme ceux qu'ils connaissent déjà.

**Application** :
- Respecter les conventions de navigation (logo en haut à gauche → home, panier en haut à droite, etc.).
- Utiliser des icônes universelles (loupe = recherche, engrenage = paramètres).
- Positions attendues : CTA primaire à droite d'une paire, "Annuler" à gauche.
- **Innover uniquement quand il y a un gain clair**. Innovation gratuite = friction pure.

**Exemple concret** : Un e-commerce qui met son panier en haut à droite avec icône caddie → aucun apprentissage nécessaire.

**Anti-pattern** : Menu caché derrière un geste custom non documenté. L'utilisateur ne découvrira pas la fonctionnalité.

---

### Mental Model
**Définition** : L'utilisateur arrive avec une représentation mentale de comment le système **devrait** fonctionner, fondée sur ses expériences passées. Le fossé entre son modèle et le modèle réel du système = source de friction.

**Application** :
- Utiliser le vocabulaire de l'utilisateur, pas le jargon technique interne.
- Métaphores visuelles connues (corbeille, dossier, bureau).
- Tester : demander à un utilisateur novice ce qu'il s'attend à voir avant de cliquer.

**Exemple concret** : Glisser-déposer un fichier dans une "corbeille" = métaphore physique intuitive. Le mot "deallocate" aurait été incompréhensible.

**Anti-pattern** : Exposer dans l'UI des concepts du domaine technique (ex : « invalider le cache », « payload », « index ») au lieu de concepts métier.

---

### Paradox of the Active User
**Définition** : Les utilisateurs ne lisent **pas** les manuels. Ils commencent à utiliser le produit immédiatement, par essai-erreur.

**Application** :
- Onboarding contextuel plutôt que tutoriel frontal.
- Valeurs par défaut qui permettent de démarrer sans configuration.
- Apprentissage progressif : l'utilisateur découvre les fonctionnalités au fur et à mesure du besoin.
- Tooltips et aides inline au moment où ils sont pertinents.

**Exemple concret** : Figma qui te plonge dans un canvas vide avec des raccourcis qui s'affichent au fil de l'usage.

**Anti-pattern** : Long tutoriel obligatoire de 12 écrans à l'inscription. 80 % des utilisateurs cliquent "skip" sans lire.

---

### Postel's Law (Principle of Robustness)
**Définition** : Sois libéral dans ce que tu acceptes, conservateur dans ce que tu envoies. En UX : le système doit tolérer les variations de l'utilisateur, tout en communiquant avec précision.

**Application** :
- Accepter plusieurs formats en entrée (dates, numéros de téléphone, IBAN avec/sans espaces, majuscules/minuscules).
- Trim automatique des espaces en début/fin.
- Messages d'erreur précis et actionnables (pas juste « erreur »).

**Exemple concret** : Champ email qui accepte "Jean.Dupont@Mail.com " (avec espace final) sans rejeter, et normalise en interne.

**Anti-pattern** : Rejeter un numéro de carte parce que l'utilisateur a mis des espaces (ce que la plupart des gens font).

---

## Lois de la perception et du biais

### Aesthetic-Usability Effect
**Définition** : Les utilisateurs perçoivent les designs esthétiquement plaisants comme plus utilisables, même quand ils ne le sont pas plus.

**Application** :
- Soigner la forme autant que le fond : polish visuel = tolérance aux défauts.
- Attention : ne pas utiliser ce biais comme excuse pour cacher des problèmes d'ergonomie.
- Utile en early stage : un prototype élégant reçoit plus de feedback constructif qu'un prototype laid.

**Exemple concret** : Deux calculatrices identiques fonctionnellement ; celle avec typo soignée et animations est jugée "meilleure" par les testeurs.

**Anti-pattern** : S'appuyer sur l'esthétique pour masquer un flow fondamentalement cassé. Le biais aide mais ne sauve pas.

---

### Cognitive Bias
**Définition** : Erreurs systématiques de jugement qui influencent la perception et la décision. Ex : biais de confirmation, biais d'ancrage, effet de dotation.

**Application** :
- **Ancrage** : afficher un prix barré à côté du prix soldé → le prix soldé paraît plus avantageux.
- **Biais de dotation** : essais gratuits → l'utilisateur perçoit le produit comme « sien » avant d'acheter.
- **Biais de rareté** : "Plus que 2 en stock" accélère la décision.
- **Responsabilité éthique** : connaître ces biais pour les utiliser honnêtement, pas manipuler.

**Exemple concret** : Pricing page avec 3 plans, plan du milieu mis en avant → ancrage + von Restorff = plan le plus choisi.

**Anti-pattern (dark pattern)** : Compte à rebours faux ("offre expire dans 5 min" qui se réinitialise). Manipulation = perte de confiance à long terme.

---

### Cognitive Load
**Définition** : Ressources mentales nécessaires pour comprendre et utiliser une interface. Divisible en 3 : intrinsèque (liée à la tâche), extrinsèque (liée à l'UI), pertinente (liée à l'apprentissage).

**Application** :
- **Réduire la charge extrinsèque** : supprimer le bruit, clarifier les labels, rendre l'interface prévisible.
- Découper les tâches complexes en étapes digestes.
- Fournir du contexte rappel plutôt que forcer à mémoriser.
- Pas plus de 3-4 éléments interactifs à la fois dans la zone focus.

**Exemple concret** : Un formulaire qui n'affiche l'étape suivante qu'après validation de la précédente réduit la charge perçue.

**Anti-pattern** : Écran qui présente simultanément toutes les options, tous les champs, toutes les actions possibles. L'utilisateur abandonne.

---

### Flow
**Définition** : État mental de focus absolu et de plaisir dans une activité, entre ennui et anxiété. Atteint quand la difficulté matche le niveau de l'utilisateur.

**Application** :
- Minimiser les interruptions (notifications, popups modaux non essentiels).
- Feedback continu sur la progression.
- Ajuster la difficulté progressivement (onboarding → pro features).
- Zéro friction sur les actions répétitives (raccourcis, quick actions).

**Exemple concret** : Un IDE qui garde l'utilisateur en flow avec auto-complétion, snippets, raccourcis. Chaque popup casse le flow.

**Anti-pattern** : Interruption d'une tâche en cours par une modale « Évaluez-nous » ou « Acceptez les cookies » après 10 secondes de lecture.

---

## Matrice de priorisation rapide

Quand tu hésites sur quelle loi appliquer en priorité :

| Situation | Lois à prioriser |
|---|---|
| Nouvelle interface, conception | Jakob's Law, Mental Model, Occam's Razor |
| Trop d'options, overwhelm | Hick's Law, Choice Overload, Miller's Law |
| Formulaire complexe | Tesler's Law, Postel's Law, Parkinson's Law, Chunking |
| Dashboard / data-lourd | Pareto Principle, Chunking, Law of Common Region |
| Flow d'achat / conversion | Goal-Gradient, Peak-End Rule, Von Restorff, Doherty Threshold |
| Mobile, zones tactiles | Fitts's Law, Jakob's Law |
| Landing / hiérarchie visuelle | Von Restorff, Serial Position, Gestalt laws |
| Feedback utilisateur | Doherty Threshold, Peak-End Rule |
| Onboarding | Paradox of the Active User, Goal-Gradient, Zeigarnik |

## Règle d'or transverse

> Une loi n'est jamais une règle absolue. C'est une **heuristique**. Toutes les lois peuvent entrer en tension (ex : Jakob vs innovation, Hick vs pouvoir fonctionnel). Le travail du designer est d'**arbitrer en contexte**, et de **justifier** chaque arbitrage.
