const BASE = "https://api.spotify.com/v1";

export class SpotifyClient {
  constructor(
    private token: string,
    private f: typeof fetch = fetch,
    private maxRetries = 2,
  ) {}

  private async request(
    path: string,
    init: RequestInit,
    attempt = 0,
  ): Promise<Response> {
    const res = await this.f(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 429 && attempt < this.maxRetries) {
      const wait = Number(res.headers.get("Retry-After") ?? "1") * 1000;
      await new Promise((r) => setTimeout(r, wait));
      return this.request(path, init, attempt + 1);
    }
    if (!res.ok)
      throw new Error(
        `Spotify ${init.method ?? "GET"} ${path} failed: ${res.status}`,
      );
    return res;
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.request(path, { method: "GET" });
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  async put(path: string, body: unknown): Promise<void> {
    await this.request(path, { method: "PUT", body: JSON.stringify(body) });
  }

  async del(path: string, body: unknown): Promise<void> {
    await this.request(path, { method: "DELETE", body: JSON.stringify(body) });
  }
}
