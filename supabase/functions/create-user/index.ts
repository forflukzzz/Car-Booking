import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing Supabase Function secrets" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return json(401, { error: "ต้องเข้าสู่ระบบก่อนเพิ่มผู้ใช้" });

  const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
  if (authError || !authData.user) return json(401, { error: "Session ไม่ถูกต้องหรือหมดอายุ" });

  const { data: adminUser, error: adminError } = await adminClient
    .from("user_directory")
    .select("role")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (adminError) return json(500, { error: adminError.message });
  const adminRole = String(adminUser?.role ?? "").toLowerCase();
  if (!["admin", "administrator", "administater"].includes(adminRole)) return json(403, { error: "เฉพาะผู้ดูแลระบบเท่านั้นที่เพิ่มผู้ใช้ได้" });

  let input: { name?: string; uid?: string; role?: string; password?: string };
  try {
    input = await request.json();
  } catch {
    return json(400, { error: "Invalid request body" });
  }

  const name = input.name?.trim() ?? "";
  const uid = input.uid?.trim().toLowerCase() ?? "";
  const password = input.password ?? "";
  const role = input.role === "admin" ? "admin" : input.role === "user" ? "user" : null;

  if (!name || name.length > 120 || !/^[a-z0-9._-]{2,64}$/.test(uid) || !role || password.length < 6) {
    return json(400, { error: "Invalid name, UID, role, or password (minimum 6 characters)" });
  }

  const email = `u-${uid}@login.carbooking.invalid`;
  const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { uid },
  });

  if (createAuthError || !createdAuth.user) {
    return json(400, { error: createAuthError?.message ?? "Could not create login account" });
  }

  const { data: directoryUser, error: directoryError } = await adminClient
    .from("user_directory")
    .insert({ name, uid, role, auth_user_id: createdAuth.user.id })
    .select("id, name, uid, role")
    .single();

  if (directoryError) {
    await adminClient.auth.admin.deleteUser(createdAuth.user.id);
    return json(400, { error: directoryError.message });
  }

  return json(201, directoryUser);
});
