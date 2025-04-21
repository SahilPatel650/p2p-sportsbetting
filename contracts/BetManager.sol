pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BetOracleRegistry.sol";

contract BetManager is Ownable {
    BetOracleRegistry public oracleRegistry;

    enum BetStatus {
        Open,
        Active,
        Completed,
        Cancelled,
        Refunded
    }

    struct Bet {
        address creator;
        address joiner;
        uint256 amount;
        string description;
        uint256 deadline;
        bool creatorWon;
        BetStatus status;
        bool isSettled;
        string sportEvent;
        string selectedTeam;
        uint256 threshold;
        bool isMoreLine;
    }

    Bet[] public bets;

    event BetCreated(
        uint256 indexed betId,
        address indexed creator,
        uint256 amount,
        string description,
        uint256 deadline,
        string sportEvent,
        string selectedTeam,
        uint256 threshold,
        bool isMoreLine
    );
    event BetJoined(
        uint256 indexed betId,
        address indexed joiner,
        uint256 amount
    );
    event BetSettled(uint256 indexed betId, address winner, uint256 amount);
    event BetRefunded(uint256 indexed betId);
    event BetCancelled(uint256 indexed betId);

    constructor(address _oracleRegistry) Ownable(msg.sender) {
        oracleRegistry = BetOracleRegistry(_oracleRegistry);
    }

    function createBet(
        string calldata description,
        uint256 deadline,
        string calldata sportEvent,
        string calldata selectedTeam,
        uint256 threshold,
        bool isMoreLine
    ) external payable {
        require(msg.value > 0, "Your bet has to have money on it!");
        require(deadline > block.timestamp, "You can't set a deadline in the past!");

        uint256 betId = bets.length;
        bets.push(
            Bet({
                creator: msg.sender,
                joiner: address(0),
                amount: msg.value,
                description: description,
                deadline: deadline,
                creatorWon: false,
                status: BetStatus.Open,
                isSettled: false,
                sportEvent: sportEvent,
                selectedTeam: selectedTeam,
                threshold: threshold,
                isMoreLine: isMoreLine
            })
        );

        emit BetCreated(
            betId,
            msg.sender,
            msg.value,
            description,
            deadline,
            sportEvent,
            selectedTeam,
            threshold,
            isMoreLine
        );
    }

    function joinBet(uint256 betId) external payable {
        require(betId < bets.length, "Bet doesn't exist");
        Bet storage bet = bets[betId];

        require(bet.status == BetStatus.Open, "Bet isn't open");
        require(msg.sender != bet.creator, "You created this bet, you can't join it!");

        bet.joiner = msg.sender;
        bet.status = BetStatus.Active;

        emit BetJoined(betId, msg.sender, msg.value);
    }

    function settleBet(uint256 betId, bool creatorWon) external {
        require(betId < bets.length, "Bet doesn't exist");

        bool isOracle = oracleRegistry.isAuthorizedOracle(msg.sender);
        bool isOwner = owner() == msg.sender;
        require(isOracle || isOwner, "Caller is not authorized");

        Bet storage bet = bets[betId];
        require(bet.status == BetStatus.Active, "Bet isn't active");
        require(!bet.isSettled, "Bet already settled");
        require(bet.joiner != address(0), "Bet hasn't been joined yet");

        bet.creatorWon = creatorWon;
        bet.status = BetStatus.Completed;
        bet.isSettled = true;

        address winner = creatorWon ? bet.creator : bet.joiner;
        uint256 totalAmount = bet.amount * 2;

        (bool success, ) = payable(winner).call{value: totalAmount}("");
        require(success, "Transfer error");

        emit BetSettled(betId, winner, totalAmount);
    }

    function timeoutBet(uint256 betId) external {
        require(betId < bets.length, "Bet doesn't exist");
        Bet storage bet = bets[betId];

        require(block.timestamp > bet.deadline, "Deadline hasn't passed");
        require(bet.status == BetStatus.Active, "Bet isn't active");
        require(!bet.isSettled, "Bet already settled");

        (bool successCreator, ) = payable(bet.creator).call{value: bet.amount}(
            ""
        );
        require(successCreator, "Creator refund failed");

        (bool successJoiner, ) = payable(bet.joiner).call{value: bet.amount}(
            ""
        );
        require(successJoiner, "Joiner refund failed");

        bet.status = BetStatus.Refunded;

        emit BetRefunded(betId);
    }

    function cancelBet(uint256 betId) external {
        require(betId < bets.length, "Bet doesn't exist");
        Bet storage bet = bets[betId];

        require(msg.sender == bet.creator, "Only creator can cancel");
        require(bet.status == BetStatus.Open, "Bet is not open");
        require(bet.joiner == address(0), "Bet has already been joined");

        (bool success, ) = payable(bet.creator).call{value: bet.amount}("");
        require(success, "Refund failed");

        bet.status = BetStatus.Cancelled;

        emit BetCancelled(betId);
    }

    function getBets() external view returns (Bet[] memory) {
        return bets;
    }

    function getBetDetails(uint256 betId) external view returns (Bet memory) {
        require(betId < bets.length, "Bet doesn't exist");
        return bets[betId];
    }
}
