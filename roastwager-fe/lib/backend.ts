import type { IndexerPost, IndexerUser, IndexerWager, PostStatus, WagerResult, WagerSide } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3001";
const FEED_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_FEED_TIMEOUT_MS ?? 1200);
const ENABLE_DEMO_FAST_FALLBACK = (process.env.NEXT_PUBLIC_DEMO_FAST_FALLBACK ?? "true").toLowerCase() !== "false";
const CACHED_FEED_KEY = "rw_cached_feed_posts_v1";

type ApiResponse<T> = {
  data: T;
  error?: string;
  code?: string;
};

type BackendPost = {
  id: string;
  creator: string;
  content: string;
  imageUrl: string | null;
  endTime: string;
  status: PostStatus;
  winningSide?: "bull" | "bear";
  bullPool?: string;
  bearPool?: string;
  bullCount?: number;
  bearCount?: number;
  createdAt: string;
};

type BackendUser = {
  id: string;
  level: number;
  experience: number;
  lastWagerAt: string;
};

type BackendWager = {
  id: string;
  postId: string;
  userAddress: string;
  side: WagerSide;
  amount: string;
  result: WagerResult;
  payout?: string;
  timestamp: string;
};

const DEMO_POSTS: IndexerPost[] = [
  {
    id: "demo-1",
    creator: "0x937008494c1d363044384593f2ed48e3d1dd4b02",
    content: "Bitcoin bakal tembus ATH baru sebelum Q4 2026 selesai.",
    imageUrl: null,
    endTime: String(Math.floor(Date.now() / 1000) + 3600 * 10),
    status: "active",
    winningSide: null,
    bullPool: null,
    bearPool: null,
    bullCount: null,
    bearCount: null,
    createdAt: String(Math.floor(Date.now() / 1000) - 900),
  },
  {
    id: "demo-2",
    creator: "0x8f0dc2e905f8f5ea2f081e5db7b0a627f8e4f999",
    content: "AI agent bakal ganti dashboard analytics tradisional tahun ini.",
    imageUrl: null,
    endTime: String(Math.floor(Date.now() / 1000) + 3600 * 4),
    status: "active",
    winningSide: null,
    bullPool: null,
    bearPool: null,
    bullCount: null,
    bearCount: null,
    createdAt: String(Math.floor(Date.now() / 1000) - 1800),
  },
  {
    id: "demo-3",
    creator: "0xc0ffee254729296a45a3885639ac7e10f9d54979",
    content: "Meme coin season lanjut sampai mid-2026 walau BTC sideway.",
    imageUrl: null,
    endTime: String(Math.floor(Date.now() / 1000) + 3600 * 22),
    status: "active",
    winningSide: null,
    bullPool: null,
    bearPool: null,
    bullCount: null,
    bearCount: null,
    createdAt: String(Math.floor(Date.now() / 1000) - 2700),
  },
];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const hasBody = init?.body !== undefined && init?.body !== null;
  const isRead = method === "GET" || method === "HEAD";

  const headers: Record<string, string> = {
    accept: "application/json",
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };

  // Avoid forcing Content-Type on GET/HEAD to prevent unnecessary CORS preflight.
  if (hasBody && method !== "GET" && method !== "HEAD" && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: isRead ? "default" : "no-store",
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return payload.data;
}

async function requestWithTimeout<T>(path: string, timeoutMs: number, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await request<T>(path, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function readCachedPosts(): IndexerPost[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(CACHED_FEED_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as IndexerPost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedPosts(posts: IndexerPost[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHED_FEED_KEY, JSON.stringify(posts));
  } catch {
    // ignore storage failures
  }
}

function addressCandidates(address: string) {
  const lower = address.toLowerCase();
  return lower === address ? [address] : [address, lower];
}

function mapWinningSideToNumber(side?: "bull" | "bear"): 1 | 2 | null {
  if (side === "bull") return 1;
  if (side === "bear") return 2;
  return null;
}

function mapPost(post: BackendPost): IndexerPost {
  return {
    id: post.id,
    creator: post.creator,
    content: post.content,
    imageUrl: post.imageUrl,
    endTime: post.endTime,
    status: post.status,
    winningSide: mapWinningSideToNumber(post.winningSide),
    bullPool: post.bullPool ?? null,
    bearPool: post.bearPool ?? null,
    bullCount: post.bullCount ?? null,
    bearCount: post.bearCount ?? null,
    createdAt: post.createdAt,
  };
}

export function getBackendApiUrl() {
  return API_BASE_URL;
}

export async function fetchPosts(limit = 20): Promise<IndexerPost[]> {
  try {
    const posts = await requestWithTimeout<BackendPost[]>(`/api/posts?limit=${limit}`, FEED_TIMEOUT_MS);
    const mapped = posts.map(mapPost);
    if (mapped.length > 0) {
      writeCachedPosts(mapped);
    }
    return mapped;
  } catch {
    const cached = readCachedPosts();
    if (cached.length > 0) {
      return cached.slice(0, limit);
    }

    if (ENABLE_DEMO_FAST_FALLBACK) {
      return DEMO_POSTS.slice(0, limit);
    }

    return [];
  }
}

export async function fetchPost(id: string): Promise<IndexerPost | null> {
  try {
    const post = await request<BackendPost>(`/api/posts/${id}`);
    return mapPost(post);
  } catch {
    return null;
  }
}

export async function fetchPostsByCreator(address: string, limit = 50): Promise<IndexerPost[]> {
  const posts = await request<BackendPost[]>(`/api/posts?limit=200`);
  const candidates = new Set(addressCandidates(address));
  return posts
    .filter((post) => candidates.has(post.creator.toLowerCase()))
    .slice(0, limit)
    .map(mapPost);
}

export async function fetchUser(address: string): Promise<IndexerUser | null> {
  const user = await request<BackendUser>(`/api/users/${address.toLowerCase()}`);
  return {
    id: user.id,
    address: user.id,
    username: null,
    level: user.level,
    experience: user.experience,
    lastWagerAt: user.lastWagerAt || null,
    maxStake: null,
  };
}

export async function fetchWagersByUser(address: string, limit = 100): Promise<IndexerWager[]> {
  const wagers = await request<BackendWager[]>(`/api/users/${address.toLowerCase()}/wagers?limit=${limit}`);

  return wagers.map((wager) => ({
    id: wager.id,
    postId: wager.postId,
    userAddress: wager.userAddress,
    side: wager.side,
    amount: wager.amount,
    result: wager.result,
    payout: wager.payout ?? null,
    timestamp: wager.timestamp,
    post: null,
  }));
}
