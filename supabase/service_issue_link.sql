-- Run after borrow_records.sql and cars.sql are installed.
alter table public.car_service_records
  add column if not exists related_borrow_record_id bigint
  references public.borrow_records(id) on delete set null;

create index if not exists car_service_records_related_borrow_record_id_idx
  on public.car_service_records (related_borrow_record_id);

notify pgrst, 'reload schema';
