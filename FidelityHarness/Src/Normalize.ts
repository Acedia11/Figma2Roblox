export function StableJson(Value: unknown): string {
  return `${JSON.stringify(SortKeys(Value), null, 2)}\n`;
}

function SortKeys(Value: unknown): unknown {
  if (Array.isArray(Value)) {
    return Value.map(SortKeys);
  }
  if (!Value || typeof Value !== "object") {
    return Value;
  }

  const Input = Value as Record<string, unknown>;
  const Output: Record<string, unknown> = {};
  for (const Key of Object.keys(Input).sort()) {
    const Child = Input[Key];
    if (Child !== undefined) Output[Key] = SortKeys(Child);
  }
  return Output;
}
