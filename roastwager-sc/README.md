# RoastWager Smart Contract (Foundry)

## Setup

1. Install Foundry:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Install dependencies:

```bash
forge install foundry-rs/forge-std --no-commit
```

3. Configure env:

```bash
cp .env.example .env
```

## Build

```bash
forge build
```

## Deploy (Monad Testnet)

```bash
source .env
forge script script/Deploy.s.sol:DeployRoastWager \
  --rpc-url "$MONAD_RPC_URL" \
  --broadcast
```

After deploy, set backend env:

```env
CONTRACT_ADDRESS=0xYourDeployedAddress
```

## Contract Notes

- `createWager(content, imageUrl)` emits `WagerCreated`
- `vote(postId, isBull, amount)` transfers USDC via `transferFrom` and emits `Voted`
- `resolve(postId)` emits `Resolved` or `Refunded`
- `claim(postId)` transfers USDC payout and emits `Claimed`
- One address can vote once per post
- Tie / one-sided pool resolves as refund

## Required Env (Deploy)

- `STABLE_TOKEN_ADDRESS`: deployed USDC token address on target chain
- `MIN_VOTE_AMOUNT`: raw token amount (for USDC 6 decimals, `500000` = 0.5 USDC)
