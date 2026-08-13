// mammoth не публикует типы для браузерного подпути (только для основного
// Node-входа, см. node_modules/mammoth/lib/index.d.ts) — используем ту же
// сигнатуру convertToHtml, но только то, что реально вызываем.
declare module "mammoth/mammoth.browser" {
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
  ): Promise<{ value: string; messages: unknown[] }>;
}
