declare module "swagger2openapi" {
  interface Converter {
    convertObj(
      spec: Record<string, unknown>,
      options: { patch?: boolean; warnOnly?: boolean },
      callback: (
        err: Error | null,
        result?: { openapi?: Record<string, unknown> },
      ) => void,
    ): void;
  }
  const converter: Converter;
  export default converter;
}
