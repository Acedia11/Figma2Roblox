const Headers: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function Preflight(): Response {
  return new Response(null, { status: 204, headers: Headers });
}

export function WithCors(Res: Response): Response {
  for (const [K, V] of Object.entries(Headers)) Res.headers.set(K, V);
  return Res;
}
