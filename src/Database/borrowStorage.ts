import type { BorrowRecord, BorrowStatus } from "../Pages/History/history";
import { supabase } from "./supabase";

const throwDatabaseError = (error: { message: string; details?: string; hint?: string; code?: string }): never => {
  const diagnostic = [error.message, error.details, error.hint, error.code ? `code: ${error.code}` : ""]
    .filter(Boolean)
    .join(" | ");
  throw new Error(diagnostic || "Supabase rejected the borrow record.");
};

const mapBorrowRecord = (row: Record<string, unknown>): BorrowRecord => ({
  id: Number(row.id),
  date: String(row.date),
  plate: String(row.plate),
  model: String(row.model),
  carId: row.vehicle_id == null
    ? (row.car_id == null ? undefined : Number(row.car_id))
    : Number(row.vehicle_id),
  requester: String(row.requester),
  requesterUid: row.requester_uid == null ? undefined : String(row.requester_uid),
  purpose: String(row.purpose),
  mileage: String(row.mileage),
  startMileage: String(row.start_mileage ?? row.mileage),
  endMileage: String(row.end_mileage ?? "-"),
  returnDate: String(row.return_date),
  distance: String(row.distance),
  status: row.status as BorrowStatus,
});

const toBorrowRecordRow = (record: Omit<BorrowRecord, "id">) => ({
  date: record.date,
  plate: record.plate,
  model: record.model,
  car_id: record.carId ?? null,
  vehicle_id: record.carId,
  requester: record.requester,
  requester_uid: record.requesterUid ?? null,
  purpose: record.purpose,
  mileage: record.mileage,
  start_mileage: record.startMileage ?? record.mileage,
  end_mileage: record.endMileage ?? "-",
  return_date: record.returnDate,
  distance: record.distance,
  status: record.status,
});

export const readBorrowRecords = async (): Promise<BorrowRecord[]> => {
  const { data, error } = await supabase
    .from("borrow_records")
    .select("*")
    .order("id", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dueReservations = rows.filter((row) => row.status === "reserved" && String(row.date).slice(0, 10) <= today);
  if (dueReservations.length) {
    await Promise.all(dueReservations.map(async (row) => {
      const id = Number(row.id);
      const { error: recordError } = await supabase.from("borrow_records").update({ status: "in-use" }).eq("id", id);
      if (recordError) throwDatabaseError(recordError);
      const vehicleId = row.vehicle_id ?? row.car_id;
      if (vehicleId != null) {
        const { error: carError } = await supabase.from("cars").update({ status: "busy" }).eq("id", Number(vehicleId));
        if (carError) throwDatabaseError(carError);
      }
      row.status = "in-use";
    }));
  }
  const records = rows.map((row) => mapBorrowRecord(row));
  if (!records.length) return records;

  const { data: issueReports, error: issueReportError } = await supabase
    .from("vehicle_issue_reports")
    .select("borrow_record_id, issue_description")
    .order("reported_at", { ascending: true });
  if (issueReportError) throwDatabaseError(issueReportError);

  const reportsByRecord = new Map<number, string[]>();
  for (const report of (issueReports ?? []) as Array<{ borrow_record_id: number; issue_description: string }>) {
    const recordId = Number(report.borrow_record_id);
    const reports = reportsByRecord.get(recordId) ?? [];
    reports.push(report.issue_description);
    reportsByRecord.set(recordId, reports);
  }

  return records.map((record) => ({
    ...record,
    issueReport: reportsByRecord.get(record.id)?.join("\n"),
  }));
};

export const createBorrowRecord = async (
  record: Omit<BorrowRecord, "id">,
): Promise<BorrowRecord> => {
  if (record.carId == null) {
    throw new Error("ไม่พบรหัสรถสำหรับบันทึกรายการยืม");
  }
  const vehicleId = record.carId;
  const { data, error } = await supabase
    .from("borrow_records")
    .insert({ ...toBorrowRecordRow(record), vehicle_id: vehicleId })
    .select("*")
    .single();

  if (error) throwDatabaseError(error);

  const { error: carError } = await supabase
    .from("cars")
    .update({ status: "busy" })
    .eq("plate", record.plate);
  if (carError) throwDatabaseError(carError);

  return mapBorrowRecord(data as Record<string, unknown>);
};

export const updateBorrowRecord = async (
  id: number,
  changes: Partial<Omit<BorrowRecord, "id">>,
): Promise<BorrowRecord> => {
  const updates: Record<string, unknown> = {};
  if (changes.date !== undefined) updates.date = changes.date;
  if (changes.plate !== undefined) updates.plate = changes.plate;
  if (changes.model !== undefined) updates.model = changes.model;
  if (changes.carId !== undefined) {
    updates.car_id = changes.carId;
    updates.vehicle_id = changes.carId;
  }
  if (changes.requester !== undefined) updates.requester = changes.requester;
  if (changes.purpose !== undefined) updates.purpose = changes.purpose;
  if (changes.mileage !== undefined) updates.mileage = changes.mileage;
  if (changes.startMileage !== undefined) updates.start_mileage = changes.startMileage;
  if (changes.endMileage !== undefined) updates.end_mileage = changes.endMileage;
  if (changes.returnDate !== undefined) updates.return_date = changes.returnDate;
  if (changes.distance !== undefined) updates.distance = changes.distance;
  if (changes.status !== undefined) updates.status = changes.status;

  const { data, error } = await supabase
    .from("borrow_records")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwDatabaseError(error);

  if (changes.status === "returned" || changes.status === "cancelled") {
    const { error: carError } = await supabase
      .from("cars")
      .update({ status: "available", request_disabled: false })
      .eq("plate", String((data as Record<string, unknown>).plate));
    if (carError) throwDatabaseError(carError);
  }

  return mapBorrowRecord(data as Record<string, unknown>);
};
