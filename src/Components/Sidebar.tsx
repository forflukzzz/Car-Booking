import { useState } from "react";
import "./Sidebar.css";
import dashboardIcon from "../assets/img/dashboard.png";
import vehiclesIcon from "../assets/img/datacar.png";
import historyIcon from "../assets/img/history.png";
import profileIcon from "../assets/img/profilr.png";
import settingsIcon from "../assets/img/setting.png";
import manageCarIcon from "../assets/img/managecar.png";
import manageCarHistoryIcon from "../assets/img/historymanagecar.png";

type SidebarItem = "vehicles" | "status" | "profile" | "settings" | "dashboard" | "managecar" | "historymanagecar";

type SidebarProps = {
  activeItem?: SidebarItem;
  onNavigate?: (item: SidebarItem) => void;
  role?: "user" | "manager" | "admin";
  onLogout?: () => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
};

const navigationItems: { id: SidebarItem; label: string }[] = [
  { id: "dashboard", label: "แดชบอร์ด" },
  { id: "vehicles", label: "ข้อมูลรถยนต์" },
  { id: "status", label: "บันทึกการใช้รถ" },
  { id: "managecar", label: "จัดการรถยนต์" },
  { id: "historymanagecar", label: "ประวัติจัดการรถยนต์" },
  { id: "settings", label: "ตั้งค่า" },
  { id: "profile", label: "โปรไฟล์" },
];

const navigationByRole: Record<NonNullable<SidebarProps["role"]>, SidebarItem[]> = {
  user: ["vehicles", "status", "profile"],
  manager: ["vehicles", "status", "managecar", "historymanagecar", "dashboard", "profile"],
  admin: ["dashboard", "vehicles", "status", "managecar", "historymanagecar", "settings", "profile"],
};

function SidebarIcon({ item }: { item: SidebarItem }) {
  if (item === "profile") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4" /><path d="M4 21c.6-4.2 3.2-6.5 8-6.5s7.4 2.3 8 6.5H4Z" /></svg>;
  }

  const icons: Record<SidebarItem, string> = {
    dashboard: dashboardIcon,
    vehicles: vehiclesIcon,
    status: historyIcon,
    profile: profileIcon,
    settings: settingsIcon,
    managecar: manageCarIcon,
    historymanagecar: manageCarHistoryIcon,
  };
  return <img src={icons[item]} alt="" aria-hidden="true" />;
}

export default function Sidebar({ activeItem = "vehicles", onNavigate, role = "user", onLogout, notificationsEnabled = true, onToggleNotifications }: SidebarProps) {
  const [logoutOpen, setLogoutOpen] = useState(false);

  const confirmLogout = () => {
    setLogoutOpen(false);
    onLogout?.();
  };

  return (
    <aside className={`sidebar${logoutOpen ? " has-logout-modal" : ""}${activeItem === "profile" ? " is-profile-active" : ""}`} data-active-item={activeItem}>
      <h1 className="sidebar-title">Car Booking</h1>
      <nav className="sidebar-nav" aria-label="เมนูหลัก">
        {navigationByRole[role].map((id) => navigationItems.find((item) => item.id === id)!).map(({ id, label }) => (
          <button
            className={`sidebar-nav-item${activeItem === id ? " is-active" : ""}`}
            key={id}
            data-sidebar-item={id}
            type="button"
            aria-current={activeItem === id ? "page" : undefined}
            onClick={() => onNavigate?.(id)}
          >
            <span className="sidebar-icon"><SidebarIcon item={id} /></span>
            <span className="sidebar-nav-label">{label}</span>
          </button>
        ))}
        <button className="sidebar-nav-item sidebar-logout" data-sidebar-item="logout" type="button" onClick={() => setLogoutOpen(true)}>
          <span className="sidebar-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></svg></span>
          <span className="sidebar-nav-label">ออกจากระบบ</span>
        </button>
      </nav>
      <button className={`sidebar-notification-toggle${notificationsEnabled ? " is-enabled" : ""}`} type="button" onClick={onToggleNotifications} aria-pressed={notificationsEnabled}>
        <span aria-hidden="true">{notificationsEnabled ? "🔔" : "🔕"}</span>
        <span>{notificationsEnabled ? "ปิดการแจ้งเตือน" : "เปิดการแจ้งเตือน"}</span>
      </button>
      <button className="sidebar-mobile-logout" type="button" onClick={() => setLogoutOpen(true)} aria-label="ออกจากระบบ">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></svg>
        <span>ออกจากระบบ</span>
      </button>
      {logoutOpen && <div className="sidebar-logout-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLogoutOpen(false); }}>
        <section className="sidebar-logout-modal" role="alertdialog" aria-modal="true" aria-labelledby="sidebar-logout-title">
          <div className="sidebar-logout-modal-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></svg></div>
          <p className="sidebar-logout-eyebrow">ยืนยันการออกจากระบบ</p>
          <h2 id="sidebar-logout-title">ต้องการออกจากระบบไหม?</h2>
          <p className="sidebar-logout-copy">คุณจะต้องเข้าสู่ระบบใหม่อีกครั้งเพื่อใช้งานต่อ</p>
          <div className="sidebar-logout-actions"><button type="button" className="sidebar-logout-cancel" onClick={() => setLogoutOpen(false)}>ยกเลิก</button><button type="button" className="sidebar-logout-confirm" onClick={confirmLogout}>ออกจากระบบ</button></div>
        </section>
      </div>}
    </aside>
  );
}
