import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import authRoutes from "./modules/auth/auth.routes.js";
import exerciseRoutes from "./modules/exercises/exercise.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";

const app = express();

app.set("trust proxy", env.TRUST_PROXY);

app.use(helmet());

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "EnglishByEar API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/exercises", exerciseRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Centralized error handler
app.use(errorHandler);

export default app;
