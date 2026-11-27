import "./profile.css";
import { useEffect, useState } from "react";
import type { BorrowRecord } from "../History/history";

type UsageRecord = { id: number; date: string; plate: string; purpose: string; startMileage: string; returnDate: string; endMileage: string; distance: string; status: string; source: BorrowRecord };

const statusLabels: Record<string, string> = { "in-use": "กำลังใช้งาน", reserved: "จองแล้ว", returned: "คืนรถสำเร็จ", cancelled: "ยกเลิกแล้ว" };

const formatProfileDate = (value?: string) => {
  if (!value || value === "-") return "-";
  const isoDate = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (isoDate) {
    return `${isoDate[3].padStart(2, "0")}/${isoDate[2].padStart(2, "0")}/${Number(isoDate[1]) + 543}`;
  }
  const slashDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashDate) {
    const rawYear = Number(slashDate[3]);
    const year = slashDate[3].length === 2 ? 2500 + rawYear - 543 : rawYear;
    return `${slashDate[1].padStart(2, "0")}/${slashDate[2].padStart(2, "0")}/${year < 2400 ? year + 543 : year}`;
  }
  return value;
};

const getRequesterName = (requester: string) => requester.replace(/\s*\(UID:\s*[^)]+\)\s*$/i, "").trim();
const getRequesterUid = (record: BorrowRecord) => record.requesterUid || record.requester.match(/\(UID:\s*([^)]*)\)/i)?.[1]?.trim();


const UserIcon = () => <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="34" r="18" /><path d="M14 92c3-21 17-35 36-35s33 14 36 35H14Z" /></svg>;
const CalendarIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></svg>;
const CarIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 11 1.7-4.2A2 2 0 0 1 8.56 5.5h6.88a2 2 0 0 1 1.86 1.3L19 11" /><path d="M3 11h18v6H3zM6 17v2M18 17v2M6 14h.01M18 14h.01" /></svg>;

type ProfileUser = { name: string; uid: string };
type ProfileProps = { user: ProfileUser | null; records: BorrowRecord[]; onReturn: (record: BorrowRecord) => void; onCancelReservation: (id: number) => void; onRefresh?: () => Promise<void>; notificationsEnabled?: boolean; onToggleNotifications?: () => void };

export default function Profile({ user, records, onReturn, onCancelReservation, onRefresh, notificationsEnabled = true, onToggleNotifications }: ProfileProps) {
  useEffect(() => {
    void onRefresh?.();
  }, []);
  const profileName = user?.name || "Admin";
  const profileUid = user?.uid || "-";
  const userRecords = user?.name || user?.uid
    ? records.filter((record) => {
      const requesterUid = getRequesterUid(record);
      const requesterName = getRequesterName(record.requester).toLocaleLowerCase();
      const currentName = (user.name || "").trim().toLocaleLowerCase();
      const currentUid = (user.uid || "").trim();
      return (currentUid && currentUid !== "-" && requesterUid === currentUid) || Boolean(currentName && requesterName === currentName);
    })
    : records;
  const usageRecords: UsageRecord[] = userRecords.map((record) => ({
    id: record.id,
    date: record.date,
    plate: record.plate,
    purpose: record.purpose,
    startMileage: record.startMileage || record.mileage,
    returnDate: record.returnDate,
    endMileage: record.endMileage || "-",
    distance: record.distance,
    status: record.status,
    source: record,
  }));
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleRecords = normalizedQuery
    ? usageRecords.filter((record) => [record.date, record.plate, record.purpose, record.status, statusLabels[record.status] || ""].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    : usageRecords;
  return (
    <main className="profile-page">
      <div className="profile-container">
<header className="profile-topbar"><div className="profile-top-user"><div className="profile-avatar"><UserIcon /></div><div className="profile-identity"><p className="profile-label">ยินดีต้อนรับ</p><h2>{profileName}</h2><p className="profile-uid"><span>UID</span> {profileUid}</p></div></div><div className="profile-top-stat"><div className="profile-stat-card"><div className="profile-stat-icon"><CarIcon /></div><div><p>จำนวนการใช้งานรถยนต์</p><strong>{usageRecords.length} <span>ครั้ง</span></strong></div><span className="profile-stat-trend">ทั้งหมด</span></div></div></header>
        <div className="profile-notification-setting"><span><strong>การแจ้งเตือน</strong><small>รับการแจ้งเตือนเมื่อมีการยืมหรือคืนรถ</small></span><button className={`profile-notification-toggle${notificationsEnabled ? " is-enabled" : ""}`} type="button" onClick={onToggleNotifications} aria-pressed={notificationsEnabled}><span aria-hidden="true">{notificationsEnabled ? "🔔" : "🔕"}</span>{notificationsEnabled ? "ปิดการแจ้งเตือน" : "เปิดการแจ้งเตือน"}</button></div>
        <section className="profile-history" aria-labelledby="profile-history-title">
          <div className="profile-section-heading">
            <div className="profile-section-icon"><CalendarIcon /></div>
             <div><h2 id="profile-history-title">ประวัติการใช้รถ</h2>
             <p>รายการการจองและการใช้งานรถล่าสุด</p>
             </div></div>
          <div className="profile-history-tools"><label className="profile-search"><span aria-hidden="true">⌕</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="ค้นหาทะเบียนรถ, วัตถุประสงค์..." aria-label="ค้นหาประวัติการใช้รถ" /></label></div><div className="profile-table-scroll">
            <table className="profile-table">
               <thead><tr><th>วันที่ยืม / จอง</th><th>ทะเบียนรถ</th><th>วัตถุประสงค์</th><th>เลขไมล์ก่อนใช้</th><th>วันที่คืนรถ</th><th>เลขไมล์หลังใช้งาน</th><th>ระยะทาง</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}><td>{formatProfileDate(record.date)}</td><td className="profile-plate">{record.plate}</td><td>{record.purpose}</td><td>{record.startMileage}</td><td>{formatProfileDate(record.returnDate)}</td><td>{record.endMileage}</td><td>{record.distance}</td><td><span className="profile-status">{statusLabels[record.status] || record.status}</span></td><td><div className="profile-action-buttons">{record.status === "reserved" && <button className="profile-cancel-button" type="button" onClick={() => onCancelReservation(record.id)}>ยกเลิก</button>}{record.status === "in-use" && <button className="profile-return-button" type="button" onClick={() => onReturn(record.source)}>คืนรถ</button>}{record.status === "returned" ? "เสร็จสิ้น" : record.status === "cancelled" ? "ยกเลิกแล้ว" : ""}</div></td></tr>)}</tbody></table></div>

        </section>
      </div>
    </main>
  );
}




