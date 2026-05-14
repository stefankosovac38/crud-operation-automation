# crud-operation-automation

CLI that generates framework-specific HTTP clients from **OpenAPI 3.x** or **Swagger 2.0** (Angular `HttpClient`, React with optional TanStack Query, Vue with optional TanStack Vue Query).

## Setup

```bash
npm install
npm run build
```

## Usage (simple)

Run this from your **frontend app root** (where `package.json` is). The spec path can be relative or absolute.

```bash
npx crud-codegen ./openapi.yaml
```

Output defaults to **`src/api`** in that app. Same thing, long form:

```bash
npx crud-codegen generate --spec ./openapi.yaml
```

Other useful forms:

```bash
npx crud-codegen ./openapi.yaml -o src/lib/api
npx crud-codegen ./openapi.yaml -p D:\path\to\other-app
npx crud-codegen ./openapi.yaml --framework angular
npx crud-codegen detect
```

- **`-p, --project`** — app root (default: current directory). **`-r`** is still accepted as an alias for **`-p`**.
- **`--openapi-version`** — `auto` (default), `3`, or `2`
- **`--readme`**, **`--with-specs`** — optional; see `src/cli.ts`

## Dev (no build step)

```bash
npm run gen -- ./path/to/openapi.yaml
```

(`npm run gen` runs the CLI via `tsx`.)
