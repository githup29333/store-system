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
    const token = authHeader.replace(/^Bearer\\s+/i, "");
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
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return respond({ error: "بريد إلكتروني صحيح مطلوب لتسجيل الدخول" }, 400);
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
