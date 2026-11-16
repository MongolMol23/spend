create or replace function public.respond_request_payment(p_payment uuid, p_decision text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  req public.money_requests%rowtype;
  payment public.request_payments%rowtype;
  confirmed bigint;
begin
  select r.* into req from public.money_requests r join public.request_payments p on p.request_id=r.id
    where p.id=p_payment for update of r;
  if not found or auth.uid() is null or req.sender <> auth.uid() or p_decision not in ('confirmed','declined') then
    raise exception 'action_unavailable' using errcode='P0001';
  end if;
  select * into payment from public.request_payments where id=p_payment;
  if payment.state = p_decision then return; end if;
  if req.state <> 'accepted' or payment.state <> 'pending' then raise exception 'action_unavailable' using errcode='P0001'; end if;
  update public.request_payments set state=p_decision where id=p_payment;
  update public.money_requests set version=version+1 where id=req.id;
  insert into public.request_events(request_id,actor,event,details)
    values(req.id,auth.uid(),'payment_' || p_decision,jsonb_build_object('payment_id',p_payment,'amount',payment.amount_minor));
  if p_decision = 'confirmed' then
    select coalesce(sum(amount_minor),0) into confirmed from public.request_payments where request_id=req.id and state='confirmed';
    if confirmed = req.amount_minor then
      update public.money_requests set state='settled' where id=req.id;
      insert into public.request_events(request_id,actor,event) values(req.id,auth.uid(),'settled');
    end if;
  end if;
end;
$$;
