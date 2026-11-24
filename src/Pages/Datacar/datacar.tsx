import carlogo from "../../assets/img/carlogo.png";
import type { Car, CarStatus } from "../../Database/carStorage";
import type { CarServiceRecord } from "../../Database/carServiceStorage";
import type { BorrowRecord } from "../History/history";
import { useState } from "react";
import "./datacar.css";

const STATUS_TEXT: Record<CarStatus, string> = { busy: "กำลังใช้งาน", available: "ว่าง", reserved: "จองแล้ว" };
type DataCarProps = { cars: Car[]; records: BorrowRecord[]; serviceRecords?: CarServiceRecord[]; carLoadError?: string; userUid?: string; onViewDetails: (car: Car) => void; onRequest: (car: Car) => void; onReturn: (record: BorrowRecord) => void; onCancelReservation: (id: number) => void };

const getActiveUse = (car: Car, records: BorrowRecord[]) => records.find((record) =>
  (record.carId != null ? record.carId === car.id : record.plate === car.plate && record.model === car.model)
  && (record.status === "in-use" || record.status === "reserved"),
);

const getLatestIssueRecord = (car: Car, records: BorrowRecord[]) => records.filter((record) => (record.carId != null ? record.carId === car.id : record.plate === car.plate && record.model === car.model) && Boolean(record.issueReport?.trim())).sort((first, second) => second.id - first.id)[0];

const daysUntilExpiry = (value?: string) => {
  if (!value) return null;
  const isoDate = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const localDate = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const year = Number(isoDate?.[1] ?? localDate?.[3]);
  const month = Number(isoDate?.[2] ?? localDate?.[2]);
  const day = Number(isoDate?.[3] ?? localDate?.[1]);
  if (!year || !month || !day) return null;
  const expiry = new Date(Date.UTC(year, month - 1, day));
  if (expiry.getUTCFullYear() !== year || expiry.getUTCMonth() !== month - 1 || expiry.getUTCDate() !== day) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((expiry.getTime() - todayUtc) / 86400000);
};

const inspectionItems = ["ระดับน้ำหล่อเย็นในหม้อพักน้ำ", "ระดับน้ำมันเครื่อง รอยรั่วซึมระบบน้ำมัน", "แบตเตอรี่ ขั่วแบตเตอรี่ น้ำกลั่น", "ระบบไฟทั้งหมด", "สภาพยาง ลมยาง สภาพล้อแม็ก", "น้ำฉีดกระจก ยางปัดน้ำฝน", "อื่นๆ"];
const parseInspectionNotes = (value?: string) => {
  if (!value) return [] as string[];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [] as string[];
  }
};

const getInspectionAlert = (car: Car, serviceRecords: CarServiceRecord[]) => {
  const inspection = serviceRecords
    .filter((record) => record.carId === car.id && record.recordType === "maintenance")
    .sort((first, second) => second.serviceDate.localeCompare(first.serviceDate) || second.id - first.id)[0];
  if (!inspection) return "";
  const statuses = [inspection.engineOil, inspection.brakePads, inspection.tires, inspection.airConditioner, inspection.brakes, inspection.windshieldWiper, inspection.otherInspection];
  const notes = parseInspectionNotes(inspection.inspectionNotes);
  const outstanding = statuses.flatMap((status, index) => {
    if (status !== "แก้ไข") return [];
    const itemName = inspectionItems[index] || `รายการตรวจ ${index + 1}`;
    const note = notes[index]?.trim();
    const repairItem = `${itemName}${note ? ` (${note})` : ""}`;
    const legacyRepairItem = `แก้ไขจากผลตรวจ: ${repairItem}`;
    const repaired = serviceRecords.some((record) => record.carId === car.id
      && record.recordType === "service-center"
      && record.id > inspection.id
      && [repairItem, legacyRepairItem].some((item) => record.item.trim() === item.trim()));
    return repaired ? [] : [itemName];
  });
  return outstanding.length ? `เช็คระยะพบปัญหา: ${outstanding.join(", ")}` : "";
};

const getCarAlert = (car: Car, serviceRecords: CarServiceRecord[]) => {
  const alerts: string[] = [];
  const documents = [
    ["พ.ร.บ.", car.prbExpiry],
    ["ประกัน", car.insuranceExpiry],
  ] as const;
  documents.forEach(([name, date]) => {
    const days = daysUntilExpiry(date);
    if (days !== null && days <= 30) alerts.push(`${name} ${days < 0 ? "หมดอายุ" : "ใกล้หมดอายุ"}`);
  });
  const currentMileage = Number(String(car.mileage || "").replace(/,/g, ""));
  const nextMileage = Number(String(car.nextMaintenanceMileage || "").replace(/,/g, ""));
  if (Number.isFinite(currentMileage) && Number.isFinite(nextMileage) && nextMileage > 0 && nextMileage - currentMileage <= 50) {
    alerts.push("ใกล้กำหนดเช็คระยะ");
  }
  const inspectionAlert = getInspectionAlert(car, serviceRecords);
  if (inspectionAlert) alerts.push(inspectionAlert);
  return alerts.join(" / ");
};

const CarIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 11 1.7-4.2A2 2 0 0 1 8.56 5.5h6.88a2 2 0 0 1 1.86 1.3L19 11" /><path d="M3 11h18v6H3zM6 17v2M18 17v2M6 14h.01M18 14h.01" /></svg>;

const DataCar = ({ cars, records, serviceRecords = [], carLoadError, userUid, onViewDetails, onRequest, onReturn, onCancelReservation }: DataCarProps) => {
  const [reservationToCancel, setReservationToCancel] = useState<BorrowRecord | null>(null);
  return <main className="datacar-page">
  <div className="datacar-container">
    <div className="datacar-overview"><div className="datacar-overview-icon"><CarIcon /></div><div><strong>{cars.length}</strong><span> คัน</span><p>รถยนต์ทั้งหมดในระบบ</p></div><div className="datacar-legend"><span><i className="is-available" />{STATUS_TEXT.available}</span><span><i className="is-busy" />กำลังใช้งาน</span><span><i className="is-reserved" />จองแล้ว</span></div></div>
    {carLoadError && <p className="datacar-load-error" role="alert">โหลดข้อมูลรถไม่สำเร็จ: {carLoadError}</p>}
    <section className="datacar-grid" aria-label="รายการรถยนต์">{cars.map((car) => { const activeUse = car.status === "available" ? undefined : getActiveUse(car, records); const isOwner = Boolean(activeUse && userUid && (activeUse.requesterUid === userUid || activeUse.requester.includes(`UID: ${userUid}`))); const latestIssueRecord = getLatestIssueRecord(car, records); const usageIssueResolved = Boolean(latestIssueRecord && serviceRecords.some((record) => record.recordType === "service-center" && record.relatedBorrowRecordId === latestIssueRecord.id)); const usageIssueAlert = latestIssueRecord?.issueReport?.trim() && !usageIssueResolved ? `ปัญหาระหว่างใช้งาน: ${latestIssueRecord.issueReport.trim()}` : ""; const carAlert = [getCarAlert(car, serviceRecords), usageIssueAlert].filter(Boolean).join(" / "); return (<article key={car.id} className={`car-card car-card--${car.status}`}>
      <div className="car-card__image"><img src={car.image ?? carlogo} alt={`${car.model} ${car.plate}`} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = carlogo; }} /><span className={`car-card__badge car-card__badge--${car.status}`}><i />{STATUS_TEXT[car.status]}</span>{carAlert && <span className="car-card__alert" role="img" aria-label={carAlert} title={carAlert} />}</div>
      <div className="car-card__content"><div className="car-card__heading"><div><p>รถยนต์คันที่ {car.id}</p><h2>{car.model}</h2><span className="car-card__plate">{car.plate}</span></div></div>
        <dl className={`car-card__info${activeUse ? " car-card__info--active" : ""}`}><div className="car-card__row"><dt>ทะเบียน</dt><dd>{car.plate}</dd></div><div className="car-card__row"><dt>ยี่ห้อ/รุ่น</dt><dd>{car.model}</dd></div>{activeUse && <><div className="car-card__row"><dt>ผู้ใช้รถยนต์</dt><dd>{activeUse.requester.replace(/\s*\(UID:\s*[^)]+\)\s*$/i, "").trim()}</dd></div><div className="car-card__row"><dt>วัตถุประสงค์</dt><dd>{activeUse.purpose}</dd></div></>}</dl>
        <div className="car-card__actions"><button type="button" className="car-card__btn car-card__btn--details" onClick={() => onViewDetails(car)}>ดูรายละเอียด</button>{car.status === "available" ? <button type="button" className="car-card__btn" disabled={car.requestDisabled} onClick={() => onRequest(car)}>ขอใช้รถ</button> : activeUse?.status === "in-use" && isOwner ? <button type="button" className="car-card__btn car-card__btn--return" onClick={() => onReturn(activeUse)}>คืนรถ</button> : activeUse?.status === "reserved" && isOwner ? <button type="button" className="car-card__btn car-card__btn--return" onClick={() => setReservationToCancel(activeUse)}>ยกเลิกการจอง</button> : <button type="button" className="car-card__btn car-card__btn--unavailable" disabled>{activeUse?.status === "reserved" ? "ถูกจองแล้ว" : "กำลังใช้งาน"}</button>}</div>
      </div>
    </article>); })}{cars.length === 0 && !carLoadError && <p className="datacar-empty">ยังไม่มีข้อมูลรถในฐานข้อมูล</p>}</section>
  </div>
  {reservationToCancel && <div className="cancel-modal__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReservationToCancel(null); }}><section className="cancel-modal" role="alertdialog" aria-modal="true" aria-labelledby="cancel-modal-title"><button className="cancel-modal__close" type="button" aria-label="ปิด" onClick={() => setReservationToCancel(null)}>×</button><div className="cancel-modal__icon" aria-hidden="true">!</div><p className="cancel-modal__eyebrow">ยืนยันการยกเลิก</p><h2 id="cancel-modal-title">ยกเลิกการจองรถ?</h2><p>ต้องการยกเลิกการจองรถทะเบียน <strong>{reservationToCancel.plate}</strong> ใช่หรือไม่</p><div className="cancel-modal__actions"><button type="button" className="cancel-modal__keep" onClick={() => setReservationToCancel(null)}>เก็บการจองไว้</button><button type="button" className="cancel-modal__confirm" onClick={() => { onCancelReservation(reservationToCancel.id); setReservationToCancel(null); }}>ยืนยันยกเลิก</button></div></section></div>}
</main>;
};

export default DataCar;








