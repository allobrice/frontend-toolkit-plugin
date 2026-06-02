---
name: developing-typescript
description: "Comprehensive TypeScript typing excellence guide for JavaScript/TypeScript agents. Use this skill when generating, refactoring, or reviewing TypeScript code to ensure superior type safety regardless of framework (React, Vue, Angular, Svelte, vanilla). Provides advanced typing patterns, API design, state management types, validation patterns, and anti-pattern detection. Essential for: (1) Generating type-safe TypeScript code, (2) Creating robust API clients with full type inference, (3) Implementing discriminated unions and advanced types, (4) Reviewing code for type safety issues, (5) Avoiding common TypeScript pitfalls."
---

# TypeScript Expert

Skill for generating and maintaining exceptional TypeScript code with superior type safety, regardless of JavaScript framework.

## Core Principles

Always follow these principles when writing TypeScript:

1. **Prefer Type Inference** - Let TypeScript infer types when possible. Only annotate when inference isn't sufficient.
2. **Avoid `any`** - Use `unknown`, generics, or proper types instead. `any` defeats TypeScript's purpose.
3. **Use Discriminated Unions** - For complex state or data with variants, use discriminated unions for type-safe handling.
4. **Leverage Utility Types** - Use built-in utility types (`Partial`, `Pick`, `Omit`, `Record`, etc.) instead of reinventing them.
5. **Type Guard Everything** - When working with `unknown` or external data, always use type guards with runtime validation.
6. **Explicit Public APIs** - Always type function parameters and return types for public APIs, even if TypeScript can infer them.

## Quick Start Patterns

### Type-Safe Function Declaration

```typescript
// ✓ Explicit types for public API
export function processUser(user: User): UserSummary {
  return {
    id: user.id,
    displayName: `${user.firstName} ${user.lastName}`,
    memberSince: user.createdAt,
  };
}

// ✓ Generic function with constraints
export function findById<T extends { id: string }>(
  items: T[],
  id: string
): T | undefined {
  return items.find(item => item.id === id);
}
```

### Discriminated Unions for State

```typescript
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function renderState<T>(state: AsyncState<T>) {
  switch (state.status) {
    case 'idle':
      return 'Not started';
    case 'loading':
      return 'Loading...';
    case 'success':
      return state.data; // TypeScript knows data exists
    case 'error':
      return state.error.message; // TypeScript knows error exists
  }
}
```

### Type Guards for Runtime Safety

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'email' in obj &&
    typeof (obj as any).id === 'string' &&
    typeof (obj as any).name === 'string' &&
    typeof (obj as any).email === 'string'
  );
}

// Usage with external data
const data = await fetch('/api/user').then(r => r.json());
if (!isUser(data)) {
  throw new Error('Invalid user data');
}
// Now data is typed as User
console.log(data.name);
```

## Framework-Agnostic Patterns

### Component Props (React/Vue/Svelte)

```typescript
// React
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ label, onClick, variant = 'primary', disabled }: ButtonProps) {
  // Implementation
}

// Vue (with generic component)
interface ListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => VNode;
}

// Svelte (with TypeScript generics in script)
// <script lang="ts" generics="T">
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
}
// </script>
```

### Event Handlers (Framework Agnostic)

```typescript
// Generic event handler type
type EventHandler<T = void> = (event: T) => void;

// Specific event handlers
type ClickHandler = EventHandler<MouseEvent>;
type ChangeHandler<T> = EventHandler<{ value: T }>;
type SubmitHandler<T> = EventHandler<{ data: T; preventDefault: () => void }>;

// Usage
interface FormProps<T> {
  initialData: T;
  onSubmit: SubmitHandler<T>;
  onChange?: ChangeHandler<Partial<T>>;
}
```

## Advanced Type Patterns

### Utility Types Mastery

```typescript
// Make specific properties optional
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Make specific properties required
type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Deep partial
type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// Deep readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
```

### Template Literal Types

```typescript
// API route typing
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ApiRoute = `/api/${string}`;
type ApiEndpoint = `${HttpMethod} ${ApiRoute}`;

// CSS properties
type CSSUnit = 'px' | 'em' | 'rem' | '%';
type CSSValue = `${number}${CSSUnit}`;

// Event handlers
type EventName = 'click' | 'focus' | 'blur';
type EventHandler = `on${Capitalize<EventName>}`;
```

### Conditional Types

```typescript
// Extract promise type
type Awaited<T> = T extends Promise<infer U> ? U : T;

// Flatten array types
type Flatten<T> = T extends Array<infer U> ? U : T;

// Function return type extraction
type ReturnTypeOf<T> = T extends (...args: any[]) => infer R ? R : never;

// Non-nullable type
type NonNullable<T> = T extends null | undefined ? never : T;
```

### Branded Types (Nominal Typing)

```typescript
// Create type-safe IDs
type Brand<K, T> = K & { __brand: T };

type UserId = Brand<string, 'UserId'>;
type ProductId = Brand<string, 'ProductId'>;

function getUserById(id: UserId): User { /* ... */ }
function getProductById(id: ProductId): Product { /* ... */ }

// TypeScript prevents mixing IDs
const userId = 'user-123' as UserId;
const productId = 'prod-456' as ProductId;

getUserById(userId); // ✓ OK
getUserById(productId); // ✗ Type error
```

### Advanced Generic Patterns

```typescript
// Constraint with keyof
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Multiple constraints
function merge<T extends object, U extends object>(obj1: T, obj2: U): T & U {
  return { ...obj1, ...obj2 };
}

// Generic with default
type ApiResponse<T = unknown> = {
  data: T;
  status: number;
  message: string;
};

// Conditional generic constraint
type OnlyStrings<T> = T extends string ? T : never;
type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];
```

### Recursive Types

```typescript
// JSON type
type JSONValue = 
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// Tree structure
interface TreeNode<T> {
  value: T;
  children: TreeNode<T>[];
}

// Nested object paths
type PathOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? K | `${K}.${PathOf<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;
```

## Type-Safe API Patterns

### Generic API Response Types

```typescript
// Base API response structure
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: string;
}

interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  status: number;
}

// Result type for operations
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Paginated response
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
```

### Type-Safe HTTP Client

```typescript
// HTTP methods as const
const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const;

type HttpMethod = typeof HTTP_METHODS[keyof typeof HTTP_METHODS];

// Request configuration
interface RequestConfig<TBody = unknown> {
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: TBody;
  params?: Record<string, string | number | boolean>;
}

// Type-safe fetch wrapper
async function apiRequest<TResponse, TBody = unknown>(
  url: string,
  config: RequestConfig<TBody>
): Promise<Result<TResponse, ApiError>> {
  try {
    const response = await fetch(url, {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      return { success: false, error };
    }

    const data: TResponse = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        status: 0,
      },
    };
  }
}
```

### Type-Safe State Management (Redux/Zustand)

```typescript
// State shape
interface AppState {
  user: User | null;
  posts: Post[];
  ui: {
    isLoading: boolean;
    error: string | null;
  };
}

// Action types as discriminated union
type Action =
  | { type: 'SET_USER'; payload: User }
  | { type: 'CLEAR_USER' }
  | { type: 'SET_POSTS'; payload: Post[] }
  | { type: 'ADD_POST'; payload: Post }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

// Type-safe reducer
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'CLEAR_USER':
      return { ...state, user: null };
    case 'SET_POSTS':
      return { ...state, posts: action.payload };
    case 'ADD_POST':
      return { ...state, posts: [...state.posts, action.payload] };
    case 'SET_LOADING':
      return { ...state, ui: { ...state.ui, isLoading: action.payload } };
    case 'SET_ERROR':
      return { ...state, ui: { ...state.ui, error: action.payload } };
    default:
      // Exhaustiveness check
      const _exhaustive: never = action;
      return state;
  }
}
```

### Form Validation with Type Safety

```typescript
// Form field value types
type FieldValue = string | number | boolean | Date | File | null;

// Form field configuration
interface FormField<T extends FieldValue = FieldValue> {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
}

// Form state
type FormState<T extends Record<string, FieldValue>> = {
  [K in keyof T]: FormField<T[K]>;
};

// Validation rules
type ValidationRule<T extends FieldValue> = (value: T) => string | null;

type ValidationRules<T extends Record<string, FieldValue>> = {
  [K in keyof T]?: ValidationRule<T[K]>[];
};

// Form configuration
interface FormConfig<T extends Record<string, FieldValue>> {
  initialValues: T;
  validationRules?: ValidationRules<T>;
  onSubmit: (values: T) => void | Promise<void>;
}
```

## Common Anti-Patterns to Avoid

### ✗ Avoid Excessive `any`

```typescript
// ✗ BAD: Loses all type safety
function processData(data: any) {
  return data.value.toString();
}

// ✓ GOOD: Use generics or unknown
function processData<T extends { value: unknown }>(data: T) {
  return String(data.value);
}
```

### ✗ Avoid Dangerous Type Assertions

```typescript
// ✗ BAD: Unsafe type assertion
const user = JSON.parse(userJson) as User;

// ✓ GOOD: Validate at runtime
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'email' in obj
  );
}

const parsed = JSON.parse(userJson);
if (!isUser(parsed)) {
  throw new Error('Invalid user data');
}
const user = parsed; // ✓ Type-safe
```

### ✗ Avoid Non-Null Assertions Without Validation

```typescript
// ✗ BAD: Assumes value exists without checking
function getUsername(user: User | null) {
  return user!.name; // Runtime error if user is null
}

// ✓ GOOD: Handle null case
function getUsername(user: User | null) {
  return user?.name ?? 'Guest';
}
```

### ✗ Avoid Optional Properties for Required Logic

```typescript
// ✗ BAD: Optional property forces checks everywhere
interface Config {
  apiUrl?: string;
  timeout?: number;
}

// ✓ GOOD: Make required properties required, provide defaults elsewhere
interface Config {
  apiUrl: string;
  timeout: number;
}

const DEFAULT_CONFIG: Config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
};

function makeRequest(config: Partial<Config> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
}
```

### ✗ Avoid Boolean Parameters (Use Objects)

```typescript
// ✗ BAD: Unclear what boolean means
function createUser(name: string, isAdmin: boolean, isActive: boolean) {
  // ...
}

createUser('Alice', true, false); // What do these booleans mean?

// ✓ GOOD: Use object parameter
interface CreateUserOptions {
  name: string;
  isAdmin: boolean;
  isActive: boolean;
}

function createUser(options: CreateUserOptions) {
  // ...
}

createUser({
  name: 'Alice',
  isAdmin: true,
  isActive: false,
});
```

### ✗ Avoid Sequential Awaits When Parallel Is Possible

```typescript
// ✗ BAD: Sequential (slow)
async function fetchUserAndPosts(userId: string) {
  const user = await fetchUser(userId);
  const posts = await fetchPosts(userId);
  return { user, posts };
}

// ✓ GOOD: Parallel (fast)
async function fetchUserAndPosts(userId: string) {
  const [user, posts] = await Promise.all([
    fetchUser(userId),
    fetchPosts(userId),
  ]);
  return { user, posts };
}
```

### ✗ Avoid Default Exports (Prefer Named Exports)

```typescript
// ✗ BAD: Default export (inconsistent naming)
export default function formatDate(date: Date) {
  return date.toISOString();
}

// Consumers can name it anything
import formatDate from './utils';
import format from './utils';
import whatever from './utils';

// ✓ GOOD: Named export (consistent naming)
export function formatDate(date: Date) {
  return date.toISOString();
}

// Consistent naming enforced
import { formatDate } from './utils';
```

## Decision Trees

### When to Use `interface` vs `type`

```typescript
// Use interface for:
interface User {  // ✓ Objects that can be extended
  id: string;
  name: string;
}

interface Admin extends User {  // ✓ Inheritance/extension
  permissions: string[];
}

// Use type for:
type UserOrAdmin = User | Admin;  // ✓ Unions
type ReadonlyUser = Readonly<User>;  // ✓ Utility types
type StringOrNumber = string | number;  // ✓ Primitives unions
type Callback = (value: string) => void;  // ✓ Function types
```

### When to Use Generics

```typescript
// ✓ Use generics when:
// 1. Function works with multiple types
function identity<T>(value: T): T {
  return value;
}

// 2. Type relationship needs to be preserved
function map<T, U>(array: T[], fn: (item: T) => U): U[] {
  return array.map(fn);
}

// 3. Component/class works with any data type
class DataStore<T> {
  private items: T[] = [];
  add(item: T): void {
    this.items.push(item);
  }
}

// ✗ Don't use generics when:
// Type is always the same
function sum(a: number, b: number): number {  // No need for generic
  return a + b;
}
```

### When to Use `unknown` vs `any`

```typescript
// ✓ Use unknown for:
function parseJSON(json: string): unknown {  // Unknown return type
  return JSON.parse(json);
}

function processData(data: unknown) {  // Force type checking
  if (typeof data === 'string') {
    return data.toUpperCase();
  }
}

// ✗ Never use any unless:
// - Migrating from JavaScript incrementally
// - Working with truly dynamic external library
// - As last resort with detailed comment explaining why
```

## Code Generation Guidelines

When generating TypeScript code, always:

1. **Start with types** - Define interfaces/types before implementation
2. **Add type guards** - Create validation functions for external data
3. **Use const assertions** - For literal types and immutable objects
4. **Document with JSDoc** - Add JSDoc comments to public APIs
5. **Validate inputs** - Never trust external data (API, user input, etc.)
6. **Export types** - Make types available for consumers

### Complete Feature Implementation Example

```typescript
// 1. Define types
interface CreateUserRequest {
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface User extends CreateUserRequest {
  id: string;
  createdAt: Date;
}

// 2. Define API response type
type CreateUserResponse = 
  | { success: true; user: User }
  | { success: false; error: string };

// 3. Type guard for validation
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'email' in obj &&
    'role' in obj &&
    'createdAt' in obj
  );
}

// 4. Implementation with full type safety
async function createUser(
  request: CreateUserRequest
): Promise<CreateUserResponse> {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data: unknown = await response.json();
    
    if (!isUser(data)) {
      return { success: false, error: 'Invalid user data received' };
    }

    return { success: true, user: data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

## Configuration Best Practices

### Recommended tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    
    // Strict mode (essential)
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    
    // Best practices
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    
    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Key Compiler Options Explained

- `strict: true` - Enables all strict type checking options
- `noUncheckedIndexedAccess` - Makes array access return `T | undefined`
- `noImplicitOverride` - Requires `override` keyword when overriding
- `noPropertyAccessFromIndexSignature` - Enforces bracket notation for index signatures

## Common Scenarios

### Working with Third-Party Libraries

```typescript
// When library has poor types or uses 'any'
import { poorlyTypedFunction } from 'some-library';

// Wrap with proper types
function safeWrapper(input: string): number {
  const result: unknown = poorlyTypedFunction(input);
  
  if (typeof result !== 'number') {
    throw new Error('Unexpected return type');
  }
  
  return result;
}
```

### Migrating from JavaScript

```typescript
// Phase 1: Add types gradually with 'any' where needed
function processUser(user: any) {  // Temporary
  return user.name;
}

// Phase 2: Replace 'any' with 'unknown' and add type guards
function processUser(user: unknown): string {
  if (!isUser(user)) {
    throw new Error('Invalid user');
  }
  return user.name;
}

// Phase 3: Type at the boundary
interface Props {
  user: User;  // Fully typed
}

function UserComponent({ user }: Props) {
  return processUser(user);
}
```

## Critical Reminders

- **ALWAYS validate external data** - Never trust API responses, user input, or `JSON.parse()` results
- **NEVER use `any`** unless migrating legacy code (document why with comment)
- **USE discriminated unions** for complex state instead of optional properties
- **PREFER type inference** but always type function signatures
- **CREATE type guards** for all external data validation
- **AVOID type assertions** (`as`) unless you're 100% certain (add runtime check)
- **USE const assertions** for literal types and immutable data
- **DOCUMENT public APIs** with JSDoc comments including `@param`, `@returns`, `@throws`

---

**Remember:** The goal is not just working code, but **type-safe code that catches errors at compile time rather than runtime**.
