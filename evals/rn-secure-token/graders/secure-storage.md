---
type: llm
---
PASS si la réponse :
- stocke les tokens avec expo-secure-store (setItemAsync / getItemAsync) ;
- n'utilise pas AsyncStorage, MMKV non chiffré ou un store persisté pour les tokens, et le dit explicitement ;
- purge les tokens (deleteItemAsync) et le cache de données au logout ;
- ne journalise pas les tokens ;
- gère l'échec de lecture du stockage sécurisé (try/catch ou retour à l'écran de connexion).
FAIL si un token est écrit dans AsyncStorage ou si la purge au logout manque.
