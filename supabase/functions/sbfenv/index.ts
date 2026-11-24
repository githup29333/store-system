import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://githup29333.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const OWNER = "c7562642-7c60-461b-ac8c-dddcee41d22b";
const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const modules = ["orders", "items", "inventory", "prices", "hotels", "deliveries", "reports", "settings", "audit"];

function cleanPermissions(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const out: Record<string, Record<string, boolean>> = {};
  for (const key of modules) {
    const v = input[key] && typeof input[key] === "object" ? input[key] as Record<string, unknown> : {};
    out[key] = {};
    for (const action of ["read", "create", "update", "delete"]) out[key][action] = v[action] === true;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    if (!serviceKey) return respond({ error: "SERVICE_ROLE_KEY is not configured" }, 503);
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token === authHeader) return respond({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return respond({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "my_status" || action === "change_password") {
      const { data: me, error: meError } = await admin.from("app_users")
        .select("id,username,is_active,is_paralyzed,must_change_password")
        .eq("auth_user_id", user.id).maybeSingle();
      if (meError) throw meError;
      if (!me) return respond({ error: "هذا الحساب غير مسجل ضمن مستخدمي المنظومة" }, 403);
      if (action === "my_status") return respond({ user: me });

      const password = String(body.password || "");
      if (password.length < 8) return respond({ error: "كلمة المرور يجب ألا تقل عن 8 أحرف" }, 400);
      const { error: passError } = await admin.auth.admin.updateUserById(user.id, { password });
      if (passError) throw passError;
      const { error: updateError } = await admin.from("app_users")
        .update({ must_change_password: false }).eq("id", me.id);
      if (updateError) throw updateError;
      await admin.from("app_user_activity").insert({
        app_user_id: me.id, actor_auth_user_id: user.id, actor_username: me.username,
        action: "password_changed", target_username: me.username, details: {},
      });
      return respond({ ok: true });
    }

    if (user.id !== OWNER || user.email?.toLowerCase() !== "mhmdbwft09@gmail.com") {
      return respond({ error: "Owner access only" }, 403);
    }

    if (action === "health") return respond({ ok: true, serviceKeyConfigured: true, ownerVerified: true });

    if (action === "monitor") {
      const [orders, deliveries, users, activity, audit] = await Promise.all([
        admin.from("orders").select("id,kind,created_at,hotel,approved").order("created_at", { ascending: false }).limit(500),
        admin.from("deliveries").select("status,updated_at,hotel,error").order("updated_at", { ascending: false }).limit(500),
        admin.from("app_users").select("id,username,display_name,is_active,is_paralyzed,created_at").order("created_at", { ascending: false }).limit(200),
        admin.from("app_user_activity").select("created_at,actor_username,action,target_username,details").order("created_at", { ascending: false }).limit(40),
        admin.from("admin_audit_log").select("created_at,hotel_code,actor_email,operation,table_name,entity_id").order("created_at", { ascending: false }).limit(40),
      ]);
      for (const result of [orders, deliveries, users, activity, audit]) {
        if (result.error) throw result.error;
      }
      const statuses: Record<string, number> = {};
      for (const row of deliveries.data || []) statuses[row.status || "unknown"] = (statuses[row.status || "unknown"] || 0) + 1;
      const activeUsers = (users.data || []).filter((u: any) => u.is_active && !u.is_paralyzed).length;
      const failedDeliveries = (deliveries.data || []).filter((d: any) => d.status === "failed").length;
      const pendingDeliveries = (deliveries.data || []).filter((d: any) => ["pending", "approved", "sending"].includes(d.status)).length;
      return respond({
        generatedAt: new Date().toISOString(),
        totals: {
          ordersLoaded: (orders.data || []).length,
          deliveriesLoaded: (deliveries.data || []).length,
          users: (users.data || []).length,
          activeUsers,
          failedDeliveries,
          pendingDeliveries,
        },
        deliveryStatuses: statuses,
        recentActivity: activity.data || [],
        recentAudit: audit.data || [],
      });
    }



    if (action === "backup_export") {
      // Explicit allowlist: credentials, hotel access keys, user accounts, app secrets,
      // licenses, profiles and audit/auth internals are deliberately excluded.
      const backupTables = [
        { name: "companies", columns: "id,name,created_at", order: "id" },
        { name: "warehouses", columns: "id,company_id,name,location,created_at", order: "id" },
        { name: "suppliers", columns: "id,company_id,name,contact,created_at", order: "id" },
        { name: "products", columns: "id,company_id,sku,name,category,unit,reorder_level,created_at", order: "id" },
        { name: "purchase_requests", columns: "id,company_id,warehouse_id,requested_by,status,created_at", order: "id" },
        { name: "purchase_request_items", columns: "id,purchase_request_id,product_id,quantity,note", order: "id" },
        { name: "stock_movements", columns: "id,company_id,product_id,warehouse_id,type,quantity,note,created_by,created_at", order: "id" },
        { name: "orders", columns: "id,kind,code,dept,no,device,created_at,hotel,approved,approved_at,approved_by", order: "id" },
        { name: "deliveries", columns: "key,dept,no,ds,dn,code,status,rev,file_path,attempts,error,created_at,updated_at,approved_at,sent_at,hotel,cost_path", order: "key" },
        { name: "items", columns: "id,ar,en,created_at,code,hotels,sku,barcode", order: "id" },
        { name: "prices", columns: "id,code,name,unit,cost,category,archived,created_at,updated_at,estimated", order: "id" },
        { name: "item_price_link", columns: "item_id,price_id,method,score,updated_at", order: "item_id,price_id" },
        { name: "hotel_price_overrides", columns: "hotel_code,item_id,cost,unit,category,source_name,updated_at", order: "hotel_code,item_id" },
        { name: "recipients", columns: "id,kind,name,email,active,created_at,hotel", order: "id" },
        { name: "hotels", columns: "code,name,expires_at,active,created_at", order: "code" },
        { name: "hotel_inventory", columns: "id,hotel_code,item_id,quantity,reorder_level,unit,updated_at", order: "id" },
        { name: "hotel_stock_movements", columns: "id,hotel_code,item_id,movement_type,quantity,unit,note,reference,created_by,created_at", order: "id" },
        { name: "hotel_suppliers", columns: "id,hotel_code,name,contact,phone,email,notes,active,created_at,updated_at", order: "id" },
        { name: "hotel_purchase_orders", columns: "id,hotel_code,supplier_id,order_no,status,notes,created_by,created_at,updated_at,ordered_at,received_at", order: "id" },
        { name: "hotel_purchase_order_items", columns: "id,purchase_order_id,item_id,quantity,unit,unit_cost,received_quantity,note,line_total,created_at", order: "id" },
      ];
      const exported: Record<string, unknown[]> = {};
      const counts: Record<string, number> = {};
      let totalRows = 0;
      const pageSize = 500, tableLimit = 5000, totalLimit = 12000;
      for (const table of backupTables) {
        const rows: unknown[] = [];
        for (let offset = 0; offset < tableLimit; offset += pageSize) {
          let query = admin.from(table.name).select(table.columns);
          for (const column of table.order.split(",")) query = query.order(column, { ascending: true });
          const { data, error } = await query.range(offset, offset + pageSize - 1);
          if (error) throw new Error("Backup read failed for " + table.name + ": " + error.message);
          rows.push(...(data || []));
          if (!data || data.length < pageSize) break;
          if (offset + pageSize >= tableLimit) {
            let extraQuery = admin.from(table.name).select(table.order);
            for (const column of table.order.split(",")) extraQuery = extraQuery.order(column, { ascending: true });
            const { data: extra, error: extraError } = await extraQuery.range(tableLimit, tableLimit);
            if (extraError) throw extraError;
            if (extra?.length) throw new Error("Backup limit reached for " + table.name + "; no partial backup was created");
          }
        }
        totalRows += rows.length;
        if (totalRows > totalLimit) return respond({ error: "Backup is too large for one download. No partial backup was created." }, 413);
        exported[table.name] = rows;
        counts[table.name] = rows.length;
      }
      const backup = {
        format: "store-system-backup",
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        includes: Object.keys(exported),
        excluded: ["auth.users", "app_users", "app_user_activity", "app_secrets", "license", "profiles", "admin_audit_log", "hotels.key"],
        rowCounts: counts,
        tables: exported,
      };
      const canonical = JSON.stringify(backup);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
      const sha256 = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
      const response = JSON.stringify({ ...backup, sha256 });
      if (new TextEncoder().encode(response).length > 4_500_000) {
        return respond({ error: "Backup exceeds the safe download size. No partial backup was created." }, 413);
      }
      return new Response(response, { status: 200, headers: { ...cors, "Content-Disposition": 'attachment; filename="store-system-backup.json"' } });
    }

    if (action === "set_dispatch_token") {
      const githubToken = String(body.token || "").trim();
      if (githubToken.length < 20 || githubToken.length > 255 || /\s/.test(githubToken)) {
        return respond({ error: "Invalid GitHub token format" }, 400);
      }
      const { error } = await admin.from("app_secrets").upsert({
        key: "gh_dispatch", value: githubToken, updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
      if (error) throw error;
      return respond({ ok: true, configured: true });
    }

    if (action === "delete_dispatch_token") {
      const { error } = await admin.from("app_secrets").delete().eq("key", "gh_dispatch");
      if (error) throw error;
      return respond({ ok: true, configured: false });
    }

    if (action === "dispatch_status" || action === "dispatch") {
      const { data: secret, error: secretError } = await admin.from("app_secrets")
        .select("value").eq("key", "gh_dispatch").maybeSingle();
      if (secretError) throw secretError;
      const githubToken = String(secret?.value || "").trim();
      if (action === "dispatch_status") return respond({ configured: !!githubToken });
      if (!githubToken) return respond({ error: "no-token" }, 404);

      const mode = String(body.mode || "send");
      if (!["send", "test", "manual"].includes(mode)) return respond({ error: "Invalid dispatch mode" }, 400);
      const gh = await fetch("https://api.github.com/repos/githup29333/store-system/actions/workflows/send.yml/dispatches", {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer " + githubToken,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main", inputs: { mode } }),
      });
      if (gh.status !== 204) {
        console.error("GitHub workflow dispatch failed with status", gh.status);
        return respond({ error: gh.status === 401 || gh.status === 403 ? "GitHub token rejected or missing Actions permission" : "GitHub dispatch failed" }, 502);
      }
      return respond({ ok: true });
    }

    if (action === "list") {
      const { data, error } = await admin.from("app_users")
        .select("id,auth_user_id,username,display_name,email,is_active,is_paralyzed,permissions,must_change_password,created_at")
        .order("created_at");
      if (error) throw error;
      const { data: logs, error: logError } = await admin.from("app_user_activity")
        .select("*").order("created_at", { ascending: false }).limit(250);
      if (logError) throw logError;
      return respond({ users: data, activity: logs });
    }

    if (action === "create") {
      const username = String(body.username || "").trim().toLowerCase();
      const display_name = String(body.display_name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return respond({ error: "اسم المستخدم يجب أن يكون 3 إلى 32 حرفًا إنجليزيًا أو رقمًا" }, 400);
      if (!display_name || display_name.length > 80) return respond({ error: "اكتب الاسم الظاهر" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: "بريد إلكتروني صحيح مطلوب لتسجيل الدخول" }, 400);
      if (password.length < 8) return respond({ error: "كلمة المرور المؤقتة يجب ألا تقل عن 8 أحرف" }, 400);

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { display_name, username },
        app_metadata: { app_role: "store_user" },
      });
      if (createError || !created.user) throw createError || new Error("Could not create auth user");

      const { data: row, error: insertError } = await admin.from("app_users").insert({
        auth_user_id: created.user.id, username, display_name, email,
        permissions: cleanPermissions(body.permissions), created_by: OWNER,
        is_active: true, is_paralyzed: false, must_change_password: true,
      }).select("id,auth_user_id,username,display_name,email,is_active,is_paralyzed,permissions,must_change_password,created_at").single();
      if (insertError) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw insertError;
      }
      await admin.from("app_user_activity").insert({
        app_user_id: row.id, actor_auth_user_id: OWNER, actor_username: "theo",
        action: "user_created", target_username: username, details: { email },
      });
      return respond({ user: row });
    }

    if (action === "update" || action === "paralyze") {
      const id = String(body.id || "");
      const { data: target, error: targetError } = await admin.from("app_users").select("*").eq("id", id).single();
      if (targetError || !target) return respond({ error: "المستخدم غير موجود" }, 404);
      if (target.auth_user_id === OWNER || target.username === "theo") return respond({ error: "لا يمكن تعديل المالك الأعلى" }, 403);
      let patch: Record<string, unknown> = {};
      if (action === "paralyze") patch = { is_paralyzed: body.value === true };
      else {
        if (body.display_name !== undefined) patch.display_name = String(body.display_name).trim().slice(0, 80);
        if (body.permissions !== undefined) patch.permissions = cleanPermissions(body.permissions);
        if (body.is_active !== undefined) patch.is_active = body.is_active === true;
      }
      const { data: updated, error } = await admin.from("app_users").update(patch).eq("id", id)
        .select("id,auth_user_id,username,display_name,email,is_active,is_paralyzed,permissions,must_change_password,created_at").single();
      if (error) throw error;
      await admin.from("app_user_activity").insert({
        app_user_id: id, actor_auth_user_id: OWNER, actor_username: "theo",
        action: action === "paralyze" ? (body.value ? "user_paralyzed" : "user_unparalyzed") : "user_updated",
        target_username: target.username, details: patch,
      });
      return respond({ user: updated });
    }

    if (action === "reset_password") {
      const id = String(body.id || ""), password = String(body.password || "");
      if (password.length < 8) return respond({ error: "كلمة المرور يجب ألا تقل عن 8 أحرف" }, 400);
      const { data: target, error: targetError } = await admin.from("app_users")
        .select("auth_user_id,username").eq("id", id).single();
      if (targetError || !target || target.auth_user_id === OWNER) return respond({ error: "المستخدم غير موجود أو غير قابل للتعديل" }, 404);
      const { error } = await admin.auth.admin.updateUserById(target.auth_user_id, { password });
      if (error) throw error;
      await admin.from("app_users").update({ must_change_password: true }).eq("id", id);
      await admin.from("app_user_activity").insert({
        app_user_id: id, actor_auth_user_id: OWNER, actor_username: "theo",
        action: "password_reset", target_username: target.username, details: {},
      });
      return respond({ ok: true });
    }

    return respond({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("user-management error", error);
    return respond({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
