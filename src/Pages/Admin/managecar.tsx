import { useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Car } from "../../Database/carStorage";
import type { CarServiceRecord } from "../../Database/carServiceStorage";
import type { BorrowRecord } from "../History/history";
import carLogo from "../../assets/img/carlogo.png";
import "./managecar.css";

type ManageCarProps = {
  cars: Car[];
  borrowRecords: BorrowRecord[];
  serviceRecords: CarServiceRecord[];
  carLoadError: string;
  performedBy: string;
  onAction?: (car: Car, action: "maintenance" | "inspection" | "prb" | "insurance") => void;
  onAddServiceRecord?: (record: Omit<CarServiceRecord, "id">) => Promise<void>;
};

type DetailAction = "maintenance" | "inspection" | "prb" | "insurance";

type IconName = "car" | "alert" | "check" | "wrench" | "shield" | "search" | "arrow" | "calendar";

const Icon = ({ name }: { name: IconName }) => {
  const paths: Record<IconName, ReactNode> = {
    car: <><path d="m5 11 1.7-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.8 1.3L19 11" /><path d="M3.5 11h17v6h-17zM6 17v2m12-2v2" /></>,
    alert: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    wrench: <><path d="M14.7 6.1a4 4 0 0 0-5 5L4 16.8a1.7 1.7 0 0 0 2.4 2.4l5.7-5.7a4 4 0 0 0 5-5l-2.3 2.3-2.4-.6-.6-2.4 2.3-1.7Z" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    arrow: <path d="m9 18 6-6-6-6" />,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7 3v4m10-4v4M3.5 9h17M7 13h.01m4 0h.01m4 0h.01M7 17h.01m4 0h.01" /></>,
  };
  return <svg className="managecar-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
};

function SaveFeedbackPopup({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  return (
    <div className="managecar-feedback-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`managecar-feedback-modal managecar-feedback-modal--${type}`} role="alertdialog" aria-modal="true" aria-labelledby="managecar-feedback-title">
        <div className="managecar-feedback-icon" aria-hidden="true">{type === "success" ? "✓" : "!"}</div>
        <span className="managecar-feedback-kicker">VEHICLE MANAGEMENT</span>
        <h2 id="managecar-feedback-title">{type === "success" ? "บันทึกสำเร็จ" : "บันทึกไม่สำเร็จ"}</h2>
        <p>{message}</p>
        <button type="button" onClick={onClose}>เข้าใจแล้ว</button>
      </section>
    </div>
  );
}

const statusLabel = (status: Car["status"]) => status === "available" ? "ว่าง" : status === "busy" ? "กำลังใช้งาน" : "จองแล้ว";

const detailConfig: Record<DetailAction, { title: string; description: string; tone: string; fields: { label: string; placeholder: string; type?: string }[] }> = {
  maintenance: { title: "ซ่อม/บำรุงรักษา",  tone: "orange", fields: [{ label: "วันที่เข้ารับบริการ", placeholder: "เลือกวันที่", type: "date" }, { label: "ผู้ดำเนินการ", placeholder: "ชื่อผู้ดำเนินการ" }, { label: "รายการ", placeholder: "เช่น เปลี่ยนแบตเตอรี่" }, { label: "อู่ / ศูนย์บริการ", placeholder: "ชื่ออู่หรือศูนย์บริการ" }] },
  inspection: { title: "เช็คสภาพ",  tone: "purple", fields: [{ label: "วันที่ตรวจ", placeholder: "เลือกวันที่", type: "date" }, { label: "ผู้ดำเนินการ", placeholder: "ชื่อผู้ดำเนินการ" }, { label: "น้ำมันเครื่อง", placeholder: "ปกติ / ควรเปลี่ยน" }, { label: "แบตเตอรี่", placeholder: "ปกติ / ควรเปลี่ยน" }, { label: "ยาง", placeholder: "ปกติ / ควรเปลี่ยน" }, { label: "แอร์ / เบรก", placeholder: "ผลการตรวจ" }, { label: "ผลตรวจสรุป", placeholder: "ผ่าน / ต้องซ่อม" }] },
  prb: { title: "พ.ร.บ.",  tone: "cyan", fields: [{ label: "วันที่ทำรายการ", placeholder: "เลือกวันที่", type: "date" }, { label: "ผู้ดำเนินการ", placeholder: "ชื่อผู้ดำเนินการ" }, { label: "วันที่เริ่มคุ้มครอง", placeholder: "เลือกวันที่", type: "date" }, { label: "วันหมดอายุ", placeholder: "เลือกวันที่", type: "date" }] },
  insurance: { title: "ประกัน",  tone: "green", fields: [{ label: "วันที่ทำรายการ", placeholder: "เลือกวันที่", type: "date" }, { label: "ผู้ดำเนินการ", placeholder: "ชื่อผู้ดำเนินการ" }, { label: "วันที่เริ่มคุ้มครอง", placeholder: "เลือกวันที่", type: "date" }, { label: "วันหมดอายุ", placeholder: "เลือกวันที่", type: "date" }] },
};

const inspectionItems = ["ระดับน้ำหล่อเย็นในหม้อพักน้ำ", "ระดับน้ำมันเครื่อง รอยรั่วซึมระบบน้ำมัน", "แบตเตอรี่ ขั่วแบตเตอรี่ น้ำกลั่น", "ระบบไฟทั้งหมด", "สภาพยาง ลมยาง สภาพล้อแม็ก","น้ำฉีดกระจก ยางปัดน้ำฝน","อื่นๆ"];
const toDatabaseDate = (value: string) => {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return value;
  const buddhistYear = Number(match[3]);
  const gregorianYear = buddhistYear >= 2400 ? buddhistYear - 543 : buddhistYear;
  return `${gregorianYear}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
};
const formatDisplayDate = (value?: string) => {
  if (!value) return "ยังไม่มีข้อมูล";
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${Number(isoMatch[1]) + 543}`;
  const thaiMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (thaiMatch) {
    const year = Number(thaiMatch[3]);
    return `${thaiMatch[1].padStart(2, "0")}/${thaiMatch[2].padStart(2, "0")}/${year >= 2400 ? year : year + 543}`;
  }
  return value;
};
const parseInspectionNotes = (value: string) => {
  try {
    const notes: unknown = JSON.parse(value);
    return Array.isArray(notes) ? notes.map(String) : [];
  } catch {
    return [];
  }
};

function CarSummaryCard({ car, reportedIssues, selectedIssueId, onIssueSelect }: { car: Car; reportedIssues?: BorrowRecord[]; selectedIssueId?: string; onIssueSelect?: (id: string) => void }) {
  const details = [
    ["เช็คระยะรอบถัดไป", car.nextMaintenanceMileage ? `${Number(car.nextMaintenanceMileage).toLocaleString("th-TH")} กม.` : "ยังไม่ได้ระบุ"],
    ["ทะเบียน", car.plate],
    ["เลขไมล์ล่าสุด", `${car.mileage || "-"} กม.`],
    ["พ.ร.บ.", formatDisplayDate(car.prbExpiry)],
    ["ประกัน", formatDisplayDate(car.insuranceExpiry)],
    ["เช็คระยะล่าสุด", formatDisplayDate(car.maintenanceDue)],
    ["ซ่อม/บำรุงรักษาล่าสุด", formatDisplayDate(car.lastServiceDate)],
  ];

  return <aside className="managecar-inspection-car managecar-car-summary">
    <img src={car.image || carLogo} alt="" onError={(event) => { event.currentTarget.src = carLogo; }} />
    <h2>{car.model}</h2>
    <div className="managecar-car-summary-grid">{details.map(([label, value]) => <div key={label}><strong>{label}</strong><b>{value}</b></div>)}</div>
    {reportedIssues && <label className="managecar-related-issue"><strong>รายงานปัญหาที่จะแก้ไข</strong>{reportedIssues.length ? <select name="relatedBorrowRecordId" value={selectedIssueId ?? ""} onChange={(event) => onIssueSelect?.(event.target.value)}><option value="">เลือกรายงานปัญหาเพื่อเติมช่องรายการ</option>{reportedIssues.map((record) => { const summary = record.issueReport?.trim().replace(/\s+/g, " ") || "มีการแจ้งปัญหา"; return <option key={record.id} value={record.id} title={summary}>{formatDisplayDate(record.date)} · {summary}</option>; })}</select> : <span className="managecar-related-issue-empty">ยังไม่มีรายงานปัญหาที่ยังไม่ได้แก้ไขของรถคันนี้</span>}</label>}
  </aside>;
}

function DateInput({ name, required = false }: { name: string; required?: boolean }) {
  const [value, setValue] = useState("");
  const calendarRef = useRef<HTMLInputElement>(null);
  const formatTypedDate = (input: string) => {
    const digits = input.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };
  return <div className="managecar-date-input"><input name={name} value={value} onChange={(event) => setValue(formatTypedDate(event.target.value))} inputMode="numeric" placeholder="วว/ดด/ปปปป" pattern="\d{1,2}/\d{1,2}/\d{4}" required={required} /><button type="button" aria-label="เลือกวันที่" onClick={() => { const picker = calendarRef.current; if (!picker) return; if (picker.showPicker) picker.showPicker(); else picker.click(); }}><Icon name="calendar" /></button><input ref={calendarRef} className="managecar-calendar-native" type="date" onChange={(event) => { const [year, month, day] = event.target.value.split("-"); if (year && month && day) setValue(`${day}/${month}/${Number(year) + 543}`); }} /></div>;
}

function InspectionDetailPage({
  car,
  performedBy,
  onBack,
  onSave,
}: {
  car: Car;
  performedBy: string;
  onBack: () => void;
  onSave: (record: Omit<CarServiceRecord, "id">) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const currentMileage = Number(String(car.mileage || "0").replace(/,/g, "").trim());
  const minimumMileage = Number.isFinite(currentMileage) ? currentMileage : 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    setError("");
    const form = new FormData(event.currentTarget);
    const serviceDate = toDatabaseDate(String(form.get("serviceDate") || ""));
    const performedBy = String(form.get("performedBy") || "");
    const mileageValue = String(form.get("mileage") || "").trim();
    const mileageNumber = Number(mileageValue.replace(/,/g, ""));
    if (!String(form.get("serviceDate") || "").trim()) {
      setError("กรุณากรอกวันที่ตรวจ");
      return;
    }
    if (!performedBy.trim()) {
      setError("กรุณากรอกชื่อผู้ดำเนินการ");
      return;
    }
    if (!mileageValue) {
      setError("กรุณากรอกเลขไมล์ปัจจุบันของรถ");
      return;
    }
    if (!Number.isFinite(mileageNumber) || mileageNumber < minimumMileage) {
      setError(`เลขไมล์ต้องไม่ต่ำกว่าเลขไมล์ปัจจุบันของรถ (${minimumMileage.toLocaleString("th-TH")} กม.)`);
      return;
    }
    const nextMaintenanceMileageValue = String(form.get("nextMaintenanceMileage") || "").trim();
    if (!nextMaintenanceMileageValue) {
      setError("กรุณากรอกเช็คระยะรอบถัดไป");
      return;
    }
    const nextMaintenanceMileageNumber = Number(nextMaintenanceMileageValue.replace(/,/g, ""));
    if (!Number.isFinite(nextMaintenanceMileageNumber) || nextMaintenanceMileageNumber <= mileageNumber) {
      setError(`เช็คระยะรอบถัดไปต้องมากกว่าเลขไมล์ปัจจุบันของรถ (${mileageNumber.toLocaleString("th-TH")} กม.)`);
      return;
    }
    const mileage = String(mileageNumber);
    const nextMaintenanceMileage = String(nextMaintenanceMileageNumber);
    const missingStatusIndex = inspectionItems.findIndex((_, index) => !String(form.get(`status-${index}`) || "").trim());
    if (missingStatusIndex !== -1) {
      setError(`กรุณาเลือกผลตรวจ: ${inspectionItems[missingStatusIndex]}`);
      return;
    }
    setSaving(true);
    const status = inspectionItems.map((_, index) => String(form.get(`status-${index}`) || "ปกติ"));
    const remarks = inspectionItems.map((_, index) => String(form.get(`remark-${index}`) || ""));

    try {
      await onSave({
        carId: car.id,
        recordType: "maintenance",
        serviceDate,
        mileage,
        serviceCenter: "",
        performedBy,
        startDate: "",
        expiryDate: "",
        item: "เช็คสภาพรถ",
        engineOil: status[0],
        brakePads: status[1],
        tires: status[2],
        airConditioner: status[3],
        brakes: status[4],
        windshieldWiper: status[5],
        otherInspection: status[6],
        inspectionResult: status.some((value) => value === "แก้ไข") ? "พบปัญหา" : "ผ่าน",
        inspectionNotes: JSON.stringify(remarks),
        nextMaintenanceMileage,
      });
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="managecar-inspection-page">
        <button className="managecar-back-button" type="button" onClick={onBack}><span aria-hidden="true">&#8592;</span> ย้อนกลับ</button>


      <form onSubmit={submit} noValidate>
        <div className="managecar-inspection-layout">
          <CarSummaryCard car={car} />

          <section className="managecar-inspection-card">
            <div className="managecar-inspection-card-heading">
              <div>
                <span>INSPECTION CHECKLIST</span>
                <h2>รายการตรวจเช็ค</h2>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>รายการตรวจ</th>
                  <th>ปกติ</th>
                  <th>แก้ไข</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {inspectionItems.map((item, index) => (
                  <tr key={item}>
                    <td>{index + 1}</td>
                    <td>{item}</td>
                    <td>
                      <label className="managecar-check">
                        <input
                          type="radio"
                          name={`status-${index}`}
                          value="ปกติ"
                        />
                        <span />
                      </label>
                    </td>
                    <td>
                      <label className="managecar-check managecar-check--fix">
                        <input
                          type="radio"
                          name={`status-${index}`}
                          value="แก้ไข"
                        />
                        <span />
                      </label>
                    </td>
                    <td>
                        <input name={`remark-${index}`} placeholder="" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="managecar-inspection-footer">
          <label>
            วันที่ตรวจ
            <DateInput name="serviceDate" required />
          </label>
          <label>
            เลขไมล์ล่าสุด
            <input
              name="mileage"
              type="number"
              inputMode="numeric"
              min={minimumMileage}
              step="1"
              placeholder="เช่น 145000"
              defaultValue={minimumMileage}
              required
            />
          </label>
          <label>
            เช็คระยะรอบถัดไป
            <input
              name="nextMaintenanceMileage"
              type="number"
              min={minimumMileage + 1}
              step="1"
              inputMode="numeric"
              placeholder=""
              defaultValue={car.nextMaintenanceMileage || ""}
              required
            />
          </label>
          <label>
            ผู้ดำเนินการ
            <input
              name="performedBy"
              defaultValue={performedBy}
              placeholder="ชื่อผู้ดำเนินการ"
              required
            />
          </label>
          <span className={error ? "managecar-save-error" : ""}>
            {error || (saved ? "บันทึกประวัติเรียบร้อยแล้ว" : "")}
          </span>
          <button type="submit" disabled={saving}>
            {saving ? "กำลังบันทึก..." : "บันทึกผลตรวจ"}
          </button>
        </div>
      </form>
      {saved && <SaveFeedbackPopup message="บันทึกผลตรวจและเลขไมล์เรียบร้อยแล้ว" type="success" onClose={() => setSaved(false)} />}
      {error && <SaveFeedbackPopup message={error} type="error" onClose={() => setError("")} />}
    </section>
  );
}

function CarDetailPage({
  car,
  action,
  borrowRecords,
  serviceRecords,
  performedBy,
  onBack,
  onSave,
}: {
  car: Car;
  action: DetailAction;
  borrowRecords: BorrowRecord[];
  serviceRecords: CarServiceRecord[];
  performedBy: string;
  onBack: () => void;
  onSave: (record: Omit<CarServiceRecord, "id">) => Promise<void>;
}) {
  if (action === "inspection") {
    return <InspectionDetailPage car={car} performedBy={performedBy} onBack={onBack} onSave={onSave} />;
  }

  const config = detailConfig[action];
  const resolvedIssueIds = new Set(serviceRecords
    .filter((record) => record.recordType === "service-center" && record.relatedBorrowRecordId != null)
    .map((record) => record.relatedBorrowRecordId as number));
  const relatedIssues = action === "maintenance"
    ? borrowRecords
      .filter((record) => (record.carId === car.id || (record.plate === car.plate && record.model === car.model)) && Boolean(record.issueReport?.trim()) && !resolvedIssueIds.has(record.id))
      .sort((first, second) => second.id - first.id)
    : [];
  const latestInspection = serviceRecords
    .filter((record) => record.carId === car.id && record.recordType === "maintenance")
    .sort((first, second) => second.serviceDate.localeCompare(first.serviceDate) || second.id - first.id)[0];
  const inspectionFixes: { id: string; label: string; item: string }[] = action === "maintenance" && latestInspection
    ? [latestInspection].flatMap((record) => {
      const statuses = [record.engineOil, record.brakePads, record.tires, record.airConditioner, record.brakes, record.windshieldWiper, record.otherInspection];
      const notes = parseInspectionNotes(record.inspectionNotes);
      return statuses.flatMap((status, index) => {
        if (status !== "แก้ไข") return [];
        const itemName = inspectionItems[index] || `รายการตรวจ ${index + 1}`;
        const note = notes[index]?.trim();
        const item = `${itemName}${note ? ` (${note})` : ""}`;
        const alreadyRepaired = serviceRecords.some((serviceRecord) =>
          serviceRecord.carId === car.id
          && serviceRecord.recordType === "service-center"
          && serviceRecord.item.trim() === item.trim()
          && serviceRecord.id > record.id
        );
        if (alreadyRepaired) return [];
        return [{
          id: `inspection-${record.id}-${index}`,
          label: `ตรวจ ${formatDisplayDate(record.serviceDate)} · ${itemName}${note ? ` · ${note}` : ""}`,
          item,
        }];
      });
    })
    : [];
  const repairOptions: { id: string; label: string; item: string; relatedBorrowRecordId?: number }[] = [
    ...relatedIssues.map((record) => {
      const summary = record.issueReport?.trim().replace(/\s+/g, " ") || "มีการแจ้งปัญหา";
      return { id: `borrow-${record.id}`, label: `รายงาน ${formatDisplayDate(record.date)} · ${summary}`, item: summary, relatedBorrowRecordId: record.id };
    }),
    ...inspectionFixes,
  ];
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedRepairOptionIds, setSelectedRepairOptionIds] = useState<string[]>([]);
  const [repairItem, setRepairItem] = useState("");
  const requiresAllFields = ["maintenance", "prb", "insurance"].includes(action);

  const selectRepairOption = (option: (typeof repairOptions)[number]) => {
    const nextIds = selectedRepairOptionIds.includes(option.id)
      ? selectedRepairOptionIds.filter((id) => id !== option.id)
      : [...selectedRepairOptionIds, option.id];
    setSelectedRepairOptionIds(nextIds);
    setRepairItem(repairOptions.filter((repairOption) => nextIds.includes(repairOption.id)).map((repairOption) => repairOption.item).join(", "));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const formData = new FormData(event.currentTarget);
    const values = config.fields.map((_, index) => String(formData.get(`field-${index}`) || ""));
    const requiredFieldIndexes = requiresAllFields ? config.fields.map((_, index) => index) : [0, 1];
    const missingFieldIndex = values.findIndex((value, index) => requiredFieldIndexes.includes(index) && !value.trim());
    if (missingFieldIndex !== -1) {
      setSaving(false);
      setError(`กรุณากรอก${config.fields[missingFieldIndex]?.label || "ข้อมูลให้ครบถ้วน"}`);
      return;
    }
    const [serviceDateValue, performedBy, ...details] = values;
    const serviceDate = toDatabaseDate(serviceDateValue);
    const isDateField = (index: number) => config.fields[index]?.type === "date";
    const normalizedDetails = details.map((value, index) => isDateField(index + 2) ? toDatabaseDate(value) : value);
    const isInspection = action === "inspection";
    const isDocument = action === "prb" || action === "insurance";
    const selectedRepairOptions = repairOptions.filter((option) => selectedRepairOptionIds.includes(option.id));
    const selectedRepairText = selectedRepairOptions.map((option) => option.item).join(", ");
    const typedRepairItem = details[0]?.trim() || "";
    const recordsToSave = action === "maintenance" && selectedRepairOptions.length > 0
      ? [...selectedRepairOptions, ...(typedRepairItem !== selectedRepairText ? [{ item: typedRepairItem, relatedBorrowRecordId: undefined }] : [])]
      : [{ item: action === "maintenance" ? details[0] || "" : "", relatedBorrowRecordId: undefined }];
    try {
      for (const repairRecord of recordsToSave) {
        await onSave({
          carId: car.id,
          recordType: isInspection ? "maintenance" : isDocument ? action : "service-center",
          serviceDate,
          mileage: car.mileage,
          serviceCenter: action === "maintenance" ? details[1] || "" : "",
          performedBy,
          startDate: isDocument ? normalizedDetails[0] || "" : "",
          expiryDate: isDocument ? normalizedDetails[1] || "" : "",
          item: repairRecord.item,
          relatedBorrowRecordId: action === "maintenance" ? repairRecord.relatedBorrowRecordId : undefined,
          engineOil: isInspection ? details[0] || "" : "",
          brakePads: isInspection ? details[1] || "" : "",
          tires: isInspection ? details[2] || "" : "",
          airConditioner: isInspection ? details[3] || "" : "",
          brakes: isInspection ? details[3] || "" : "",
          inspectionResult: isInspection ? details[4] || "" : "",
          inspectionNotes: "",
          nextMaintenanceMileage: isInspection ? details[5] || "" : "",
        });
      }
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`managecar-record-page managecar-detail-page--${config.tone}`}>
      <button className="managecar-back-button" type="button" onClick={onBack}><span aria-hidden="true">&#8592;</span> ย้อนกลับ</button>
      <form className="managecar-record-form" onSubmit={submit} noValidate>
        <div className="managecar-inspection-layout managecar-record-layout">
          <CarSummaryCard car={car} />
          <section className="managecar-inspection-card managecar-record-card">
            <div className="managecar-inspection-card-heading"><div><span>VEHICLE INFORMATION</span><h2>รายละเอียด {config.title}</h2></div><small>รถ {car.plate}</small></div>
            {action === "maintenance" && <div className="managecar-issue-picker">
              <span className="managecar-issue-picker-label">เลือกรายการปัญหาที่ต้องการซ่อม (เลือกได้หลายรายการ)</span>
              {repairOptions.length > 0 ? <div className="managecar-issue-options" role="group" aria-label="รายการปัญหาและผลตรวจที่ต้องแก้ไข">
                {repairOptions.map((option) => <button
                  key={option.id}
                  type="button"
                  className={selectedRepairOptionIds.includes(option.id) ? "managecar-issue-option managecar-issue-option--selected" : "managecar-issue-option"}
                  aria-pressed={selectedRepairOptionIds.includes(option.id)}
                  title={option.label}
                  onClick={() => selectRepairOption(option)}
                >{option.label}</button>)}
              </div> : <span className="managecar-issue-picker-empty">ยังไม่มีรายงานปัญหาหรือรายการตรวจที่ต้องแก้ไข</span>}
            </div>}
            <div className="managecar-record-fields">
              {config.fields.map((field, index) => <label key={field.label}>{field.label}
                {field.type === "date"
                  ? <DateInput name={`field-${index}`} required={requiresAllFields || index < 2} />
                  : action === "maintenance" && index === 2
                    ? <input name={`field-${index}`} type="text" placeholder={field.placeholder} value={repairItem} onChange={(event) => setRepairItem(event.target.value)} />
                    : <input name={`field-${index}`} type={field.type || "text"} placeholder={field.placeholder} defaultValue={index === 1 ? performedBy : undefined} required={requiresAllFields || index === 1} />}
              </label>)}
              {action === "inspection" && <label>เช็คระยะรอบถัดไป (กม.)<input name="nextMaintenanceMileage" type="number" min="0" step="1" placeholder="เช่น 500" required /></label>}
            </div>
            <div className="managecar-inspection-footer managecar-record-footer"><span className={error ? "managecar-save-error" : ""}>{error || (saved ? "บันทึกประวัติเรียบร้อยแล้ว" : "กรอกข้อมูลให้ครบถ้วนก่อนบันทึก")}</span><button type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกรายการ"}</button></div>
          </section>
        </div>
      </form>
      {saved && <SaveFeedbackPopup message="บันทึกรายการและอัปเดตข้อมูลรถเรียบร้อยแล้ว" type="success" onClose={() => setSaved(false)} />}
      {error && <SaveFeedbackPopup message={error} type="error" onClose={() => setError("")} />}
    </section>
  );
}

export default function ManageCar({ cars, borrowRecords, serviceRecords, carLoadError, performedBy, onAction, onAddServiceRecord }: ManageCarProps) {
  const [detail, setDetail] = useState<{ car: Car; action: DetailAction } | null>(null);
  const attentionCount = cars.filter((car) => car.prbExpiry || car.insuranceExpiry).length;
  const availableCount = cars.filter((car) => car.status === "available").length;
  const activeCount = cars.filter((car) => car.status === "busy" || car.status === "reserved").length;

  if (detail) return <main className={`managecar-page managecar-page--detail${detail.action === "inspection" ? " managecar-page--inspection" : ""}`}><div className="managecar-shell"><CarDetailPage car={detail.car} action={detail.action} borrowRecords={borrowRecords} serviceRecords={serviceRecords} performedBy={performedBy} onBack={() => setDetail(null)} onSave={async (record) => { if (!onAddServiceRecord) throw new Error("ยังไม่ได้เชื่อมต่อฐานข้อมูลรายการรถ"); await onAddServiceRecord(record); onAction?.(detail.car, detail.action); }} /></div></main>;

  return <main className="managecar-page">
    <div className="managecar-shell">


      <section className="managecar-stat-grid" aria-label="สรุปข้อมูลรถ">
        <article className="managecar-stat"><span className="managecar-stat-icon managecar-stat-icon--blue"><Icon name="car" /></span><div><small>รถทั้งหมด</small><strong>{cars.length}</strong><em>คัน</em></div><span className="managecar-stat-trend">100%</span></article>
        <article className="managecar-stat"><span className="managecar-stat-icon managecar-stat-icon--amber"><Icon name="alert" /></span><div><small>ต้องตรวจสอบ</small><strong>{attentionCount}</strong><em>รายการ</em></div><span className="managecar-stat-trend managecar-stat-trend--amber"><Icon name="alert" /></span></article>
        <article className="managecar-stat"><span className="managecar-stat-icon managecar-stat-icon--green"><Icon name="check" /></span><div><small>ว่าง</small><strong>{availableCount}</strong><em>คัน</em></div><span className="managecar-stat-trend">{cars.length ? Math.round((availableCount / cars.length) * 100) : 0}%</span></article>
        <article className="managecar-stat"><span className="managecar-stat-icon managecar-stat-icon--purple"><Icon name="wrench" /></span><div><small>กำลังใช้งาน</small><strong>{activeCount}</strong><em>คัน</em></div><span className="managecar-stat-trend managecar-stat-trend--purple">LIVE</span></article>
      </section>

      <div className="managecar-list-header"><div><h2>รายการรถยนต์</h2><p>เลือกเมนูเพื่อจัดการข้อมูลของรถแต่ละคัน</p></div><div className="managecar-list-tools"><label><Icon name="search" /><input aria-label="ค้นหารถ" placeholder="ค้นหาทะเบียนหรือรุ่นรถ" /></label><span>{cars.length} คัน</span></div></div>
      {carLoadError && <p className="managecar-error" role="alert">โหลดข้อมูลรถไม่สำเร็จ: {carLoadError}</p>}
      <section className="managecar-list" aria-label="รายการรถยนต์">
        {cars.map((car) => <article className="managecar-card" key={car.id}><div className="managecar-vehicle-image"><div className="managecar-image-backdrop" /><img src={car.image || carLogo} alt="" onError={(event) => { event.currentTarget.src = carLogo; }} /></div><div className="managecar-vehicle-info"><div className="managecar-vehicle-top"><span className={`managecar-status managecar-status--${car.status}`}><i />{statusLabel(car.status)}</span></div><h3>{car.model}</h3><strong>{car.plate}</strong><p><span>เลขไมล์ปัจจุบัน</span><b>{car.mileage} กม.</b></p></div><div className="managecar-actions"><button type="button" className="managecar-action managecar-action--maintenance" onClick={() => setDetail({ car, action: "maintenance" })}><span><Icon name="wrench" /></span><b>ซ่อม/บำรุงรักษา</b><Icon name="arrow" /></button><button type="button" className="managecar-action managecar-action--inspection" onClick={() => setDetail({ car, action: "inspection" })}><span><Icon name="check" /></span><b>เช็คสภาพ</b><Icon name="arrow" /></button><button type="button" className="managecar-action managecar-action--prb" onClick={() => setDetail({ car, action: "prb" })}><span><Icon name="shield" /></span><b>พ.ร.บ.</b><Icon name="arrow" /></button><button type="button" className="managecar-action managecar-action--insurance" onClick={() => setDetail({ car, action: "insurance" })}><span><Icon name="shield" /></span><b>ประกัน</b><Icon name="arrow" /></button></div></article>)}
        {cars.length === 0 && <div className="managecar-empty"><span><Icon name="car" /></span><h3>ยังไม่มีรถในระบบ</h3><p>เพิ่มรถยนต์เพื่อเริ่มจัดการข้อมูล</p></div>}
      </section>
    </div>
  </main>;
}
