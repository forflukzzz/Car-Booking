import { supabase } from "./supabase";

export type CarStatus = "busy" | "available" | "reserved";
export type Car = {
  id: number;
  plate: string;
  model: string;
  mileage: string;
  lastUsed: string;
  status: CarStatus;
  image?: string;
  prbExpiry?: string;
  insuranceExpiry?: string;
  maintenanceDue?: string;
  nextMaintenanceMileage?: string;
  lastServiceDate?: string;
  serviceCenter?: string;
  returnDate?: string;
  requestDisabled?: boolean;
};

type CarRow = {
  id: number;
  plate: string;
  model: string;
  mileage: string;
  last_used: string;
  status: CarStatus;
  image: string | null;
  prb_expiry: string | null;
  insurance_expiry: string | null;
  maintenance_due: string | null;
  next_maintenance_mileage: string | null;
  last_service_date: string | null;
  service_center: string | null;
  return_date: string | null;
  request_disabled: boolean;
};

type CarInput = Pick<Car, "plate" | "model" | "mileage" | "status"> & Partial<Pick<Car, "prbExpiry" | "insuranceExpiry" | "maintenanceDue" | "nextMaintenanceMileage" | "lastServiceDate" | "serviceCenter">>;

const fromRow = (row: CarRow): Car => ({
  id: row.id,
  plate: row.plate,
  model: row.model,
  mileage: row.mileage,
  lastUsed: row.last_used,
  status: row.status,
  ...(row.image ? { image: row.image } : {}),
  ...(row.prb_expiry ? { prbExpiry: row.prb_expiry } : {}),
  ...(row.insurance_expiry ? { insuranceExpiry: row.insurance_expiry } : {}),
  ...(row.maintenance_due ? { maintenanceDue: row.maintenance_due } : {}),
  ...(row.next_maintenance_mileage ? { nextMaintenanceMileage: row.next_maintenance_mileage } : {}),
  ...(row.last_service_date ? { lastServiceDate: row.last_service_date } : {}),
  ...(row.service_center ? { serviceCenter: row.service_center } : {}),
  ...(row.return_date ? { returnDate: row.return_date } : {}),
  requestDisabled: row.request_disabled,
});

const selectFields = "id, plate, model, mileage, last_used, status, image, prb_expiry, insurance_expiry, maintenance_due, next_maintenance_mileage, last_service_date, service_center, return_date, request_disabled";
const LEGACY_STORAGE_KEY = "car-booking.cars";

const migrateLegacyCars = async (): Promise<void> => {
  let saved: string | null;
  try { saved = window.localStorage.getItem(LEGACY_STORAGE_KEY); }
  catch { return; }
  if (!saved) return;

  let legacyCars: unknown;
  try { legacyCars = JSON.parse(saved); }
  catch { return; }
  if (!Array.isArray(legacyCars)) return;

  const rows = legacyCars.flatMap((value) => {
    if (typeof value !== "object" || value === null) return [];
    const car = value as Record<string, unknown>;
    if (typeof car.plate !== "string" || typeof car.model !== "string" || typeof car.mileage !== "string") return [];
    const status = ["busy", "available", "reserved"].includes(String(car.status)) ? car.status as CarStatus : "available";
    return [{
      plate: car.plate,
      model: car.model,
      mileage: car.mileage,
      last_used: typeof car.lastUsed === "string" ? car.lastUsed : "",
      status,
      image: typeof car.image === "string" ? car.image : null,
      prb_expiry: typeof car.prbExpiry === "string" ? car.prbExpiry : null,
      return_date: typeof car.returnDate === "string" ? car.returnDate : null,
      request_disabled: car.requestDisabled === true,
    }];
  });

  if (rows.length) {
    const { error } = await supabase.from("cars").upsert(rows, { onConflict: "plate", ignoreDuplicates: true });
    if (error) throw error;
  }
  try { window.localStorage.removeItem(LEGACY_STORAGE_KEY); }
  catch { /* Database has the migrated copy; keep the old browser copy if cleanup fails. */ }
};

export const readCars = async (): Promise<Car[]> => {
  // Legacy local storage migration must not prevent reading the current database rows.
  try { await migrateLegacyCars(); }
  catch (error) { console.warn("Could not migrate legacy car data:", error); }

  const fullResult = await supabase.from("cars").select(selectFields).order("id");
  if (!fullResult.error) return (fullResult.data as CarRow[]).map(fromRow);

  // Older deployments may not have the newer optional car columns yet.
  const coreResult = await supabase
    .from("cars")
    .select("*")
    .order("id");
  if (coreResult.error) throw coreResult.error;
  return (coreResult.data as CarRow[]).map((row) => fromRow({
    ...row,
    last_used: row.last_used || "",
    status: row.status || "available",
    image: row.image || null,
    prb_expiry: row.prb_expiry || null,
    insurance_expiry: row.insurance_expiry || null,
    maintenance_due: row.maintenance_due || null,
    next_maintenance_mileage: row.next_maintenance_mileage || null,
    last_service_date: row.last_service_date || null,
    service_center: row.service_center || null,
    return_date: row.return_date || null,
    request_disabled: row.request_disabled || false,
  }));
};

const uploadCarImage = async (file: File): Promise<string> => {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("car-images").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("car-images").getPublicUrl(path).data.publicUrl;
};

export const createCar = async (car: CarInput, imageFile?: File | null): Promise<Car> => {
  const image = imageFile ? await uploadCarImage(imageFile) : null;
  const { data, error } = await supabase
    .from("cars")
    .insert({
      plate: car.plate,
      model: car.model,
      mileage: car.mileage,
      status: car.status,
      last_used: new Date().toLocaleDateString("th-TH"),
      image,
      prb_expiry: car.prbExpiry || null,
      insurance_expiry: car.insuranceExpiry || null,
      maintenance_due: car.maintenanceDue || null,
      next_maintenance_mileage: car.nextMaintenanceMileage || null,
      last_service_date: car.lastServiceDate || null,
      service_center: car.serviceCenter || null,
    })
    .select(selectFields)
    .single();
  if (error) throw error;
  return fromRow(data as CarRow);
};

export const updateCar = async (id: number, changes: CarInput, imageFile?: File | null): Promise<Car> => {
  const image = imageFile ? await uploadCarImage(imageFile) : undefined;
  const { data, error } = await supabase
    .from("cars")
    .update({ plate: changes.plate, model: changes.model, mileage: changes.mileage, status: changes.status, ...(changes.prbExpiry !== undefined ? { prb_expiry: changes.prbExpiry || null } : {}), ...(changes.insuranceExpiry !== undefined ? { insurance_expiry: changes.insuranceExpiry || null } : {}), ...(changes.maintenanceDue !== undefined ? { maintenance_due: changes.maintenanceDue || null } : {}), ...(changes.nextMaintenanceMileage !== undefined ? { next_maintenance_mileage: changes.nextMaintenanceMileage || null } : {}), ...(changes.lastServiceDate !== undefined ? { last_service_date: changes.lastServiceDate || null } : {}), ...(changes.serviceCenter !== undefined ? { service_center: changes.serviceCenter || null } : {}), ...(image ? { image } : {}) })
    .eq("id", id)
    .select(selectFields)
    .single();
  if (error) throw error;
  return fromRow(data as CarRow);
};

export const updateCarUsage = async (id: number, mileage: string, lastUsed: string): Promise<Car> => {
  const { data, error } = await supabase
    .from("cars")
    .update({ mileage, last_used: lastUsed })
    .eq("id", id)
    .select(selectFields)
    .single();
  if (error) throw error;
  return fromRow(data as CarRow);
};

export const updateCarMileage = async (id: number, mileage: string): Promise<Car> => {
  const { data, error } = await supabase.from("cars").update({ mileage }).eq("id", id).select(selectFields).single();
  if (error) throw error;
  return fromRow(data as CarRow);
};

export const updateCarStatus = async (id: number, status: CarStatus): Promise<Car> => {
  const { data, error } = await supabase.from("cars").update({ status }).eq("id", id).select(selectFields).single();
  if (error) throw error;
  return fromRow(data as CarRow);
};

export const deleteCar = async (id: number): Promise<void> => {
  const { error } = await supabase.from("cars").delete().eq("id", id);
  if (error) throw error;
};
