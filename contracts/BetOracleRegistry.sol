pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract BetOracleRegistry is Ownable {
    mapping(uint256 => address) private betOracles;

    mapping(address => bool) private authorizedOracles;

    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event ResultSubmitted(
        uint256 indexed betId,
        bool creatorWon,
        address oracle
    );

    constructor() Ownable(msg.sender) {}

    function addOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "Invalid oracle address");
        require(!authorizedOracles[oracle], "Oracle already authorized");

        authorizedOracles[oracle] = true;
        emit OracleAdded(oracle);
    }

    function removeOracle(address oracle) external onlyOwner {
        require(authorizedOracles[oracle], "Oracle not authorized");

        authorizedOracles[oracle] = false;
        emit OracleRemoved(oracle);
    }

    function isAuthorizedOracle(address oracle) public view returns (bool) {
        return authorizedOracles[oracle];
    }

    function assignOracleToBet(
        uint256 betId,
        address oracle
    ) external onlyOwner {
        require(authorizedOracles[oracle], "Not an authorized oracle");
        require(betOracles[betId] == address(0), "Bet already has an oracle");

        betOracles[betId] = oracle;
    }

    function getOracle(uint256 betId) external view returns (address) {
        return betOracles[betId];
    }

    function submitResult(
        uint256 betId,
        bool creatorWon
    ) external returns (bool) {
        require(authorizedOracles[msg.sender], "Not an authorized oracle");
        require(
            betOracles[betId] == address(0) || betOracles[betId] == msg.sender,
            "Not authorized for this bet"
        );

        emit ResultSubmitted(betId, creatorWon, msg.sender);
        return creatorWon;
    }
}
