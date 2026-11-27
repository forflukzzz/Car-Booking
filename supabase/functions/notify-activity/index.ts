import webpush from "npm:web-push";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!url || !key || !vapidPublicKey || !vapidPrivateKey) return json(500, { error: "Missing push notification secrets" });
  let activity: { type?: string; requester?: string; requesterUid?: string; model?: string; plate?: string; issueReport?: string };
  try { activity = await request.json(); } catch { return json(400, { error: "Invalid request body" }); }
  if (activity.type !== "issue" || !activity.model || !activity.plate || !activity.issueReport) return json(400, { error: "Invalid vehicle issue notification" });
  const title = "พบปัญหาระหว่างใช้งานรถ";
  const name = String(activity.requester || "ผู้ใช้งาน").replace(/\s*\(UID:\s*[^)]+\)\s*$/i, "").trim();
  const body = `รุ่นรถ: ${activity.model} | ทะเบียน: ${activity.plate} | ผู้ใช้: ${name} | ปัญหา: ${activity.issueReport}`;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: subscriptions, error } = await admin.from("push_subscriptions").select("id, user_uid, endpoint, p256dh, auth").eq("enabled", true);
  if (error) return json(500, { error: error.message });
  const { data: managers } = await admin.from("user_directory").select("uid").ilike("role", "manager");
  const managerUids = new Set((managers || []).map((manager) => String(manager.uid).trim()));
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com", vapidPublicKey, vapidPrivateKey);
  await Promise.all((subscriptions || []).filter((item) => managerUids.has(String(item.user_uid).trim()) && item.user_uid !== activity.requesterUid).map(async (item) => {
    try { await webpush.sendNotification({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }, JSON.stringify({ title, body, url: "/history" })); }
    catch (sendError) { if (sendError instanceof Error && sendError.message.includes("410")) await admin.from("push_subscriptions").delete().eq("id", item.id); }
  }));
  return json(200, { sent: subscriptions?.length || 0 });
});
