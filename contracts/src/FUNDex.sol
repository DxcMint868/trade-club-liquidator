// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FUNDex - A Fake Perpetuals DEX for Demo/Hackathon
 * @notice Simulated perpetuals trading with controllable price oracle
 * @dev DO NOT USE IN PRODUCTION - This is for demo purposes only
 */
contract FUNDex is Ownable, ReentrancyGuard {
    
    enum PositionType { LONG, SHORT }
    
    struct Position {
        address trader;
        PositionType positionType;
        uint256 collateral;      // ETH deposited
        uint256 size;            // Position size (with leverage)
        uint256 leverage;        // Leverage multiplier (1x-10x)
        uint256 entryPrice;      // Price at entry (scaled by 1e18)
        uint256 openedAt;        // Timestamp
        bool isOpen;
    }
    
    struct Asset {
        string symbol;           // e.g., "ETH/USD"
        uint256 currentPrice;    // Current price (scaled by 1e18)
        uint256 lastUpdated;     // Last price update timestamp
        bool isActive;
    }
    
    // State variables
    mapping(address => uint256) public balances;           // User deposits
    mapping(uint256 => Position) public positions;         // Position ID => Position
    mapping(address => uint256[]) public userPositions;    // User => Position IDs
    mapping(uint256 => Asset) public assets;               // Asset ID => Asset data
    
    uint256 public positionCounter;
    uint256 public assetCounter;
    uint256 public constant MAX_LEVERAGE = 10;
    uint256 public constant PRICE_PRECISION = 1e18;
    
    // Events
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        uint256 indexed assetId,
        PositionType positionType,
        uint256 collateral,
        uint256 size,
        uint256 leverage,
        uint256 entryPrice,
        uint256 timestamp
    );
    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        uint256 indexed assetId,
        uint256 exitPrice,
        int256 pnl,
        uint256 timestamp
    );
    event PriceUpdated(
        uint256 indexed assetId,
        string symbol,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 timestamp
    );
    event AssetAdded(
        uint256 indexed assetId,
        string symbol,
        uint256 initialPrice
    );
    
    constructor() Ownable(msg.sender) {
        // Add default ETH/USD asset
        _addAsset("ETH/USD", 2000 * PRICE_PRECISION); // $2000
    }
    
    /**
     * @notice Deposit ETH to use for trading
     */
    function deposit() external payable {
        require(msg.value > 0, "Must deposit some ETH");
        
        balances[msg.sender] += msg.value;
        
        emit Deposited(msg.sender, msg.value, balances[msg.sender]);
    }
    
    /**
     * @notice Withdraw available balance
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit Withdrawn(msg.sender, amount, balances[msg.sender]);
    }
    
    /**
     * @notice Open a leveraged position with ETH sent in transaction
     * @param assetId The asset to trade
     * @param positionType LONG or SHORT
     * @param leverage Leverage multiplier (1-10x)
     * @dev Send ETH as msg.value to use as collateral (1 tx to open position)
     */
    function openPosition(
        uint256 assetId,
        PositionType positionType,
        uint256 leverage
    ) external payable returns (uint256) {
        require(assets[assetId].isActive, "Asset not active");
        require(msg.value > 0, "Must send ETH as collateral");
        require(leverage >= 1 && leverage <= MAX_LEVERAGE, "Invalid leverage");
        
        uint256 collateral = msg.value;
        
        // Calculate position size
        uint256 size = collateral * leverage;
        
        // Create position
        uint256 positionId = ++positionCounter;
        Position storage position = positions[positionId];
        position.trader = msg.sender;
        position.positionType = positionType;
        position.collateral = collateral;
        position.size = size;
        position.leverage = leverage;
        position.entryPrice = assets[assetId].currentPrice;
        position.openedAt = block.timestamp;
        position.isOpen = true;
        
        userPositions[msg.sender].push(positionId);
        
        emit PositionOpened(
            positionId,
            msg.sender,
            assetId,
            positionType,
            collateral,
            size,
            leverage,
            position.entryPrice,
            block.timestamp
        );
        
        return positionId;
    }
    
    /**
     * @notice Close an open position
     * @param positionId The position to close
     * @param assetId The asset being traded
     */
    function closePosition(uint256 positionId, uint256 assetId) external nonReentrant {
        Position storage position = positions[positionId];
        
        require(position.trader == msg.sender, "Not your position");
        require(position.isOpen, "Position already closed");
        require(assets[assetId].isActive, "Asset not active");
        
        // Get current price
        uint256 exitPrice = assets[assetId].currentPrice;
        
        // Calculate PnL
        int256 pnl = calculatePnL(positionId, exitPrice);
        
        // Update balance (collateral + PnL)
        if (pnl >= 0) {
            balances[msg.sender] += position.collateral + uint256(pnl);
        } else {
            // Loss case - deduct from collateral
            uint256 loss = uint256(-pnl);
            if (loss >= position.collateral) {
                // Liquidated - lose all collateral
                balances[msg.sender] += 0;
            } else {
                balances[msg.sender] += position.collateral - loss;
            }
        }
        
        position.isOpen = false;
        
        emit PositionClosed(
            positionId,
            msg.sender,
            assetId,
            exitPrice,
            pnl,
            block.timestamp
        );
    }
    
    /**
     * @notice Calculate PnL for a position at current price
     * @param positionId The position ID
     * @param currentPrice The current asset price
     * @return pnl The profit/loss (can be negative)
     */
    function calculatePnL(uint256 positionId, uint256 currentPrice) public view returns (int256) {
        Position memory position = positions[positionId];
        require(position.isOpen, "Position is closed");
        
        int256 priceChange;
        
        if (position.positionType == PositionType.LONG) {
            // Long: profit when price goes up
            priceChange = int256(currentPrice) - int256(position.entryPrice);
        } else {
            // Short: profit when price goes down
            priceChange = int256(position.entryPrice) - int256(currentPrice);
        }
        
        // PnL = (priceChange / entryPrice) * size
        int256 pnl = (priceChange * int256(position.size)) / int256(position.entryPrice);
        
        return pnl;
    }
    
    /**
     * @notice Add a new tradeable asset (owner only)
     * @param symbol Asset symbol (e.g., "BTC/USD")
     * @param initialPrice Initial price (scaled by 1e18)
     */
    function addAsset(string memory symbol, uint256 initialPrice) external onlyOwner {
        _addAsset(symbol, initialPrice);
    }
    
    function _addAsset(string memory symbol, uint256 initialPrice) internal {
        require(initialPrice > 0, "Price must be positive");
        
        uint256 assetId = ++assetCounter;
        assets[assetId] = Asset({
            symbol: symbol,
            currentPrice: initialPrice,
            lastUpdated: block.timestamp,
            isActive: true
        });
        
        emit AssetAdded(assetId, symbol, initialPrice);
    }
    
    /**
     * @notice Update asset price (owner only - simulates oracle)
     * @param assetId The asset to update
     * @param newPrice New price (scaled by 1e18)
     */
    function updatePrice(uint256 assetId, uint256 newPrice) external onlyOwner {
        require(assets[assetId].isActive, "Asset not active");
        require(newPrice > 0, "Price must be positive");
        
        uint256 oldPrice = assets[assetId].currentPrice;
        assets[assetId].currentPrice = newPrice;
        assets[assetId].lastUpdated = block.timestamp;
        
        emit PriceUpdated(
            assetId,
            assets[assetId].symbol,
            oldPrice,
            newPrice,
            block.timestamp
        );
    }
    
    /**
     * @notice Batch update multiple asset prices (owner only)
     * @param assetIds Array of asset IDs
     * @param newPrices Array of new prices
     */
    function batchUpdatePrices(
        uint256[] calldata assetIds,
        uint256[] calldata newPrices
    ) external onlyOwner {
        require(assetIds.length == newPrices.length, "Array length mismatch");
        
        for (uint256 i = 0; i < assetIds.length; i++) {
            if (assets[assetIds[i]].isActive && newPrices[i] > 0) {
                uint256 oldPrice = assets[assetIds[i]].currentPrice;
                assets[assetIds[i]].currentPrice = newPrices[i];
                assets[assetIds[i]].lastUpdated = block.timestamp;
                
                emit PriceUpdated(
                    assetIds[i],
                    assets[assetIds[i]].symbol,
                    oldPrice,
                    newPrices[i],
                    block.timestamp
                );
            }
        }
    }
    
    /**
     * @notice Get user's open positions
     * @param user The user address
     * @return positionIds Array of open position IDs
     */
    function getUserOpenPositions(address user) external view returns (uint256[] memory) {
        uint256[] memory allPositions = userPositions[user];
        uint256 openCount = 0;
        
        // Count open positions
        for (uint256 i = 0; i < allPositions.length; i++) {
            if (positions[allPositions[i]].isOpen) {
                openCount++;
            }
        }
        
        // Build array of open positions
        uint256[] memory openPositions = new uint256[](openCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allPositions.length; i++) {
            if (positions[allPositions[i]].isOpen) {
                openPositions[index] = allPositions[i];
                index++;
            }
        }
        
        return openPositions;
    }
    
    /**
     * @notice Get asset info
     * @param assetId The asset ID
     * @return Asset data
     */
    function getAsset(uint256 assetId) external view returns (Asset memory) {
        return assets[assetId];
    }
    
    /**
     * @notice Get position details
     * @param positionId The position ID
     * @return Position data
     */
    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }
    
    receive() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, balances[msg.sender]);
    }
}
