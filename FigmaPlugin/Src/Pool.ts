export async function MapPool<T, R>(
  Items: readonly T[],
  Concurrency: number,
  Fn: (Item: T, Index: number) => Promise<R>,
): Promise<R[]> {
  const Results = new Array<R>(Items.length);
  let Cursor = 0;
  async function Worker(): Promise<void> {
    while (true) {
      const I = Cursor++;
      if (I >= Items.length) return;
      Results[I] = await Fn(Items[I]!, I);
    }
  }
  const Workers = Math.max(1, Math.min(Concurrency, Items.length));
  await Promise.all(Array.from({ length: Workers }, () => Worker()));
  return Results;
}
