// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract RoastWager {
    struct Post {
        address creator;
        string content;
        string imageUrl;
        uint64 endTime;
        bool exists;
        bool settled;
        bool refunded;
        bool winningSide;
        uint256 bullPool;
        uint256 bearPool;
        uint32 bullCount;
        uint32 bearCount;
    }

    address public owner;
    IERC20 public immutable STAKE_TOKEN;
    uint256 public nextPostId;
    uint64 public wagerDuration = 1 days;
    uint256 public minVoteAmount;

    mapping(uint256 => Post) public posts;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(uint256 => mapping(address => uint256)) public bullBets;
    mapping(uint256 => mapping(address => uint256)) public bearBets;

    event WagerCreated(
        uint256 indexed postId,
        address indexed creator,
        string content,
        string imageUrl,
        uint256 endTime
    );
    event Voted(uint256 indexed postId, address indexed voter, bool isBull, uint256 amount);
    event Resolved(uint256 indexed postId, bool winningSide);
    event Refunded(uint256 indexed postId);
    event Claimed(uint256 indexed postId, address indexed voter, uint256 amount);

    error Unauthorized();
    error InvalidInput();
    error PostNotFound();
    error AlreadyVoted();
    error NotVoteWindow();
    error AlreadyFinalized();
    error NotFinalizable();
    error NothingToClaim();
    error AlreadyClaimed();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address initialOwner, address stakeToken, uint256 initialMinVoteAmount) {
        if (stakeToken == address(0)) revert InvalidInput();
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
        STAKE_TOKEN = IERC20(stakeToken);
        minVoteAmount = initialMinVoteAmount;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidInput();
        owner = newOwner;
    }

    function setWagerDuration(uint64 newDuration) external onlyOwner {
        if (newDuration < 5 minutes) revert InvalidInput();
        wagerDuration = newDuration;
    }

    function setMinVoteAmount(uint256 newMinVoteAmount) external onlyOwner {
        minVoteAmount = newMinVoteAmount;
    }

    function createWager(string calldata content, string calldata imageUrl) external returns (uint256 postId) {
        if (bytes(content).length == 0) revert InvalidInput();

        postId = ++nextPostId;
        uint64 endTime = uint64(block.timestamp + wagerDuration);

        posts[postId] = Post({
            creator: msg.sender,
            content: content,
            imageUrl: imageUrl,
            endTime: endTime,
            exists: true,
            settled: false,
            refunded: false,
            winningSide: false,
            bullPool: 0,
            bearPool: 0,
            bullCount: 0,
            bearCount: 0
        });

        emit WagerCreated(postId, msg.sender, content, imageUrl, endTime);
    }

    function vote(uint256 postId, bool isBull, uint256 amount) external {
        Post storage post = posts[postId];
        if (!post.exists) revert PostNotFound();
        if (post.settled || post.refunded) revert AlreadyFinalized();
        if (block.timestamp >= post.endTime) revert NotVoteWindow();
        if (hasVoted[postId][msg.sender]) revert AlreadyVoted();
        if (amount == 0 || amount < minVoteAmount) revert InvalidInput();

        bool transferInSuccess = STAKE_TOKEN.transferFrom(msg.sender, address(this), amount);
        if (!transferInSuccess) revert TransferFailed();

        hasVoted[postId][msg.sender] = true;

        if (isBull) {
            bullBets[postId][msg.sender] = amount;
            post.bullPool += amount;
            post.bullCount += 1;
        } else {
            bearBets[postId][msg.sender] = amount;
            post.bearPool += amount;
            post.bearCount += 1;
        }

        emit Voted(postId, msg.sender, isBull, amount);
    }

    function resolve(uint256 postId) external {
        Post storage post = posts[postId];
        if (!post.exists) revert PostNotFound();
        if (post.settled || post.refunded) revert AlreadyFinalized();
        if (block.timestamp < post.endTime) revert NotFinalizable();
        if (msg.sender != owner && msg.sender != post.creator) revert Unauthorized();

        if (post.bullPool == 0 || post.bearPool == 0 || post.bullPool == post.bearPool) {
            post.refunded = true;
            emit Refunded(postId);
            return;
        }

        post.settled = true;
        post.winningSide = post.bullPool > post.bearPool;

        emit Resolved(postId, post.winningSide);
    }

    function claim(uint256 postId) external returns (uint256 payout) {
        Post storage post = posts[postId];
        if (!post.exists) revert PostNotFound();
        if (!post.settled && !post.refunded) revert NotFinalizable();
        if (hasClaimed[postId][msg.sender]) revert AlreadyClaimed();

        uint256 bullStake = bullBets[postId][msg.sender];
        uint256 bearStake = bearBets[postId][msg.sender];
        uint256 userStake = bullStake + bearStake;

        if (userStake == 0) revert NothingToClaim();

        hasClaimed[postId][msg.sender] = true;

        if (post.refunded) {
            payout = userStake;
        } else if (post.winningSide) {
            if (bullStake == 0) revert NothingToClaim();
            payout = bullStake + ((bullStake * post.bearPool) / post.bullPool);
        } else {
            if (bearStake == 0) revert NothingToClaim();
            payout = bearStake + ((bearStake * post.bullPool) / post.bearPool);
        }

        bool transferOutSuccess = STAKE_TOKEN.transfer(msg.sender, payout);
        if (!transferOutSuccess) revert TransferFailed();

        emit Claimed(postId, msg.sender, payout);
    }

    function getUserWager(
        uint256 postId,
        address user
    ) external view returns (bool voted, bool side, uint256 amount, bool claimed_) {
        uint256 bullStake = bullBets[postId][user];
        uint256 bearStake = bearBets[postId][user];

        if (bullStake > 0) {
            return (true, true, bullStake, hasClaimed[postId][user]);
        }

        if (bearStake > 0) {
            return (true, false, bearStake, hasClaimed[postId][user]);
        }

        return (false, false, 0, hasClaimed[postId][user]);
    }
}
