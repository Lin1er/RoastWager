// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from 'forge-std/Script.sol';
import {RoastWager} from '../src/RoastWager.sol';

contract DeployRoastWager is Script {
    function run() external returns (RoastWager deployed) {
        uint256 privateKey = vm.envUint('PRIVATE_KEY');
        address owner = vm.envOr('OWNER_ADDRESS', vm.addr(privateKey));
        address stableToken = vm.envAddress('STABLE_TOKEN_ADDRESS');
        uint256 minVoteAmount = vm.envUint('MIN_VOTE_AMOUNT');

        vm.startBroadcast(privateKey);
        deployed = new RoastWager(owner, stableToken, minVoteAmount);
        vm.stopBroadcast();
    }
}
