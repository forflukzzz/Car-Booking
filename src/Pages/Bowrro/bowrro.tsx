import { useRef, useState, type FormEvent } from "react";
import carlogo from "../../assets/img/carlogo.png";
import type { Car } from "../../Database/carStorage";
import { supabase } from "../../Database/supabase";
import { notifyPushActivity } from "../../Database/pushNotifications";
import "./bowrro.css";

export type CarRequest = {
  requester: string;
  startDate: string;
  purpose: string;
};

type CarRequestProps = {
  car: Car;
  requesterName?: string;
  requesterUid?: string;
  onCancel: () => void;
  onSaved: (carId: number) => Promise<void>;
};

const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const normalizeBuddhistDateInput = (value: string) => {
  const formatted = formatDateInput(value);
  const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return formatted;
  const year = Number(match[3]);
  return `${match[1]}/${match[2]}/${year < 2400 ? year + 543 : year}`;
};

const toIsoDate = (value: string) => {
  const [day, month, year] = value.split("/");
  const christianYear = Number(year) >= 2400 ? Number(year) - 543 : Number(year);
  return `${christianYear}-${month}-${day}`;
};

const isValidDateInput = (value: string) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
  const [day, month, inputYear] = value.split("/").map(Number);
  const year = inputYear >= 2400 ? inputYear - 543 : inputYear;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const formatDisplayDate = (value?: string) => {
  if (!value || value === "-") return "ยังไม่มีข้อมูล";
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (iso) return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${Number(iso[1]) + 543}`;
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slash) {
    const rawYear = Number(slash[3]);
    const year = slash[3].length === 2 ? 2500 + rawYear - 543 : rawYear;
    return `${slash[1].padStart(2, "0")}/${slash[2].padStart(2, "0")}/${year < 2400 ? year + 543 : year}`;
  }
  return value;
};

type RequestDateFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const RequestDateField = ({ id, name, label, value, onChange }: RequestDateFieldProps) => {
  const pickerRef = useRef<HTMLInputElement>(null);
  const isoValue = isValidDateInput(value) ? toIsoDate(value) : "";

  return (
    <label className="car-request-field car-request-date-field">{label}
      <span className="car-request-date-input-wrap">
        <input id={id} name={name} type="text" inputMode="numeric" placeholder="dd/mm/yyyy" value={value} onChange={(event) => onChange(normalizeBuddhistDateInput(event.target.value))} maxLength={10} pattern="\d{2}/\d{2}/\d{4}" required />
        <button type="button" className="car-request-calendar-button" aria-label={`เลือก${label}`} onClick={() => pickerRef.current?.showPicker?.()}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></svg></button>
        <input ref={pickerRef} className="car-request-hidden-date" type="date" value={isoValue} onChange={(event) => { const [year, month, day] = event.target.value.split("-"); onChange(year && month && day ? `${day}/${month}/${Number(year) + 543}` : ""); }} tabIndex={-1} aria-hidden="true" />
      </span>
    </label>
  );
};

export default function Bowrro({ car, requesterName, requesterUid, onCancel, onSaved }: CarRequestProps) {
  const [requester, setRequester] = useState(requesterName || "");
  const [startDate, setStartDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const statusText = {
    busy: "กำลังใช้งาน",
    available: "ว่าง",
    reserved: "จองแล้ว",
  }[car.status];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanRequester = requester.trim();
    const cleanPurpose = purpose.trim();
    if (!cleanRequester || !cleanPurpose || isSubmitting || !isValidDateInput(startDate)) {
      setSubmitMessage("กรุณากรอกวันที่เริ่มใช้ในรูปแบบ dd/mm/yyyy");
      return;
    }
    setSubmitMessage("");
    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    const cleanRequester = requester.trim();
    const cleanPurpose = purpose.trim();
    if (!cleanRequester || !cleanPurpose || isSubmitting || !isValidDateInput(startDate)) return;
    const isoStartDate = toIsoDate(startDate);
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const requestStatus = isoStartDate > todayIso ? "reserved" : "in-use";
    setIsSubmitting(true);
    setSubmitMessage("");
    setShowConfirmation(false);
    try {
      const { error: borrowError } = await supabase.from("borrow_records").insert({
        date: isoStartDate,
        plate: car.plate,
        model: car.model,
        car_id: car.id,
        vehicle_id: car.id,
        requester: requesterUid ? `${cleanRequester} (UID: ${requesterUid})` : cleanRequester,
        purpose: cleanPurpose,
        mileage: car.mileage,
        start_mileage: car.mileage,
        end_mileage: "-",
        return_date: "-",
        distance: "-",
        status: requestStatus,
      });
      if (borrowError) throw new Error([borrowError.message, borrowError.details, borrowError.code ? `code: ${borrowError.code}` : ""].filter(Boolean).join(" | "));
      const { error: carError } = await supabase.from("cars").update({ status: requestStatus === "reserved" ? "reserved" : "busy" }).eq("id", car.id);
      if (carError) throw new Error([carError.message, carError.details, carError.code ? `code: ${carError.code}` : ""].filter(Boolean).join(" | "));
      await onSaved(car.id);
      void notifyPushActivity({ type: "borrow", requester: requesterUid ? `${cleanRequester} (UID: ${requesterUid})` : cleanRequester, requesterUid, model: car.model, plate: car.plate });
      const saved = true;
      if (!saved) throw new Error("บันทึกคำขอไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล");
      setSubmitMessage("บันทึกคำขอใช้รถเรียบร้อยแล้ว");
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "บันทึกคำขอไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="car-request-page">
      <section className="car-request-card" aria-label="แบบฟอร์มขอใช้รถยนต์">
        <section className="car-request-vehicle" aria-label="ข้อมูลรถที่เลือก">
          <div className="car-request-image"><img src={car.image || carlogo} alt={`${car.model} ${car.plate}`} onError={(event) => { event.currentTarget.src = carlogo; }} /></div>
          <div className="car-request-vehicle-heading"><div><span>รถที่เลือก</span><h2>{car.model}</h2></div><strong className={`car-request-status car-request-status--${car.status}`}><i />{statusText}</strong></div>
          <dl className="car-request-info">
            <div><dt>ทะเบียนรถ</dt><dd>{car.plate}</dd></div>
            <div><dt>เลขไมล์ปัจจุบัน</dt><dd>{car.mileage} กม.</dd></div>
            <div><dt>ใช้งานล่าสุด</dt><dd>{formatDisplayDate(car.lastUsed)}</dd></div>
          </dl>
        </section>
        <section className="car-request-form-panel" aria-labelledby="car-request-title">
          <div className="car-request-form-heading"><span>รายละเอียดการจอง</span><h2 id="car-request-title">กรอกข้อมูลขอใช้รถ</h2><p>ระบุผู้ขอ วันใช้งาน และวัตถุประสงค์</p></div>
          <form onSubmit={handleSubmit}>
            <label className="car-request-field car-request-field--requester">ชื่อผู้ขอใช้รถ
              <input id="borrow-requester" name="requester" type="text" value={requester} onChange={(event) => setRequester(event.target.value)} placeholder="พิมพ์ชื่อผู้ขอใช้รถ" autoComplete="off" required />
            </label>
            <div className="car-request-date-fields">
              <RequestDateField id="borrow-start-date" name="startDate" label="วันที่เริ่มใช้" value={startDate} onChange={setStartDate} />
            </div>
            <label className="car-request-field car-request-field--purpose">วัตถุประสงค์ในการใช้รถ
              <textarea id="borrow-purpose" name="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} rows={3} placeholder="ระบุรายละเอียดการเดินทางหรือภารกิจ" required />
            </label>
            <div className="car-request-actions"><button className="car-request-cancel" type="button" onClick={onCancel}>ยกเลิก</button><button className="car-request-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "กำลังบันทึก..." : "ยืนยันคำขอ"}</button></div>
            {submitMessage && <p className="car-request-message" role="status">{submitMessage}</p>}
          </form>
        </section>
      </section>
      {showConfirmation && <div className="car-request-confirm-backdrop" role="presentation">
        <section className="car-request-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="car-request-confirm-title">
          <span className="car-request-confirm-icon" aria-hidden="true">?</span>
          <h2 id="car-request-confirm-title">ยืนยันคำขอใช้รถ</h2>
          <p>ต้องการส่งคำขอใช้รถ {car.model} ทะเบียน {car.plate} ใช่หรือไม่?</p>
          <div className="car-request-confirm-actions">
            <button type="button" className="car-request-cancel" onClick={() => setShowConfirmation(false)}>กลับไปแก้ไข</button>
            <button type="button" className="car-request-submit" onClick={confirmSubmit} disabled={isSubmitting}>ยืนยันคำขอ</button>
          </div>
        </section>
      </div>}
    </main>
  );
}
