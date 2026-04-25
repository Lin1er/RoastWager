export const roastWagerAbi = [
  {
    type: "function",
    name: "createWager",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_content", type: "string" },
      { name: "_imageUrl", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "vote",
    stateMutability: "payable",
    inputs: [
      { name: "_postId", type: "uint256" },
      { name: "_isBull", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "vote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_postId", type: "uint256" },
      { name: "_isBull", type: "bool" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "resolve",
    stateMutability: "nonpayable",
    inputs: [{ name: "_postId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "_postId", type: "uint256" }],
    outputs: [],
  },
] as const;
