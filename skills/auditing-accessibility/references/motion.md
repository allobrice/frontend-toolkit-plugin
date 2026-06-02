# Mouvement & Animation

Critères WCAG principaux : 2.2.2 (Pause, Stop, Hide), 2.3.1 (Three Flashes),
2.3.3 (Animation from Interactions — WCAG 2.1 AAA), SC 1.4.2

---

## Checklist

### Clignotement et flash (SC 2.3.1 — A)
- [ ] Aucun élément ne clignote plus de 3 fois par seconde
- [ ] Les animations de type "flash" sont absentes ou sous le seuil de danger

### Contenu en mouvement automatique (SC 2.2.2 — A)
- [ ] Tout contenu animé automatiquement (carousel, ticker, bannière) peut être
  mis en pause, arrêté, ou masqué
- [ ] Les animations automatiques > 5 secondes sont contrôlables
- [ ] Pas d'animation infinie bloquant la lecture du contenu adjacent

### Mouvement déclenché par interaction (SC 2.3.3 — AAA)
- [ ] `prefers-reduced-motion` respecté pour toutes les animations de transition
- [ ] Les animations non essentielles sont supprimées ou réduites quand
  `prefers-reduced-motion: reduce` est actif

---

## Implémentation prefers-reduced-motion

### CSS
```scss
// ✅ Approche globale recommandée (à mettre dans le global styles)
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

// ✅ Approche par composant (plus précise)
.slide-in {
  animation: slideIn 0.3s ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    // Appliquer directement l'état final
    transform: translateX(0);
    opacity: 1;
  }
}
```

### Vue.js — Transitions conditionnelles
```vue
<script setup>
import { ref } from 'vue'

// Détecter la préférence utilisateur
const prefersReducedMotion = ref(
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
)
</script>

<template>
  <!-- ✅ Désactiver la transition Vue si reduced motion -->
  <Transition :name="prefersReducedMotion ? '' : 'slide'">
    <div v-if="visible">Contenu animé</div>
  </Transition>
</template>

<style>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
```

### Vue.js — Composable réutilisable
```ts
// composables/useReducedMotion.ts
import { ref, onMounted, onUnmounted } from 'vue'

export function useReducedMotion() {
  const prefersReducedMotion = ref(false)
  let mediaQuery: MediaQueryList | null = null

  const handleChange = (e: MediaQueryListEvent) => {
    prefersReducedMotion.value = e.matches
  }

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = mediaQuery.matches
    mediaQuery.addEventListener('change', handleChange)
  })

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', handleChange)
  })

  return { prefersReducedMotion }
}
```

---

## Critères WCAG de référence

| Critère | Niveau | Description |
|---|---|---|
| SC 1.4.2 | A | Contrôle de l'audio automatique |
| SC 2.2.2 | A | Pause, arrêt, masquage des contenus en mouvement |
| SC 2.3.1 | A | Pas plus de 3 flashes par seconde |
| SC 2.3.3 | AAA | Animation déclenchée par interaction désactivable |
