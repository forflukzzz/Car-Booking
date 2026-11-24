import carlogo from "../../assets/img/carlogo.png";
import type { CarServiceRecord } from "../../Database/carServiceStorage";
import type { Car } from "../../Database/carStorage";
import { useState } from "react";
import type { BorrowRecord, BorrowStatus } from "../History/history";
import "./datacarDetail.css";

const thai = {
  detail: "\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e23\u0e16\u0e22\u0e19\u0e15\u0e4c",
  plate: "\u0e17\u0e30\u0e40\u0e1a\u0e35\u0e22\u0e19",
  mileage: "\u0e40\u0e25\u0e02\u0e44\u0e21\u0e25\u0e4c\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14",
  lastUsed: "\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14",
  prbExpiry: "\u0e27\u0e31\u0e19\u0e2b\u0e21\u0e14\u0e2d\u0e32\u0e22\u0e38 \u0e1e.\u0e23.\u0e1a.",
  status: "\u0e2a\u0e16\u0e32\u0e19\u0e30",
  history: "\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e23\u0e16",
};
const parseRecordDate = (value: string) => {
  const normalized = value.trim();
  const isoDate = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  const slashDate = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:$|[T\s])/);
  const parsedYear = isoDate?.[1] ?? slashDate?.[3];
  const year = parsedYear
    ? parsedYear.length === 2
      ? 2500 + Number(parsedYear) - 543
      : Number(parsedYear) > 2400 ? Number(parsedYear) - 543 : Number(parsedYear)
    : 0;
  const month = Number(isoDate?.[2] ?? slashDate?.[2]);
  const day = Number(isoDate?.[3] ?? slashDate?.[1]);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};
const formatPrbDate = (value?: string) => {
  if (!value) return "-";
  const date = parseRecordDate(value);
  return date ? `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear() + 543}` : value;
};
const formatCarDate = (value?: string) => {
  if (!value) return "-";
  return formatPrbDate(value);
};
const parseDistance = (value: string) => {
  const distance = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(distance) ? distance : 0;
};
const inspectionItems = ["ระดับน้ำหล่อเย็นในหม้อพักน้ำ", "ระดับน้ำมันเครื่อง รอยรั่วซึมระบบน้ำมัน", "แบตเตอรี่ ขั่วแบตเตอรี่ น้ำกลั่น", "ระบบไฟทั้งหมด", "สภาพยาง ลมยาง สภาพล้อแม็ก", "น้ำฉีดกระจก ยางปัดน้ำฝน", "อื่นๆ"];
const parseInspectionNotes = (value?: string) => {
  if (!value) return [] as string[];
  try {
    const notes: unknown = JSON.parse(value);
    return Array.isArray(notes) ? notes.map(String) : [];
  } catch {
    return [] as string[];
  }
};
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
const getExpiryWarning = (value?: string) => {
  const days = daysUntilExpiry(value);
  if (days === null || days > 30) return "";
  if (days < 0) return "หมดอายุแล้ว";
  if (days === 0) return "หมดอายุวันนี้";
  return `ใกล้หมดอายุใน ${days} วัน`;
};
const getMileageWarning = (mileage?: string, nextMileage?: string) => {
  const current = Number(String(mileage || "").replace(/,/g, ""));
  const next = Number(String(nextMileage || "").replace(/,/g, ""));
  if (!Number.isFinite(current) || !Number.isFinite(next) || !next) return "";
  const remaining = next - current;
  if (remaining > 50) return "";
  if (remaining < 0) return `เกินกำหนดเช็คระยะ ${Math.abs(remaining).toLocaleString("th-TH")} กม.`;
  if (remaining === 0) return "ถึงกำหนดเช็คระยะแล้ว";
  return `เหลืออีก ${remaining.toLocaleString("th-TH")} กม. ถึงรอบเช็คระยะ`;
};
const statusLabels: Record<BorrowStatus, string> = {
  "in-use": "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19",
  reserved: "\u0e08\u0e2d\u0e07\u0e41\u0e25\u0e49\u0e27",
  returned: "\u0e04\u0e37\u0e19\u0e23\u0e16\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08",
  cancelled: "\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e41\u0e25\u0e49\u0e27",
};

type DataCarDetailProps = { car: Car; records: BorrowRecord[]; serviceRecords: CarServiceRecord[]; onBack: () => void };
const normalizeServiceType = (value: string) => {
  const normalized = value.toLocaleLowerCase().replace(/[\s._-]/g, "");
  if (normalized === "prb" || normalized.includes("พรบ") || normalized.includes("compulsory") || normalized.includes("ctp")) return "พ.ร.บ.";
  if (normalized === "insurance" || normalized.includes("ประกัน")) return "ประกัน";
  if (normalized === "maintenance" || normalized.includes("เช็กระยะ") || normalized.includes("เช็คระยะ") || normalized.includes("inspection") || normalized.includes("checkup")) return "เช็คระยะ";
  if (normalized === "servicecenter" || normalized.includes("บำรุงรักษา") || normalized.includes("ซ่อม") || normalized.includes("repair")) return "ซ่อม/บำรุงรักษา";
  return "อื่น ๆ";
};
const getServiceTypeTone = (value: string) => {
  if (value === "พ.ร.บ.") return "prb";
  if (value === "ประกัน") return "insurance";
  if (value === "เช็คระยะ") return "inspection";
  if (value === "บำรุงรักษา") return "maintenance";
  return "default";
};

const DataCarDetail = ({ car, records, serviceRecords, onBack }: DataCarDetailProps) => {
  const [activeTab, setActiveTab] = useState<"details" | "usage" | "management">("details");
  const [chartRange, setChartRange] = useState<6 | 12>(6);
  const carRecords = records.filter((record) => record.carId === car.id || (record.plate === car.plate && record.model === car.model));
  const usageRecords = carRecords.filter((record) => record.status === "returned" || record.status === "in-use");
  const totalDistance = usageRecords.reduce((total, record) => total + parseDistance(record.distance), 0);
  const latestUsageDate = usageRecords.reduce<Date | null>((latest, record) => {
    const date = parseRecordDate(record.date);
    return date && (!latest || date > latest) ? date : latest;
  }, null);
  const chartEndDate = latestUsageDate ?? new Date();
  const chartMonths = Array.from({ length: chartRange }, (_, index) => {
    return new Date(chartEndDate.getFullYear(), chartEndDate.getMonth() - chartRange + index + 1, 1);
  });
  const usageByMonth = new Map<string, number>(chartMonths.map((date) => [`${date.getFullYear()}-${date.getMonth()}`, 0] as const));
  usageRecords.forEach((record) => {
    const date = parseRecordDate(record.date);
    if (!date) return;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (usageByMonth.has(key)) usageByMonth.set(key, (usageByMonth.get(key) ?? 0) + 1);
  });
  const monthlyUsage = chartMonths.map((date) => ({
    label: new Intl.DateTimeFormat("th-TH", { month: "short" }).format(date),
    count: usageByMonth.get(`${date.getFullYear()}-${date.getMonth()}`) ?? 0,
  }));
  const chartTop = 22;
  const chartBottom = 148;
  const chartLeft = 52;
  const chartRight = 630;
  const chartMax = Math.max(5, Math.ceil(Math.max(...monthlyUsage.map((month) => month.count), 0) / 5) * 5);
  const chartPoints = monthlyUsage.map((month, index) => ({
    ...month,
    x: chartLeft + (monthlyUsage.length === 1 ? 0 : index * (chartRight - chartLeft) / (monthlyUsage.length - 1)),
    y: chartBottom - (month.count / chartMax) * (chartBottom - chartTop),
  }));
  const chartLine = chartPoints.length > 0
    ? chartPoints.slice(1).reduce((path, point, index) => {
      const previous = chartPoints[index];
      const midpoint = (previous.x + point.x) / 2;
      return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
    }, `M ${chartPoints[0].x} ${chartPoints[0].y}`)
    : "";
  const chartArea = chartPoints.length > 0
    ? `${chartLine} L ${chartPoints[chartPoints.length - 1].x} ${chartBottom} L ${chartPoints[0].x} ${chartBottom} Z`
    : "";
  const carServiceRecords = serviceRecords.filter((record) => record.carId === car.id);
  const latestPrbRecord = carServiceRecords
    .filter((record) => record.recordType === "prb" && record.expiryDate)
    .sort((first, second) => second.serviceDate.localeCompare(first.serviceDate))[0];
  const latestInsuranceRecord = carServiceRecords
    .filter((record) => record.recordType === "insurance" && record.expiryDate)
    .sort((first, second) => second.serviceDate.localeCompare(first.serviceDate))[0];
  const latestMaintenanceRecord = carServiceRecords
    .filter((record) => record.recordType === "service-center" && record.serviceDate)
    .sort((first, second) => second.serviceDate.localeCompare(first.serviceDate))[0];
  const latestInspectionRecord = carServiceRecords
    .filter((record) => record.recordType === "maintenance" && record.serviceDate)
    .sort((first, second) => second.serviceDate.localeCompare(first.serviceDate))[0];
  const latestCheckRecord = carServiceRecords
    .filter((record) => ["maintenance", "service-center"].includes(record.recordType) && record.serviceDate)
    .sort((first, second) => second.serviceDate.localeCompare(first.serviceDate))[0];
  const prbExpiry = car.prbExpiry || latestPrbRecord?.expiryDate;
  const insuranceExpiry = car.insuranceExpiry || latestInsuranceRecord?.expiryDate;
  const lastServiceDate = latestMaintenanceRecord?.serviceDate || car.lastServiceDate;
  const latestInspectionDate = latestInspectionRecord?.serviceDate || car.maintenanceDue;
  const inspectionStatuses = [latestInspectionRecord?.engineOil, latestInspectionRecord?.brakePads, latestInspectionRecord?.tires, latestInspectionRecord?.airConditioner, latestInspectionRecord?.brakes, latestInspectionRecord?.windshieldWiper, latestInspectionRecord?.otherInspection];
  const inspectionHasIssue = inspectionStatuses.some((result) => result === "\u0e41\u0e01\u0e49\u0e44\u0e02" || result === "\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32") || latestInspectionRecord?.inspectionResult === "\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32";
  const inspectionNotes = parseInspectionNotes(latestInspectionRecord?.inspectionNotes);
  const failedInspectionItems = inspectionStatuses.flatMap((result, index) => {
    if (result !== "\u0e41\u0e01\u0e49\u0e44\u0e02") return [];
    const itemName = inspectionItems[index] || `\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08 ${index + 1}`;
    const note = inspectionNotes[index]?.trim();
    const repairItem = `${itemName}${note ? ` (${note})` : ""}`;
    const legacyRepairItem = `แก้ไขจากผลตรวจ: ${repairItem}`;
    const repaired = Boolean(latestInspectionRecord && carServiceRecords.some((record) => record.recordType === "service-center" && record.id > latestInspectionRecord.id && [repairItem, legacyRepairItem].some((item) => record.item.trim() === item.trim())));
    return [{ itemName, repaired }];
  });
  const completedInspectionItemCount = failedInspectionItems.filter((item) => item.repaired).length;
  const inspectionRepairsComplete = failedInspectionItems.length > 0 && completedInspectionItemCount === failedInspectionItems.length;
  const latestInspectionResult = latestInspectionRecord
    ? failedInspectionItems.length > 0
      ? `${inspectionRepairsComplete ? "แก้ไขแล้ว" : "พบปัญหา"} ${failedInspectionItems.map((item) => item.itemName).join(", ")}${!inspectionRepairsComplete && completedInspectionItemCount > 0 ? ` · แก้ไขแล้ว ${completedInspectionItemCount}/${failedInspectionItems.length} รายการ` : ""}`
      : inspectionHasIssue ? "\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32" : latestInspectionRecord.inspectionResult || "-"
    : "";
  const latestInspectionTone = inspectionHasIssue && !inspectionRepairsComplete
    ? "issue"
    : inspectionRepairsComplete || latestInspectionRecord?.inspectionResult === "\u0e1c\u0e48\u0e32\u0e19" ? "pass" : "";
  const nextMaintenanceMileage = car.nextMaintenanceMileage || latestCheckRecord?.nextMaintenanceMileage;
  const sortedUsageRecords = [...usageRecords].sort((first, second) => {
    const firstDate = parseRecordDate(first.date)?.getTime() ?? 0;
    const secondDate = parseRecordDate(second.date)?.getTime() ?? 0;
    return secondDate - firstDate;
  });
  const latestUsageRecord = sortedUsageRecords[0];
  const latestIssueRecord = sortedUsageRecords.find((record) => record.issueReport?.trim());
  const latestIssue = latestIssueRecord?.issueReport;
  const latestIssueResolved = Boolean(latestIssueRecord && carServiceRecords.some((record) => record.recordType === "service-center" && record.relatedBorrowRecordId === latestIssueRecord.id));
  const insuranceWarning = getExpiryWarning(insuranceExpiry);
  const prbWarning = getExpiryWarning(prbExpiry);
  const mileageWarning = getMileageWarning(car.mileage, nextMaintenanceMileage);
  const statusText = { busy: statusLabels["in-use"], available: "\u0e27\u0e48\u0e32\u0e07", reserved: statusLabels.reserved }[car.status];
  const yTicks = Array.from({ length: 6 }, (_, index) => Math.round(chartMax * (5 - index) / 5));

  return (
    <main className="datacar-detail-page">
      <div className="datacar-detail-container">
        <header className="datacar-detail-topbar">
          <nav className="datacar-detail-tabs" role="tablist" aria-label="หน้ารายละเอียดรถ">
            <button id="vehicle-detail-tab" type="button" role="tab" aria-controls="vehicle-detail-panel" aria-selected={activeTab === "details"} className={activeTab === "details" ? "is-active" : ""} onClick={() => setActiveTab("details")}><span aria-hidden="true">▣</span>หน้าข้อมูลรถ</button>
            <button id="vehicle-usage-tab" type="button" role="tab" aria-controls="vehicle-detail-panel" aria-selected={activeTab === "usage"} className={activeTab === "usage" ? "is-active" : ""} onClick={() => setActiveTab("usage")}><span aria-hidden="true">◷</span>ประวัติการใช้งานรถ</button>
            <button id="vehicle-management-tab" type="button" role="tab" aria-controls="vehicle-detail-panel" aria-selected={activeTab === "management"} className={activeTab === "management" ? "is-active" : ""} onClick={() => setActiveTab("management")}><span aria-hidden="true">⚙</span>ประวัติจัดการรถ</button>
          </nav>
          <button className="datacar-detail-back" type="button" onClick={onBack}><span aria-hidden="true">←</span>ย้อนกลับ</button>
        </header>
        <section className="datacar-detail-card" id="vehicle-detail-panel" role="tabpanel" aria-label={thai.detail}>
          {activeTab === "details" && <div className="datacar-detail-dashboard">
            <div className="datacar-detail-overview">
              <section className="datacar-detail-vehicle" aria-label={`${car.model} ${car.plate}`}>
                <div className="datacar-detail-image"><img src={car.image ?? carlogo} alt={`${car.model} ${car.plate}`} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = carlogo; }} /></div>
              </section>
              <section className="datacar-detail-content" aria-labelledby="vehicle-info-title">
                <div className="datacar-detail-panel-heading"><span aria-hidden="true">▤</span><div><h2 id="vehicle-info-title">ข้อมูลรถ</h2><p>รายละเอียดและสถานะล่าสุด</p></div></div>
                <dl className="datacar-detail-info">
                  <div><dt>ยี่ห้อ/รุ่น</dt><dd>{car.model}</dd></div>
                  <div><dt>{thai.plate}</dt><dd>{car.plate}</dd></div>
                  <div><dt>{thai.mileage}</dt><dd>{Number(String(car.mileage).replace(/,/g, "")).toLocaleString("th-TH")} กม.</dd></div>
                  <div><dt>{thai.lastUsed}</dt><dd>{formatCarDate(latestUsageRecord?.date || car.lastUsed)}</dd></div>
                  <div><dt>เข้าบำรุงรักษาล่าสุด</dt><dd>{formatCarDate(lastServiceDate)}{latestMaintenanceRecord?.item ? ` · ${latestMaintenanceRecord.item}` : ""}</dd></div>
                  <div><dt>เช็คระยะล่าสุด</dt><dd>{formatCarDate(latestInspectionDate)}{latestInspectionDate && latestInspectionResult && <span className={`datacar-detail-inspection-result ${latestInspectionTone ? `datacar-detail-inspection-result--${latestInspectionTone}` : ""}`}>{latestInspectionResult}</span>}</dd></div>
                  <div><dt>เช็คระยะรอบถัดไป</dt><dd>{nextMaintenanceMileage ? `${Number(nextMaintenanceMileage).toLocaleString("th-TH")} กม.` : "ยังไม่ได้ระบุ"}{mileageWarning && <span className="datacar-detail-warning" role="status">{mileageWarning}</span>}</dd></div>
                  <div><dt>{thai.prbExpiry}</dt><dd>{formatPrbDate(prbExpiry)}{prbWarning && <span className="datacar-detail-warning" role="status">{prbWarning}</span>}</dd></div>
                  <div><dt>วันหมดอายุประกัน</dt><dd>{formatCarDate(insuranceExpiry)}{insuranceWarning && <span className="datacar-detail-warning" role="status">{insuranceWarning}</span>}</dd></div>
                  <div><dt>ปัญหาระหว่างใช้งาน</dt><dd>{latestIssue ? <span className={`datacar-detail-issue-badge${latestIssueResolved ? " datacar-detail-issue-badge--resolved" : ""}`} title={latestIssue}>{latestIssueResolved ? `${latestIssue} · แก้ไขแล้ว` : latestIssue}</span> : <span className="datacar-detail-issue-clear">ไม่มีรายงาน</span>}</dd></div>
                  <div><dt>{thai.status}</dt><dd><span className={`datacar-detail-status datacar-detail-status--${car.status}`}>{statusText}</span></dd></div>
                </dl>
              </section>
            </div>
            <div className="datacar-detail-insights">
              <section className="datacar-detail-stats" aria-labelledby="vehicle-stats-title">
                <div className="datacar-detail-section-title"><span aria-hidden="true">▥</span><h2 id="vehicle-stats-title">สถิติการใช้งาน</h2></div>
                <article className="datacar-detail-stat datacar-detail-stat--distance"><span className="datacar-detail-stat-icon" aria-hidden="true">▤</span><div><p>ระยะทางรวม</p><strong>{totalDistance.toLocaleString("th-TH")} <small>กม.</small></strong></div></article>
                <article className="datacar-detail-stat datacar-detail-stat--trips"><span className="datacar-detail-stat-icon" aria-hidden="true">▦</span><div><p>จำนวนการใช้งาน</p><strong>{usageRecords.length} <small>ครั้ง</small></strong></div></article>
              </section>
              <section className="datacar-detail-chart-card" aria-labelledby="usage-chart-title">
                <div className="datacar-detail-chart-heading">
                  <div className="datacar-detail-chart-title"><span aria-hidden="true">▥</span><div><h2 id="usage-chart-title">แนวโน้มการใช้งานรถ</h2><p>จำนวนครั้งการใช้งานรถรายเดือน (ครั้ง)</p></div></div>
                  <label className="datacar-detail-range"><span aria-hidden="true">▦</span><select value={chartRange} onChange={(event) => setChartRange(Number(event.target.value) as 6 | 12)} aria-label="ช่วงเวลาของกราฟ"><option value={6}>6 เดือนล่าสุด</option><option value={12}>12 เดือนล่าสุด</option></select></label>
                </div>
                <div className="datacar-detail-chart" role="img" aria-label={`จำนวนการใช้งานรถย้อนหลัง ${chartRange} เดือน`}>
                  <svg viewBox="0 0 680 190" preserveAspectRatio="none" aria-hidden="true">
                    <defs><linearGradient id="usage-area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#55a9f7" stopOpacity=".72" /><stop offset="100%" stopColor="#9fd2ff" stopOpacity=".28" /></linearGradient></defs>
                    {yTicks.map((tick, index) => {
                      const y = chartTop + index * (chartBottom - chartTop) / 5;
                      return <g key={`${tick}-${index}`}><line x1={chartLeft - 8} x2={chartRight + 6} y1={y} y2={y} className="datacar-detail-chart-grid" /><text x="10" y={y + 4} className="datacar-detail-chart-tick">{tick}</text></g>;
                    })}
                    <path d={chartArea} className="datacar-detail-chart-area" />
                    <path d={chartLine} className="datacar-detail-chart-line" />
                    {chartPoints.map((point) => <g key={point.label}><circle cx={point.x} cy={point.y} r="4.5" className="datacar-detail-chart-point" />{point.count > 0 && <g className="datacar-detail-chart-callout"><rect x={point.x - 29} y={Math.max(1, point.y - 32)} width="58" height="23" rx="11.5" /><text x={point.x} y={Math.max(1, point.y - 32) + 15}>{point.count} ครั้ง</text></g>}<text x={point.x} y="177" className="datacar-detail-chart-month">{point.label}</text></g>)}
                  </svg>
                </div>
              </section>
            </div>
          </div>}
          {activeTab === "usage" && <div className="datacar-detail-tables datacar-detail-tables--single">
            <section className="datacar-detail-history" aria-labelledby="usage-history-title">
              <div className="datacar-detail-history-heading"><div><h2 id="usage-history-title">{thai.history}</h2><p>ประวัติการใช้งานรถคันนี้</p></div><span>{carRecords.length} รายการ</span></div>
              <div className="datacar-detail-table-scroll"><table className="datacar-detail-table datacar-detail-table--usage">
                <thead><tr><th>วันที่ยืม/จอง</th><th>ชื่อผู้ใช้</th><th>วัตถุประสงค์</th><th>เลขไมล์ก่อนใช้</th><th>วันที่คืน</th><th>เลขไมล์หลังใช้งาน</th><th>ระยะทาง</th><th>สถานะ</th><th>ปัญหาระหว่างใช้งาน</th></tr></thead>
                <tbody>{carRecords.map((record) => {
                  const issue = record.issueReport?.trim();
                  const issueResolved = Boolean(issue && carServiceRecords.some((serviceRecord) => serviceRecord.recordType === "service-center" && serviceRecord.relatedBorrowRecordId === record.id));
                  return <tr key={record.id}>
                    <td className="datacar-detail-date-cell">{formatCarDate(record.date)}</td>
                    <td className="datacar-detail-user-cell">{record.requester.replace(/\s*\(UID:\s*[^)]+\)\s*$/i, "").trim() || "-"}</td>
                    <td className="datacar-detail-purpose-cell">{record.purpose || "-"}</td>
                    <td>{record.startMileage || record.mileage || "-"}</td>
                    <td className="datacar-detail-date-cell">{formatCarDate(record.returnDate)}</td>
                    <td>{record.endMileage || "-"}</td>
                    <td>{record.distance || "-"}</td>
                    <td><span className={`datacar-detail-history-status datacar-detail-history-status--${record.status}`}><i />{statusLabels[record.status]}</span></td>
                    <td>{issue ? <span className={`datacar-detail-usage-issue${issueResolved ? " datacar-detail-usage-issue--resolved" : ""}`} title={issue}>{issueResolved ? `${issue} · แก้ไขแล้ว` : issue}</span> : <span className="datacar-detail-usage-clear">ไม่มีปัญหา</span>}</td>
                  </tr>;
                })}
                  {carRecords.length === 0 && <tr><td colSpan={9}>ยังไม่มีประวัติการใช้งานรถคันนี้</td></tr>}
                </tbody>
              </table></div>
            </section>
          </div>}
          {activeTab === "management" && <div className="datacar-detail-tables datacar-detail-tables--single">
            <section className="datacar-detail-history datacar-detail-management" aria-labelledby="management-history-title">
              <div className="datacar-detail-history-heading"><div><h2 id="management-history-title">ตารางประวัติการจัดการรถ</h2><p>รายการของรถคันนี้</p></div><span>{carServiceRecords.length} รายการ</span></div>
              <div className="datacar-detail-table-scroll"><table className="datacar-detail-table datacar-detail-table--management">
                <thead><tr><th>วันที่</th><th>รายการ</th><th>ผู้ดำเนินการ</th></tr></thead>
                <tbody>{carServiceRecords.map((record) => {
                  const item = normalizeServiceType(record.recordType);
                  return <tr key={record.id}><td>{formatCarDate(record.serviceDate)}</td><td><span className={`datacar-service-type datacar-service-type--${getServiceTypeTone(item)}`}>{item}</span></td><td>{record.performedBy || "-"}</td></tr>;
                })}
                  {carServiceRecords.length === 0 && <tr><td colSpan={3}>ยังไม่มีประวัติการจัดการรถคันนี้</td></tr>}
                </tbody>
              </table></div>
            </section>
          </div>}
        </section>
      </div>
    </main>
  );
};

export default DataCarDetail;
