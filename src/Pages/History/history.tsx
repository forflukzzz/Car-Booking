import { useState } from "react";
import "./history.css";

export type BorrowStatus = "in-use" | "reserved" | "returned" | "cancelled";
export type BorrowRecord = {
  id: number;
  date: string;
  plate: string;
  model: string;
  requester: string;
  requesterUid?: string;
  carId?: number;
  image?: string;
  purpose: string;
  mileage: string;
  startMileage?: string;
  endMileage?: string;
  returnDate: string;
  distance: string;
  status: BorrowStatus;
  issueReport?: string;
};

const borrowStatusLabels: Record<BorrowStatus, string> = {
  "in-use": "กำลังใช้งาน",
  reserved: "จองแล้ว",
  returned: "คืนรถสำเร็จ",
  cancelled: "ยกเลิกแล้ว",
};

type HistoryProps = {
  onNewRequest: () => void;
  onReturn: (record: BorrowRecord) => void;
  onCancelReservation: (id: number) => void;
  records: BorrowRecord[];
  storageError: string | null;
  userUid?: string;
};

export default function History({ onNewRequest, onReturn, onCancelReservation, records, storageError, userUid }: HistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [pendingCancellation, setPendingCancellation] = useState<BorrowRecord | null>(null);
  const counts = {
    inUse: records.filter((record) => record.status === "in-use").length,
    reserved: records.filter((record) => record.status === "reserved").length,
    cancelled: records.filter((record) => record.status === "cancelled").length,
    returned: records.filter((record) => record.status === "returned").length,
  };
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const normalizedRecords = records.map((record) => {
    const match = record.requester.match(/^(.*?)\s*\(UID:\s*(.*?)\)$/);
    return match ? { ...record, requester: match[1], requesterUid: record.requesterUid || match[2] } : record;
  });
  const getRecordMonth = (dateValue: string) => {
    const isoDate = dateValue.match(/^\d{4}-(\d{2})-\d{2}$/);
    const slashDate = dateValue.match(/^\d{1,2}\/(\d{1,2})\//);
    return isoDate?.[1] || (slashDate ? slashDate[1].padStart(2, "0") : "");
  };
  const formatHistoryDate = (dateValue: string) => {
    const isoDate = dateValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
    if (isoDate) return `${isoDate[3].padStart(2, "0")}/${isoDate[2].padStart(2, "0")}/${String(Number(isoDate[1]) + 543)}`;

    const slashDate = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (slashDate) {
      const rawYear = Number(slashDate[3]);
      const year = slashDate[3].length === 2 ? 2500 + rawYear - 543 : rawYear;
      return `${slashDate[1].padStart(2, "0")}/${slashDate[2].padStart(2, "0")}/${String(year < 2400 ? year + 543 : year)}`;
    }

    return dateValue;
  };
  const availableMonths = [...new Set(normalizedRecords.map((record) => getRecordMonth(record.date)).filter(Boolean))]
    .sort((first, second) => Number(second) - Number(first));
  const filteredRecords = normalizedRecords.filter((record) => (!selectedMonth || getRecordMonth(record.date) === selectedMonth) && [
    record.date,
    record.plate,
    record.model,
    record.requester,
    record.requesterUid || "",
    record.purpose,
    record.issueReport || "",
    record.startMileage || record.mileage,
    record.returnDate,
    record.endMileage || "",
    record.distance,
    borrowStatusLabels[record.status],
  ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
  const canReturn = (record: BorrowRecord) => Boolean(userUid && (record.requesterUid === userUid || record.requester.includes(`UID: ${userUid}`)));
  const confirmCancellation = () => {
    if (!pendingCancellation) return;
    onCancelReservation(pendingCancellation.id);
    setPendingCancellation(null);
  };

  return <main className="borrow-history-page">
    {storageError && <p className="borrow-history-storage-error" role="alert">ไม่สามารถโหลดข้อมูลได้: {storageError}</p>}
    <section className="borrow-history-summary" aria-label="สรุปประวัติการใช้รถ"><article className="borrow-history-stat borrow-history-stat--total"><span className="borrow-history-stat-icon" aria-hidden="true">▣</span><div><p>รายการทั้งหมด</p><strong>{records.length}</strong></div></article><article className="borrow-history-stat borrow-history-stat--active"><span className="borrow-history-stat-icon" aria-hidden="true">▶</span><div><p>กำลังใช้งาน</p><strong>{counts.inUse}</strong></div></article><article className="borrow-history-stat borrow-history-stat--reserved"><span className="borrow-history-stat-icon" aria-hidden="true">◆</span><div><p>จองรถ</p><strong>{counts.reserved}</strong></div></article><article className="borrow-history-stat borrow-history-stat--returned"><span className="borrow-history-stat-icon" aria-hidden="true">✓</span><div><p>คืนรถแล้ว</p><strong>{counts.returned}</strong></div></article><article className="borrow-history-stat borrow-history-stat--cancelled"><span className="borrow-history-stat-icon" aria-hidden="true">×</span><div><p>ยกเลิกแล้ว</p><strong>{counts.cancelled}</strong></div></article></section>
    <section className="borrow-history-panel"><div className="borrow-history-panel-heading"><div><h2>รายการยืมและจองรถ</h2><p>รายละเอียดการใช้งานและการคืนรถ</p></div><div className="borrow-history-tools"><label className="borrow-history-month"><span>กรองเดือน</span><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="กรองรายการตามเดือน"><option value="">ทุกเดือน</option>{availableMonths.map((month) => <option key={month} value={month}>{new Intl.DateTimeFormat("th-TH", { month: "long" }).format(new Date(2024, Number(month) - 1, 1))}</option>)}</select></label><label className="borrow-history-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="ค้นหาทะเบียนรถ ผู้ขอใช้ UID หรือสถานะ..." aria-label="ค้นหาประวัติการใช้รถ" />{searchQuery && <button type="button" className="borrow-history-search-clear" onClick={() => setSearchQuery("")} aria-label="ล้างการค้นหา">×</button>}</label><span className="borrow-history-total">{normalizedQuery || selectedMonth ? `${filteredRecords.length} / ${records.length} รายการ` : `${records.length} รายการ`}</span></div></div>
      <div className="borrow-history-scroll"><table className="borrow-history-table"><thead><tr><th>วันที่ยืม / จอง</th><th>ทะเบียนรถ</th><th>ชื่อผู้ใช้</th><th>วัตถุประสงค์</th><th>เลขไมล์ก่อนใช้</th><th>วันที่คืนรถ</th><th>เลขไมล์หลังใช้</th><th>ระยะทาง</th><th>สถานะ</th><th>ปัญหาระหว่างใช้งาน</th><th>จัดการ</th></tr></thead><tbody>{filteredRecords.map((record) => <tr key={record.id}><td className="borrow-history-date">{formatHistoryDate(record.date)}{record.status === "in-use" && canReturn(record) && <button className="borrow-history-mobile-return" type="button" onClick={() => onReturn(record)}>คืนรถ</button>}</td><td><span className="borrow-history-plate">{record.plate}</span><small className="borrow-history-model">{record.model}</small></td><td><span>{record.requester}</span></td><td>{record.purpose}</td><td>{record.startMileage || record.mileage}</td><td>{formatHistoryDate(record.returnDate)}</td><td>{record.status === "returned" ? record.endMileage || "-" : "-"}</td><td>{record.distance}</td><td><span className={`borrow-history-status borrow-history-status--${record.status}`}><span aria-hidden="true" />{borrowStatusLabels[record.status]}</span></td><td className="borrow-history-issue">{record.issueReport || "-"}</td><td className="borrow-history-actions">{record.status === "in-use" && canReturn(record) && <button className="borrow-history-return" type="button" onClick={() => onReturn(record)}>คืนรถ</button>}{record.status === "reserved" && canReturn(record) && <button className="borrow-history-cancel" type="button" onClick={() => setPendingCancellation(record)}>ยกเลิก</button>}{(record.status === "returned" || record.status === "cancelled") && <span className="borrow-history-completed">{record.status === "returned" ? "เสร็จสิ้น" : "ยกเลิกแล้ว"}</span>}</td></tr>)}{filteredRecords.length === 0 && <tr><td className="borrow-history-empty" colSpan={11}>{records.length === 0 ? "ยังไม่มีประวัติการใช้รถ" : "ไม่พบข้อมูลที่ตรงกับการค้นหา"}</td></tr>}</tbody></table></div>
    </section>
    {pendingCancellation && <div className="borrow-history-confirm-backdrop" role="presentation">
      <section className="borrow-history-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="borrow-history-confirm-title">
        <span className="borrow-history-confirm-icon" aria-hidden="true">!</span>
        <h2 id="borrow-history-confirm-title">ยืนยันการยกเลิกการจอง</h2>
        <p>รายละเอียดการใช้งานและการคืนรถ</p>
        <div className="borrow-history-confirm-actions">
          <button type="button" className="borrow-history-confirm-back" onClick={() => setPendingCancellation(null)}>กลับ</button>
          <button type="button" className="borrow-history-confirm-submit" onClick={confirmCancellation}>ยืนยันยกเลิก</button>
        </div>
      </section>
    </div>}
  </main>;
}
