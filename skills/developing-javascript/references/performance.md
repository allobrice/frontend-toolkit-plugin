# Performance & Optimisation JavaScript

Guide complet d'optimisation des performances JavaScript, côté navigateur et Node.js.

## Table des matières

1. [Principes généraux](#principes-généraux)
2. [Structures de données performantes](#structures-de-données-performantes)
3. [Optimisation mémoire](#optimisation-mémoire)
4. [Performance navigateur](#performance-navigateur)
5. [Performance Node.js](#performance-nodejs)
6. [Mesure et profiling](#mesure-et-profiling)

---

## Principes généraux

### Règle d'or : mesurer avant d'optimiser

```javascript
// ✅ Toujours mesurer AVANT d'optimiser
console.time('operation');
const result = expensiveOperation();
console.timeEnd('operation'); // operation: 145.23ms

// ✅ Performance API pour des mesures précises
performance.mark('start');
await complexTask();
performance.mark('end');
performance.measure('complexTask', 'start', 'end');

const measure = performance.getEntriesByName('complexTask')[0];
console.log(`Durée : ${measure.duration.toFixed(2)}ms`);
```

### Éviter les micro-optimisations inutiles

```javascript
// ❌ Micro-optimisations qui n'ont aucun impact mesurable
// Exemple : boucle for vs forEach sur 10 éléments — AUCUNE différence
// Exemple : concaténation string vs template literal — AUCUNE différence

// ✅ Concentrer les efforts sur les vrais goulots d'étranglement :
// - Requêtes réseau (latence)
// - Manipulation du DOM (re-rendering)
// - Algorithmes O(n²) sur de grands ensembles de données
// - Fuites mémoire
// - Opérations I/O bloquantes
```

## Structures de données performantes

### Map vs Object

```javascript
// ✅ Map — plus performant pour les ajouts/suppressions fréquents
const cache = new Map();

// Map avantages :
// - O(1) garanti pour get/set/delete
// - .size disponible (pas besoin de Object.keys().length)
// - Itération dans l'ordre d'insertion
// - Clés de n'importe quel type
// - Pas de pollution par le prototype

// ✅ Object — pour les structures statiques / JSON
const config = { host: 'localhost', port: 3000 }; // pas de changement fréquent

// Benchmark typique pour 100 000 entrées :
// Map.set() ~3x plus rapide que obj[key] = value
// Map.get() ~similaire à obj[key]
// Map.delete() ~10x plus rapide que delete obj[key]
```

### Set pour les recherches d'appartenance

```javascript
// ❌ Array.includes — O(n) à chaque appel
const allowedIds = [1, 2, 3, 4, 5, /* ... milliers d'éléments */];
items.filter(item => allowedIds.includes(item.id)); // O(n × m)

// ✅ Set.has — O(1) par recherche
const allowedSet = new Set(allowedIds);
items.filter(item => allowedSet.has(item.id)); // O(n)

// ✅ Dédoublonnage performant
const unique = [...new Set(array)];

// ✅ ES2025 — opérations ensemblistes natives
const added = newItems.difference(existingItems);
const removed = existingItems.difference(newItems);
```

### WeakMap / WeakRef pour les caches

```javascript
// ✅ WeakMap — cache qui n'empêche pas le garbage collection
const metadataCache = new WeakMap();

function getMetadata(element) {
  if (metadataCache.has(element)) return metadataCache.get(element);

  const metadata = computeExpensiveMetadata(element);
  metadataCache.set(element, metadata);
  return metadata;
}
// Quand l'élément est supprimé, le cache est automatiquement nettoyé

// ✅ WeakRef + FinalizationRegistry — cache avec nettoyage explicite
const cache = new Map();
const registry = new FinalizationRegistry((key) => {
  cache.delete(key);
});

function cacheObject(key, obj) {
  const ref = new WeakRef(obj);
  cache.set(key, ref);
  registry.register(obj, key);
}

function getCached(key) {
  const ref = cache.get(key);
  return ref?.deref(); // undefined si l'objet a été collecté
}
```

## Optimisation mémoire

### Éviter les fuites mémoire

```javascript
// ❌ Fuite mémoire classique — listeners non nettoyés
class Component {
  constructor() {
    window.addEventListener('resize', this.handleResize);
  }
  // Oubli de removeEventListener → fuite !
}

// ✅ Nettoyage avec AbortController
class Component {
  #controller = new AbortController();

  constructor() {
    window.addEventListener('resize', this.handleResize, {
      signal: this.#controller.signal,
    });
  }

  destroy() {
    this.#controller.abort(); // nettoie tous les listeners
  }
}

// ❌ Fuite par closure — référence à un gros objet
function createProcessor() {
  const hugeData = loadHugeDataset(); // 500 MB en mémoire

  return function process(id) {
    // hugeData est capturé dans la closure même si on n'en utilise qu'une partie
    return hugeData[id];
  };
}

// ✅ Réduire la portée de la closure
function createProcessor() {
  const index = buildIndex(loadHugeDataset()); // ne garder que l'index
  return function process(id) {
    return index.get(id);
  };
}

// ❌ Fuite par timers non nettoyés
const interval = setInterval(() => {
  updateDashboard();
}, 1000);
// Si on ne fait jamais clearInterval(interval) → fuite

// ✅ Explicit Resource Management (ES2025)
{
  using timer = createManagedInterval(() => updateDashboard(), 1000);
  // automatiquement nettoyé à la sortie du bloc
}
```

### Copie efficace

```javascript
// ✅ structuredClone pour les copies profondes
const clone = structuredClone(complexObject);

// ✅ Spread pour les copies superficielles (plus rapide)
const shallowCopy = { ...original };
const arrayCopy = [...original];

// ❌ JSON.parse(JSON.stringify()) — lent, perd les types spéciaux
// Perd : Date, Map, Set, undefined, fonctions, RegExp, Error
```

### Traitement par lots (batching)

```javascript
// ❌ Traiter un par un — pression mémoire + lenteur
const results = [];
for (const id of thousandsOfIds) {
  results.push(await fetch(`/api/items/${id}`));
}

// ✅ Traitement par lots
async function processBatch(items, batchSize, processor) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

await processBatch(thousandsOfIds, 50, id => fetch(`/api/items/${id}`));
```

## Performance navigateur

### Manipulation du DOM

```javascript
// ❌ Multiples modifications DOM → multiples reflows
for (const item of items) {
  const el = document.createElement('div');
  el.textContent = item.name;
  container.appendChild(el); // reflow à chaque itération
}

// ✅ DocumentFragment — un seul reflow
const fragment = document.createDocumentFragment();
for (const item of items) {
  const el = document.createElement('div');
  el.textContent = item.name;
  fragment.appendChild(el);
}
container.appendChild(fragment); // un seul reflow

// ✅ innerHTML pour les gros volumes (encore plus rapide)
container.innerHTML = items
  .map(item => `<div>${escapeHtml(item.name)}</div>`)
  .join('');

// ✅ requestAnimationFrame pour les animations
function animate() {
  element.style.transform = `translateX(${position}px)`;
  position += speed;
  if (position < target) requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
```

### Lazy loading et virtualisation

```javascript
// ✅ IntersectionObserver — chargement paresseux
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      observer.unobserve(img);
    }
  }
}, { rootMargin: '200px' }); // précharger 200px avant l'entrée dans le viewport

document.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));

// ✅ Web Worker pour les calculs lourds
// worker.js
self.onmessage = ({ data }) => {
  const result = heavyComputation(data);
  self.postMessage(result);
};

// main.js
const worker = new Worker('worker.js', { type: 'module' });
worker.postMessage(largeDataset);
worker.onmessage = ({ data }) => updateUI(data);
```

### Optimisation des événements

```javascript
// ✅ Délégation d'événements — un seul listener au lieu de centaines
document.querySelector('.list').addEventListener('click', (event) => {
  const item = event.target.closest('.list-item');
  if (!item) return;
  handleItemClick(item.dataset.id);
});

// ✅ Passive listeners pour le scroll (meilleure performance)
window.addEventListener('scroll', handleScroll, { passive: true });
window.addEventListener('touchmove', handleTouch, { passive: true });

// ✅ Debounce des événements fréquents (resize, scroll, input)
const handleResize = debounce(() => recalculateLayout(), 150);
window.addEventListener('resize', handleResize);
```

## Performance Node.js

### Event Loop — ne jamais bloquer

```javascript
// ❌ Blocage de l'event loop
function parseHugeJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8'); // BLOQUANT
  return JSON.parse(content); // BLOQUANT si gros fichier
}

// ✅ Lecture asynchrone + streaming
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

async function processLargeFile(filePath) {
  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  for await (const chunk of stream) {
    processChunk(chunk);
  }
}

// ✅ Worker Threads pour les calculs CPU-intensifs
import { Worker, isMainThread, parentPort } from 'node:worker_threads';

if (isMainThread) {
  const worker = new Worker(new URL(import.meta.url));
  worker.postMessage({ data: largeDataset });
  worker.on('message', (result) => console.log(result));
} else {
  parentPort.on('message', ({ data }) => {
    const result = cpuIntensiveWork(data);
    parentPort.postMessage(result);
  });
}
```

### Streams pour les gros volumes

```javascript
// ✅ Transformer des fichiers en streaming (mémoire constante)
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  },
});

await pipeline(
  createReadStream('input.txt'),
  upperCase,
  createWriteStream('output.txt'),
);

// ✅ Réponse HTTP streamée
app.get('/large-data', (req, res) => {
  const stream = createReadStream('large-file.json');
  stream.pipe(res);
});
```

## Mesure et profiling

### Performance API

```javascript
// ✅ Mesures avec la Performance API
function measureFunction(name, fn) {
  performance.mark(`${name}-start`);
  const result = fn();
  performance.mark(`${name}-end`);
  performance.measure(name, `${name}-start`, `${name}-end`);

  const entry = performance.getEntriesByName(name).at(-1);
  console.log(`${name}: ${entry.duration.toFixed(2)}ms`);
  return result;
}

// ✅ Mesure async
async function measureAsync(name, fn) {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  console.log(`${name}: ${duration.toFixed(2)}ms`);
  return result;
}

// ✅ PerformanceObserver pour le monitoring continu
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
  }
});
observer.observe({ entryTypes: ['measure'] });
```

### Benchmarking fiable

```javascript
// ✅ Benchmark avec échauffement et statistiques
function benchmark(name, fn, { iterations = 1000, warmup = 100 } = {}) {
  // Échauffement — laisser le JIT optimiser
  for (let i = 0; i < warmup; i++) fn();

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const avg = times.reduce((a, b) => a + b) / times.length;

  console.log(`${name}: avg=${avg.toFixed(3)}ms, median=${median.toFixed(3)}ms, p95=${p95.toFixed(3)}ms`);
}
```

### Node.js Profiling

```bash
# Profiler CPU avec Node.js intégré
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Inspector Chrome DevTools
node --inspect app.js
# Ouvrir chrome://inspect dans Chrome

# Heap snapshot
node --heap-prof app.js
```
