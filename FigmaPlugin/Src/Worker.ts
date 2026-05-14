export const BaseUrl = "https://acedian.com/FigmaToRoblox/Api";

export type WorkerResult<T = unknown> = { Ok: true; Data: T } | { Ok: false; Error: string };

export function WorkerUrl(Path: string): string {
  return Path.startsWith("http") ? Path : BaseUrl + Path;
}

export async function WorkerRawFetch(Path: string, Init?: RequestInit): Promise<Response> {
  try {
    return await fetch(WorkerUrl(Path), Init);
  } catch (Err) {
    throw new Error(`Network error: ${(Err as Error).message ?? String(Err)}`);
  }
}

export async function WorkerFetch<T = unknown>(Path: string, Init?: RequestInit): Promise<WorkerResult<T>> {
  let Response: Response;
  try {
    Response = await WorkerRawFetch(Path, Init);
  } catch (Err) {
    return { Ok: false, Error: (Err as Error).message ?? String(Err) };
  }
  const Body = await Response.text();
  if (!Response.ok) {
    return { Ok: false, Error: `HTTP ${Response.status}: ${Body || Response.statusText}` };
  }
  if (!Body) {
    return { Ok: true, Data: undefined as unknown as T };
  }
  try {
    return { Ok: true, Data: JSON.parse(Body) as T };
  } catch (Err) {
    return { Ok: false, Error: `JSON decode failed: ${(Err as Error).message ?? String(Err)}` };
  }
}
