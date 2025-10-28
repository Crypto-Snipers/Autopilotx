// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  users;
  strategies;
  positions;
  portfolioSnapshots;
  userId = 1;
  strategyId = 1;
  positionId = 1;
  snapshotId = 1;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.strategies = /* @__PURE__ */ new Map();
    this.positions = /* @__PURE__ */ new Map();
    this.portfolioSnapshots = /* @__PURE__ */ new Map();
    this.initializeSampleData();
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find((user) => user.username === username);
  }
  async getUserByEmail(email) {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }
  async createUser(insertUser) {
    const id = this.userId++;
    const now = /* @__PURE__ */ new Date();
    const user = { ...insertUser, id, createdAt: now };
    this.users.set(id, user);
    return user;
  }
  // Strategy methods
  async getStrategies(userId) {
    return Array.from(this.strategies.values()).filter((strategy) => strategy.userId === userId);
  }
  async getDeployedStrategies(userId) {
    return Array.from(this.strategies.values()).filter((strategy) => strategy.userId === userId && strategy.isDeployed);
  }
  async getStrategy(id) {
    return this.strategies.get(id);
  }
  async createStrategy(strategy) {
    const id = this.strategyId++;
    const now = /* @__PURE__ */ new Date();
    const newStrategy = { ...strategy, id, createdAt: now };
    this.strategies.set(id, newStrategy);
    return newStrategy;
  }
  async updateStrategy(id, update) {
    const strategy = this.strategies.get(id);
    if (!strategy) return void 0;
    const updatedStrategy = { ...strategy, ...update };
    this.strategies.set(id, updatedStrategy);
    return updatedStrategy;
  }
  async deleteStrategy(id) {
    return this.strategies.delete(id);
  }
  // Position methods
  async getPositions(userId) {
    return Array.from(this.positions.values()).filter((position) => position.userId === userId);
  }
  async getPosition(id) {
    return this.positions.get(id);
  }
  async createPosition(position) {
    const id = this.positionId++;
    const now = /* @__PURE__ */ new Date();
    const newPosition = { ...position, id, createdAt: now };
    this.positions.set(id, newPosition);
    return newPosition;
  }
  async updatePosition(id, update) {
    const position = this.positions.get(id);
    if (!position) return void 0;
    const updatedPosition = { ...position, ...update };
    this.positions.set(id, updatedPosition);
    return updatedPosition;
  }
  async deletePosition(id) {
    return this.positions.delete(id);
  }
  // Portfolio methods
  async getPortfolioSnapshots(userId, limit = 30) {
    return Array.from(this.portfolioSnapshots.values()).filter((snapshot) => snapshot.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
  }
  async getLatestPortfolioSnapshot(userId) {
    return Array.from(this.portfolioSnapshots.values()).filter((snapshot) => snapshot.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }
  async createPortfolioSnapshot(snapshot) {
    const id = this.snapshotId++;
    const now = /* @__PURE__ */ new Date();
    const newSnapshot = { ...snapshot, id, timestamp: now };
    this.portfolioSnapshots.set(id, newSnapshot);
    return newSnapshot;
  }
  initializeSampleData() {
    const demoUser = {
      username: "demouser",
      email: "demo@example.com",
      name: "Dianne Russell",
      phone: "+912233445566",
      password: "password123",
      // This would be hashed in production
      apiKey: "demo-api-key",
      apiSecret: "demo-api-secret"
    };
    const user = this.createUser(demoUser);
    const strategy1 = {
      userId: 1,
      name: "Advanced Delta Neutral",
      description: "A delta neutral strategy for volatile markets",
      type: "OPTION",
      maxDrawdown: 0,
      margin: 0,
      config: {
        instruments: [
          { name: "Sell NIFTY BANK ATM O CE" },
          { name: "Sell NIFTY BANK ATM O PE" }
        ],
        startTime: "9:22",
        endTime: "15:11",
        segmentType: "OPTION",
        strategyType: "Time Based"
      },
      isDeployed: false
    };
    const strategy2 = { ...strategy1, isDeployed: true };
    const strategy3 = { ...strategy1 };
    this.createStrategy(strategy1);
    this.createStrategy(strategy2);
    this.createStrategy(strategy3);
    const position1 = {
      userId: 1,
      strategyId: 1,
      symbol: "BTCUSDT",
      exchange: "Bybit",
      value: 25227.92,
      entryPrice: 27451.5,
      markPrice: 34487.32,
      unrealizedPnl: 6465.92,
      unrealizedPnlPercentage: 25.63,
      realizedPnl: 2189.78,
      realizedPnlPercentage: 8.68,
      leverage: 100,
      positionType: "LONG",
      isIsolated: true
    };
    const position2 = { ...position1, symbol: "ETHUSDT" };
    this.createPosition(position1);
    this.createPosition(position2);
    const portfolioSnapshot = {
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
};
var storage = new MemStorage();

// shared/schema.ts
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  real,
  jsonb
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  // optional: add an ID if needed
  email: text("email").notNull().unique(),
  google_id: text("google_id"),
  // was incorrect: '' is not a valid type
  phone: text("phone"),
  username: text("username").notNull().unique(),
  status: text("status").default("pending"),
  // corrected
  password: text("password").notNull(),
  referralCode: text("referral_code"),
  // corrected
  referralCount: integer("referral_count").default(0),
  // corrected
  approvedAt: timestamp("approved_at"),
  // corrected from 'Date'
  brokerName: text("broker_name"),
  // corrected
  strategies: jsonb("strategies").default({}),
  // corrected
  is_admin: boolean("is_admin").default(false),
  isActive: boolean("is_active").default(true),
  api_verified: boolean("api_verified").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  phone: true,
  password: true
});
var strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  maxDrawdown: real("max_drawdown").default(0),
  margin: real("margin").default(0),
  config: jsonb("config"),
  isDeployed: boolean("is_deployed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertStrategySchema = createInsertSchema(strategies).pick({
  userId: true,
  name: true,
  description: true,
  type: true,
  maxDrawdown: true,
  margin: true,
  config: true,
  isDeployed: true
});
var positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  strategyId: integer("strategy_id"),
  symbol: text("symbol").notNull(),
  exchange: text("exchange").notNull(),
  value: real("value").notNull(),
  entryPrice: real("entry_price").notNull(),
  markPrice: real("mark_price").notNull(),
  unrealizedPnl: real("unrealized_pnl").default(0),
  unrealizedPnlPercentage: real("unrealized_pnl_percentage").default(0),
  realizedPnl: real("realized_pnl").default(0),
  realizedPnlPercentage: real("realized_pnl_percentage").default(0),
  leverage: integer("leverage").default(1),
  positionType: text("position_type").notNull(),
  // LONG or SHORT
  isIsolated: boolean("is_isolated").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertPositionSchema = createInsertSchema(positions).pick({
  userId: true,
  strategyId: true,
  symbol: true,
  exchange: true,
  value: true,
  entryPrice: true,
  markPrice: true,
  unrealizedPnl: true,
  unrealizedPnlPercentage: true,
  realizedPnl: true,
  realizedPnlPercentage: true,
  leverage: true,
  positionType: true,
  isIsolated: true
});
var portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  totalValue: real("total_value").notNull(),
  btcValue: real("btc_value"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  assets: jsonb("assets")
});
var insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).pick({
  userId: true,
  totalValue: true,
  btcValue: true,
  assets: true
});

// server/routes.ts
import session from "express-session";
import memoryStore from "memorystore";
var MS_PER_DAY = 1e3 * 60 * 60 * 24;
var otpStore = /* @__PURE__ */ new Map();
var generateOTP = () => Math.floor(1e5 + Math.random() * 9e5).toString();
var OTP_EXPIRE_TIME = 5 * 60 * 1e3;
async function registerRoutes(app2) {
  const MemoryStore = memoryStore(session);
  app2.use(
    session({
      secret: process.env.SESSION_SECRET || "crypto-snipers-secret",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({
        checkPeriod: MS_PER_DAY
      }),
      cookie: {
        maxAge: MS_PER_DAY * 7,
        secure: process.env.NODE_ENV === "production"
      }
    })
  );
  const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  };
  app2.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, phone } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      const otp = generateOTP();
      otpStore.set(email, { otp, timestamp: Date.now() });
      console.log(`OTP for ${email}: ${otp}`);
      return res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("Signup error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }
      const storedOTP = otpStore.get(email);
      if (!storedOTP) {
        return res.status(400).json({ message: "No OTP found for this email" });
      }
      if (Date.now() - storedOTP.timestamp > OTP_EXPIRE_TIME) {
        otpStore.delete(email);
        return res.status(400).json({ message: "OTP has expired" });
      }
      if (storedOTP.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }
      otpStore.delete(email);
      return res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
      console.error("OTP verification error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/auth/complete-registration", async (req, res) => {
    try {
      const userData = insertUserSchema.safeParse(req.body);
      if (!userData.success) {
        return res.status(400).json({ message: "Invalid user data", errors: userData.error.errors });
      }
      const user = await storage.createUser(userData.data);
      req.session.userId = user.id;
      return res.status(200).json({
        message: "Registration completed successfully",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error("Registration completion error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
      return res.status(200).json({
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/auth/signout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      return res.status(200).json({ message: "Logout successful" });
    });
  });
  app2.get("/api/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.status(200).json({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        phone: user.phone
      });
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/strategies", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const strategies2 = await storage.getStrategies(userId);
      return res.status(200).json(strategies2);
    } catch (error) {
      console.error("Get strategies error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/strategies/deployed", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const strategies2 = await storage.getDeployedStrategies(userId);
      return res.status(200).json(strategies2);
    } catch (error) {
      console.error("Get deployed strategies error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/strategies/:id", isAuthenticated, async (req, res) => {
    try {
      const strategyId = parseInt(req.params.id);
      if (isNaN(strategyId)) {
        return res.status(400).json({ message: "Invalid strategy ID" });
      }
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized to access this strategy" });
      }
      return res.status(200).json(strategy);
    } catch (error) {
      console.error("Get strategy error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/strategies", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const strategyData = insertStrategySchema.safeParse({
        ...req.body,
        userId
      });
      if (!strategyData.success) {
        return res.status(400).json({ message: "Invalid strategy data", errors: strategyData.error.errors });
      }
      const strategy = await storage.createStrategy(strategyData.data);
      return res.status(201).json(strategy);
    } catch (error) {
      console.error("Create strategy error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.patch("/api/strategies/:id", isAuthenticated, async (req, res) => {
    try {
      const strategyId = parseInt(req.params.id);
      if (isNaN(strategyId)) {
        return res.status(400).json({ message: "Invalid strategy ID" });
      }
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized to update this strategy" });
      }
      const updateData = req.body;
      const updatedStrategy = await storage.updateStrategy(strategyId, updateData);
      return res.status(200).json(updatedStrategy);
    } catch (error) {
      console.error("Update strategy error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.delete("/api/strategies/:id", isAuthenticated, async (req, res) => {
    try {
      const strategyId = parseInt(req.params.id);
      if (isNaN(strategyId)) {
        return res.status(400).json({ message: "Invalid strategy ID" });
      }
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized to delete this strategy" });
      }
      await storage.deleteStrategy(strategyId);
      return res.status(200).json({ message: "Strategy deleted successfully" });
    } catch (error) {
      console.error("Delete strategy error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/positions", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const positions2 = await storage.getPositions(userId);
      return res.status(200).json(positions2);
    } catch (error) {
      console.error("Get positions error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/positions/:id", isAuthenticated, async (req, res) => {
    try {
      const positionId = parseInt(req.params.id);
      if (isNaN(positionId)) {
        return res.status(400).json({ message: "Invalid position ID" });
      }
      const position = await storage.getPosition(positionId);
      if (!position) {
        return res.status(404).json({ message: "Position not found" });
      }
      if (position.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized to access this position" });
      }
      return res.status(200).json(position);
    } catch (error) {
      console.error("Get position error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/positions", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const positionData = insertPositionSchema.safeParse({
        ...req.body,
        userId
      });
      if (!positionData.success) {
        return res.status(400).json({ message: "Invalid position data", errors: positionData.error.errors });
      }
      const position = await storage.createPosition(positionData.data);
      return res.status(201).json(position);
    } catch (error) {
      console.error("Create position error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/portfolio", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const latestSnapshot = await storage.getLatestPortfolioSnapshot(userId);
      if (!latestSnapshot) {
        return res.status(404).json({ message: "No portfolio data found" });
      }
      return res.status(200).json(latestSnapshot);
    } catch (error) {
      console.error("Get portfolio error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/portfolio/history", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const limit = req.query.limit ? parseInt(req.query.limit) : 30;
      const snapshots = await storage.getPortfolioSnapshots(userId, limit);
      return res.status(200).json(snapshots);
    } catch (error) {
      console.error("Get portfolio history error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/portfolio/snapshot", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const snapshotData = insertPortfolioSnapshotSchema.safeParse({
        ...req.body,
        userId
      });
      if (!snapshotData.success) {
        return res.status(400).json({ message: "Invalid snapshot data", errors: snapshotData.error.errors });
      }
      const snapshot = await storage.createPortfolioSnapshot(snapshotData.data);
      return res.status(201).json(snapshot);
    } catch (error) {
      console.error("Create portfolio snapshot error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      // "@": path.resolve(import.meta.dirname, "client", "src"),
      // "@shared": path.resolve(import.meta.dirname, "shared"),
      // "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "@hooks": path.resolve(import.meta.dirname, "client", "src/hooks"),
      "@lib": path.resolve(import.meta.dirname, "client", "src/lib")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "../client-dist");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
import os from "os";
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 7e3;
  const localIp = getLocalIp();
  server.listen({
    port,
    host: "0.0.0.0"
    // reusePort: true,
  }, () => {
    log(`Serving on http://localhost:${port} or http://${localIp}:${port}`);
  });
})();
