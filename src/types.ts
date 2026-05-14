export type HttpMethod =
  | "get"
  | "put"
  | "post"
  | "delete"
  | "patch"
  | "options"
  | "head"
  | "trace";

export interface ParsedOperation {
  operationId: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  tags: string[];
}

export type FrameworkKind = "angular" | "react" | "vue" | "unknown";

export interface FrameworkProfile {
  kind: FrameworkKind;
  /** @angular/core semver, when Angular */
  angular?: string;
  /** react semver */
  react?: string;
  /** vue semver */
  vue?: string;
  /** @tanstack/react-query semver if present */
  tanstackQuery?: string;
  /** @tanstack/vue-query semver if present */
  tanstackVueQuery?: string;
  /** true when package.json lists @angular/core */
  hasAngularCore: boolean;
  /** true when react is a dependency */
  hasReact: boolean;
  /** true when vue is a dependency */
  hasVue: boolean;
}

export type OpenApiInputVersion = "3" | "2" | "auto";
