alter table public.cars
  add column if not exists next_maintenance_mileage text;

alter table public.car_service_records
  add column if not exists next_maintenance_mileage text not null default '';
