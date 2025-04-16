// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BetOracleRegistry
 * @dev Manages trusted oracles that can submit bet results
 */
contract BetOracleRegistry is Ownable {
    // Mapping of bet IDs to their assigned oracles
    mapping(uint256 => address) private betOracles;
    
    // Mapping to track authorized oracles
    mapping(address => bool) private authorizedOracles;
    
    // Events
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event ResultSubmitted(uint256 indexed betId, bool creatorWon, address oracle);
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Add a trusted oracle
     * @param oracle Address of the oracle to add
     */
    function addOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "Invalid oracle address");
        require(!authorizedOracles[oracle], "Oracle already authorized");
        
        authorizedOracles[oracle] = true;
        emit OracleAdded(oracle);
    }
    
    /**
     * @dev Remove a trusted oracle
     * @param oracle Address of the oracle to remove
     */
    function removeOracle(address oracle) external onlyOwner {
        require(authorizedOracles[oracle], "Oracle not authorized");
        
        authorizedOracles[oracle] = false;
        emit OracleRemoved(oracle);
    }
    
    /**
     * @dev Check if an address is an authorized oracle
     * @param oracle Address to check
     */
    function isAuthorizedOracle(address oracle) public view returns (bool) {
        return authorizedOracles[oracle];
    }
    
    /**
     * @dev Assign an oracle to a specific bet
     * @param betId ID of the bet
     * @param oracle Address of the oracle
     */
    function assignOracleToBet(uint256 betId, address oracle) external onlyOwner {
        require(authorizedOracles[oracle], "Not an authorized oracle");
        require(betOracles[betId] == address(0), "Bet already has an oracle");
        
        betOracles[betId] = oracle;
    }
    
    /**
     * @dev Get the oracle assigned to a bet
     * @param betId ID of the bet
     * @return Address of the assigned oracle
     */
    function getOracle(uint256 betId) external view returns (address) {
        return betOracles[betId];
    }
    
    /**
     * @dev Submit a result for a bet (oracle only)
     * @param betId ID of the bet
     * @param creatorWon true if the bet creator won, false otherwise
     */
    function submitResult(uint256 betId, bool creatorWon) external returns (bool) {
        require(authorizedOracles[msg.sender], "Not an authorized oracle");
        require(betOracles[betId] == address(0) || betOracles[betId] == msg.sender, "Not authorized for this bet");
        
        emit ResultSubmitted(betId, creatorWon, msg.sender);
        return creatorWon;
    }
} 