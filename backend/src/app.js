import cors from "cors";
import express from "express";
import chatRouter from "./routes/chat.js";
import fontsRouter from "./routes/fonts.js";
import knowledgeRouter from "./routes/knowledge.js";

const app = express();

const parseAllowedOrigins = () => {
  const raw = process.env.CORS_ORIGINS || "http://localhost:5173";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.disable("x-powered-by");
app.use(cors(corsOptions));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
});

app.use(express.json());

app.use("/api/chat", chatRouter);
app.use("/api/fonts", fontsRouter);
app.use("/api/knowledge", knowledgeRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "backend" });
});

export default app;
