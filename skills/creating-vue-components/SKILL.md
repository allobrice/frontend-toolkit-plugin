---
name: creating-vue-components
description: Create high-quality Vue 2.7 components using Composition API with TypeScript. Handles component creation (Component, Layout, Modal, View), form validation with Vuelidate, responsive design, performance optimization, and accessibility best practices. Use when creating or refactoring Vue components, implementing forms, or working with SCSS-scoped styles.
---

# Vue UI Components - Guide de création

Ce skill fournit des templates et des bonnes pratiques pour créer des composants Vue 2.7 performants, accessibles et responsives en utilisant la Composition API avec TypeScript.

## Conventions de nommage

Respecter strictement les suffixes suivants selon le type de composant :

- **Component** : Composant simple réutilisable (ex: `ButtonComponent.vue`, `CardComponent.vue`)
- **Layout** : Layout de page avec slots (ex: `MainLayout.vue`, `DashboardLayout.vue`)
- **Modal** : Modale/Dialog (ex: `ConfirmModal.vue`, `UserModal.vue`)
- **View** : Page/Vue de l'application (ex: `HomeView.vue`, `ProfileView.vue`)

## Structure de base d'un composant

Chaque composant doit suivre cette structure :

```vue
<script setup lang="ts">
// 1. Imports
import { ref, computed } from 'vue'

// 2. Props interface
interface Props {
  // Définir les props
}

const props = withDefaults(defineProps<Props>(), {
  // Valeurs par défaut
})

// 3. Emits interface
interface Emits {
  (e: 'eventName', value: Type): void
}

const emit = defineEmits<Emits>()

// 4. State
const localState = ref('')

// 5. Computed
const computedValue = computed(() => {
  return props.someValue
})

// 6. Methods
const handleAction = () => {
  emit('eventName', localState.value)
}

// 7. Lifecycle
onMounted(() => {
  // Initialisation
})
</script>

<template>
  <div class="component-name">
    <!-- Contenu du composant -->
  </div>
</template>

<style lang="scss" scoped>
.component-name {
  // Styles du composant
}

// Responsive
@media (max-width: 768px) {
  .component-name {
    // Mobile styles
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .component-name {
    // Tablet styles
  }
}

@media (min-width: 1025px) {
  .component-name {
    // Desktop styles
  }
}
</style>
```

## Templates disponibles

Utiliser les templates fournis comme point de départ pour chaque type de composant :

### 1. Component simple
Voir `assets/ComponentTemplate.vue` - Template de base pour un composant réutilisable.

### 2. Layout
Voir `assets/LayoutTemplate.vue` - Layout avec slots header/main/footer et gestion responsive.

### 3. Modal
Voir `assets/ModalTemplate.vue` - Modale accessible avec :
- Gestion du focus et du clavier (Escape)
- Teleport vers body
- Overlay cliquable
- Tailles configurables (small/medium/large)
- Transitions fluides
- Blocage du scroll du body

### 4. View (Page)
Voir `assets/ViewTemplate.vue` - Page avec états de chargement et d'erreur.

### 5. Formulaire avec Vuelidate
Voir `assets/FormTemplate.vue` - Formulaire complet avec :
- Validation Vuelidate 0.7.7
- Gestion des erreurs
- États de soumission
- Messages d'erreur personnalisés

## Validation de formulaires avec Vuelidate

Pour toute création de formulaire, **toujours lire** `references/vuelidate.md` pour :
- Configuration de Vuelidate 0.7.7
- Validators disponibles
- Gestion des erreurs
- Validation conditionnelle
- Messages personnalisés

### Exemple rapide

```typescript
import { useVuelidate } from '@vuelidate/core'
import { required, email, minLength } from '@vuelidate/validators'

const formData = reactive({
  email: '',
  password: ''
})

const rules = computed(() => ({
  email: { required, email },
  password: { required, minLength: minLength(6) }
}))

const v$ = useVuelidate(rules, formData)

const handleSubmit = async () => {
  const isValid = await v$.value.$validate()
  if (!isValid) return
  
  // Soumettre le formulaire
}
```

## Bonnes pratiques UI

**Toujours consulter** `references/best-practices.md` pour :
- Performance (computed, lazy loading, v-memo)
- Responsive design (breakpoints, images, conteneurs)
- Accessibilité (ARIA, navigation clavier, contraste)
- Architecture (props vs events, composition, state)
- Styles SCSS (BEM, variables, scope)
- Gestion des états (loading, erreurs, skeleton)

### Points clés à retenir

#### Performance
- Utiliser `computed` au lieu de `watch` quand possible
- Lazy loading des composants lourds avec `defineAsyncComponent`
- `v-memo` pour optimiser les listes
- `shallowRef` pour les objets complexes

#### Responsive
```scss
// Mobile first
.component {
  padding: 1rem; // Mobile par défaut
  
  @media (min-width: 769px) {
    padding: 1.5rem; // Tablet
  }
  
  @media (min-width: 1025px) {
    padding: 2rem; // Desktop
  }
}
```

#### Accessibilité
- Labels associés aux inputs (`for="id"`)
- Attributs ARIA (`role`, `aria-label`, `aria-labelledby`)
- Navigation clavier (Enter, Escape, Tab)
- Contraste minimum 4.5:1 pour le texte
- Focus visible sur les éléments interactifs

#### Styles SCSS scopés
```scss
<style lang="scss" scoped>
// TOUJOURS utiliser scoped pour éviter les conflits
.component {
  // Utiliser BEM pour la structure
  &__element {
    // Element
  }
  
  &--modifier {
    // Modifier
  }
}
</style>
```

## Processus de création

### 1. Identifier le type de composant
- Composant simple → `ComponentTemplate.vue`
- Layout → `LayoutTemplate.vue`
- Modale → `ModalTemplate.vue`
- Page → `ViewTemplate.vue`
- Formulaire → `FormTemplate.vue`

### 2. Copier le template approprié
Commencer avec le template correspondant depuis `assets/`.

### 3. Consulter les références
- Formulaire → Lire `references/vuelidate.md`
- Toujours → Consulter `references/best-practices.md` pour les patterns appropriés

### 4. Adapter le template
- Renommer selon les conventions (suffixe approprié)
- Définir les interfaces Props et Emits
- Implémenter la logique métier
- Ajouter les styles SCSS scopés avec responsive

### 5. Vérifications finales
- [ ] Nom du composant avec le bon suffixe
- [ ] TypeScript strict (interfaces Props/Emits)
- [ ] Styles SCSS scopés
- [ ] Responsive design (mobile first)
- [ ] Accessibilité (ARIA, keyboard)
- [ ] Performance (computed, pas de watchers inutiles)
- [ ] Validation Vuelidate si formulaire

## Exemples d'utilisation

### Créer un composant de carte
```
"Crée un composant CardComponent qui affiche un titre, un contenu et une image"
→ Utilise ComponentTemplate.vue
→ Applique best practices (performance, responsive, accessibility)
```

### Créer un formulaire de connexion
```
"Crée un formulaire de connexion avec email et mot de passe"
→ Utilise FormTemplate.vue
→ Lit references/vuelidate.md pour la validation
→ Implémente les messages d'erreur personnalisés
```

### Créer une modale de confirmation
```
"Crée une modale de confirmation avec boutons Annuler/Confirmer"
→ Utilise ModalTemplate.vue
→ Gère la navigation clavier (Escape)
→ Applique l'accessibilité (ARIA)
```

### Refactoriser un composant existant
```
"Refactorise ce composant pour suivre les standards UI"
→ Vérifie les conventions de nommage
→ Consulte best-practices.md
→ Applique les patterns de performance
→ Améliore l'accessibilité
```

## Checklist de qualité

Avant de considérer un composant terminé :

✅ **Structure**
- [ ] Suffixe correct (Component/Layout/Modal/View)
- [ ] Structure `<script setup lang="ts">` + `<template>` + `<style lang="scss" scoped>`
- [ ] Interfaces Props et Emits définies

✅ **Performance**
- [ ] Utilisation de `computed` pour les valeurs dérivées
- [ ] Pas de watchers inutiles
- [ ] Lazy loading si composant lourd

✅ **Responsive**
- [ ] Mobile first approche
- [ ] Breakpoints à 769px (tablet) et 1025px (desktop)
- [ ] Tests sur différentes tailles d'écran

✅ **Accessibilité**
- [ ] Labels associés aux inputs
- [ ] Attributs ARIA appropriés
- [ ] Navigation clavier fonctionnelle
- [ ] Contraste suffisant

✅ **Styles**
- [ ] SCSS scopé
- [ ] Méthodologie BEM
- [ ] Variables pour les couleurs/spacing
- [ ] Responsive breakpoints

✅ **Formulaires** (si applicable)
- [ ] Validation Vuelidate configurée
- [ ] Messages d'erreur clairs
- [ ] Touch sur blur
- [ ] Bouton submit désactivé si invalide
