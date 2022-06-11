// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

error StartBlockShouldNotBeInThePast();
error TheEndBlockShouldBeLatterThanTheStartBlock();
error TicketPriceMustBeBiggerThanZero();

error LotteryHasntStarted();
error LotteryHasFinished();
error NotEnoughMoneyForATicket();

error FinalWinnerCanOnlyBeCalculatedAfterPeriodEnds();
error NoFundsToBeWon();

error TicketIsNotWinningOne();
error YouShouldBeOwnerOrApprovedToSpendTheTicket();
error TransferFailed();

error URIQueryForNonExistantToken();

/**
 * @notice Implementation of a lottery where users can purchase tickets (ERC721 tokens) and at the end of period a winner is drawn
 * during the lottery an owner can call a surprise winner who earns half of the currently collected funds
 */
contract Ticket is ERC721Upgradeable, OwnableUpgradeable {
    /**
     * @dev Emitted when surpise winner is selected
     */
    event SurpriseWinnerAwarded(uint256 indexed ticketId, uint256 amount);

    /**
     * @dev Emitted when final winner is selected
     */
    event FinalWinnerAwarded(uint256 indexed ticketId, uint256 amount);

    uint256 public s_startBlock;
    uint256 public s_endBlock;
    uint256 public s_ticketPrice;

    uint256 public s_gatheredFunds;

    uint256 public s_numberOfTickets = 0;

    string private s_ticketURI;

    mapping(uint256 => uint256) public s_winnersRewards;

    /**
     * @notice Initializes the contract
     */
    function initialize(
        address owner,
        string calldata name,
        string calldata symbol,
        uint256 startBlock,
        uint256 endBlock,
        uint256 ticketPrice,
        string calldata ticketUri
    ) public initializer {
        if (startBlock < block.number) {
            revert StartBlockShouldNotBeInThePast();
        }

        if (endBlock <= startBlock) {
            revert TheEndBlockShouldBeLatterThanTheStartBlock();
        }

        if (ticketPrice == 0) {
            revert TicketPriceMustBeBiggerThanZero();
        }

        __ERC721_init(name, symbol);
        _transferOwnership(owner);

        s_startBlock = startBlock;
        s_endBlock = endBlock;
        s_ticketPrice = ticketPrice;
        s_ticketURI = ticketUri;
    }

    /**
     * @notice buy a ticket for the lottery if successfull mints the user a ticket
     */
    function buyTicket() external payable {
        if (block.number < s_startBlock) {
            revert LotteryHasntStarted();
        }

        if (block.number > s_endBlock) {
            revert LotteryHasFinished();
        }

        uint256 ticketPrice = s_ticketPrice;

        if (msg.value < ticketPrice) {
            revert NotEnoughMoneyForATicket();
        }

        _mint(msg.sender, s_numberOfTickets++);
        s_gatheredFunds += ticketPrice;

        // return extra money if any. As a good samaritans
        if (msg.value > ticketPrice) {
            (bool success, ) = msg.sender.call{value: msg.value - ticketPrice}(
                ""
            );

            if (!success) {
                revert TransferFailed();
            }
        }
    }

    /**
     * @notice draws the final winner of the lottery using a random function. Enabling him to withdraw awarded sum
     * @dev Emits a {FinalWinnerAwarded} event
     */
    function drawFinalWinner() external {
        if (block.number <= s_endBlock) {
            revert FinalWinnerCanOnlyBeCalculatedAfterPeriodEnds();
        }

        uint256 gatheredFunds = s_gatheredFunds;

        if (gatheredFunds == 0) {
            revert NoFundsToBeWon();
        }

        uint256 winner = pickWinner();
        uint256 winAmount = gatheredFunds;

        s_winnersRewards[winner] += winAmount;
        s_gatheredFunds = 0;

        emit FinalWinnerAwarded(winner, s_winnersRewards[winner]);
    }

    /**
     * @notice draws a surprise winner during lottery using a random function. Enabling him to withdraw awarded sum
     * @dev Emits a {SurpriseWinnerAwarded} event
     */
    function drawSurpriseWinner() external onlyOwner {
        if (block.number < s_startBlock) {
            revert LotteryHasntStarted();
        }

        if (s_endBlock < block.number) {
            revert LotteryHasFinished();
        }

        uint256 gatheredFunds = s_gatheredFunds;

        if (gatheredFunds == 0) {
            revert NoFundsToBeWon();
        }

        uint256 winner = pickWinner();

        uint256 winAmount = gatheredFunds / 2;

        s_winnersRewards[winner] += winAmount;
        s_gatheredFunds -= winAmount;

        emit SurpriseWinnerAwarded(winner, s_winnersRewards[winner]);
    }

    /**
     * @notice withdraws the ticket reward to the msg sender
     */
    function withdrawWinsForTicket(uint256 ticketId) external {
        uint256 rewardAmount = s_winnersRewards[ticketId];

        if (rewardAmount == 0) {
            revert TicketIsNotWinningOne();
        }

        if (!_isApprovedOrOwner(msg.sender, ticketId)) {
            revert YouShouldBeOwnerOrApprovedToSpendTheTicket();
        }

        s_winnersRewards[ticketId] = 0;

        (bool success, ) = msg.sender.call{value: rewardAmount}("");

        if (!success) {
            revert TransferFailed();
        }
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        if (!_exists(tokenId)) {
            revert URIQueryForNonExistantToken();
        }

        return s_ticketURI;
    }

    /**
     * @dev Internal function for picking a random winner among thickets
     */
    function pickWinner() private view returns (uint256) {
        return random() % s_numberOfTickets;
    }

    /**
     * @dev Internal function for getting a random value
     * MEV-able as minners know the value of `block.difficulty` and `block.timestamp` 
     * Getting the value from an Oracle is considered a better solutin 
     * but still perfect solution does not exists
     */
    function random() private view returns (uint256) {
        return
            uint256(
                keccak256(abi.encodePacked(block.difficulty, block.timestamp))
            );
    }
}
