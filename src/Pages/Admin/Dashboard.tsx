import type { Car } from "../../Database/carStorage";
import type { CarServiceRecord } from "../../Database/carServiceStorage";
import type { BorrowRecord, BorrowStatus } from "../History/history";
import "./dashboard.css";

type DashboardProps = { cars: Car[]; historyRecords: BorrowRecord[]; serviceRecords: CarServiceRecord[] };
type IconName = "car" | "available" | "calendar" | "warning" | "chart" | "pie" | "bell" | "wrench" | "issue";
type AlertItem = { id: string; tone: "danger" | "warning" | "success"; icon: "warning" | "wrench" | "issue" | "available"; title: string; vehicle: string; detail: string; priority: number; issue?: boolean; resolved?: boolean };

const Icon = ({ type }: { type: IconName }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {type === "car" && <><path d="m4 13 1.7-5A2 2 0 0 1 7.6 6.5h8.8A2 2 0 0 1 18.3 8L20 13v5h-2v-2H6v2H4z" /><path d="M4 13h16M7 16h.01M17 16h.01" /></>}
    {type === "available" && <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>}
    {type === "calendar" && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h2" /></>}
    {type === "warning" && <><path d="M12 3 22 20H2z" /><path d="M12 9v5M12 17h.01" /></>}
    {type === "chart" && <><path d="M4 19V11M10 19V6M16 19v-9M22 19H2" /></>}
    {type === "pie" && <><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>}
    {type === "bell" && <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>}
    {type === "wrench" && <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z" />}
    {type === "issue" && <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /><path d="M12 8v4M12 16h.01" /></>}
  </svg>
);

const parseDate = (value?: string) => {
  if (!value) return null;
  const normalized = value.trim();
  const iso = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slash = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (iso) {
    const year = Number(iso[1]);
    const date = new Date(year > 2400 ? year - 543 : year, Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (slash) {
    const parsedYear = Number(slash[3]);
    const year = slash[3].length === 2 ? 2500 + parsedYear - 543 : parsedYear > 2400 ? parsedYear - 543 : parsedYear;
    const date = new Date(year, Number(slash[2]) - 1, Number(slash[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: string) => {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short", year: "numeric" }).format(date) : value || "-";
};

const parseMileage = (value?: string) => {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const daysUntil = (value?: string) => {
  const date = parseDate(value);
  if (!date) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((dateUtc - todayUtc) / 86400000);
};

const serviceMileageRemaining = (car: Car) => {
  const current = parseMileage(car.mileage);
  const next = parseMileage(car.nextMaintenanceMileage);
  return current !== null && next !== null ? next - current : null;
};

const needsService = (car: Car) => {
  const remaining = serviceMileageRemaining(car);
  return remaining !== null && remaining <= 50;
};

const statusLabels: Record<BorrowStatus, string> = { "in-use": "กำลังใช้งาน", reserved: "จองแล้ว", returned: "คืนรถแล้ว", cancelled: "ยกเลิกแล้ว" };
const inspectionItems = ["ระดับน้ำหล่อเย็นในหม้อพักน้ำ", "ระดับน้ำมันเครื่อง รอยรั่วซึมระบบน้ำมัน", "แบตเตอรี่ ขั่วแบตเตอรี่ น้ำกลั่น", "ระบบไฟทั้งหมด", "สภาพยาง ลมยาง สภาพล้อแม็ก", "น้ำฉีดกระจก ยางปัดน้ำฝน", "อื่นๆ"];

const getOutstandingInspectionItems = (inspection: CarServiceRecord, serviceRecords: CarServiceRecord[]) => {
  let notes: string[] = [];
  try {
    const parsed: unknown = JSON.parse(inspection.inspectionNotes || "[]");
    if (Array.isArray(parsed)) notes = parsed.map(String);
  } catch {
    notes = [];
  }

  const statuses = [inspection.engineOil, inspection.brakePads, inspection.tires, inspection.airConditioner, inspection.brakes, inspection.windshieldWiper, inspection.otherInspection];
  return statuses.flatMap((status, index) => {
    if (status !== "แก้ไข") return [];
    const itemName = inspectionItems[index] || `รายการตรวจ ${index + 1}`;
    const note = notes[index]?.trim();
    const repairItem = `${itemName}${note ? ` (${note})` : ""}`;
    const legacyRepairItem = `แก้ไขจากผลตรวจ: ${repairItem}`;
    const hasRepairRecord = serviceRecords.some((record) => record.carId === inspection.carId
      && record.recordType === "service-center"
      && record.id > inspection.id
      && [repairItem, legacyRepairItem].some((item) => record.item.trim() === item.trim()));
    return hasRepairRecord ? [] : [`${itemName}${note ? ` (${note})` : ""}`];
  });
};

export default function Dashboard({ cars, historyRecords, serviceRecords }: DashboardProps) {
  const resolvedIssueIds = new Set(serviceRecords
    .filter((record) => record.recordType === "service-center" && record.relatedBorrowRecordId != null)
    .map((record) => record.relatedBorrowRecordId as number));
  const serviceDueIds = new Set(cars.filter((car) => car.status === "available" && needsService(car)).map((car) => car.id));
  const reportedIssueCarIds = new Set<number>();
  historyRecords.forEach((record) => {
    if (!record.issueReport?.trim() || resolvedIssueIds.has(record.id)) return;
    const car = cars.find((candidate) => candidate.id === record.carId || (candidate.plate === record.plate && candidate.model === record.model));
    if (car) reportedIssueCarIds.add(car.id);
  });
  const inspectionFindings = cars.flatMap((car) => {
    const latestInspection = serviceRecords
      .filter((record) => record.carId === car.id && record.recordType === "maintenance")
      .sort((first, second) => second.serviceDate.localeCompare(first.serviceDate) || second.id - first.id)[0];
    if (!latestInspection) return [];
    const items = getOutstandingInspectionItems(latestInspection, serviceRecords);
    return items.length > 0 ? [{ carId: car.id, date: latestInspection.serviceDate, items }] : [];
  });
  const inspectionFindingsByCar = new Map(inspectionFindings.map((finding) => [finding.carId, finding]));
  const inspectionFindingCarIds = new Set(inspectionFindingsByCar.keys());
  const maintenanceCarIds = new Set([...serviceDueIds, ...reportedIssueCarIds, ...inspectionFindingCarIds]);
  const availableCount = cars.filter((car) => car.status === "available" && !maintenanceCarIds.has(car.id)).length;
  const activeCount = cars.filter((car) => car.status === "busy" && !maintenanceCarIds.has(car.id)).length;
  const reservedCount = cars.filter((car) => car.status === "reserved" && !maintenanceCarIds.has(car.id)).length;
  const maintenanceCount = maintenanceCarIds.size;
  const usageRecords = historyRecords.filter((record) => record.status !== "cancelled");
  const mostUsedCars = cars.map((car) => ({
    car,
    count: usageRecords.filter((record) => record.carId === car.id || (record.plate === car.plate && record.model === car.model)).length,
  })).sort((first, second) => second.count - first.count || first.car.id - second.car.id);
  const totalUsageCount = usageRecords.length;
  const mostUsedCar = mostUsedCars[0];
  const mostUsedCount = mostUsedCar?.count || 0;
  const vehicleColors = ["#1682f5", "#8b5cf6", "#14b8a6", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];
  const usageSegments = mostUsedCars.map(({ car, count }, index) => ({
    label: `${car.model} (${car.plate})`,
    count,
    color: vehicleColors[index % vehicleColors.length],
    tone: "vehicle",
  }));
  const totalCars = cars.length;
  let donutProgress = 0;
  const donutStops = usageSegments.map((segment) => {
    const start = donutProgress;
    donutProgress += totalUsageCount ? (segment.count / totalUsageCount) * 100 : 0;
    return `${segment.color} ${start}% ${donutProgress}%`;
  });
  const donutBackground = totalUsageCount ? `conic-gradient(${donutStops.join(", ")})` : "conic-gradient(#e8eef6 0 100%)";

  const today = new Date();
  const historyDates = historyRecords
    .filter((record) => record.status !== "cancelled")
    .map((record) => parseDate(record.date))
    .filter((date): date is Date => date !== null);
  const latestHistoryDate = historyDates.reduce<Date | null>((latest, date) => !latest || date > latest ? date : latest, null);
  const chartEndDate = latestHistoryDate ?? today;
  const monthBuckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(chartEndDate.getFullYear(), chartEndDate.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const month = new Intl.DateTimeFormat("th-TH", { month: "short" }).format(date);
    return { key, label: `${month} ${date.getFullYear()}`, count: 0 };
  });
  const monthLookup = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));
  usageRecords.forEach((record) => {
    const date = parseDate(record.date);
    if (!date) return;
    const bucket = monthLookup.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    if (bucket) bucket.count += 1;
  });

  const chartWidth = 620;
  const chartLeft = 48;
  const chartRight = 608;
  const chartTop = 20;
  const chartBottom = 166;
  const chartMax = Math.max(5, Math.ceil(Math.max(...monthBuckets.map((bucket) => bucket.count)) / 5) * 5);
  const points = monthBuckets.map((bucket, index) => ({
    ...bucket,
    x: chartLeft + (index * (chartRight - chartLeft)) / (monthBuckets.length - 1),
    y: chartBottom - (bucket.count / chartMax) * (chartBottom - chartTop),
  }));
  const linePath = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, "");
  const areaPath = `${linePath} L ${chartRight} ${chartBottom} L ${chartLeft} ${chartBottom} Z`;
  const yGuides = Array.from({ length: 5 }, (_, index) => ({
    y: chartTop + (index / 4) * (chartBottom - chartTop),
    value: Math.round(chartMax * (1 - index / 4)),
  }));

  const latestRecords = [...historyRecords]
    .sort((first, second) => (parseDate(second.date)?.getTime() ?? second.id) - (parseDate(first.date)?.getTime() ?? first.id));

  const vehicleAlerts: AlertItem[] = cars.flatMap((car) => {
    const items: AlertItem[] = [];
    const vehicle = `${car.model} (${car.plate})`;
    const inspectionFinding = inspectionFindingsByCar.get(car.id);
    if (inspectionFinding) items.push({
      id: `${car.id}-inspection-findings`,
      tone: "danger",
      icon: "wrench",
      title: "เช็คระยะพบรายการต้องแก้ไข",
      vehicle,
      detail: `${formatDate(inspectionFinding.date)} · ${inspectionFinding.items.join(" · ")}`,
      priority: -2,
    });
    ([{ name: "ประกัน", date: car.insuranceExpiry }, { name: "พ.ร.บ.", date: car.prbExpiry }] as const).forEach(({ name, date }) => {
      const remainingDays = daysUntil(date);
      if (remainingDays === null || remainingDays > 30) return;
      items.push({
        id: `${car.id}-${name}`,
        tone: remainingDays < 0 || remainingDays <= 7 ? "danger" : "warning",
        icon: "warning",
        title: `${name} ${remainingDays < 0 ? "หมดอายุแล้ว" : "ใกล้หมดอายุ"}`,
        vehicle,
        detail: remainingDays < 0 ? `เลยกำหนด ${Math.abs(remainingDays)} วัน` : remainingDays === 0 ? "หมดอายุวันนี้" : `เหลือ ${remainingDays} วัน`,
        priority: remainingDays < 0 ? 0 : remainingDays <= 7 ? 1 : 2,
      });
    });
    const remainingMileage = serviceMileageRemaining(car);
    if (remainingMileage !== null && remainingMileage <= 50) items.push({
      id: `${car.id}-service`,
      tone: remainingMileage <= 0 ? "danger" : "warning",
      icon: "wrench",
      title: "ถึงกำหนดเช็คระยะ",
      vehicle,
      detail: remainingMileage < 0 ? `เกินกำหนด ${Math.abs(remainingMileage).toLocaleString("th-TH")} กม.` : `เหลือ ${remainingMileage.toLocaleString("th-TH")} กม.`,
      priority: remainingMileage <= 0 ? 0 : 2,
    });
    return items;
  });
  const issueAlerts: AlertItem[] = [...historyRecords]
    .filter((record) => Boolean(record.issueReport?.trim()))
    .sort((first, second) => (parseDate(second.date)?.getTime() ?? second.id) - (parseDate(first.date)?.getTime() ?? first.id))
    .map((record) => {
      const resolved = resolvedIssueIds.has(record.id);
      return {
        id: `${record.id}-issue`,
        tone: resolved ? "success" as const : "danger" as const,
        icon: resolved ? "available" as const : "issue" as const,
        title: resolved ? "แก้ไขแล้ว" : "ปัญหาระหว่างใช้งาน",
        vehicle: `${record.model} (${record.plate})`,
        detail: record.issueReport?.trim() || "มีการแจ้งปัญหา",
        priority: resolved ? 0 : -1,
        issue: true,
        resolved,
      };
    });
  const alerts = [...issueAlerts, ...vehicleAlerts]
    .sort((first, second) => first.priority - second.priority);
  const latestResolvedIssue = issueAlerts.find((alert) => alert.resolved);
  if (latestResolvedIssue && !alerts.some((alert) => alert.resolved)) {
    if (alerts.length > 0) alerts[alerts.length - 1] = latestResolvedIssue;
    else alerts.push(latestResolvedIssue);
  }

  const stats = [
    { label: "รถทั้งหมด", value: totalCars, unit: "คัน", icon: "car" as const, tone: "blue" },
    { label: "ว่าง", value: availableCount, unit: "คัน", icon: "available" as const, tone: "green" },
    { label: "กำลังใช้งาน", value: activeCount, unit: "คัน", icon: "car" as const, tone: "red" },
    { label: "จองแล้ว", value: reservedCount, unit: "คัน", icon: "calendar" as const, tone: "yellow" },
    { label: "ต้องบำรุงรักษา", value: maintenanceCount, unit: "คัน", icon: "warning" as const, tone: "orange" },
  ];

  return (
    <main className="admin-dashboard-page">
      <div className="admin-dashboard-container">
        <header className="admin-dashboard-header">
          <div className="admin-dashboard-title"><h1>แดชบอร์ด</h1><p>ภาพรวมการใช้งานและสถานะรถยนต์</p></div>
          <div className="admin-dashboard-updated"><span>อัปเดตล่าสุด</span><strong>{formatDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`)}</strong></div>
        </header>
        <section className="admin-dashboard-stats" aria-label="สรุปสถานะรถยนต์">
          {stats.map((stat) => <article className={`dashboard-stat dashboard-stat--${stat.tone}`} key={stat.label}><span className="dashboard-stat-icon"><Icon type={stat.icon} /></span><div className="dashboard-stat-copy"><p>{stat.label}</p><strong>{stat.value}</strong><small>{stat.unit}</small></div></article>)}
        </section>

        <section className="dashboard-analytics-grid">
          <article className="dashboard-panel dashboard-trend-panel">
            <div className="dashboard-panel-heading"><span className="dashboard-panel-icon dashboard-panel-icon--blue"><Icon type="chart" /></span><div><h2>สถิติการใช้งานรถ</h2><p>จากประวัติการใช้รถย้อนหลัง 6 เดือน</p></div><span className="dashboard-period">6 เดือนล่าสุด</span></div>
            <div className="dashboard-chart-wrap">
              <svg className="dashboard-chart" viewBox={`0 0 ${chartWidth} 210`} role="img" aria-label="กราฟจำนวนรายการใช้งานรถในช่วง 6 เดือนล่าสุด">
                <defs><linearGradient id="dashboard-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1682f5" stopOpacity=".35" /><stop offset="100%" stopColor="#1682f5" stopOpacity=".04" /></linearGradient></defs>
                {yGuides.map((guide, index) => <g key={index}><line x1={chartLeft} x2={chartRight} y1={guide.y} y2={guide.y} className="dashboard-chart-gridline" /><text x="35" y={guide.y + 4} textAnchor="end" className="dashboard-chart-axis-label">{guide.value}</text></g>)}
                <path d={areaPath} fill="url(#dashboard-chart-fill)" /><path d={linePath} className="dashboard-chart-line" />
                {points.map((point) => <g key={point.key}><circle cx={point.x} cy={point.y} r="4" className="dashboard-chart-point"><title>{point.label}: {point.count} รายการ</title></circle><text x={point.x} y="194" textAnchor="middle" className="dashboard-chart-month">{point.label.split(" ")[0]}</text></g>)}
              </svg>
              {monthBuckets.every((bucket) => bucket.count === 0) && <p className="dashboard-chart-empty">ยังไม่มีรายการใช้งานในช่วงนี้</p>}
            </div>
          </article>

          <article className="dashboard-panel dashboard-status-panel">
            <div className="dashboard-panel-heading"><span className="dashboard-panel-icon dashboard-panel-icon--blue"><Icon type="pie" /></span><div><h2>รถที่ใช้งานบ่อยที่สุด</h2><p>จัดอันดับจากประวัติการใช้รถ</p></div></div>
            <div className="dashboard-donut-layout">
              <div className="dashboard-donut" style={{ background: donutBackground }} role="img" aria-label={mostUsedCar ? `${mostUsedCar.car.model} ใช้งาน ${mostUsedCount} ครั้ง` : "ยังไม่มีประวัติการใช้งานรถ"} />
              <div className="dashboard-status-list">{mostUsedCars.map(({ car, count }, index) => {
                const percentage = totalUsageCount ? (count / totalUsageCount) * 100 : 0;
                const color = vehicleColors[index % vehicleColors.length];
                return <div className="dashboard-status-row" key={car.id}><span className="dashboard-status-dot" style={{ backgroundColor: color }} /><span className="dashboard-status-car"><span>{car.model}</span><small>{car.plate}</small></span><strong>{count} ครั้ง <small>({percentage.toFixed(1)}%)</small></strong></div>;
              })}</div>
            </div>
          </article>
        </section>

        <section className="dashboard-lower-grid">
          <article className="dashboard-panel dashboard-recent-panel">
            <div className="dashboard-panel-heading"><span className="dashboard-panel-icon dashboard-panel-icon--blue"><Icon type="calendar" /></span><div><h2>ประวัติการใช้รถ</h2><p>รายการใช้งานรถที่บันทึกล่าสุด</p></div><span className="dashboard-panel-count">{historyRecords.length} รายการ</span></div>
            <div className="dashboard-table-wrap"><table className="dashboard-table">
              <thead><tr><th>วันที่</th><th>ผู้ยืม</th><th>รถยนต์</th><th>วัตถุประสงค์</th><th>สถานะ</th></tr></thead>
              <tbody>
                {latestRecords.map((record) => <tr key={record.id}><td>{formatDate(record.date)}</td><td>{record.requester.replace(/\s*\(UID:\s*[^)]+\)\s*$/i, "").trim()}</td><td><strong>{record.model}</strong><small>{record.plate}</small></td><td>{record.purpose}</td><td><span className={`dashboard-record-status dashboard-record-status--${record.status}`}>{statusLabels[record.status]}</span></td></tr>)}
                {latestRecords.length === 0 && <tr><td colSpan={5} className="dashboard-table-empty">ยังไม่มีรายการจองใช้รถ</td></tr>}
              </tbody>
            </table></div>
          </article>

          <article className="dashboard-panel dashboard-alerts-panel">
            <div className="dashboard-panel-heading"><span className="dashboard-panel-icon dashboard-panel-icon--blue"><Icon type="bell" /></span><div><h2>รายการที่ต้องดำเนินการ</h2><p>รายการสำคัญที่ควรติดตาม</p></div><span className="dashboard-panel-count">{alerts.length} รายการ</span></div>
            <div className="dashboard-alert-list">
              {alerts.map((alert) => <article className={`dashboard-alert dashboard-alert--${alert.tone}${alert.issue ? " dashboard-alert--issue" : ""}`} key={alert.id}><span className="dashboard-alert-icon"><Icon type={alert.icon} /></span><div className="dashboard-alert-copy"><strong>{alert.title}</strong><span>{alert.vehicle}</span></div><b title={alert.detail}>{alert.detail}</b></article>)}
              {alerts.length === 0 && <div className="dashboard-alert-empty"><span><Icon type="available" /></span><strong>ไม่มีรายการเร่งด่วน</strong><small>รถยนต์และเอกสารอยู่ในสถานะปกติ</small></div>}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
