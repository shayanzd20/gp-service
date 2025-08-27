// src/server.ts
import express from "express";
import morgan from "morgan";
import "dotenv/config";
import { getInstagramGraphqlData } from "./igServiceWithoutCookie";
import { getInstagramDataByCookie } from "./igServiceWithCookie";
const PORT = Number(process.env.PORT ?? 3000);
const app = express();
app.use(morgan("dev"));
app.get("/api/instagram", async (req, res) => {
    const url = String(req.query.url ?? "");
    if (!url)
        return res
            .status(400)
            .json({ ok: false, error: "Query param 'url' is required." });
    try {
        const result = await getInstagramGraphqlData(url);
        if (!result.ok)
            return res.status(result.status).json(result);
        return res.json(result);
    }
    catch (err) {
        return res
            .status(500)
            .json({ ok: false, error: "Internal error", details: err?.message });
    }
});
/**
 * NEW: cookie-based endpoint
 * GET /api/instagram/by-cookie?url=...
 * Optionally override the cookie per request:
 *   - Header: x-ig-cookie: "sessionid=...; ds_user_id=...; csrftoken=...; ..."
 *   - Body (POST): { url: "...", cookie: "..." }
 */
app.get("/api/instagram/by-cookie", async (req, res) => {
    const url = String(req.query.url ?? "");
    if (!url)
        return res
            .status(400)
            .json({ ok: false, error: "Query param 'url' is required." });
    try {
        const cookieOverride = req.header("x-ig-cookie") ?? undefined;
        const result = await getInstagramDataByCookie(url, { cookieOverride });
        if (!result.ok)
            return res.status(result.status).json(result);
        return res.json(result);
    }
    catch (err) {
        return res
            .status(500)
            .json({ ok: false, error: "Internal error", details: err?.message });
    }
});
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => {
    console.log(`IG API listening on http://localhost:${PORT}`);
});
