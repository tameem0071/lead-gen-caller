import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

console.log('[Startup] Initializing server...');
console.log('[Startup] Environment:', process.env.NODE_ENV || 'production');
console.log('[Startup] Port:', process.env.PORT || '5000');

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
console.log('[Startup] Configuring middleware...');

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true })); // Required for Twilio webhooks

// Health check endpoint for deployment platforms
app.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// CORS support for testing from Replit console
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log('[Startup] Registering routes and WebSocket servers...');
    const server = await registerRoutes(app);
    console.log('[Startup] Routes registered successfully');

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      console.log('[Startup] Setting up Vite development server...');
      await setupVite(app, server);
      console.log('[Startup] Vite setup complete');
    } else {
      console.log('[Startup] Serving static assets...');
      serveStatic(app);
      console.log('[Startup] Static assets configured');
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    console.log(`[Startup] Starting server on host 0.0.0.0:${port}...`);
    
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      console.log(`[Startup] ✅ Server successfully started on port ${port}`);
      console.log(`[Startup] Health check available at http://0.0.0.0:${port}/health`);
      log(`serving on port ${port}`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      console.error('[Startup] ❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`[Startup] Port ${port} is already in use`);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('[Startup] ❌ Failed to initialize server:', error);
    console.error('[Startup] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
})();
