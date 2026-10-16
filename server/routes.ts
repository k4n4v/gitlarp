import { Hono } from "hono";
import { buildPreview, getToken, runPush } from "./planService.js";
import { parsePlanBody } from "./types.js";

export const api = new Hono();

api.get("/health", (c) => {
  return c.json({
    ok: true,
    tokenConfigured: Boolean(getToken()),
  });
});

api.post("/preview", async (c) => {
  try {
    const body = parsePlanBody(await c.req.json());
    const preview = await buildPreview(body);
    return c.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

api.post("/push", async (c) => {
  try {
    const body = parsePlanBody(await c.req.json());
    const result = await runPush(body);
    return c.json({
      ok: true,
      ...result,
      message: `Pushed ${result.commits} commit(s) to ${result.repo}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});
