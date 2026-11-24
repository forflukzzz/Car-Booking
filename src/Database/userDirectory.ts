import { supabase } from "./supabase";

export type DirectoryRole = "user" | "manager" | "admin";
export type DirectoryUser = { id: number; name: string; uid: string; role: DirectoryRole; mustChangePassword?: boolean };
export type PasswordResetRequest = { id: number; userId: number; name: string; uid: string; status: "pending" | "approved" | "rejected"; temporaryPassword?: string; createdAt: string; approvedAt?: string };
const localUserKey = "car_booking_user";

export const getStoredDirectoryUser = (): DirectoryUser | null => {
  try { return JSON.parse(localStorage.getItem(localUserKey) || "null") as DirectoryUser | null; }
  catch { return null; }
};
export const clearStoredDirectoryUser = () => localStorage.removeItem(localUserKey);
export const saveSignedInUser = (user: DirectoryUser) => localStorage.setItem(localUserKey, JSON.stringify(user));

const toDirectoryUser = (value: { id: number; name: string; uid: string; role: string; must_change_password?: boolean }): DirectoryUser => ({
  id: value.id, name: value.name, uid: value.uid,
  mustChangePassword: value.must_change_password === true,
  role: ["admin", "administrator", "administater"].includes(value.role.toLowerCase())
    ? "admin"
    : value.role.toLowerCase() === "manager" ? "manager" : "user",
});

export const readSignedInDirectoryUser = async (authUserId: string): Promise<DirectoryUser | null> => {
  const { data, error } = await supabase.from("user_directory").select("id, name, uid, role, must_change_password").eq("auth_user_id", authUserId).maybeSingle();
  if (error) throw error;
  return data ? toDirectoryUser(data) : null;
};

export const validateUid = (uid: string) => {
  const normalizedUid = uid.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,64}$/.test(normalizedUid)) throw new Error("Invalid UID format");
  return normalizedUid;
};

export const signInWithUid = async (uid: string, password: string) => {
  const normalizedUid = validateUid(uid);
  const { data, error } = await supabase.from("user_directory").select("id, name, uid, password, role, must_change_password").eq("uid", normalizedUid).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Invalid UID or password");
  const user = toDirectoryUser(data);
  if (user.role === "admin") {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: `u-${normalizedUid}@login.carbooking.invalid`, password });
    if (authError || !authData.user) throw new Error(authError?.message || "Admin login failed");
  } else if (data.password !== password) {
    throw new Error("Invalid UID or password");
  }
  saveSignedInUser(user);
  return user;
};

export const readDirectoryUsers = async (): Promise<DirectoryUser[]> => {
  const { data, error } = await supabase.from("user_directory").select("id, name, uid, role").order("created_at");
  if (error) throw error;
  return (data ?? []).map(toDirectoryUser);
};

export const createDirectoryUser = async (user: { name: string; uid: string; password: string; role: DirectoryRole }) => {
  const normalizedUid = validateUid(user.uid);
  if (user.password.length < 6) throw new Error("Password must contain at least 6 characters");
  const { data, error } = await supabase.from("user_directory").insert({ name: user.name.trim(), uid: normalizedUid, password: user.password, role: user.role, must_change_password: true }).select("id, name, uid, role, must_change_password").single();
  if (error) throw new Error(`Could not add user: ${error.message}`);
  return toDirectoryUser(data);
};

export const updateDirectoryUser = async (id: number, changes: Partial<Pick<DirectoryUser, "name" | "uid" | "role">> & { password?: string }) => {
  const update = changes.password ? { ...changes, must_change_password: true } : changes;
  const { data, error } = await supabase.from("user_directory").update(update).eq("id", id).select("id, name, uid, role, must_change_password").single();
  if (error) throw error;
  return toDirectoryUser(data);
};

export const changeDirectoryPassword = async (uid: string, currentPassword: string, newPassword: string) => {
  const normalizedUid = validateUid(uid);
  if (newPassword.length < 6) throw new Error("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
  if (newPassword === currentPassword) throw new Error("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม");
  const { data, error } = await supabase.from("user_directory").select("id, role").eq("uid", normalizedUid).single();
  if (error || !data) throw new Error("ไม่พบข้อมูลผู้ใช้");
  if (String(data.role).toLowerCase() === "admin") {
    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
    if (authError) throw new Error(authError.message);
  }
  const { error: updateError } = await supabase.from("user_directory").update({ password: newPassword, must_change_password: false }).eq("id", data.id);
  if (updateError) throw updateError;
};

export const requestPasswordReset = async (uid: string) => {
  const normalizedUid = validateUid(uid);
  const { data: user, error: userError } = await supabase.from("user_directory").select("id, name, uid").eq("uid", normalizedUid).maybeSingle();
  if (userError || !user) throw new Error("ไม่พบผู้ใช้งานจาก UID นี้");
  const { error } = await supabase.from("password_reset_requests").insert({ user_id: user.id, uid: user.uid, user_name: user.name, status: "pending" });
  if (error && error.code !== "23505") throw error;
};

export const readPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
  const { data, error } = await supabase.from("password_reset_requests").select("id, user_id, uid, user_name, status, temporary_password, created_at, approved_at").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((request) => ({ id: request.id, userId: request.user_id, name: request.user_name, uid: request.uid, status: request.status, temporaryPassword: request.temporary_password || undefined, createdAt: request.created_at, approvedAt: request.approved_at || undefined }));
};

export const approvePasswordReset = async (requestId: number, temporaryPassword: string) => {
  if (temporaryPassword.trim().length < 6) throw new Error("รหัสชั่วคราวต้องมีอย่างน้อย 6 ตัวอักษร");
  const { data: request, error: requestError } = await supabase.from("password_reset_requests").select("user_id, status").eq("id", requestId).single();
  if (requestError || !request) throw new Error("ไม่พบคำขอเปลี่ยนรหัสผ่าน");
  if (request.status !== "pending") throw new Error("คำขอนี้ดำเนินการไปแล้ว");
  const { error: userError } = await supabase.from("user_directory").update({ password: temporaryPassword.trim(), must_change_password: true }).eq("id", request.user_id);
  if (userError) throw userError;
  const { error } = await supabase.from("password_reset_requests").update({ status: "approved", temporary_password: temporaryPassword.trim(), approved_at: new Date().toISOString() }).eq("id", requestId);
  if (error) throw error;
};

export const deleteDirectoryUser = async (id: number) => {
  const { error } = await supabase.from("user_directory").delete().eq("id", id);
  if (error) throw error;
};
