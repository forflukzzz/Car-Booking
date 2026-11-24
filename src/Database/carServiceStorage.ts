import { supabase } from "./supabase";

export type CarServiceRecord = {
  id: number;
  carId: number;
  recordType: "maintenance" | "service-center" | "prb" | "insurance";
  serviceDate: string;
  mileage: string;
  serviceCenter: string;
  performedBy: string;
  startDate: string;
  expiryDate: string;
  item: string;
  engineOil: string;
  brakePads: string;
  tires: string;
  airConditioner: string;
  brakes: string;
  windshieldWiper: string;
  otherInspection: string;
  inspectionResult: string;
  inspectionNotes: string;
  nextMaintenanceMileage: string;
  relatedBorrowRecordId?: number;
};

type ServiceRow = {
  id: number;
  car_id: number;
  record_type: CarServiceRecord["recordType"];
  service_date: string;
  mileage: string;
  service_center: string;
  performed_by: string;
  start_date: string;
  expiry_date: string;
  item: string;
  engine_oil: string;
  brake_pads: string;
  tires: string;
  air_conditioner: string;
  brakes: string;
  windshield_wiper: string;
  other_inspection: string;
  inspection_result: string;
  inspection_notes: string;
  next_maintenance_mileage: string;
  related_borrow_record_id?: number | null;
};

const baseSelectFields = "id, car_id, record_type, service_date, mileage, service_center, performed_by, start_date, expiry_date, item, engine_oil, brake_pads, tires, air_conditioner, brakes, windshield_wiper, other_inspection, inspection_result, inspection_notes, next_maintenance_mileage";
const selectFields = `${baseSelectFields}, related_borrow_record_id`;

const fromRow = (row: ServiceRow): CarServiceRecord => ({
  id: row.id,
  carId: row.car_id,
  recordType: row.record_type,
  serviceDate: row.service_date,
  mileage: row.mileage,
  serviceCenter: row.service_center,
  performedBy: row.performed_by,
  startDate: row.start_date,
  expiryDate: row.expiry_date,
  item: row.item,
  engineOil: row.engine_oil,
  brakePads: row.brake_pads,
  tires: row.tires,
  airConditioner: row.air_conditioner,
  brakes: row.brakes,
  windshieldWiper: row.windshield_wiper || "",
  otherInspection: row.other_inspection || "",
  inspectionResult: row.inspection_result,
  inspectionNotes: row.inspection_notes || "",
  nextMaintenanceMileage: row.next_maintenance_mileage || "",
  relatedBorrowRecordId: row.related_borrow_record_id == null ? undefined : Number(row.related_borrow_record_id),
});

export const readCarServiceRecords = async (): Promise<CarServiceRecord[]> => {
  const result = await (supabase as any).from("car_service_records").select(selectFields).order("service_date", { ascending: false });
  if (!result.error) return (result.data as ServiceRow[]).map(fromRow);
  if (!String(result.error.message).toLowerCase().includes("related_borrow_record_id")) throw result.error;

  const legacyResult = await (supabase as any).from("car_service_records").select(baseSelectFields).order("service_date", { ascending: false });
  if (legacyResult.error) throw legacyResult.error;
  return (legacyResult.data as Array<Record<string, unknown>>).map((row) => fromRow({ ...row, related_borrow_record_id: null } as ServiceRow));
};

export const createCarServiceRecord = async (record: Omit<CarServiceRecord, "id">): Promise<CarServiceRecord> => {
  const row = {
    car_id: record.carId,
    record_type: record.recordType,
    service_date: record.serviceDate,
    mileage: record.mileage,
    service_center: record.serviceCenter,
    performed_by: record.performedBy,
    start_date: record.startDate,
    expiry_date: record.expiryDate,
    item: record.item,
    engine_oil: record.engineOil,
    brake_pads: record.brakePads,
    tires: record.tires,
    air_conditioner: record.airConditioner,
    brakes: record.brakes,
    windshield_wiper: record.windshieldWiper,
    other_inspection: record.otherInspection,
    inspection_result: record.inspectionResult,
    inspection_notes: record.inspectionNotes,
    next_maintenance_mileage: record.nextMaintenanceMileage || "",
    related_borrow_record_id: record.relatedBorrowRecordId ?? null,
  };
  const result = await (supabase as any).from("car_service_records").insert(row).select(selectFields).single();
  if (!result.error) return fromRow(result.data as ServiceRow);
  if (!String(result.error.message).toLowerCase().includes("related_borrow_record_id")) throw result.error;
  if (record.relatedBorrowRecordId != null) {
    throw new Error("ต้องติดตั้ง supabase/service_issue_link.sql ก่อนจึงจะบันทึกการเชื่อมโยงรายงานปัญหาได้");
  }

  const legacyRow = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "related_borrow_record_id"));
  const legacyResult = await (supabase as any).from("car_service_records").insert(legacyRow).select(baseSelectFields).single();
  if (legacyResult.error) throw legacyResult.error;
  return fromRow({ ...legacyResult.data, related_borrow_record_id: null } as ServiceRow);
};
