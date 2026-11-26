import { useState, type FormEvent } from "react";
import { changeDirectoryPassword, requestPasswordReset, signInWithUid, type DirectoryUser } from "../../Database/userDirectory";
import logo from "../../assets/img/logo.png";
import carImage from "../../assets/img/carlogo.png";
import "./login.css";

type LoginProps = { onSignedIn: (user: DirectoryUser) => void };

export default function Login({ onSignedIn }: LoginProps) {
  const [uid, setUid] = useState("");
  const [password, setPassword] = useState("");
  const [pendingUser, setPendingUser] = useState<DirectoryUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotUid, setForgotUid] = useState("");
  const [resetRequested, setResetRequested] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isShortPasswordError = /อย่างน้อย 6/.test(error);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!uid.trim() || !password) throw new Error("กรุณากรอกข้อมูลให้ครบถ้วน");
      if (password.length < 6) throw new Error("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      const user = await signInWithUid(uid, password);
      if (user.mustChangePassword) {
        setPendingUser(user);
        setError("");
      } else onSignedIn(user);
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : "";
      setError(/อย่างน้อย 6|at least 6/i.test(message)
        ? "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร"
        : /invalid uid|invalid password|login failed|รหัสผ่าน/i.test(message)
          ? "รหัสผ่านไม่ถูกต้อง หรือยังไม่มีบัญชีในระบบ กรุณาติดต่อผู้ดูแลระบบ"
          : message || "เข้าสู่ระบบไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingUser) return;
    setError("");
    setBusy(true);
    try {
      if (newPassword.length < 6) throw new Error("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      if (newPassword !== confirmPassword) throw new Error("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      await changeDirectoryPassword(pendingUser.uid, password, newPassword);
      onSignedIn({ ...pendingUser, mustChangePassword: false });
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const submitForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await requestPasswordReset(forgotUid);
      setResetRequested(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "ส่งคำขอเปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return <main className="uid-login-page">
    <img className="uid-login-brand" src={logo} alt="Cauley" />
    <div className="uid-login-circle" aria-hidden="true" />
    <img className="uid-login-car" src={carImage} alt="" aria-hidden="true" />
    <section className="uid-login-panel">
      <div className="uid-login-heading"><span>Welcome To</span><h1>Car Booking</h1></div>
      {pendingUser ? <form className="uid-login-form" onSubmit={changePassword}>
        <p className="uid-login-password-notice">นี่เป็นการเข้าสู่ระบบครั้งแรก กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน</p>
        <label className="uid-login-field"><span className="sr-only">New password</span><input name="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="รหัสผ่านใหม่ :" required /></label>
        <label className="uid-login-field"><span className="sr-only">Confirm new password</span><input name="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="ยืนยันรหัสผ่านใหม่ :" required /></label>
        <button className="uid-login-submit" type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่านและเข้าใช้งาน"}</button>
      </form> : forgotMode ? <form className="uid-login-form" onSubmit={submitForgotPassword}>
        <p className="uid-login-password-notice">{resetRequested ? "ส่งคำขอแล้ว กรุณารอผู้ดูแลระบบอนุมัติและแจ้งรหัสชั่วคราว" : "กรอก UID เพื่อส่งคำขอเปลี่ยนรหัสผ่านให้ผู้ดูแลระบบ"}</p>
        {!resetRequested && <><label className="uid-login-field"><span className="sr-only">Username</span><input name="forgot-uid" autoComplete="username" value={forgotUid} onChange={(event) => setForgotUid(event.target.value)} placeholder="Username :" required /></label><button className="uid-login-submit" type="submit" disabled={busy}>{busy ? "กำลังส่งคำขอ..." : "ส่งคำขอเปลี่ยนรหัสผ่าน"}</button></>}
        <button className="uid-login-secondary" type="button" onClick={() => { setForgotMode(false); setResetRequested(false); setError(""); }}>กลับไปหน้าเข้าสู่ระบบ</button>
      </form> : <form className="uid-login-form" onSubmit={submit}>
        <label className="uid-login-field"><span className="sr-only">Username</span><input id="login-uid" name="uid" autoComplete="username" value={uid} onChange={(event) => setUid(event.target.value)} placeholder="Username :" required /></label>
        <label className="uid-login-field"><span className="sr-only">Password</span><input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password :" required /></label>
        {error && <p className="uid-login-error" role="alert">{error}</p>}
        <button className="uid-login-submit" type="submit" disabled={busy}>{busy ? "Loading..." : "เข้าสู่ระบบ"}</button>
        <button className="uid-login-secondary" type="button" onClick={() => { setForgotMode(true); setError(""); }}>ลืมรหัสผ่าน?</button>
      </form>}
    </section>
    {error && <div className="uid-login-error-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setError(""); }}>
      <section className={`uid-login-error-dialog${isShortPasswordError ? " uid-login-error-dialog--warning" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby="uid-login-error-title">
        <div className="uid-login-error-icon" aria-hidden="true">{isShortPasswordError ? "i" : "!"}</div>
        <h2 id="uid-login-error-title">{isShortPasswordError ? "รหัสผ่านไม่ครบถ้วน" : pendingUser ? "ไม่สามารถเปลี่ยนรหัสผ่านได้" : "เข้าสู่ระบบไม่สำเร็จ"}</h2>
        <p>{error}</p>
        <button type="button" onClick={() => setError("")}>ปิด</button>
      </section>
    </div>}
  </main>;
}
