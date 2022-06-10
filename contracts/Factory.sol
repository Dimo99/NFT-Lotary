// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "./Ticket.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";

contract LottaryFactory {
    event NewLottaryCreated(
        address lottaryAddress,
        string name,
        string symbol,
        uint256 startBlock,
        uint256 endBlock,
        uint256 ticketPrice
    );

    address public implementationAddress;

    constructor(address _implementationAddress) {
        implementationAddress = _implementationAddress;
    }

    function createLottary(
        string calldata name,
        string calldata symbol,
        uint256 startBlock,
        uint256 endBlock,
        uint256 ticketPrice
    ) external returns (address) {
        address lottary = ClonesUpgradeable.cloneDeterministic(
            implementationAddress,
            keccak256(
                abi.encodePacked(
                    name,
                    symbol,
                    startBlock,
                    endBlock,
                    ticketPrice
                )
            )
        );

        Ticket lottaryContract = Ticket(lottary);
        lottaryContract.initialize(
            msg.sender,
            name,
            symbol,
            startBlock,
            endBlock,
            ticketPrice
        );

        emit NewLottaryCreated(
            lottary,
            name,
            symbol,
            startBlock,
            endBlock,
            ticketPrice
        );

        return lottary;
    }
}
