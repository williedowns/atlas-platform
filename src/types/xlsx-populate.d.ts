declare module "xlsx-populate" {
  export interface Cell {
    value(): unknown;
    value(v: unknown): Cell;
    formula(): string | undefined;
    formula(expr: string): Cell;
  }

  export interface Sheet {
    cell(address: string): Cell;
    cell(row: number, col: number): Cell;
    name(): string;
  }

  export interface Workbook {
    sheet(nameOrIndex: string | number): Sheet | undefined;
    sheets(): Sheet[];
    outputAsync(opts?: { type?: "nodebuffer" | "uint8array" | "arraybuffer" | "blob" }): Promise<Buffer | Uint8Array | ArrayBuffer | Blob>;
  }

  interface XlsxPopulateStatic {
    fromFileAsync(path: string): Promise<Workbook>;
    fromDataAsync(data: Buffer | ArrayBuffer | Uint8Array): Promise<Workbook>;
    fromBlankAsync(): Promise<Workbook>;
  }

  const XlsxPopulate: XlsxPopulateStatic;
  export default XlsxPopulate;
}
