import {
  users, type User, type InsertUser,
  strategies, type Strategy, type InsertStrategy,
  positions, type Position, type InsertPosition,
  portfolioSnapshots, type PortfolioSnapshot, type InsertPortfolioSnapshot
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Strategy methods
  getStrategies(userId: number): Promise<Strategy[]>;
  getDeployedStrategies(userId: number): Promise<Strategy[]>;
  getStrategy(id: number): Promise<Strategy | undefined>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategy(id: number, strategy: Partial<InsertStrategy>): Promise<Strategy | undefined>;
  deleteStrategy(id: number): Promise<boolean>;

  // Position methods
  getPositions(userId: number): Promise<Position[]>;
  getPosition(id: number): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: number, position: Partial<InsertPosition>): Promise<Position | undefined>;
  deletePosition(id: number): Promise<boolean>;

  // Portfolio methods
  getPortfolioSnapshots(userId: number, limit?: number): Promise<PortfolioSnapshot[]>;
  getLatestPortfolioSnapshot(userId: number): Promise<PortfolioSnapshot | undefined>;
  createPortfolioSnapshot(snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private strategies: Map<number, Strategy>;
  private positions: Map<number, Position>;
  private portfolioSnapshots: Map<number, PortfolioSnapshot>;

  private userId: number = 1;
  private strategyId: number = 1;
  private positionId: number = 1;
  private snapshotId: number = 1;

  constructor() {
    this.users = new Map();
    this.strategies = new Map();
    this.positions = new Map();
    this.portfolioSnapshots = new Map();

    // Add some sample data
    this.initializeSampleData();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const now = new Date();
    const user: User = { ...insertUser, id, createdAt: now };
    this.users.set(id, user);
    return user;
  }

  // Strategy methods
  async getStrategies(userId: number): Promise<Strategy[]> {
    return Array.from(this.strategies.values())
      .filter(strategy => strategy.userId === userId);
  }

  async getDeployedStrategies(userId: number): Promise<Strategy[]> {
    return Array.from(this.strategies.values())
      .filter(strategy => strategy.userId === userId && strategy.isDeployed);
  }

  async getStrategy(id: number): Promise<Strategy | undefined> {
    return this.strategies.get(id);
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const id = this.strategyId++;
    const now = new Date();
    const newStrategy: Strategy = { ...strategy, id, createdAt: now };
    this.strategies.set(id, newStrategy);
    return newStrategy;
  }

  async updateStrategy(id: number, update: Partial<InsertStrategy>): Promise<Strategy | undefined> {
    const strategy = this.strategies.get(id);
    if (!strategy) return undefined;

    const updatedStrategy = { ...strategy, ...update };
    this.strategies.set(id, updatedStrategy);
    return updatedStrategy;
  }

  async deleteStrategy(id: number): Promise<boolean> {
    return this.strategies.delete(id);
  }

  // Position methods
  async getPositions(userId: number): Promise<Position[]> {
    return Array.from(this.positions.values())
      .filter(position => position.userId === userId);
  }

  async getPosition(id: number): Promise<Position | undefined> {
    return this.positions.get(id);
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const id = this.positionId++;
    const now = new Date();
    const newPosition: Position = { ...position, id, createdAt: now };
    this.positions.set(id, newPosition);
    return newPosition;
  }

  async updatePosition(id: number, update: Partial<InsertPosition>): Promise<Position | undefined> {
    const position = this.positions.get(id);
    if (!position) return undefined;

    const updatedPosition = { ...position, ...update };
    this.positions.set(id, updatedPosition);
    return updatedPosition;
  }

  async deletePosition(id: number): Promise<boolean> {
    return this.positions.delete(id);
  }

  // Portfolio methods
  async getPortfolioSnapshots(userId: number, limit: number = 30): Promise<PortfolioSnapshot[]> {
    return Array.from(this.portfolioSnapshots.values())
      .filter(snapshot => snapshot.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getLatestPortfolioSnapshot(userId: number): Promise<PortfolioSnapshot | undefined> {
    return Array.from(this.portfolioSnapshots.values())
      .filter(snapshot => snapshot.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }

  async createPortfolioSnapshot(snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot> {
    const id = this.snapshotId++;
    const now = new Date();
    const newSnapshot: PortfolioSnapshot = { ...snapshot, id, timestamp: now };
    this.portfolioSnapshots.set(id, newSnapshot);
    return newSnapshot;
  }

  private initializeSampleData() {
    // Create demo user
    const demoUser: InsertUser = {
      username: 'demouser',
      email: 'demo@example.com',
      name: 'Dianne Russell',
      phone: '+912233445566',
      password: 'password123', // This would be hashed in production
      apiKey: 'demo-api-key',
      apiSecret: 'demo-api-secret'
    };
    const user = this.createUser(demoUser);

    // Create some strategies
    const strategy1: InsertStrategy = {
      userId: 1,
      name: 'Advanced Delta Neutral',
      description: 'A delta neutral strategy for volatile markets',
      type: 'OPTION',
      maxDrawdown: 0,
      margin: 0,
      config: {
        instruments: [
          { name: 'Sell NIFTY BANK ATM O CE' },
          { name: 'Sell NIFTY BANK ATM O PE' }
        ],
        startTime: '9:22',
        endTime: '15:11',
        segmentType: 'OPTION',
        strategyType: 'Time Based'
      },
      isDeployed: false
    };

    const strategy2 = { ...strategy1, isDeployed: true };
    const strategy3 = { ...strategy1 };

    this.createStrategy(strategy1);
    this.createStrategy(strategy2);
    this.createStrategy(strategy3);

    // Create some positions
    const position1: InsertPosition = {
      userId: 1,
      strategyId: 1,
      symbol: 'BTCUSDT',
      exchange: 'Bybit',
      value: 25227.92,
      entryPrice: 27451.50,
      markPrice: 34487.32,
      unrealizedPnl: 6465.92,
      unrealizedPnlPercentage: 25.63,
      realizedPnl: 2189.78,
      realizedPnlPercentage: 8.68,
      leverage: 100,
      positionType: 'LONG',
      isIsolated: true
    };

    const position2 = { ...position1, symbol: 'ETHUSDT' };

    this.createPosition(position1);
    this.createPosition(position2);

    // Create portfolio snapshot
    const portfolioSnapshot: InsertPortfolioSnapshot = {
      userId: 1,
      totalValue: 12849.84,
      btcValue: 0.440725,
      assets: {
        BTC: { percentage: 6, value: 245.67 },
        ETH: { percentage: 6, value: 245.67 },
        BNB: { percentage: 6, value: 245.67 },
        SOL: { percentage: 6, value: 245.67 },
        ARB: { percentage: 6, value: 245.67 },
        SAND: { percentage: 6, value: 245.67 }
      }
    };

    this.createPortfolioSnapshot(portfolioSnapshot);
  }
}

export const storage = new MemStorage();
