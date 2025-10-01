export async function request<T>(
  url: string,
  opts: { method?: 'GET' | 'POST'; json?: any } = {}
): Promise<T> {
  const { method = 'GET', json } = opts;
  const res = await fetch(url, {
    method,
    headers: json ? { 'content-type': 'application/json' } : undefined,
    body: json ? JSON.stringify(json) : undefined,
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} – ${text.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}
