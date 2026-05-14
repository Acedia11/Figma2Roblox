export function InstallFigmaShim(): void {
  (globalThis as typeof globalThis & { figma: { mixed: symbol } }).figma = {
    mixed: Symbol.for("figma.mixed"),
  };
}
