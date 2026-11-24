-- Run this once for existing databases to store the two additional inspection items.
alter table public.car_service_records
  add column if not exists windshield_wiper text not null default '';

alter table public.car_service_records
  add column if not exists other_inspection text not null default '';

notify pgrst, 'reload schema';
