import { useEffect, useState, type FormEvent } from "react";
import type { Car, CarStatus } from "../../Database/carStorage";
import type { DirectoryRole, DirectoryUser, PasswordResetRequest } from "../../Database/userDirectory";
import carLogo from "../../assets/img/carlogo.png";
import "./setting.css";

type NewCar = Pick<Car, "plate" | "model" | "mileage" | "status">;
type SettingProps = {
  users: DirectoryUser[];
  cars: Car[];
  carLoadError: string;
  passwordResetRequests: PasswordResetRequest[];
  onApprovePasswordReset: (requestId: number, temporaryPassword: string) => Promise<void>;
  onAddUser: (user: { name: string; uid: string; password: string; role: DirectoryRole }) => Promise<void>;
  onUpdateUser: (id: number, changes: { name?: string; uid?: string; password?: string; role?: DirectoryRole }) => Promise<void>;
  onDeleteUser: (id: number) => Promise<void>;
  onAddCar: (car: NewCar, imageFile: File | null) => Promise<void>;
  onUpdateCar: (id: number, car: NewCar, imageFile: File | null) => Promise<void>;
  onDeleteCar: (id: number) => Promise<void>;
};

const UserIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;

const getThaiSettingsError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (/duplicate key|unique constraint|already exists/.test(normalized)) {
    return /name/.test(normalized)
      ? "ชื่อนี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบข้อมูล"
      : "UID นี้มีอยู่ในระบบแล้ว กรุณาใช้ UID อื่น";
  }
  if (/invalid uid/.test(normalized)) return "รูปแบบ UID ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
  if (/password.*(6|characters)|minimum 6/.test(normalized)) return "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
  if (/row-level security|permission denied|not allowed/.test(normalized)) return "ไม่มีสิทธิ์ดำเนินการนี้ กรุณาตรวจสอบสิทธิ์ผู้ดูแลระบบ";
  if (/failed to fetch|network|fetch error/.test(normalized)) return "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต";
  if (/invalid input syntax|violates check constraint/.test(normalized)) return "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
  return fallback;
};

export default function Setting({ users, cars, carLoadError, passwordResetRequests, onApprovePasswordReset, onAddUser, onUpdateUser, onDeleteUser, onAddCar, onUpdateCar, onDeleteCar }: SettingProps) {
  const visibleUsers = users.filter((user) => user.role !== "admin");
  const [activeMode, setActiveMode] = useState<"user" | "car" | "reset">("user");
  const [name, setName] = useState("");
  const [uid, setUid] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<DirectoryRole>("user");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [carStatus, setCarStatus] = useState<CarStatus>("available");
  const [editingCarId, setEditingCarId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDeleteUser, setPendingDeleteUser] = useState<DirectoryUser | null>(null);
  const [pendingDeleteCar, setPendingDeleteCar] = useState<Car | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!imageFile) return;
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  const addUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUid = uid.trim();
    if (!name.trim()) {
      setMessage("กรุณากรอกชื่อผู้ใช้งาน");
      return;
    }
    if (!normalizedUid) {
      setMessage("กรุณากรอก UID");
      return;
    }
    if (editingUserId === null && userPassword.length < 6) {
      setMessage("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    try {
      if (editingUserId === null) await onAddUser({ name: name.trim(), uid: normalizedUid, password: userPassword, role: userRole });
      else await onUpdateUser(editingUserId, { name: name.trim(), uid: normalizedUid, role: userRole, ...(userPassword ? { password: userPassword } : {}) });
      setName(""); setUid(""); setUserPassword(""); setUserRole("user");
      setEditingUserId(null);
      setMessage(editingUserId === null ? "เพิ่มผู้ใช้เรียบร้อยแล้ว" : "แก้ไขผู้ใช้เรียบร้อยแล้ว");
    } catch (error) {
      setMessage(getThaiSettingsError(error, editingUserId === null ? "เพิ่มผู้ใช้ไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง" : "แก้ไขผู้ใช้ไม่สำเร็จ กรุณาลองอีกครั้ง"));
    }
  };

  const addCar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!plate.trim() || !model.trim() || !mileage.trim()) return;
    const values = { plate: plate.trim(), model: model.trim(), mileage: mileage.trim(), status: carStatus };
    try {
      if (editingCarId === null) await onAddCar(values, imageFile);
      else await onUpdateCar(editingCarId, values, imageFile);
      setPlate(""); setModel(""); setMileage(""); setCarStatus("available");
      setImageFile(null); setImagePreview("");
      setMessage(editingCarId === null ? "เพิ่มรถเรียบร้อยแล้ว" : "บันทึกการแก้ไขรถแล้ว");
      setEditingCarId(null);
    } catch (error) {
      setMessage(getThaiSettingsError(error, "บันทึกข้อมูลรถไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง"));
    }
  };

  const editCar = (car: Car) => {
    setEditingCarId(car.id);
    setPlate(car.plate);
    setModel(car.model);
    setMileage(car.mileage);
    setCarStatus(car.status);
    setImageFile(null);
    setImagePreview(car.image || "");
    setMessage("");
  };

  const removeCar = async (car: Car) => {
    setPendingDeleteCar(car);
  };

  const confirmDeleteCar = async () => {
    if (!pendingDeleteCar) return;
    try {
      await onDeleteCar(pendingDeleteCar.id);
      if (editingCarId === pendingDeleteCar.id) {
        setEditingCarId(null); setPlate(""); setModel(""); setMileage(""); setCarStatus("available"); setImageFile(null); setImagePreview("");
      }
      setMessage("ลบรถออกจากฐานข้อมูลแล้ว");
    } catch (error) {
      setMessage(getThaiSettingsError(error, "ลบรถไม่สำเร็จ กรุณาลองอีกครั้ง"));
    } finally {
      setPendingDeleteCar(null);
    }
  };

  const removeUser = async (id: number) => {
    const user = users.find((item) => item.id === id);
    if (!user) return;
    setPendingDeleteUser(user);
  };

  const editUser = (user: DirectoryUser) => {
    setEditingUserId(user.id);
    setName(user.name);
    setUid(user.uid);
    setUserPassword("");
    setUserRole(user.role === "manager" ? "manager" : "user");
    setMessage("");
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setName("");
    setUid("");
    setUserPassword("");
    setUserRole("user");
  };

  const confirmDeleteUser = async () => {
    if (!pendingDeleteUser) return;
    try { await onDeleteUser(pendingDeleteUser.id); }
    catch (error) { setMessage(getThaiSettingsError(error, "ลบผู้ใช้ไม่สำเร็จ กรุณาลองอีกครั้ง")); }
    finally { setPendingDeleteUser(null); }
  };

  const approveReset = async (request: PasswordResetRequest) => {
    const temporaryPassword = resetPasswords[request.id]?.trim() || "";
    if (temporaryPassword.length < 6) {
      setMessage("กรุณากำหนดรหัสชั่วคราวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    try {
      await onApprovePasswordReset(request.id, temporaryPassword);
      setResetPasswords((current) => ({ ...current, [request.id]: "" }));
      setMessage(`อนุมัติคำขอของ ${request.name} แล้ว กรุณาแจ้งรหัสชั่วคราวให้ผู้ใช้`);
    } catch (error) {
      setMessage(getThaiSettingsError(error, "อนุมัติคำขอเปลี่ยนรหัสผ่านไม่สำเร็จ"));
    }
  };

  return (
    <main className="admin-setting-page">
      <div className="admin-setting-container">
        <div className="admin-setting-choice" role="group" aria-label="เลือกประเภทการจัดการ">
          <button type="button" className={activeMode === "user" ? "is-active" : ""} aria-pressed={activeMode === "user"} onClick={() => { setActiveMode("user"); setMessage(""); }}>
            <span className="admin-choice-icon"><UserIcon /></span><span className="admin-choice-copy"><strong>จัดการผู้ใช้</strong><small>เพิ่มบัญชีและกำหนดสิทธิ์</small></span><span className="admin-choice-arrow" aria-hidden="true">›</span>
          </button>
          <button type="button" className={activeMode === "car" ? "is-active" : ""} aria-pressed={activeMode === "car"} onClick={() => { setActiveMode("car"); setMessage(""); }}>
            <span className="admin-choice-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 11 1.7-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.8 1.3L19 11" /><path d="M3.5 11h17v6h-17zM6 17v2m12-2v2" /></svg></span><span className="admin-choice-copy"><strong>จัดการรถยนต์</strong><small>เพิ่มรถและตรวจสอบรายการ</small></span><span className="admin-choice-arrow" aria-hidden="true">›</span>
          </button>
          <button type="button" className={activeMode === "reset" ? "is-active" : ""} aria-pressed={activeMode === "reset"} onClick={() => { setActiveMode("reset"); setMessage(""); }}>
            <span className="admin-choice-icon admin-choice-icon--warning" aria-hidden="true">!</span><span className="admin-choice-copy"><strong>คำขอเปลี่ยนรหัสผ่าน</strong><small>อนุมัติและตั้งรหัสชั่วคราว</small></span><span className="admin-choice-arrow" aria-hidden="true">›</span>
          </button>
        </div>
        <section className={`admin-setting-layout admin-setting-layout--${activeMode} ${activeMode === "user" ? "show-users" : activeMode === "car" ? "show-cars" : "show-reset"}`}>
          <form className="admin-user-form" onSubmit={addUser}>
            <div className="admin-card-title"><span className="admin-card-number">1</span><div><h2>{editingUserId === null ? "เพิ่มผู้ใช้ใหม่" : "แก้ไขข้อมูลผู้ใช้"}</h2><p>{editingUserId === null ? "เพิ่มรายชื่อผู้ใช้สำหรับการจองรถ" : "แก้ไขชื่อ UID หรือรหัสผ่าน"}</p></div></div>
            <label>ชื่อผู้ใช้งาน<input value={name} onChange={(event) => setName(event.target.value)} placeholder="" required /></label>
            <label>UID<input value={uid} onChange={(event) => setUid(event.target.value)} placeholder="" required /></label>
            <label>รหัสผ่านเริ่มต้น<input type="password" autoComplete="new-password" minLength={editingUserId === null ? 6 : undefined} value={userPassword} onChange={(event) => setUserPassword(event.target.value)} placeholder={editingUserId === null ? "" : "เว้นว่างถ้าไม่เปลี่ยนรหัสผ่าน"} required={editingUserId === null} /></label>
            <label>สิทธิ์การเข้าถึง<div className={`admin-role-picker${roleMenuOpen ? " is-open" : ""}`}><button type="button" className="admin-role-dropdown" aria-haspopup="listbox" aria-expanded={roleMenuOpen} onClick={() => setRoleMenuOpen((open) => !open)}><span className={`admin-role-badge admin-role-badge--${userRole}`}>{userRole === "manager" ? "M" : "U"}</span><span className="admin-role-selected"><strong>{userRole === "manager" ? "Manager" : "User"}</strong><small>{userRole === "manager" ? "ผู้จัดการ" : "ผู้ใช้งานทั่วไป"}</small></span><span className="admin-role-chevron" aria-hidden="true">⌄</span></button>{roleMenuOpen && <div className="admin-role-menu" role="listbox" aria-label="เลือกสิทธิ์การใช้งาน"><button type="button" className={userRole === "user" ? "is-selected" : ""} role="option" aria-selected={userRole === "user"} onClick={() => { setUserRole("user"); setRoleMenuOpen(false); }}><span className="admin-role-badge admin-role-badge--user">U</span><span className="admin-role-option-copy"><strong>User</strong><small>ผู้ใช้งานทั่วไป · ขอใช้รถและดูข้อมูลตัวเอง</small></span><span className="admin-role-check">{userRole === "user" ? "✓" : ""}</span></button><button type="button" className={userRole === "manager" ? "is-selected" : ""} role="option" aria-selected={userRole === "manager"} onClick={() => { setUserRole("manager"); setRoleMenuOpen(false); }}><span className="admin-role-badge admin-role-badge--manager">M</span><span className="admin-role-option-copy"><strong>Manager</strong><small>ผู้จัดการ · จัดการผู้ใช้ รถยนต์ และ Dashboard</small></span><span className="admin-role-check">{userRole === "manager" ? "✓" : ""}</span></button></div>}</div></label>

            <button className="admin-primary-button" type="submit">{editingUserId === null ? "+ เพิ่มผู้ใช้" : "บันทึกการแก้ไข"}</button>
            {editingUserId !== null && <button className="admin-cancel-edit" type="button" onClick={cancelEditUser}>ยกเลิกการแก้ไข</button>}
          </form>
          <section className="admin-user-list">
            <div className="admin-card-title"><span className="admin-card-number admin-card-number--blue">2</span><div><h2>ผู้ใช้งานในระบบ</h2><p>{visibleUsers.length} บัญชีที่ลงทะเบียนไว้</p></div><span className="admin-user-count">{visibleUsers.length}</span></div>
            <div className="admin-users"><div className="admin-user-row admin-user-row--heading"><span>ผู้ใช้งาน</span><span>UID</span><span>สิทธิ์</span><span>จัดการ</span></div>
              {visibleUsers.map((user) => <div className="admin-user-row" key={user.id}><div className="admin-user-name"><span className="admin-user-avatar"><UserIcon /></span><strong>{user.name}</strong></div><span className="admin-user-uid">{user.uid}</span><span>{user.role === "manager" ? "Manager" : "User"}</span><div className="admin-user-actions"><button className="admin-edit-button" type="button" onClick={() => editUser(user)}>แก้ไข</button><button className="admin-delete-button" type="button" onClick={() => removeUser(user.id)}>ลบ</button></div></div>)}
            </div>
          </section>
          <section className="admin-user-list admin-reset-list">
            <div className="admin-card-title"><span className="admin-card-number admin-card-number--blue">!</span><div><h2>คำขอเปลี่ยนรหัสผ่าน</h2><p>ตรวจสอบและกำหนดรหัสชั่วคราวให้ผู้ใช้งาน</p></div><span className="admin-user-count">{passwordResetRequests.filter((request) => request.status === "pending").length}</span></div>
            {passwordResetRequests.length > 0 ? <div className="admin-reset-requests">
              {passwordResetRequests.map((request) => <div className="admin-reset-request" key={request.id}><div><strong>{request.name}</strong><small>UID: {request.uid} · {request.status === "pending" ? "รออนุมัติ" : "อนุมัติแล้ว"}</small></div>{request.status === "pending" ? <div className="admin-reset-actions"><input type="text" value={resetPasswords[request.id] || ""} onChange={(event) => setResetPasswords((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="รหัสชั่วคราว" minLength={6} /><button type="button" onClick={() => approveReset(request)}>อนุมัติ</button></div> : <span className="admin-reset-approved">อนุมัติแล้ว</span>}</div>)}
            </div> : <div className="admin-reset-empty"><span>✓</span><div><strong>ยังไม่มีคำขอเปลี่ยนรหัสผ่าน</strong><small>เมื่อผู้ใช้ส่งคำขอ รายการจะแสดงที่ส่วนนี้</small></div></div>}
          </section>
          <form className="admin-user-form admin-car-form" onSubmit={addCar}>
            <div className="admin-card-title"><span className="admin-card-number admin-card-number--blue">1</span><div><h2>{editingCarId === null ? "เพิ่มรถยนต์" : "แก้ไขข้อมูลรถ"}</h2><p>{editingCarId === null ? "เพิ่มรถเข้าในรายการรถที่เปิดให้จอง" : `กำลังแก้ไขรถทะเบียน ${plate}`}</p></div></div>
            <label>ทะเบียนรถ<input value={plate} onChange={(event) => setPlate(event.target.value)} placeholder="" required /></label>
            <label>ยี่ห้อ / รุ่น<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="" required /></label>
            <label>เลขไมล์ปัจจุบัน<input inputMode="numeric" value={mileage} onChange={(event) => setMileage(event.target.value)} placeholder="" required /></label>
            <label>รูปรถ (ไม่เกิน 5 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { setMessage("กรุณาเลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB"); event.target.value = ""; return; } setMessage(""); setImageFile(file); if (!file) setImagePreview(editingCarId === null ? "" : cars.find((car) => car.id === editingCarId)?.image || ""); }} /></label>
            {imagePreview && <div className="admin-car-image-preview"><img src={imagePreview} alt="ตัวอย่างรูปรถ" /><span>{imageFile ? "รูปที่เลือก" : "รูปปัจจุบัน"}</span></div>}
            <button className="admin-primary-button" type="submit">{editingCarId === null ? "+ เพิ่มรถ" : "บันทึกการแก้ไข"}</button>
            {editingCarId !== null && <button className="admin-cancel-edit" type="button" onClick={() => { setEditingCarId(null); setPlate(""); setModel(""); setMileage(""); setCarStatus("available"); setImageFile(null); setImagePreview(""); }}>ยกเลิกการแก้ไข</button>}
          </form>
          <section className="admin-user-list admin-car-list">
            <div className="admin-card-title"><span className="admin-card-number">2</span><div><h2>รถยนต์ในระบบ</h2><p>{cars.length} คัน</p></div><span className="admin-user-count">{cars.length}</span></div>
            {carLoadError && <p className="admin-car-error" role="alert">โหลดข้อมูลรถจากฐานข้อมูลไม่สำเร็จ: {carLoadError}</p>}
            <div className="admin-users"><div className="admin-car-row admin-car-row--heading"><span>ทะเบียน / รุ่น</span><span>เลขไมล์</span><span>สถานะ</span><span>จัดการ</span></div>
              {cars.map((car) => <div className="admin-car-row" key={car.id}><strong className="admin-car-identity"><img src={car.image || carLogo} alt="" onError={(event) => { event.currentTarget.src = carLogo; }} /><span>{car.plate}<small>{car.model}</small></span></strong><span>{car.mileage}</span><span>{car.status === "available" ? "พร้อมใช้งาน" : car.status === "busy" ? "กำลังใช้งาน" : "จองแล้ว"}</span><span className="admin-car-actions"><button type="button" onClick={() => editCar(car)}>แก้ไข</button><button type="button" onClick={() => removeCar(car)}>ลบ</button></span></div>)}
              {cars.length === 0 && <p className="admin-car-empty">ยังไม่มีรถในระบบ</p>}
            </div>
          </section>
        </section>
      </div>
      {message && <div className="admin-notice-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMessage(""); }}>
        <section className={`admin-notice-modal${/ไม่สำเร็จ|กรุณา|มีอยู่|ไม่ถูกต้อง|ไม่มีสิทธิ์|ไม่สำเร็จ/.test(message) ? " is-error" : " is-success"}`} role="alertdialog" aria-modal="true" aria-labelledby="admin-notice-title">
          <div className="admin-notice-icon" aria-hidden="true">{/ไม่สำเร็จ|กรุณา|มีอยู่|ไม่ถูกต้อง|ไม่มีสิทธิ์/.test(message) ? "!" : "✓"}</div>
          <p className="admin-notice-eyebrow">CAR BOOKING SETTINGS</p>
          <h2 id="admin-notice-title">{/ไม่สำเร็จ|กรุณา|มีอยู่|ไม่ถูกต้อง|ไม่มีสิทธิ์/.test(message) ? "แจ้งเตือน" : "เรียบร้อย"}</h2>
          <p className="admin-notice-copy">{message}</p>
          <button type="button" onClick={() => setMessage("")}>เข้าใจแล้ว</button>
        </section>
      </div>}
      {pendingDeleteUser && <div className="admin-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDeleteUser(null); }}>
        <section className="admin-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title">
          <div className="admin-confirm-icon" aria-hidden="true">!</div>
          <p className="admin-confirm-eyebrow">ยืนยันการลบข้อมูล</p>
          <h2 id="delete-user-title">ลบผู้ใช้งานนี้หรือไม่?</h2>
          <p className="admin-confirm-copy">ข้อมูลของผู้ใช้งานจะถูกลบออกจากระบบ และไม่สามารถกู้คืนได้</p>
          <div className="admin-confirm-user"><strong>{pendingDeleteUser.name}</strong><span>UID: {pendingDeleteUser.uid}</span></div>
          <div className="admin-confirm-actions"><button type="button" className="admin-confirm-cancel" onClick={() => setPendingDeleteUser(null)}>ยกเลิก</button><button type="button" className="admin-confirm-delete" onClick={confirmDeleteUser}>ลบผู้ใช้</button></div>
        </section>
      </div>}
      {pendingDeleteCar && <div className="admin-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDeleteCar(null); }}>
        <section className="admin-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-car-title">
          <div className="admin-confirm-icon admin-confirm-icon--car" aria-hidden="true">⌫</div>
          <p className="admin-confirm-eyebrow">ยืนยันการลบรถ</p>
          <h2 id="delete-car-title">ลบรถคันนี้หรือไม่?</h2>
          <p className="admin-confirm-copy">ข้อมูลรถและรายการที่เกี่ยวข้องอาจไม่สามารถกู้คืนได้</p>
          <div className="admin-confirm-user"><strong>{pendingDeleteCar.model}</strong><span>ทะเบียน: {pendingDeleteCar.plate}</span></div>
          <div className="admin-confirm-actions"><button type="button" className="admin-confirm-cancel" onClick={() => setPendingDeleteCar(null)}>ยกเลิก</button><button type="button" className="admin-confirm-delete" onClick={confirmDeleteCar}>ลบรถ</button></div>
        </section>
      </div>}
    </main>
  );
}
