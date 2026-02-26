import express from "express";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PERSISTENT_DIR = process.env.PERSISTENT_DIR || ".";
if (PERSISTENT_DIR !== "." && !fs.existsSync(PERSISTENT_DIR)) {
  fs.mkdirSync(PERSISTENT_DIR, { recursive: true });
}

const dbPath = path.join(PERSISTENT_DIR, "notifications.db");
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT UNIQUE,
    p256dh TEXT,
    auth TEXT,
    country TEXT
  )
`);

// VAPID keys should be generated once and persisted
const VAPID_FILE = path.join(PERSISTENT_DIR, "vapid-keys.json");
let vapidKeys: { publicKey: string; privateKey: string };

if (fs.existsSync(VAPID_FILE)) {
  vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys));
}

webpush.setVapidDetails(
  "mailto:example@yourdomain.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Logging middleware at the very top to see ALL requests
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      hasApiKey: !!process.env.VITE_GEMINI_API_KEY 
    });
  });

  app.get("/api/config", (req, res) => {
    res.json({ 
      hasApiKey: !!process.env.VITE_GEMINI_API_KEY,
      apiKey: process.env.VITE_GEMINI_API_KEY || "" 
    });
  });

  app.get("/api/vapid-public-key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post("/api/subscribe", (req, res) => {
    const { subscription, country } = req.body;
    const { endpoint, keys } = subscription;
    
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO subscriptions (endpoint, p256dh, auth, country)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(endpoint, keys.p256dh, keys.auth, country);
      res.status(201).json({ message: "Subscribed successfully" });
    } catch (error) {
      console.error("Subscription error:", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  // Background task to simulate checking for new results
  // In a real app, this would call fetchLotteryResults and compare with previous state
  setInterval(async () => {
    const countries = ["Togo", "Bénin", "Côte d'Ivoire"];
    for (const country of countries) {
      // Simulate finding a new result
      const subscriptions = db.prepare("SELECT * FROM subscriptions WHERE country = ?").all(country);
      
      if (subscriptions.length > 0) {
        const payload = JSON.stringify({
          title: `Nouveau résultat : ${country}`,
          body: `Un nouveau tirage vient d'être publié pour ${country} !`,
          icon: "/icon.png"
        });

        for (const sub of subscriptions as any[]) {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          webpush.sendNotification(pushSubscription, payload).catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              // Subscription expired or no longer valid
              db.prepare("DELETE FROM subscriptions WHERE endpoint = ?").run(sub.endpoint);
            } else {
              console.error("Error sending notification:", err);
            }
          });
        }
      }
    }
  }, 60000); // Check every minute (simulated)

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    console.log("Production mode: serving static files from", distPath);
    
    // Serve static files from dist
    app.use(express.static(distPath));

    // SPA fallback: serve index.html for any other route
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        // Disable caching for index.html to ensure users always get the latest version
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`Build artifacts not found. Please check Render build logs.`);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
