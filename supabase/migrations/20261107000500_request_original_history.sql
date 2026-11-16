-- Keep the original request values even after an approved correction.
update public.request_events e set details=jsonb_build_object('amount',r.amount_minor,'reason',r.reason)
from public.money_requests r where e.request_id=r.id and e.event='sent';
create function public.capture_request_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.event='sent' then
    select jsonb_build_object('amount',r.amount_minor,'reason',r.reason) into new.details
    from public.money_requests r where r.id=new.request_id;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_request_event() from public, anon, authenticated;
create trigger capture_original_request before insert on public.request_events
for each row execute function public.capture_request_event();

