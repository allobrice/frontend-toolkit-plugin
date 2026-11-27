# Patterns de composants

Concevoir des composants qui s'étendent par composition plutôt que par accumulation de props.

## Sommaire

1. Découper un composant
2. Composition : `children` et slots
3. Variantes sans booléens
4. Compound components
5. Contrôlé, non contrôlé, hybride
6. Envelopper un élément natif
7. Composants génériques
8. Polymorphisme (`as`)
9. Render props — encore utiles ?
10. États de chargement, vide, erreur

---

## 1. Découper un composant

Découper selon les **raisons de changer**, pas selon la taille :

| Responsabilité | Où elle vit |
|---|---|
| Récupérer / muter des données | hook (`useOrders`) ou couche data (TanStack Query) |
| Logique d'interaction, état d'UI | hook (`useOrderFilters`) ou le composant lui-même s'il est petit |
| Mise en page d'un écran | composant conteneur de feature (`OrdersPage`) |
| Affichage d'une donnée | composant de présentation pur (`OrderRow`), sans fetch ni contexte métier |

Signaux qu'il faut découper : plus de ~150 lignes, 3+ effets, un JSX qui dépasse un écran, des
noms de gestionnaires qui portent sur des sujets différents (`handleFilter`, `handleExport`,
`handlePrint`), un test qui doit mocker la moitié de l'app pour vérifier un affichage.

Ne **pas** découper un composant de 40 lignes en 4 fichiers « pour faire propre » : un seul
appelant et aucune douleur, on garde.

---

## 2. Composition : `children` et slots

```tsx
// ❌ Configuration : chaque besoin ajoute une prop
<Card title="Commande" subtitle="#123" showFooter footerAction="Payer" onFooterAction={pay} icon="cart" />

// ✅ Composition : le parent décide du contenu
type CardProps = { header: ReactNode; footer?: ReactNode; children: ReactNode }

export function Card({ header, footer, children }: CardProps) {
  return (
    <section className={styles.card}>
      <header className={styles.header}>{header}</header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </section>
  )
}

<Card
  header={<CardTitle icon={<CartIcon />}>Commande #123</CardTitle>}
  footer={<Button onClick={pay}>Payer</Button>}
>
  <OrderSummary order={order} />
</Card>
```

La composition résout aussi le **prop drilling** : au lieu de faire descendre `user` sur 4 niveaux,
le composant haut placé rend directement `<Avatar user={user} />` et le passe en `children` /
slot au layout intermédiaire.

---

## 3. Variantes sans booléens

```tsx
// ❌ Booléens combinables → états incohérents (`primary && danger`)
<Button primary danger small />

// ✅ Une prop par axe, valeurs exclusives
type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(styles.button, styles[variant], styles[size], className)}
      {...props}
    />
  )
}
```

Quand les variantes ont des **comportements** différents (pas seulement un style), un composant
par variante, sélectionné par un `switch` exhaustif sur l'union discriminée :

```tsx
export function NotificationItem({ notification }: { notification: Notification }) {
  switch (notification.type) {
    case 'message': return <MessageNotification notification={notification} />
    case 'mention': return <MentionNotification notification={notification} />
    case 'invoice': return <InvoiceNotification notification={notification} />
    default: return assertNever(notification)
  }
}
```

Le `switch` exhaustif reste la forme la plus sûre en TS : narrowing de `notification` dans
chaque branche, erreur de compilation via `assertNever` si un cas manque. Une map
`type → composant` ne se justifie que si les renderers sont enregistrés dynamiquement ou fournis
par plusieurs features (registre de plugins).

---

## 4. Compound components

Pour un composant composé de parties qui partagent un état implicite (Tabs, Accordion, Menu,
Select). L'API reste déclarative et chaque partie est remplaçable.

```tsx
type TabsContextValue = { activeId: string; select: (id: string) => void; baseId: string }
const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(component: string): TabsContextValue {
  const context = use(TabsContext)
  if (!context) throw new Error(`<${component}> doit être placé dans <Tabs>.`)
  return context
}

export function Tabs({ defaultId, children }: { defaultId: string; children: ReactNode }) {
  const [activeId, setActiveId] = useState(defaultId)
  const baseId = useId()
  return <TabsContext value={{ activeId, select: setActiveId, baseId }}>{children}</TabsContext>
}

export function TabList({ label, children }: { label: string; children: ReactNode }) {
  return <div role="tablist" aria-label={label}>{children}</div>
}

export function Tab({ id, children }: { id: string; children: ReactNode }) {
  const { activeId, select, baseId } = useTabsContext('Tab')
  const isActive = activeId === id
  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${id}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${id}`}
      tabIndex={isActive ? 0 : -1}
      onClick={() => select(id)}
    >
      {children}
    </button>
  )
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const { activeId, baseId } = useTabsContext('TabPanel')
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${id}`}
      aria-labelledby={`${baseId}-tab-${id}`}
      hidden={activeId !== id}
    >
      {children}
    </div>
  )
}
```

Compléter avec la navigation clavier (flèches, Home/End) pour un vrai tablist accessible. Préférer
des exports nommés (`Tabs`, `Tab`…) à l'attachement `Tabs.Tab = Tab`, qui gêne le tree-shaking et
le typage.

---

## 5. Contrôlé, non contrôlé, hybride

| Mode | Le parent… | Quand |
|---|---|---|
| Non contrôlé | donne `defaultValue`, lit la valeur à la soumission (`FormData`) | formulaires classiques, `<form action>` |
| Contrôlé | possède `value` et reçoit `onChange` | la valeur pilote d'autres parties de l'UI |
| Hybride | peut faire l'un ou l'autre | composants de librairie réutilisables |

Hook pour l'hybride, une seule source de vérité :

```tsx
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value?: T
  defaultValue: T
  onChange?: (next: T) => void
}): [T, (next: T) => void] {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : internalValue

  function setValue(next: T) {
    if (!isControlled) setInternalValue(next)
    onChange?.(next)
  }

  return [current, setValue]
}
```

Ne jamais basculer un composant de non contrôlé à contrôlé au cours de sa vie.

---

## 6. Envelopper un élément natif

Un wrapper doit rester **substituable** à l'élément natif (LSP) : il accepte et transmet toutes
ses props, `ref` comprise.

```tsx
type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  icon: ReactNode
  label: string // nom accessible obligatoire : pas de bouton-icône muet
}

export function IconButton({ icon, label, className, type = 'button', ...buttonProps }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} className={clsx(styles.iconButton, className)} {...buttonProps}>
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
```

Règles : `...rest` étalé **sur l'élément natif** ; fusionner `className` au lieu de l'écraser ;
`type="button"` par défaut pour éviter les soumissions accidentelles ; ne pas intercepter
`onClick` sans rappeler celui du parent.

---

## 7. Composants génériques

```tsx
type ListProps<T> = {
  items: readonly T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  empty?: ReactNode
}

export function List<T>({ items, getKey, renderItem, empty = null }: ListProps<T>) {
  if (items.length === 0) return <>{empty}</>
  return (
    <ul>
      {items.map((item) => <li key={getKey(item)}>{renderItem(item)}</li>)}
    </ul>
  )
}

<List items={users} getKey={(user) => user.id} renderItem={(user) => <UserRow user={user} />} />
```

L'inférence de `T` vient de `items` : l'appelant n'écrit jamais `<List<User>>`.

---

## 8. Polymorphisme (`as`)

Utile pour des primitives de design system (`Text`, `Stack`). Coûteux en typage : ne l'introduire
que dans une librairie de composants, pas dans du code de feature.

```tsx
type TextProps<E extends ElementType> = {
  as?: E
  tone?: 'default' | 'muted'
} & Omit<ComponentProps<E>, 'as'>

export function Text<E extends ElementType = 'span'>({ as, tone = 'default', className, ...props }: TextProps<E>) {
  const Component = as ?? 'span'
  return <Component className={clsx(styles.text, styles[tone], className)} {...props} />
}
```

Pour un lien de router stylé comme un bouton, préférer souvent la composition
(`<Button asChild><Link …/></Button>` via un Slot) ou une classe partagée.

---

## 9. Render props — encore utiles ?

Les hooks ont remplacé la plupart des render props. Elles restent pertinentes quand le parent
doit **décider du rendu d'un élément interne** avec des données que seul l'enfant connaît
(cellule de tableau, item de liste virtualisée, option d'un combobox) — cf. `renderItem` en §7.

---

## 10. États de chargement, vide, erreur

Chaque vue de données gère explicitement : chargement, erreur, vide, succès.

- Chargement → `<Suspense fallback>` avec un squelette de la même taille (pas de saut de layout).
- Erreur → Error Boundary proche de la zone concernée, avec action de récupération (« Réessayer »).
- Vide → message utile et action suivante, pas une liste blanche.
- Ne jamais afficher un spinner global pour un chargement local.

Modéliser l'état avec une union discriminée quand il n'est pas porté par Suspense :

```tsx
type Remote<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: T }
```
