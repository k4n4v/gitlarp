export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export class GitHubClient {
  readonly apiBase: string;
  readonly graphqlUrl: string;

  constructor(
    readonly host: string,
    private readonly token: string
  ) {
    const normalized = host.replace(/\/$/, "");
    const isDotCom =
      normalized === "https://github.com" || normalized === "http://github.com";

    this.apiBase = isDotCom
      ? "https://api.github.com"
      : `${normalized}/api/v3`;
    this.graphqlUrl = isDotCom
      ? "https://api.github.com/graphql"
      : `${normalized}/api/graphql`;
  }

  async request<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<{ data: T; headers: Headers }> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    headers.set("Accept", "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", "gitlarp");
    }

    const res = await fetch(`${this.apiBase}${path}`, { ...init, headers });
    const text = await res.text();

    if (!res.ok) {
      throw new GitHubError(
        `GitHub API ${res.status} for ${path}: ${text.slice(0, 300)}`,
        res.status,
        text
      );
    }

    const data = (text ? JSON.parse(text) : null) as T;
    return { data, headers: res.headers };
  }

  async graphql<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    const headers = new Headers({
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "gitlarp",
    });

    const res = await fetch(this.graphqlUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new GitHubError(
        `GitHub GraphQL ${res.status}: ${text.slice(0, 300)}`,
        res.status,
        text
      );
    }

    const payload = JSON.parse(text) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };
    if (payload.errors?.length) {
      throw new GitHubError(
        `GitHub GraphQL error: ${payload.errors.map((e) => e.message).join("; ")}`
      );
    }
    if (!payload.data) {
      throw new GitHubError("GitHub GraphQL returned no data");
    }
    return payload.data;
  }
}

export interface GitHubUser {
  login: string;
  name: string | null;
  email: string | null;
}

export async function getCurrentUser(client: GitHubClient): Promise<GitHubUser> {
  const { data } = await client.request<GitHubUser>("/user");
  return data;
}
