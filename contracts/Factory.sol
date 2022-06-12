// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "./Ticket.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Lottery Factory
 * @notice Creates instances of Ticket lottery implementation
 */
contract Factory is Ownable {
    event NewLottaryCreated(
        address lotteryAddress,
        string name,
        string symbol,
        uint256 startBlock,
        uint256 endBlock,
        uint256 ticketPrice
    );

    address public immutable s_implementationAddress;

    constructor(address implementationAddress) {
        s_implementationAddress = implementationAddress;
    }

    /**
     * @notice creates EIP 1167 minimal proxy using create2
     */
    function createLottery(
        string calldata name,
        string calldata symbol,
        uint256 startBlock,
        uint256 endBlock,
        uint256 ticketPrice,
        string calldata ticketURI
    ) external onlyOwner returns (address) {
        address lottery = Clones.cloneDeterministic(
            s_implementationAddress,
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    name,
                    symbol,
                    startBlock,
                    endBlock,
                    ticketPrice,
                    ticketURI
                )
            )
        );

        Ticket lotteryContract = Ticket(lottery);
        lotteryContract.initialize(
            msg.sender,
            name,
            symbol,
            startBlock,
            endBlock,
            ticketPrice,
            ticketURI
        );

        emit NewLottaryCreated(
            lottery,
            name,
            symbol,
            startBlock,
            endBlock,
            ticketPrice
        );

        return lottery;
    }
}
