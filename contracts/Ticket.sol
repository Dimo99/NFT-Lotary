// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Ticket is ERC721Upgradeable, OwnableUpgradeable {
    event SupriseWinnerAwarded(uint256 indexed ticketId, uint256 amount);
    event FinalWinnerAwarded(uint256 indexed tickedId, uint256 amount);

    uint256 public s_startBlock;
    uint256 public s_endBlock;
    uint256 public s_ticketPrice;

    uint256 s_gatheredFunds;

    uint256 public s_numberOfTickets = 0;

    mapping(uint256 => uint256) s_winnersRewards;

    function initialize(
        address owner,
        string calldata name,
        string calldata symbol,
        uint256 startBlock,
        uint256 endBlock,
        uint256 ticketPrice
    ) external initializer {
        require(
            startBlock >= block.number,
            "The starting block should not be in the past"
        );
        require(
            endBlock > startBlock,
            "The end block should be latter than start block"
        );

        require(ticketPrice > 0, "Ticket price must be bigger than zero");

        __ERC721_init(name, symbol);
        transferOwnership(owner);
        
        s_startBlock = startBlock;
        s_endBlock = endBlock;
        s_ticketPrice = ticketPrice;
    }

    function buyTicket() external payable {
        require(block.number >= s_startBlock, "Lottary hasn't started");
        require(block.number <= s_endBlock, "Lottary has finished");
        require(msg.value >= s_ticketPrice, "Not enough money for a ticket");

        _mint(msg.sender, s_numberOfTickets++);
        s_gatheredFunds += s_ticketPrice;

        // return extra money if any. As a good samaritans
        if (msg.value > s_ticketPrice) {
            (bool success, ) = msg.sender.call{
                value: msg.value - s_ticketPrice
            }("");

            require(success, "Transfer failed");
        }
    }

    function finalWinner() external {
        require(
            block.number > s_endBlock,
            "Final winner can only be calculated after period ends"
        );
        require(s_gatheredFunds > 0, "No funds to be won");

        uint256 winner = pickWinner();
        uint256 winAmount = s_gatheredFunds;

        s_winnersRewards[winner] = winAmount;
        s_gatheredFunds = 0;

        emit FinalWinnerAwarded(winner, winAmount);
    }

    function surpriseWinner() external onlyOwner {
        require(s_numberOfTickets > 0, "No one bought any tickets yet");

        uint256 winner = pickWinner();

        uint256 winAmount = s_gatheredFunds / 2;

        s_winnersRewards[winner] = winAmount;
        s_gatheredFunds -= winAmount;

        emit SupriseWinnerAwarded(winner, winAmount);
    }

    function withdrawWinsForTicket(uint256 ticketId) external {
        require(s_winnersRewards[ticketId] > 0, "Ticket is not winning one");
        require(
            _isApprovedOrOwner(msg.sender, ticketId),
            "You should be owner or approved to spend the ticket"
        );

        uint256 reward = s_winnersRewards[ticketId];
        s_winnersRewards[ticketId] = 0;

        (bool success, ) = msg.sender.call{value: reward}("");
        require(success, "Transfer failed.");
    }

    function pickWinner() private view returns (uint256) {
        return random() % s_numberOfTickets;
    }

    function random() private view returns (uint256) {
        return
            uint256(
                keccak256(abi.encodePacked(block.difficulty, block.timestamp))
            );
    }
}
