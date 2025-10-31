## TypeScript Deloim - Guía de Estilo y Codificación

Esta guía de estilo es para el código TypeScript desarrollado internamente en Deloim, y es el estilo predeterminado para el código TypeScript en Deloim.
Realiza elecciones estilísticas que se ajustan a otros lenguajes en Deloim, como el estilo de Deloim C# y el estilo de Deloim Java.

---

## Reglas de Formato

### Reglas de Nombres

Las reglas de nombres siguen las pautas de nomenclatura de [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/styleguide) y [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html).

**Resumen de reglas:**

| Tipo                                | Convención de nombre        | Ejemplo                                 |
| ----------------------------------- | --------------------------- | --------------------------------------- |
| Clases, interfaces, tipos, enums    | `PascalCase`                | `MyClass`, `UserProfile`, `OrderStatus` |
| Métodos, funciones, propiedades     | `camelCase`                 | `calculateValue`, `getUserById`         |
| Variables locales, parámetros       | `camelCase`                 | `resultValue`, `userId`                 |
| Variables privadas (con convención) | `_camelCase`                | `_internalState` (opcional)             |
| Constantes                          | `UPPER_SNAKE_CASE`          | `MAX_RETRY_COUNT`, `API_BASE_URL`       |
| Interfaces (sin prefijo I)          | `PascalCase`                | `User`, `OrderEvent` (no `IUser`)       |
| Type aliases                        | `PascalCase`                | `UserId`, `ErrorHandler`                |
| Enums                               | `PascalCase` (keys también) | `enum Status { Active, Inactive }`      |

* Los modificadores como `const`, `static`, `readonly`, etc., **no afectan la convención de nombres**.
* Una "palabra" es cualquier cosa escrita sin espacios internos, incluyendo acrónimos (por ejemplo, `MyApi` en lugar de `MyAPI`).
* **No usar prefijo `I` para interfaces** (a diferencia de C#). Usar nombres descriptivos directamente.

---

### Archivos

* Los nombres de archivos y directorios son `kebab-case`, por ejemplo: `my-service.ts`, `user-repository.ts`.
* Archivos de prueba deben tener el sufijo `.spec.ts` o `.test.ts`: `user-service.spec.ts`.
* Archivos de tipo (type definitions) deben tener el sufijo `.types.ts`: `user.types.ts`.
* Siempre que sea posible, el nombre del archivo debe coincidir con la clase/interfaz principal dentro del archivo.
* En general, se prefiere **una clase o interfaz principal por archivo**.

---

### Organización

**Orden de importaciones:**

1. Importaciones de Node.js built-in (ej: `fs`, `path`)
2. Importaciones de third-party (ej: `express`, `axios`)
3. Importaciones de módulos internos/aliased (ej: `@/domain`, `@/infrastructure`)
4. Importaciones relativas (ej: `./user-service`, `../utils`)

Las importaciones deben ser **alfabéticas** dentro de cada grupo.

```typescript
// Node.js built-in
import { readFile } from 'fs/promises';
import path from 'path';

// Third-party
import express from 'express';
import { z } from 'zod';

// Internal/aliased
import { UserRepository } from '@/domain/repositories';
import { logger } from '@/infrastructure/logger';

// Relative
import { UserService } from './user-service';
import { validateEmail } from '../utils/validation';
```

**Orden de miembros de clase:**

1. Propiedades estáticas
2. Propiedades de instancia
3. Constructor
4. Métodos estáticos
5. Métodos públicos
6. Métodos privados/protegidos

Dentro de cada grupo, el orden es:
`public → protected → private`.

---

### Reglas de Espaciado

Basadas en el estilo de C# de Deloim y adaptadas para TypeScript.

* Máximo **una instrucción por línea**.
* Máximo **una asignación por instrucción**.
* **Indentación de 2 espacios**, sin tabulaciones.
* **Límite de columna: 100 caracteres.**
* No hay salto de línea antes de una llave de apertura.
* No hay salto de línea entre una llave de cierre y un `else`.
* Las llaves **se usan siempre**, incluso cuando son opcionales.
* Espacio después de `if`, `for`, `while`, etc., y después de comas.
* Sin espacio después de un paréntesis de apertura o antes de uno de cierre.
* Sin espacio entre un operador unario y su operando.
* Un espacio entre los operandos de otros operadores.
* Prima el uso de operador ternario cuando sean condicionales de asignación simples.
* No se anidarán operadores ternarios.
* Usar comillas simples (`'`) para strings, comillas dobles (`"`) solo en JSON o cuando sea necesario.
* Usar template literals (`` ` ``) cuando se necesite interpolación.

**Ajuste de línea:**

* En general, las continuaciones de línea se **indentan 2 espacios adicionales** (total 4 espacios desde el nivel base).
* Los saltos de línea con llaves (por ejemplo, lambdas, objetos) **no cuentan como continuaciones**.
* Si los argumentos de una función no caben en una sola línea, se dividen en varias líneas, con cada argumento en su propia línea indentado 2 espacios.

---

### Ejemplo de Código

```typescript
// Las importaciones van al inicio del archivo
import { EventEmitter } from 'events';

// Los namespaces/módulos son PascalCase (pero evitar cuando sea posible)
export namespace MyNamespace {

  // Las interfaces son PascalCase, sin prefijo I
  export interface MyInterface {
    calculate(value: number, exp: number): number;
  }

  // Los enums son PascalCase
  export enum MyEnum {
    Yes = 'YES',
    No = 'NO',
  }

  // Las clases son PascalCase
  export class MyClass {
    // Propiedades públicas
    public foo: number = 0;
    public noCounting: boolean = false;

    // Clase anidada
    private static Results = class {
      public numNegativeResults: number = 0;
      public numPositiveResults: number = 0;
    };

    // Propiedades privadas
    private results: InstanceType<typeof MyClass.Results>;

    // Propiedades estáticas
    public static numTimesCalled: number = 0;

    // Constantes privadas
    private readonly BAR: number = 100;

    // Arrays/objetos
    private someTable: number[] = [2, 3, 4];

    // Constructor
    constructor() {
      this.results = new MyClass.Results();
      this.results.numNegativeResults = 1;
      this.results.numPositiveResults = 1;
    }

    // Métodos públicos
    public calculateValue(mulNumber: number): number {
      const resultValue = this.foo * mulNumber;
      MyClass.numTimesCalled++;
      this.foo += this.BAR;

      if (!this.noCounting) {
        if (resultValue < 0) {
          this.results.numNegativeResults++;
        } else if (resultValue > 0) {
          this.results.numPositiveResults++;
        }
      }

      return resultValue;
    }

    // Arrow functions y expresiones lambda
    public expressionBodies(): void {
      const increment = (x: number): number => x + 1;

      const difference1 = (x: number, y: number): number => {
        const diff = x - y;
        return diff >= 0 ? diff : -diff;
      };

      const difference2 = (x: number, y: number): number => {
        const diff = x - y;
        return diff >= 0 ? diff : -diff;
      };

      this.callWithDelegate((x: number, y: number): number => {
        const diff = x - y;
        return diff >= 0 ? diff : -diff;
      });
    }

    // Método vacío
    private doNothing(): void {}

    // Métodos con nombres largos y line wrapping
    private aVeryLongFunctionNameThatCausesLineWrappingProblems(
      longArgumentName: number,
      p1: number,
      p2: number
    ): void {}

    private anotherLongFunctionNameThatCausesLineWrappingProblems(
      longArgumentName: number,
      longArgumentName2: number,
      longArgumentName3: number
    ): void {}

    private callingLongFunctionName(): void {
      const veryLongArgumentName = 1234;
      const shortArg = 1;

      this.anotherLongFunctionNameThatCausesLineWrappingProblems(
        shortArg,
        shortArg,
        veryLongArgumentName
      );

      this.anotherLongFunctionNameThatCausesLineWrappingProblems(
        veryLongArgumentName,
        veryLongArgumentName,
        veryLongArgumentName
      );
    }

    private callWithDelegate(fn: (x: number, y: number) => number): void {
      // Implementation
    }
  }
}
```

---

## Guía de Codificación en TypeScript

### Sistema de Tipos

* **Usar tipos explícitos siempre que mejore la claridad**, especialmente en:
  - Parámetros de función
  - Valores de retorno de función
  - Propiedades de clase públicas
  - Variables exportadas

* **Evitar `any`**. Usar `unknown` si el tipo realmente no se conoce, y hacer type narrowing.

```typescript
// ❌ Malo
function process(data: any): any {
  return data.value;
}

// ✅ Bueno
function process(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value);
  }
  throw new Error('Invalid data');
}
```

* **Preferir interfaces para objetos**, types para uniones/intersecciones:

```typescript
// Interfaces para estructuras de objetos
interface User {
  id: string;
  name: string;
  email: string;
}

// Types para uniones/intersecciones
type UserId = string;
type Result<T> = Success<T> | Failure;
type UserWithMetadata = User & { createdAt: Date };
```

---

### Constantes y Variables

* Las variables y campos que puedan ser `const` **deben serlo siempre**.
* Si `const` no es posible, evaluar si puede ser `readonly` (en clases).
* Preferir **constantes con nombre** en lugar de **números mágicos**.

```typescript
// ❌ Malo
if (user.age > 18) { ... }

// ✅ Bueno
const MINIMUM_AGE = 18;
if (user.age > MINIMUM_AGE) { ... }
```

---

### Null y Undefined

* **Preferir `undefined` sobre `null`** en código nuevo (más idiomático en TypeScript).
* Usar **optional chaining** (`?.`) y **nullish coalescing** (`??`) cuando sea apropiado.
* Activar `strictNullChecks` en `tsconfig.json`.

```typescript
// ✅ Bueno
function getUser(id: string): User | undefined {
  return users.find(u => u.id === id);
}

const userName = user?.profile?.name ?? 'Unknown';
```

---

### Funciones

* **Usar arrow functions** para callbacks y funciones cortas.
* **Usar function declarations** para funciones nombradas en el scope superior.
* **Siempre tipar parámetros y retorno** explícitamente en funciones públicas.

```typescript
// Function declarations para funciones públicas
export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// Arrow functions para callbacks
const processItems = (items: Item[]): ProcessedItem[] => {
  return items
    .filter(item => item.isValid)
    .map(item => ({ ...item, processed: true }));
};
```

---

### Async/Await

* **Preferir async/await sobre Promises directas** para mejor legibilidad.
* Siempre manejar errores con try/catch en funciones async.
* Usar `Promise.all()` para operaciones concurrentes.

```typescript
// ✅ Bueno
async function fetchUserData(userId: string): Promise<User> {
  try {
    const [user, orders, preferences] = await Promise.all([
      fetchUser(userId),
      fetchOrders(userId),
      fetchPreferences(userId),
    ]);

    return { ...user, orders, preferences };
  } catch (error) {
    logger.error('Failed to fetch user data', { userId, error });
    throw new UserFetchError('Could not retrieve user data', { cause: error });
  }
}
```

---

### Manejo de Errores

* **Crear clases de error personalizadas** para errores de dominio.
* **Usar Error Cause** (disponible desde Node.js 16+).
* **Siempre loguear contexto** en catch blocks.

```typescript
// Clase de error personalizada
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ValidationError';
  }
}

// Uso
try {
  await validateOrder(order);
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn('Validation failed', { field: error.field });
    throw error;
  }

  logger.error('Unexpected error during validation', { error });
  throw new ValidationError('Order validation failed', 'unknown', { cause: error });
}
```

---

### Generics

* Usar generics para funciones y clases reutilizables.
* Usar nombres descriptivos para type parameters (no solo `T`).

```typescript
// ✅ Bueno - nombres descriptivos
interface Repository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | undefined>;
  save(entity: TEntity): Promise<void>;
}

class UserRepository implements Repository<User, string> {
  async findById(id: string): Promise<User | undefined> {
    // Implementation
  }

  async save(user: User): Promise<void> {
    // Implementation
  }
}
```

---

### Enums vs Union Types

* **Preferir union types** sobre enums en la mayoría de casos.
* Usar enums solo cuando se necesite reverse mapping o cuando el valor en runtime es importante.

```typescript
// ✅ Preferido - Union types
type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered';

const status: OrderStatus = 'pending';

// ✅ Aceptable - Enums cuando se necesita reverse mapping
enum HttpStatus {
  OK = 200,
  NotFound = 404,
  InternalServerError = 500,
}

const statusCode = HttpStatus.OK; // 200
const statusName = HttpStatus[200]; // 'OK'
```

---

### Type Guards y Type Narrowing

* Crear type guards personalizados cuando sea necesario.
* Usar `is` keyword en type predicates.

```typescript
interface Order {
  type: 'order';
  orderId: string;
}

interface Invoice {
  type: 'invoice';
  invoiceId: string;
}

type Document = Order | Invoice;

// Type guard personalizado
function isOrder(doc: Document): doc is Order {
  return doc.type === 'order';
}

// Uso
function processDocument(doc: Document): void {
  if (isOrder(doc)) {
    console.log(doc.orderId); // TypeScript sabe que es Order
  } else {
    console.log(doc.invoiceId); // TypeScript sabe que es Invoice
  }
}
```

---

### Utility Types

Aprovechar los utility types de TypeScript:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
}

// Partial - todos los campos opcionales
type UserUpdate = Partial<User>;

// Pick - seleccionar campos
type UserPublic = Pick<User, 'id' | 'name' | 'email'>;

// Omit - excluir campos
type UserWithoutPassword = Omit<User, 'password'>;

// Readonly - hacer inmutable
type ImmutableUser = Readonly<User>;

// Record - crear objetos con keys específicos
type UserMap = Record<string, User>;
```

---

### Decoradores

* Usar decoradores solo cuando aporten valor real (ej: inyección de dependencias, validación).
* Habilitar `experimentalDecorators` en `tsconfig.json`.

```typescript
import { injectable, inject } from 'tsyringe';

@injectable()
export class OrderService {
  constructor(
    @inject('OrderRepository') private orderRepository: OrderRepository,
    @inject('EventPublisher') private eventPublisher: EventPublisher
  ) {}

  async createOrder(data: CreateOrderData): Promise<Order> {
    // Implementation
  }
}
```

---

### Módulos y Exports

* **Usar named exports** en lugar de default exports (mejor para refactoring).
* **Exportar desde index.ts** en cada módulo para API pública limpia.

```typescript
// user-service.ts
export class UserService { ... }

// user-repository.ts
export class UserRepository { ... }

// index.ts
export { UserService } from './user-service';
export { UserRepository } from './user-repository';
export type { User, UserCreateData } from './user.types';
```

---

### Configuración de TypeScript (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

---

### Comentarios y Documentación

* Usar **JSDoc** para funciones y clases públicas.
* Comentarios en código solo cuando la lógica no sea obvia.
* No comentar código obvio.

```typescript
/**
 * Calcula el total de una orden aplicando descuentos y impuestos.
 *
 * @param order - La orden a procesar
 * @param discountCode - Código de descuento opcional
 * @returns El total calculado con impuestos incluidos
 * @throws {ValidationError} Si la orden es inválida
 */
export async function calculateOrderTotal(
  order: Order,
  discountCode?: string
): Promise<number> {
  // Implementation
}
```

---

### Testing

* Usar **Jest** como framework de testing.
* Estructura de tests: **Arrange, Act, Assert (AAA)**.
* Usar `describe` y `it` para organizar tests.

```typescript
describe('OrderService', () => {
  let orderService: OrderService;
  let mockRepository: jest.Mocked<OrderRepository>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
    } as any;

    orderService = new OrderService(mockRepository);
  });

  describe('createOrder', () => {
    it('should create order and save to repository', async () => {
      // Arrange
      const orderData = { customerId: '123', items: [] };
      mockRepository.save.mockResolvedValue(undefined);

      // Act
      const result = await orderService.createOrder(orderData);

      // Assert
      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        customerId: '123',
      }));
    });

    it('should throw error when repository fails', async () => {
      // Arrange
      const orderData = { customerId: '123', items: [] };
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(orderService.createOrder(orderData))
        .rejects
        .toThrow('Database error');
    });
  });
});
```

---

### Buenas Prácticas Generales

1. **Mantener funciones pequeñas** - Una función debe hacer una cosa y hacerla bien.
2. **Evitar funciones con muchos parámetros** - Usar objetos de opciones si hay más de 3 parámetros.
3. **Preferir composición sobre herencia** - Usar interfaces y composición.
4. **Principio DRY** - No repetir código.
5. **Principios SOLID** - Aplicar especialmente Single Responsibility y Dependency Inversion.
6. **Inmutabilidad cuando sea posible** - Usar `readonly`, `const`, y evitar mutaciones.
7. **Validación temprana** - Validar inputs al inicio de funciones.
8. **Logging estructurado** - Incluir contexto relevante en logs.

---

## Linting y Formato

### ESLint Configuration

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "interface",
        "format": ["PascalCase"]
      },
      {
        "selector": "class",
        "format": ["PascalCase"]
      },
      {
        "selector": "variable",
        "modifiers": ["const"],
        "format": ["camelCase", "UPPER_CASE"]
      }
    ]
  }
}
```

### Prettier Configuration

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

---
