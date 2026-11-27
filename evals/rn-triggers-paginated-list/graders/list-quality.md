---
type: llm
---
PASS si la réponse :
- utilise FlatList ou FlashList (pas ScrollView + map) avec un keyExtractor fondé sur l'id ;
- pagine avec useInfiniteQuery + onEndReached, avec une garde contre les déclenchements multiples (isFetchingNextPage / hasNextPage) ;
- gère les états chargement, vide (ListEmptyComponent ou équivalent), erreur avec possibilité de réessayer ;
- mémoïse le composant de ligne ou justifie l'absence de mémoïsation par React Compiler ;
- ne contient ni `any` ni valeur de style en dur dans un style inline.
FAIL sinon, ou si le code utilise des éléments DOM (div, onClick) ou du CSS/SCSS.
