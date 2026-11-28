import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
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
    if (length > 80000) return respond({ error: "Request too large" }, 413);

    const body = await req.json();
    const action = String(body.action || "");
    if (action === "receipt_get" || action === "receipt_confirm") {
      const rawToken = String(body.t || "");
      if (!/^[a-f0-9]{64}$/.test(rawToken)) return respond({ error: "Invalid receipt link" }, 400);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
      const tokenHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      if (action === "receipt_get") {
        const { data, error } = await admin.rpc("hotel_receipt_get", { p_token_hash: tokenHash });
        if (error || !data) return respond({ error: "Receipt link not found or expired" }, 404);
        const fields = String(data.code || "").split("|");
        if (fields.length < 10 || fields[0] !== "EBR1F") return respond({ error: "Invalid order data" }, 404);
        const custom = new Map();
        String(fields[9] || "").split(";").filter(Boolean).forEach(line => {
          const p = line.split("~");
          if (p.length >= 2) custom.set(p[0], { ar: p[1] || "", unit: p[2] || "" });
        });
        const rawLines = String(fields[6] || "").split(",").filter(Boolean).map(line => {
          const p = line.split(":");
          if (p.length < 4 || !/^\\d+$/.test(p[0])) return null;
          return { id: Number(p[0]), requested: Number(p[1]), issued: Number(p[2]), unit: p[3] || "" };
        });
        if (!rawLines.length || rawLines.some(x => !x || !Number.isSafeInteger(x.id) ||
          !Number.isFinite(x.requested) || !Number.isFinite(x.issued))) {
          return respond({ error: "Invalid order items" }, 404);
        }
        const { data: catalog } = await admin.from("items").select("id,ar,en").in("id", rawLines.map(x => x.id));
        const byId = new Map((catalog || []).map(x => [Number(x.id), x]));
        const items = rawLines.map(x => {
          const base = byId.get(x.id) || {}, extra = custom.get(String(x.id)) || {};
          return { ...x, name_ar: extra.ar || base.ar || ("Item " + x.id),
            name_en: base.en || "", unit: extra.unit || x.unit };
        });
        return respond({ ...data, items });
      }
      const name = String(body.name || "").trim();
      if (name.length < 2 || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) {
        return respond({ error: "Enter a valid recipient name" }, 400);
      }
      if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 500) {
        return respond({ error: "Review every item before confirming" }, 400);
      }
      const items = [];
      for (const row of body.items) {
        const id = Number(row?.id), received = Number(row?.received);
        if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(received) ||
            received < 0 || received > 999999999 || row?.reviewed !== true) {
          return respond({ error: "Invalid or unreviewed receipt item" }, 400);
        }
        items.push({ id: String(id), received: String(received), reviewed: true });
      }
      const signature = String(body.signature || "");
      if (signature.length > 60000 ||
          !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
        return respond({ error: "A valid drawn signature is required" }, 400);
      }
      const { data, error } = await admin.rpc("hotel_receipt_confirm", {
        p_token_hash: tokenHash, p_name: name, p_items: items, p_signature: signature,
      });
      if (error || !data) return respond({ error: "Unable to confirm receipt" }, 400);
      return respond(data);
    }

    const supplied = String(body.k || "");
    if (!["hotel_info", "hotel_items", "hotel_add_item", "hotel_log", "hotel_receipt_issue", "receipt_get", "receipt_confirm"].includes(action)) {
      return respond({ error: "Unknown action" }, 400);
    }
    let key = "";
    if (/^[A-Za-z0-9_-]{32}$/.test(supplied)) {
      // Backward compatibility for existing full-key links.
      key = supplied;
    } else if (/^[A-Za-z0-9_-]{2,24}$/.test(supplied)) {
      // Short path slug (e.g. /ebr) resolves to the private hotel key server-side.
      const { data: row, error: lookupError } = await admin
        .from("hotels").select("key").eq("code", supplied.toUpperCase()).eq("active", true).maybeSingle();
      if (lookupError) {
        console.error("hotel slug lookup failed");
        return respond({ error: "Unable to validate hotel access" }, 503);
      }
      key = String(row?.key || "");
    }
    if (!/^[A-Za-z0-9_-]{32}$/.test(key)) return respond({ error: "Invalid hotel link" }, 401);

    // Resolve and validate the private hotel credential server-side.
    const { data: hotel, error: hotelError } = await admin.rpc("hotel_info", { k: key });
    if (hotelError) {
      console.error("hotel portal key check failed");
      return respond({ error: "Unable to validate hotel access" }, 503);
    }
    if (!hotel) return respond({ error: "Invalid or expired hotel access" }, 401);
    if (action === "hotel_receipt_issue") {
      const no = String(body.p_no || "");
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(no)) return respond({ error: "Invalid order number" }, 400);
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const token = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      const tokenHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      const { error } = await admin.rpc("hotel_receipt_issue", {
        k: key, p_no: no, p_token_hash: tokenHash,
      });
      if (error) {
        console.warn("hotel_receipt_issue rejected a request");
        return respond({ error: "Unable to create receipt link" }, 400);
      }
      return respond({ ok: true, token });
    }
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
