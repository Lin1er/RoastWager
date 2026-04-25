export type Status = 'active' | 'settled' | 'refunded'

export type Side = 'bull' | 'bear'

export type Result = 'pending' | 'win' | 'lose' | 'refund'

export interface Post {
  id: string
  creator: string
  content: string
  imageUrl: string | null
  endTime: string
  status: Status
  winningSide?: Side
  bullPool: string
  bearPool: string
  bullCount: number
  bearCount: number
  createdAt: string
}

export interface Wager {
  id: string
  postId: string
  userAddress: string
  side: Side
  amount: string
  result: Result
  payout?: string
  timestamp: string
}

export interface User {
  id: string
  level: number
  experience: number
  lastWagerAt: string | null
}
