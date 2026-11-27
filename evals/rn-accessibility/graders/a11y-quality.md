---
type: llm
---
PASS si la réponse :
- regroupe le contenu informatif de la carte en un seul élément accessible (accessible / libellé combiné) ;
- garde le bouton favori atteignable séparément (hors du groupe, ou via accessibilityActions) ;
- donne au favori un rôle bouton, un nom (accessibilityLabel / aria-label) et expose son état : accessibilityState.selected / checked, aria-selected / aria-checked, ou un libellé qui change avec l'état (« Ajouter aux favoris » / « Retirer des favoris ») ;
- porte la cible tactile à au moins 44 pt / 48 dp (hitSlop ou taille minimale) ;
- masque l'image décorative ou lui donne un libellé pertinent ;
- mentionne un test avec VoiceOver et TalkBack.
FAIL si le rôle, le nom, l'état ou la taille de cible du favori manque, ou si la réponse utilise des attributs HTML/DOM.
