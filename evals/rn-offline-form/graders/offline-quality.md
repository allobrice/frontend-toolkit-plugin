---
type: llm
---
PASS si la réponse :
- détecte l'état réseau via onlineManager de TanStack Query branché sur expo-network ou NetInfo (ou un équivalent explicite) ;
- persiste les écritures en attente localement (SQLite / outbox ou mutations persistées avec setMutationDefaults) et non seulement en mémoire ;
- prévoit une clé d'idempotence (ou un identifiant client) pour éviter les doublons au renvoi ;
- relance l'envoi au retour du réseau et/ou au retour au premier plan ;
- affiche à l'utilisateur un état « en attente » ou équivalent ;
- copie les photos dans un emplacement durable ou mentionne le risque des URI temporaires ;
- ne stocke aucune donnée sensible ou token dans AsyncStorage.
FAIL si l'une des trois premières conditions manque.
