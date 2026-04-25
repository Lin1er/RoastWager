import type { IndexerPost, IndexerUser, IndexerWager, PostStatus, WagerResult, WagerSide } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3001";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const hasBody = init?.body !== undefined && init?.body !== null;

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
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return payload.data;
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
  const posts = await request<BackendPost[]>(`/api/posts?limit=${limit}`);
  return posts.map(mapPost);
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
