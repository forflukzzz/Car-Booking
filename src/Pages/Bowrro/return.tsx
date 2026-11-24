import { useRef, useState, type FormEvent } from "react";
import carlogo from "../../assets/img/carlogo.png";
import type { BorrowRecord } from "../History/history";
import "./return.css";

export type ReturnDetails = {
  id: number;
  requester: string;
  startDate: string;
  purpose: string;
  mileage: string;
  returnDate: string;
  distance: string;
  issueReport: string;
};

type ReturnPageProps = {
  record: BorrowRecord;
  onCancel: () => void;
  onConfirm: (details: ReturnDetails) => Promise<boolean | void>;
};

const formatDate = (date: string) => {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${Number(year) + 543}`;
};

const toDateInputValue = (date: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [day, month, shortYear] = date.split("/");
  if (!day || !month || !shortYear) {
    return "";
  }
  const year = Number(shortYear) + 2500 - 543;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const getRequesterName = (requester: string) => requester.replace(/\s*\(UID:\s*[^)]+\)\s*$/i, "").trim();
const getRequesterUidTag = (requester: string) => requester.match(/\(UID:\s*[^)]+\)\s*$/i)?.[0].trim() ?? "";

export default function ReturnPage({
  record,
  onCancel,
  onConfirm,
}: ReturnPageProps) {
  const requesterUidTag = getRequesterUidTag(record.requester);
  const [requester, setRequester] = useState(getRequesterName(record.requester));
  const startDate = toDateInputValue(record.date);
  const [returnDate, setReturnDate] = useState(toDateInputValue(record.returnDate));
  const [purpose, setPurpose] = useState(record.purpose);
  const [mileage, setMileage] = useState("");
  const [issueReport, setIssueReport] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSavingReturn, setIsSavingReturn] = useState(false);
  const [pendingReturn, setPendingReturn] = useState<ReturnDetails | null>(null);
  const returnDateRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const latestMileage = Number(mileage.replace(/,/g, ""));
    const startingMileage = Number(record.mileage.replace(/,/g, ""));
    if (!Number.isFinite(latestMileage) || latestMileage < startingMileage) {
      setErrorMessage("เลขไมล์หลังใช้งานต้องไม่น้อยกว่าเลขไมล์ล่าสุด");
      return;
    }

    setPendingReturn({
      id: record.id,
      requester: [requester.trim(), requesterUidTag].filter(Boolean).join(" "),
      startDate,
      purpose,
      mileage: latestMileage.toLocaleString("en-US"),
      returnDate: formatDate(returnDate),
      distance: `${(latestMileage - startingMileage).toLocaleString("en-US")} กม.`,
      issueReport: issueReport.trim(),
    });
  };

  const confirmReturn = async () => {
    if (!pendingReturn || isSavingReturn) return;
    setIsSavingReturn(true);
    setSaveError("");
    try {
      await onConfirm(pendingReturn);
      setPendingReturn(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "บันทึกการคืนรถไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setIsSavingReturn(false);
    }
  };

  return (
    <main className="return-page">

      <section className="return-card" aria-label="แบบฟอร์มคืนรถยนต์">
        <div className="return-vehicle">
          <div className="return-image">
            <img src={record.image || carlogo} alt={`รถทะเบียน ${record.plate}`} onError={(event) => { event.currentTarget.src = carlogo; }} />
          </div>

          <dl className="return-info">
            <div>
              <dt>ทะเบียนรถ</dt>
              <dd className="return-plate">{record.plate}</dd>
            </div>
            <div>
              <dt>เลขไมล์ล่าสุด</dt>
              <dd>{record.mileage}</dd>
            </div>
            <div>
              <dt>ใช้งานล่าสุด</dt>
              <dd>{formatDate(record.date)}</dd>
            </div>
          </dl>
        </div>

        <section className="return-form-panel" aria-labelledby="return-form-title">
          <h2 id="return-form-title">กรอกข้อมูลคืนรถยนต์</h2>
          <form onSubmit={handleSubmit}>
            <label className="return-field return-field--requester return-field--readonly">
              ชื่อผู้ขอ
              <input
                type="text"
                value={requester}
                readOnly
                aria-readonly="true"
                required
              />
            </label>

            <div className="return-date-fields">
              <label className="return-field return-field--readonly">
                วันที่ยืม
                <input
                  type="date"
                  value={startDate}
                  readOnly
                  disabled
                  aria-readonly="true"
                />
              </label>
              <label className="return-field">
                วันที่คืน
                <span className="return-date-input-wrap"><input className="return-date-display" type="text"value={formatDate(returnDate)} readOnly aria-readonly="true" required /><input ref={returnDateRef} className="return-native-date" type="date" value={returnDate} min={startDate || undefined} onChange={(event) => setReturnDate(event.target.value)} tabIndex={-1} aria-hidden="true" /><button type="button" aria-label="เลือกวันที่คืน" onClick={() => returnDateRef.current?.showPicker?.()}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></svg></button></span>
              </label>
            </div>

            <label className="return-field return-field--readonly">
              วัตถุประสงค์ในการใช้รถยนต์
              <textarea
                value={purpose}
                  readOnly
                  aria-readonly="true"
                rows={3}
                required
              />
            </label>

            <div className="return-mileage-issue-fields">
              <label className="return-field return-field--mileage">
                เลขไมล์ล่าสุด
                <input
                  type="number"
                  min={Number(record.mileage.replace(/,/g, ""))}
                  step="1"
                  value={mileage}
                  onChange={(event) => {
                    setMileage(event.target.value);
                    setErrorMessage("");
                  }}
                  required
                />
              </label>

              <label className="return-field return-field--issue-report">
                <textarea
                  value={issueReport}
                  onChange={(event) => setIssueReport(event.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="ระบุปัญหาที่พบ (ถ้ามี)"
                />
              </label>
            </div>

            {errorMessage && (
              <p className="return-error" role="alert">{errorMessage}</p>
            )}

            <div className="return-actions">
              <button
                className="return-cancel"
                type="button"
                onClick={onCancel}
              >
                ยกเลิก
              </button>
              <button className="return-confirm" type="submit">
                ยืนยัน
              </button>
            </div>
          </form>
        </section>
      </section>
      {pendingReturn && <div className="return-confirm-backdrop" role="presentation">
        <section className="return-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="return-confirm-title">
          <span className="return-confirm-icon" aria-hidden="true">โ“</span>
          <h2 id="return-confirm-title">ยืนยันการคืนรถ</h2>
          <p>ตรวจสอบข้อมูลก่อนยืนยันคืนรถทะเบียน {record.plate}</p>
          <dl className="return-confirm-summary">
            <div><dt>วันที่คืน</dt><dd>{pendingReturn.returnDate}</dd></div>
            <div><dt>เลขไมล์ล่าสุด</dt><dd>{pendingReturn.mileage} กม.</dd></div>
            <div><dt>ระยะทางที่ใช้</dt><dd>{pendingReturn.distance}</dd></div>
            {pendingReturn.issueReport && <div className="return-confirm-issue"><dt>รายงานปัญหา</dt><dd>{pendingReturn.issueReport}</dd></div>}
          </dl>
          {saveError && <p className="return-error" role="alert">{saveError}</p>}
          <div className="return-confirm-actions">
            <button className="return-cancel" type="button" onClick={() => setPendingReturn(null)}>กลับไปแก้ไข</button>
            <button className="return-confirm" type="button" onClick={confirmReturn} disabled={isSavingReturn}>{isSavingReturn ? "กำลังบันทึก…" : "ยืนยันคืนรถ"}</button>
          </div>
        </section>
      </div>}
    </main>
  );
}
