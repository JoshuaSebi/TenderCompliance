import "dotenv/config";

import express from "express";
import cors from "cors";
import uploadRouter from "./routes/upload.js";
import validateRouter from "./routes/validate.js";

const app = express();
const PORT = 4000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", uploadRouter);
app.use("/api", validateRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});