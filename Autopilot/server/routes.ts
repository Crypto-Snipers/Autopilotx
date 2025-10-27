import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertStrategySchema, insertPositionSchema, insertPortfolioSnapshotSchema } from "@shared/schema";
import session from "express-session";
import memoryStore from "memorystore";
import { z } from "zod";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// OTP verification store
const otpStore = new Map<string, { otp: string, timestamp: number }>();
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const OTP_EXPIRE_TIME = 5 * 60 * 1000; // 5 minutes

export async function registerRoutes(app: Express): Promise<Server> {
  const MemoryStore = memoryStore(session);

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "crypto-snipers-secret",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({
        checkPeriod: MS_PER_DAY,
      }),
      cookie: {
        maxAge: MS_PER_DAY * 7,
        secure: process.env.NODE_ENV === "production",
      },
    })
  );

  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: any) => {
    if (req.session.userId) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  };

  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, phone } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Generate OTP
      const otp = generateOTP();
      otpStore.set(email, { otp, timestamp: Date.now() });

      // In a real app, send OTP via email/SMS
      console.log(`OTP for ${email}: ${otp}`);

      return res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("Signup error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
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

      // OTP verified successfully, remove from store
      otpStore.delete(email);

      return res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
      console.error("OTP verification error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/complete-registration", async (req, res) => {
    try {
      const userData = insertUserSchema.safeParse(req.body);

      if (!userData.success) {
        return res.status(400).json({ message: "Invalid user data", errors: userData.error.errors });
      }

      // Create user
      const user = await storage.createUser(userData.data);

      // Set user in session
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

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // In a real app, compare hashed passwords
      if (user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set user in session
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

  app.post("/api/auth/signout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      return res.status(200).json({ message: "Logout successful" });
    });
  });

  // User routes
  app.get("/api/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId!);

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

  // Strategy routes
  app.get("/api/strategies", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const strategies = await storage.getStrategies(userId!);

      return res.status(200).json(strategies);
    } catch (error) {
      console.error("Get strategies error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/strategies/deployed", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const strategies = await storage.getDeployedStrategies(userId!);

      return res.status(200).json(strategies);
    } catch (error) {
      console.error("Get deployed strategies error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/strategies/:id", isAuthenticated, async (req, res) => {
    try {
      const strategyId = parseInt(req.params.id);

      if (isNaN(strategyId)) {
        return res.status(400).json({ message: "Invalid strategy ID" });
      }

      const strategy = await storage.getStrategy(strategyId);

      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }

      // Check if strategy belongs to user
      if (strategy.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized to access this strategy" });
      }

      return res.status(200).json(strategy);
    } catch (error) {
      console.error("Get strategy error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/strategies", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;

      // Add userId to request body
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

  app.patch("/api/strategies/:id", isAuthenticated, async (req, res) => {
    try {
      const strategyId = parseInt(req.params.id);

      if (isNaN(strategyId)) {
        return res.status(400).json({ message: "Invalid strategy ID" });
      }

      const strategy = await storage.getStrategy(strategyId);

      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }

      // Check if strategy belongs to user
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

  app.delete("/api/strategies/:id", isAuthenticated, async (req, res) => {
    try {
      const strategyId = parseInt(req.params.id);

      if (isNaN(strategyId)) {
        return res.status(400).json({ message: "Invalid strategy ID" });
      }

      const strategy = await storage.getStrategy(strategyId);

      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }

      // Check if strategy belongs to user
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

  // Position routes
  app.get("/api/positions", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const positions = await storage.getPositions(userId!);

      return res.status(200).json(positions);
    } catch (error) {
      console.error("Get positions error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/positions/:id", isAuthenticated, async (req, res) => {
    try {
      const positionId = parseInt(req.params.id);

      if (isNaN(positionId)) {
        return res.status(400).json({ message: "Invalid position ID" });
      }

      const position = await storage.getPosition(positionId);

      if (!position) {
        return res.status(404).json({ message: "Position not found" });
      }

      // Check if position belongs to user
      if (position.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized to access this position" });
      }

      return res.status(200).json(position);
    } catch (error) {
      console.error("Get position error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/positions", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;

      // Add userId to request body
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

  // Portfolio routes
  app.get("/api/portfolio", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
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

  app.get("/api/portfolio/history", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;

      const snapshots = await storage.getPortfolioSnapshots(userId, limit);

      return res.status(200).json(snapshots);
    } catch (error) {
      console.error("Get portfolio history error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/portfolio/snapshot", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;

      // Add userId to request body
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

  const httpServer = createServer(app);
  return httpServer;
}

