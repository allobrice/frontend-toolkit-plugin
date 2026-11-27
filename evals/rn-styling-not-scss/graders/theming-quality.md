---
type: llm
---
PASS si la réponse :
- s'appuie sur useColorScheme (ou un ThemeProvider qui l'utilise) et un thème typé à rôles sémantiques (clair / sombre) issu des tokens ;
- utilise StyleSheet (éventuellement via une fabrique dépendant du thème), sans valeur de couleur en dur dans le composant ;
- mentionne userInterfaceStyle 'automatic' dans la config de l'app ou la barre de statut ;
- n'introduit ni fichier .scss / .css ni CSS Modules.
FAIL sinon.
