-- Enable realtime events so Admin/Manager browsers can receive new car requests.
do $$
begin
  alter publication supabase_realtime add table public.borrow_records;
exception
  when duplicate_object then null;
end;
$$;
