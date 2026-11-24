import { useMemo, useState } from "react";
import type { Car } from "../../Database/carStorage";
import type { CarServiceRecord } from "../../Database/carServiceStorage";
import type { BorrowRecord } from "../History/history";
import "./Historymanagecar.css";

type HistoryManageCarProps = { cars: Car[]; serviceRecords: CarServiceRecord[]; borrowRecords: BorrowRecord[]; carLoadError?: string };
type HistoryTab = "all" | "maintenance" | "inspection" | "prb" | "insurance";
type Row = { id: string; type: Exclude<HistoryTab, "all">; date?: string; car?: Car; values: string[]; title: string; record?: CarServiceRecord };

const tabs: { id: HistoryTab; label: string; tone: string }[] = [
  { id: "all", label: "ทั้งหมด", tone: "blue" },
  { id: "maintenance", label: "ซ่อม/บำรุงรักษา", tone: "orange" },
  { id: "inspection", label: "เช็คระยะ", tone: "purple" },
  { id: "prb", label: "พ.ร.บ.", tone: "cyan" },
  { id: "insurance", label: "ประกัน", tone: "green" },
];

const headers: Record<Exclude<HistoryTab, "all">, string[]> = {
  maintenance: ["วันที่", "ทะเบียน", "ผู้ดำเนินการ", "รายการ", "อู่", "รายงานปัญหาที่เชื่อมโยง"],
  inspection: ["วันที่", "ทะเบียน", "ผู้ดำเนินการ", "ระดับน้ำหล่อเย็น", "ระดับน้ำมันเครื่อง", "แบตเตอรี่", "ระบบไฟ", "สภาพยาง", "น้ำฉีดกระจก/ยางปัดน้ำฝน", "อื่นๆ", "ผลตรวจรวม"],
  prb: ["วันที่", "ทะเบียน", "ผู้ดำเนินการ", "วันที่เริ่ม", "วันหมดอายุ"],
  insurance: ["วันที่", "ทะเบียน", "ผู้ดำเนินการ", "วันที่เริ่ม", "วันหมดอายุ"],
};

const formatDate = (value?: string) => {
  if (!value) return "-";
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

const typeLabel = (type: Row["type"]) => ({ maintenance: "ซ่อม/บำรุงรักษา", inspection: "เช็คระยะ", prb: "พ.ร.บ.", insurance: "ประกัน" })[type];
const inspectionItems = ["ระดับน้ำหล่อเย็นในหม้อพักน้ำ", "ระดับน้ำมันเครื่อง รอยรั่วซึมระบบน้ำมัน", "แบตเตอรี่ ขั่วแบตเตอรี่ น้ำกลั่น", "ระบบไฟทั้งหมด", "สภาพยาง ลมยาง สภาพล้อแม็ก", "น้ำฉีดกระจก ยางปัดน้ำฝน", "อื่นๆ"];
const getInspectionNotes = (value?: string): string[] => {
  if (!value) return [];
  try { const notes: unknown = JSON.parse(value); return Array.isArray(notes) ? notes.map(String) : []; }
  catch { return []; }
};
const getInspectionSummary = (record: CarServiceRecord) => {
  const statuses = [record.engineOil, record.brakePads, record.tires, record.airConditioner, record.brakes, record.windshieldWiper, record.otherInspection];
  if (statuses.includes("แก้ไข")) return "พบปัญหา";
  if (statuses.includes("ปกติ")) return "ผ่าน";
  return record.inspectionResult || "-";
};

const getInspectionRepairItem = (record: CarServiceRecord, index: number) => {
  const statuses = [record.engineOil, record.brakePads, record.tires, record.airConditioner, record.brakes, record.windshieldWiper, record.otherInspection];
  if (statuses[index] !== "\u0e41\u0e01\u0e49\u0e44\u0e02") return null;
  const notes = getInspectionNotes(record.inspectionNotes);
  const itemName = inspectionItems[index] || `\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08 ${index + 1}`;
  const note = notes[index]?.trim();
  return `${itemName}${note ? ` (${note})` : ""}`;
};

const isInspectionItemRepaired = (record: CarServiceRecord, index: number, serviceRecords: CarServiceRecord[]) => {
  const repairItem = getInspectionRepairItem(record, index);
  const legacyRepairItem = repairItem ? `แก้ไขจากผลตรวจ: ${repairItem}` : "";
  return Boolean(repairItem && serviceRecords.some((serviceRecord) => serviceRecord.carId === record.carId
    && serviceRecord.recordType === "service-center"
    && serviceRecord.id > record.id
    && [repairItem, legacyRepairItem].some((item) => serviceRecord.item.trim() === item.trim())));
};

const getInspectionNoteWithRepairStatus = (record: CarServiceRecord | undefined, index: number, serviceRecords: CarServiceRecord[]) => {
  if (!record) return "-";
  const note = getInspectionNotes(record.inspectionNotes)[index]?.trim();
  return isInspectionItemRepaired(record, index, serviceRecords)
    ? `${note ? `${note} ` : ""}(แก้ไขแล้ว)`
    : note || "-";
};

const getInspectionFollowUpSummary = (record: CarServiceRecord, serviceRecords: CarServiceRecord[]) => {
  const statuses = [record.engineOil, record.brakePads, record.tires, record.airConditioner, record.brakes, record.windshieldWiper, record.otherInspection];
  const failedIndexes = statuses.flatMap((status, index) => status === "\u0e41\u0e01\u0e49\u0e44\u0e02" ? [index] : []);
  if (failedIndexes.length === 0) return getInspectionSummary(record);
  const fixedCount = failedIndexes.filter((index) => isInspectionItemRepaired(record, index, serviceRecords)).length;
  return fixedCount === failedIndexes.length ? "แก้ไขแล้ว" : getInspectionSummary(record);
};

export default function Historymanagecar({ cars, serviceRecords, borrowRecords, carLoadError }: HistoryManageCarProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>("all");
  const [query, setQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const carById = new Map(cars.map((car) => [car.id, car]));
  const borrowRecordById = new Map(borrowRecords.map((record) => [record.id, record]));
  const rows = useMemo<Row[]>(() => {
    const serviceRows = serviceRecords.map((record) => {
      const car = carById.get(record.carId);
      const linkedIssue = record.relatedBorrowRecordId == null ? undefined : borrowRecordById.get(record.relatedBorrowRecordId);
      const linkedIssueText = linkedIssue?.issueReport?.trim()
        ? `\u0e17\u0e33\u0e01\u0e32\u0e23\u0e41\u0e01\u0e49\u0e44\u0e02\u0e41\u0e25\u0e49\u0e27 · ${linkedIssue.issueReport.trim().replace(/\s+/g, " ")}`
        : "-";
      if (record.recordType === "prb" || record.recordType === "insurance") {
        return {
          id: `${record.recordType}-${record.id}`,
          type: record.recordType,
          date: record.serviceDate,
          car,
          record,
          title: typeLabel(record.recordType),
          values: [formatDate(record.serviceDate), car?.plate || "-", record.performedBy || "-", formatDate(record.startDate), formatDate(record.expiryDate)],
        };
      }

      const isInspection = record.recordType === "maintenance";
      return isInspection
        ? { id: `inspection-${record.id}`, type: "inspection" as const, date: record.serviceDate, car, record, title: typeLabel("inspection"), values: [formatDate(record.serviceDate), car?.plate || "-", record.performedBy || "-", record.engineOil || "-", record.brakePads || "-", record.tires || "-", record.airConditioner || "-", record.brakes || "-", record.windshieldWiper || "-", record.otherInspection || "-", getInspectionFollowUpSummary(record, serviceRecords)] }
        : { id: `maintenance-${record.id}`, type: "maintenance" as const, date: record.serviceDate, car, record, title: typeLabel("maintenance"), values: [formatDate(record.serviceDate), car?.plate || "-", record.performedBy || "-", record.item || "-", record.serviceCenter || "-", linkedIssueText] };
    });
    return serviceRows.filter((row) => {
      if (activeTab !== "all" && row.type !== activeTab) return false;
      return `${row.car?.plate || ""} ${row.car?.model || ""} ${row.title} ${row.values.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase());
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [activeTab, query, cars, serviceRecords, borrowRecords]);

  const visibleType = activeTab === "all" ? "maintenance" : activeTab;
  const visibleRows = activeTab === "all" ? rows : rows.filter((row) => row.type === visibleType);
  const totalRecords = serviceRecords.length;
  const documentRecordCount = serviceRecords.filter((record) => record.recordType === "prb" || record.recordType === "insurance").length;

  const renderCarCell = (row: Row, value: string) => row.car ? <><strong>{value}</strong><small className="historycar-car-model">{row.car.model}</small></> : value;

  const renderTable = (type: Exclude<HistoryTab, "all">, tableRows: Row[]) => <section className="historycar-table-section"><div className="historycar-table-title"><div><span className={`historycar-title-dot historycar-title-dot--${tabs.find((tab) => tab.id === type)?.tone}`} /><h3>ตาราง{typeLabel(type)}</h3></div><span>{tableRows.length} รายการ</span></div><div className="historycar-table-wrap"><table><thead><tr>{headers[type].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{tableRows.map((row) => <tr key={row.id} className="historycar-clickable-row" onDoubleClick={() => setSelectedRow(row)} title="ดับเบิลคลิกเพื่อดูรายละเอียดเต็ม">{row.values.map((value, index) => <td key={`${row.id}-${index}`}>{index === 0 ? <strong>{value}</strong> : index === 1 ? renderCarCell(row, value) : value}</td>)}</tr>)}{tableRows.length === 0 && <tr><td colSpan={headers[type].length} className="historycar-empty">ยังไม่มีรายการในหมวดนี้</td></tr>}</tbody></table></div></section>;
  const renderAllTable = (tableRows: Row[]) => <section className="historycar-table-section"><div className="historycar-table-title"><div><span className="historycar-title-dot historycar-title-dot--blue" /><h3>รายการทั้งหมด</h3></div><span>{tableRows.length} รายการ</span></div><div className="historycar-table-wrap"><table><thead><tr><th>วันที่</th><th>ทะเบียน</th><th>รายการ</th><th>ผู้ดำเนินการ</th></tr></thead><tbody>{tableRows.map((row) => <tr key={row.id} className="historycar-clickable-row" onDoubleClick={() => setSelectedRow(row)} title="ดับเบิลคลิกเพื่อดูรายละเอียดเต็ม"><td><strong>{formatDate(row.date)}</strong></td><td>{renderCarCell(row, row.car?.plate || "-")}</td><td><span className={`historycar-type historycar-type--${row.type}`}>{row.title}</span></td><td>{row.values[2] || "-"}</td></tr>)}{tableRows.length === 0 && <tr><td colSpan={4} className="historycar-empty">ยังไม่มีรายการในระบบ</td></tr>}</tbody></table></div></section>;

  return <main className="historycar-page"><div className="historycar-shell">
    
    {carLoadError && <p className="historycar-error" role="alert">โหลดข้อมูลรถไม่สำเร็จ: {carLoadError}</p>}
    <section className="historycar-overview"><article><span className="historycar-overview-icon historycar-overview-icon--blue">▤</span><div><small>รายการทั้งหมด</small><strong>{totalRecords}</strong><em>รายการ</em></div></article><article><span className="historycar-overview-icon historycar-overview-icon--orange">◆</span><div><small>บำรุง / เช็คระยะ</small><strong>{serviceRecords.length - documentRecordCount}</strong><em>รายการ</em></div></article><article><span className="historycar-overview-icon historycar-overview-icon--green">✓</span><div><small>ประกัน / พ.ร.บ.</small><strong>{documentRecordCount}</strong><em>รายการ</em></div></article></section>
    <div className="historycar-toolbar"><div><h2>ตารางบันทึกรายการ</h2><p>เลือกหมวดหมู่เพื่อดูประวัติ</p></div><label className="historycar-search">ค้นหา<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ทะเบียนรถ หรือรายการ" /></label></div>
    <nav className="historycar-tabs" aria-label="หมวดหมู่ประวัติ">{tabs.map((tab) => <button type="button" className={`historycar-tab historycar-tab--${tab.tone}${activeTab === tab.id ? " is-active" : ""}`} key={tab.id} onClick={() => setActiveTab(tab.id)}><span />{tab.label}</button>)}</nav>
    {activeTab === "all" ? renderAllTable(rows) : renderTable(visibleType, visibleRows)}
    {selectedRow && <div className="historycar-modal-backdrop" role="presentation" onClick={() => setSelectedRow(null)}><section className="historycar-detail-modal" role="dialog" aria-modal="true" aria-labelledby="historycar-detail-title" onClick={(event) => event.stopPropagation()}><header><div><span>VEHICLE RECORD / {selectedRow.type.toUpperCase()}</span><h2 id="historycar-detail-title">{selectedRow.title}</h2><p>{selectedRow.car?.plate || "-"} · {selectedRow.car?.model || ""}</p></div><button type="button" aria-label="ปิดรายละเอียด" onClick={() => setSelectedRow(null)}>×</button></header>{selectedRow.type === "inspection" ? <><div className="historycar-detail-grid"><div><small>วันที่ตรวจ</small><strong>{formatDate(selectedRow.date)}</strong></div><div><small>เลขไมล์ (กม.)</small><strong>{selectedRow.record?.mileage || "-"}</strong></div><div><small>ผู้ดำเนินการ</small><strong>{selectedRow.record?.performedBy || "-"}</strong></div><div><small>ผลตรวจรวม</small><strong className={getInspectionSummary(selectedRow.record!) === "พบปัญหา" ? "historycar-problem" : "historycar-pass"}>{getInspectionSummary(selectedRow.record!)}</strong></div></div><div className="historycar-inspection-detail-table"><table><thead><tr><th>รายการตรวจ</th><th>ผลตรวจ</th><th>หมายเหตุ</th></tr></thead><tbody>{inspectionItems.map((item, index) => { const values = [selectedRow.record?.engineOil, selectedRow.record?.brakePads, selectedRow.record?.tires, selectedRow.record?.airConditioner, selectedRow.record?.brakes, selectedRow.record?.windshieldWiper, selectedRow.record?.otherInspection]; const status = values[index] || "-"; const repaired = status === "แก้ไข" && isInspectionItemRepaired(selectedRow.record!, index, serviceRecords); const displayStatus = repaired ? "แก้ไขแล้ว" : status; return <tr key={item}><td>{item}</td><td><span className={repaired ? "historycar-pass" : status === "แก้ไข" ? "historycar-problem" : "historycar-pass"}>{displayStatus}</span></td><td>{getInspectionNoteWithRepairStatus(selectedRow.record, index, serviceRecords)}</td></tr>; })}</tbody></table></div></> : <div className="historycar-detail-grid"><div><small>วันที่ทำรายการ</small><strong>{formatDate(selectedRow.date)}</strong></div>{headers[selectedRow.type].slice(2).map((header, index) => <div key={`${header}-${index}`}><small>{header}</small><strong>{selectedRow.values[index + 2] || "-"}</strong></div>)}</div>}<footer><button type="button" onClick={() => setSelectedRow(null)}>ปิดหน้าต่าง</button></footer></section></div>}
  </div></main>;
}
