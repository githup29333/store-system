import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://githup29333.github.io",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Vary": "Origin",
};
const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  if (!serviceKey) return respond({ error: "Service unavailable" }, 503);

  try {
    const length = Number(req.headers.get("content-length") || "0");
    if (length > 40000) return respond({ error: "Request too large" }, 413);

    const body = await req.json();
    const action = String(body.action || "");
    const key = String(body.k || "");
    if (!["hotel_info", "hotel_items", "hotel_add_item", "hotel_log"].includes(action)) {
      return respond({ error: "Unknown action" }, 400);
    }
    if (!/^[A-Za-z0-9_-]{32}$/.test(key)) return respond({ error: "Invalid hotel key" }, 401);

    // The hotel key is a 32-character bearer credential. Validate it server-side
    // before using the service-role client for any hotel-scoped operation.
    const { data: hotel, error: hotelError } = await admin.rpc("hotel_info", { k: key });
    if (hotelError) {
      console.error("hotel portal key check failed");
      return respond({ error: "Unable to validate hotel access" }, 503);
    }
    if (!hotel) return respond({ error: "Invalid or expired hotel access" }, 401);
    if (action === "hotel_info") return respond(hotel);

    if (action === "hotel_items") {
      const { data, error } = await admin.rpc("hotel_items", { k: key });
      if (error) {
        console.error("hotel_items failed");
        return respond({ error: "Unable to load hotel items" }, 500);
      }
      return respond(data || []);
    }

    if (action === "hotel_add_item") {
      const ar = String(body.p_ar || "").trim();
      const en = String(body.p_en || "").trim();
      if (!ar || ar.length > 120 || en.length > 120) {
        return respond({ error: "Invalid item name" }, 400);
      }
      const { data, error } = await admin.rpc("hotel_add_item", { k: key, p_ar: ar, p_en: en });
      if (error) {
        console.error("hotel_add_item failed");
        return respond({ error: "Unable to add item" }, 400);
      }
      return respond(data || []);
    }

    const kind = String(body.p_kind || "");
    const code = String(body.p_code || "");
    const dept = String(body.p_dept || "");
    const no = String(body.p_no || "");
    const device = String(body.p_device || "");
    if (!["request", "final"].includes(kind) || !code || code.length > 30000 ||
        !/^[A-Za-z0-9_-]{1,16}$/.test(dept) || !/^[A-Za-z0-9_-]{1,64}$/.test(no) ||
        device.length > 40) {
      return respond({ error: "Invalid order payload" }, 400);
    }
    const { error } = await admin.rpc("hotel_log", {
      k: key, p_kind: kind, p_code: code, p_dept: dept, p_no: no, p_device: device,
    });
    if (error) {
      const message = String(error.message || "");
      if (message.includes("invalid key")) return respond({ error: "Invalid or expired hotel access" }, 401);
      console.warn("hotel_log rejected an order payload");
      return respond({ error: "Order data was rejected by validation" }, 400);
    }
    return respond({ ok: true });
  } catch (_error) {
    console.error("hotel portal request failed");
    return respond({ error: "Invalid request" }, 400);
  }
});
