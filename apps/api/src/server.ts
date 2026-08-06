import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { app } from "./app.js";
import { env } from "./config.js";
import { bootstrapAdmin } from "./bootstrap-admin.js";
import { ensureSubscriptionCatalog, expireSubscriptionData } from "./services/subscription.service.js";
import { logger } from "./lib/logger.js";
const server = createServer(app); const io = new Server(server, { cors: { origin: env.CORS_ORIGIN } }); app.set("io", io);
io.use((socket, next) => { try { socket.data.user = jwt.verify(socket.handshake.auth.token, env.JWT_ACCESS_SECRET) as { id: string; role: string }; next(); } catch { next(new Error("UNAUTHENTICATED")); } });
io.on("connection", (socket) => { const user = socket.data.user; socket.join(`user:${user.id}`); if (user.role === "RIDER") socket.join("riders"); if (user.role === "ADMIN") socket.join("admins"); });

const RETRY_BOOTSTRAP_MS = 30_000;

async function initializeDatabaseState(): Promise<void> {
  try {
    await Promise.all([bootstrapAdmin(), ensureSubscriptionCatalog(), expireSubscriptionData()]);
    logger.info("Database startup tasks completed.");
  } catch (error) {
    // The HTTP process must remain reachable while Render/database networking recovers.
    // Requests will still surface their normal API errors; this retry only handles optional
    // bootstrap and catalog synchronization work.
    logger.error({ error }, "Database startup tasks failed; retrying.");
    setTimeout(() => void initializeDatabaseState(), RETRY_BOOTSTRAP_MS);
  }
}

server.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "MotoYa API listening");
  void initializeDatabaseState();
  setInterval(() => {
    void expireSubscriptionData().catch((error) => logger.error({ error }, "Subscription expiration task failed."));
  }, 15 * 60_000);
});
