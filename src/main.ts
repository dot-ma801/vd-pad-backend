import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { registerImportScriptRoute } from "./interfaces/controllers/importScriptController";

const app = new Hono();

// Middlewares
app.use(cors());

// Routes
app.get("/", (c) => c.text("OK"));
registerImportScriptRoute(app);

// Start server
serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
