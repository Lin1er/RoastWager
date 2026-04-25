export type PostStatus = "active" | "settled" | "refunded";
export type WagerResult = "pending" | "win" | "lose" | "refund";
export type WagerSide = "bull" | "bear";
export type VoteChoice = "agree" | "disagree" | null;

export type IndexerPost = {
  id: string;
  creator: string;
  content: string;
  imageUrl: string | null;
  endTime: string;
  status: PostStatus;
  winningSide: number | null;
  bullPool: string | null;
  bearPool: string | null;
  bullCount: number | null;
  bearCount: number | null;
  createdAt: string;
};

export type IndexerUser = {
  id: string;
  address: string;
  username: string | null;
  level: number;
  experience: number;
  lastWagerAt: string | null;
  maxStake: string | null;
};

export type IndexerWager = {
  id: string;
  postId: string;
  userAddress: string;
  side: WagerSide;
  amount: string;
  result: WagerResult;
  payout: string | null;
  timestamp: string;
  post: IndexerPost | null;
};

export type FeedPost = {
  id: string;
  address: string;
  level: number | null;
  content: string;
  imageUrl: string | null;
  timeLeft: string;
  myVote: VoteChoice;
  status: PostStatus;
  winningSide: number | null;
  bullPool: string | null;
  bearPool: string | null;
  bullCount: number | null;
  bearCount: number | null;
  createdAt: string;
  isPending?: boolean;
};
