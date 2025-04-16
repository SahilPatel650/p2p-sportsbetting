// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BetOracleRegistry.sol";

/**
 * @title BetManager
 * @dev Manages peer-to-peer sports bets between users
 */
contract BetManager is Ownable {
    // Reference to the Oracle Registry
    BetOracleRegistry public oracleRegistry;
    
    // Bet status enum
    enum BetStatus { Open, Active, Completed, Cancelled, Refunded }
    
    // Bet struct
    struct Bet {
        address creator;
        address joiner;
        uint256 amount;
        string description;
        uint256 deadline;
        bool creatorWon;
        BetStatus status;
        bool isSettled;
    }
    
    // Storage
    Bet[] public bets;
    
    // Events
    event BetCreated(uint256 indexed betId, address indexed creator, uint256 amount, string description, uint256 deadline);
    event BetJoined(uint256 indexed betId, address indexed joiner, uint256 amount);
    event BetSettled(uint256 indexed betId, address winner, uint256 amount);
    event BetRefunded(uint256 indexed betId);
    event BetCancelled(uint256 indexed betId);
    
    constructor(address _oracleRegistry) Ownable(msg.sender) {
        oracleRegistry = BetOracleRegistry(_oracleRegistry);
    }
    
    /**
     * @dev Create a new bet
     * @param description Description of the bet
     * @param deadline Timestamp after which the bet can be refunded if not settled
     */
    function createBet(string calldata description, uint256 deadline) external payable {
        require(msg.value > 0, "Bet amount must be greater than 0");
        require(deadline > block.timestamp, "Deadline must be in the future");
        
        uint256 betId = bets.length;
        bets.push(Bet({
            creator: msg.sender,
            joiner: address(0),
            amount: msg.value,
            description: description,
            deadline: deadline,
            creatorWon: false,
            status: BetStatus.Open,
            isSettled: false
        }));
        
        emit BetCreated(betId, msg.sender, msg.value, description, deadline);
    }
    
    /**
     * @dev Join an existing open bet
     * @param betId ID of the bet to join
     */
    function joinBet(uint256 betId) external payable {
        require(betId < bets.length, "Bet does not exist");
        Bet storage bet = bets[betId];
        
        require(bet.status == BetStatus.Open, "Bet is not open");
        require(msg.sender != bet.creator, "Cannot join your own bet");
        require(msg.value == bet.amount, "Must match the exact bet amount");
        
        bet.joiner = msg.sender;
        bet.status = BetStatus.Active;
        
        emit BetJoined(betId, msg.sender, msg.value);
    }
    
    /**
     * @dev Settle a bet with outcome (callable by oracle or owner)
     * @param betId ID of the bet to settle
     * @param creatorWon true if the creator won, false if the joiner won
     */
    function settleBet(uint256 betId, bool creatorWon) external {
        require(betId < bets.length, "Bet does not exist");
        
        // Check if caller is an authorized oracle or owner
        bool isOracle = oracleRegistry.isAuthorizedOracle(msg.sender);
        bool isOwner = owner() == msg.sender;
        require(isOracle || isOwner, "Caller is not authorized");
        
        Bet storage bet = bets[betId];
        require(bet.status == BetStatus.Active, "Bet is not active");
        require(!bet.isSettled, "Bet already settled");
        require(bet.joiner != address(0), "Bet has not been joined");
        
        bet.creatorWon = creatorWon;
        bet.status = BetStatus.Completed;
        bet.isSettled = true;
        
        // Determine winner and transfer funds
        address winner = creatorWon ? bet.creator : bet.joiner;
        uint256 totalAmount = bet.amount * 2;
        
        // Transfer funds to winner
        (bool success, ) = payable(winner).call{value: totalAmount}("");
        require(success, "Transfer failed");
        
        emit BetSettled(betId, winner, totalAmount);
    }
    
    /**
     * @dev Allow refund if deadline has passed and bet is not settled
     * @param betId ID of the bet to refund
     */
    function timeoutBet(uint256 betId) external {
        require(betId < bets.length, "Bet does not exist");
        Bet storage bet = bets[betId];
        
        require(block.timestamp > bet.deadline, "Deadline has not passed");
        require(bet.status == BetStatus.Active, "Bet is not active");
        require(!bet.isSettled, "Bet already settled");
        
        // Refund creator
        (bool successCreator, ) = payable(bet.creator).call{value: bet.amount}("");
        require(successCreator, "Creator refund failed");
        
        // Refund joiner
        (bool successJoiner, ) = payable(bet.joiner).call{value: bet.amount}("");
        require(successJoiner, "Joiner refund failed");
        
        bet.status = BetStatus.Refunded;
        
        emit BetRefunded(betId);
    }
    
    /**
     * @dev Cancel an unjoined bet (creator only)
     * @param betId ID of the bet to cancel
     */
    function cancelBet(uint256 betId) external {
        require(betId < bets.length, "Bet does not exist");
        Bet storage bet = bets[betId];
        
        require(msg.sender == bet.creator, "Only creator can cancel");
        require(bet.status == BetStatus.Open, "Bet is not open");
        require(bet.joiner == address(0), "Bet has already been joined");
        
        // Return funds to creator
        (bool success, ) = payable(bet.creator).call{value: bet.amount}("");
        require(success, "Refund failed");
        
        bet.status = BetStatus.Cancelled;
        
        emit BetCancelled(betId);
    }
    
    /**
     * @dev Get all bets
     * @return All bets
     */
    function getBets() external view returns (Bet[] memory) {
        return bets;
    }
    
    /**
     * @dev Get details of a specific bet
     * @param betId ID of the bet
     * @return Bet details
     */
    function getBetDetails(uint256 betId) external view returns (Bet memory) {
        require(betId < bets.length, "Bet does not exist");
        return bets[betId];
    }
} 