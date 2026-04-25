export const roastWagerAbi = [
  {
    type: 'event',
    name: 'WagerCreated',
    inputs: [
      { indexed: true, name: 'postId', type: 'uint256' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'content', type: 'string' },
      { indexed: false, name: 'imageUrl', type: 'string' },
      { indexed: false, name: 'endTime', type: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Voted',
    inputs: [
      { indexed: true, name: 'postId', type: 'uint256' },
      { indexed: true, name: 'voter', type: 'address' },
      { indexed: false, name: 'isBull', type: 'bool' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Resolved',
    inputs: [
      { indexed: true, name: 'postId', type: 'uint256' },
      { indexed: false, name: 'winningSide', type: 'bool' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Refunded',
    inputs: [{ indexed: true, name: 'postId', type: 'uint256' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { indexed: true, name: 'postId', type: 'uint256' },
      { indexed: true, name: 'voter', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    anonymous: false,
  },
] as const
