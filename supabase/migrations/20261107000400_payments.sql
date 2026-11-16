alter table public.money_requests drop constraint money_requests_state_check;
alter table public.money_requests add constraint money_requests_state_check
  check (state in ('pending','accepted','declined','cancelled','settled'));
alter table public.money_requests add column version integer not null default 0;

alter table public.request_events drop constraint request_events_event_check;
alter table public.request_events add constraint request_events_event_check check (event in (
  'sent','accepted','declined','cancelled','payment_recorded','payment_confirmed','payment_declined',
  'correction_proposed','correction_approved','correction_declined','settled','reopened'
));
alter table public.request_events add column details jsonb not null default '{}'::jsonb;

create table public.request_payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.money_requests(id) on delete cascade,
  amount_minor integer not null check (amount_minor > 0),
  state text not null default 'pending' check (state in ('pending','confirmed','declined','cancelled')),
  created_at timestamptz not null default now()
);
create index request_payments_request on public.request_payments (request_id, created_at);

create table public.request_corrections (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.money_requests(id) on delete cascade,
  proposer uuid not null references public.profiles(id),
  kind text not null check (kind in ('request_amount','request_reason','payment_amount','payment_cancel')),
  payment_id uuid references public.request_payments(id),
  amount_minor integer,
  new_reason text,
  explanation text not null check (explanation ~ '[^[:space:]]' and char_length(explanation) <= 500),
  base_version integer not null,
  state text not null default 'pending' check (state in ('pending','approved','declined')),
  created_at timestamptz not null default now()
);
create index request_corrections_request on public.request_corrections (request_id, created_at);

-- Keys are scoped to the actor. The payload prevents accidental key reuse for another action.
create table public.request_operations (
  actor uuid not null references public.profiles(id),
  operation_key uuid not null,
  request_id uuid not null references public.money_requests(id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  result uuid not null,
  primary key (actor, operation_key)
);

alter table public.request_payments enable row level security;
alter table public.request_corrections enable row level security;
alter table public.request_operations enable row level security;
revoke all on public.request_payments, public.request_corrections, public.request_operations from public, anon, authenticated;
grant select on public.request_payments, public.request_corrections to authenticated;
create policy payment_participants on public.request_payments for select to authenticated
  using (exists (select 1 from public.money_requests where id = request_id));
create policy correction_participants on public.request_corrections for select to authenticated
  using (exists (select 1 from public.money_requests where id = request_id));

create function public.record_request_payment(p_request uuid, p_amount integer, p_key uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  req public.money_requests%rowtype;
  saved public.request_operations%rowtype;
  reserved bigint;
  result uuid;
  payload jsonb := jsonb_build_object('amount', p_amount);
begin
  if auth.uid() is null or p_key is null then raise exception 'action_unavailable' using errcode='P0001'; end if;
  select * into req from public.money_requests where id=p_request for update;
  if not found or req.recipient <> auth.uid() then raise exception 'action_unavailable' using errcode='P0001'; end if;
  select * into saved from public.request_operations where actor=auth.uid() and operation_key=p_key;
  if found then
    if saved.kind <> 'payment' or saved.request_id <> p_request or saved.payload <> payload then
      raise exception 'key_conflict' using errcode='P0001';
    end if;
    return saved.result;
  end if;
  if req.state <> 'accepted' or p_amount is null or p_amount <= 0 then raise exception 'invalid_payment' using errcode='P0001'; end if;
  select coalesce(sum(amount_minor),0) into reserved from public.request_payments
    where request_id=p_request and state in ('pending','confirmed');
  if reserved + p_amount > req.amount_minor then raise exception 'invalid_payment' using errcode='P0001'; end if;
  insert into public.request_payments(request_id,amount_minor) values(p_request,p_amount) returning id into result;
  insert into public.request_operations values(auth.uid(),p_key,p_request,'payment',payload,result);
  update public.money_requests set version=version+1 where id=p_request;
  insert into public.request_events(request_id,actor,event,details)
    values(p_request,auth.uid(),'payment_recorded',jsonb_build_object('payment_id',result,'amount',p_amount));
  return result;
end;
$$;

create function public.respond_request_payment(p_payment uuid, p_decision text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  req public.money_requests%rowtype;
  payment public.request_payments%rowtype;
  confirmed bigint;
begin
  select r.* into req from public.money_requests r join public.request_payments p on p.request_id=r.id
    where p.id=p_payment for update of r;
  if not found or req.sender <> auth.uid() or p_decision not in ('confirmed','declined') then
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

create function public.propose_request_correction(p_request uuid, p_kind text, p_explanation text,
  p_key uuid, p_payment uuid default null, p_amount integer default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  req public.money_requests%rowtype;
  payment public.request_payments%rowtype;
  saved public.request_operations%rowtype;
  result uuid;
  payload jsonb := jsonb_build_object('kind',p_kind,'explanation',p_explanation,'payment',p_payment,'amount',p_amount,'reason',p_reason);
begin
  if auth.uid() is null or p_key is null then raise exception 'action_unavailable' using errcode='P0001'; end if;
  select * into req from public.money_requests where id=p_request for update;
  if not found or auth.uid() not in (req.sender,req.recipient) then raise exception 'action_unavailable' using errcode='P0001'; end if;
  select * into saved from public.request_operations where actor=auth.uid() and operation_key=p_key;
  if found then
    if saved.kind <> 'correction' or saved.request_id <> p_request or saved.payload <> payload then
      raise exception 'key_conflict' using errcode='P0001';
    end if;
    return saved.result;
  end if;
  if req.state not in ('accepted','settled') or p_explanation is null
    or p_explanation !~ '[^[:space:]]' or char_length(p_explanation)>500 then
    raise exception 'invalid_correction' using errcode='P0001';
  end if;
  if p_kind = 'request_amount' then
    if p_amount is null or p_amount <= 0 or p_payment is not null or p_reason is not null then raise exception 'invalid_correction' using errcode='P0001'; end if;
  elsif p_kind = 'request_reason' then
    if p_reason is null or p_reason !~ '[^[:space:]]' or char_length(p_reason)>500 or p_amount is not null or p_payment is not null then
      raise exception 'invalid_correction' using errcode='P0001';
    end if;
  elsif p_kind in ('payment_amount','payment_cancel') then
    select * into payment from public.request_payments where id=p_payment and request_id=p_request;
    if not found or payment.state <> 'confirmed' or p_reason is not null
      or (p_kind = 'payment_amount' and (p_amount is null or p_amount <= 0))
      or (p_kind = 'payment_cancel' and p_amount is not null) then
      raise exception 'invalid_correction' using errcode='P0001';
    end if;
  else
    raise exception 'invalid_correction' using errcode='P0001';
  end if;
  insert into public.request_corrections(request_id,proposer,kind,payment_id,amount_minor,new_reason,explanation,base_version)
    values(p_request,auth.uid(),p_kind,p_payment,p_amount,p_reason,p_explanation,req.version) returning id into result;
  insert into public.request_operations values(auth.uid(),p_key,p_request,'correction',payload,result);
  insert into public.request_events(request_id,actor,event,details)
    values(p_request,auth.uid(),'correction_proposed',payload || jsonb_build_object('correction_id',result));
  return result;
end;
$$;

create function public.respond_request_correction(p_correction uuid, p_decision text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  req public.money_requests%rowtype;
  correction public.request_corrections%rowtype;
  payment public.request_payments%rowtype;
  total_reserved bigint;
  total_confirmed bigint;
  before_value jsonb;
  after_value jsonb;
  previous_state text;
begin
  select r.* into req from public.money_requests r join public.request_corrections c on c.request_id=r.id
    where c.id=p_correction for update of r;
  if not found or auth.uid() is null or auth.uid() not in (req.sender,req.recipient)
    or p_decision not in ('approved','declined') then raise exception 'action_unavailable' using errcode='P0001'; end if;
  select * into correction from public.request_corrections where id=p_correction;
  if correction.proposer=auth.uid() then raise exception 'action_unavailable' using errcode='P0001'; end if;
  if correction.state=p_decision then return; end if;
  if correction.state <> 'pending' then raise exception 'action_unavailable' using errcode='P0001'; end if;
  if p_decision='approved' then
    if correction.base_version <> req.version then raise exception 'stale_correction' using errcode='P0001'; end if;
    previous_state := req.state;
    select coalesce(sum(amount_minor),0) into total_reserved from public.request_payments
      where request_id=req.id and state in ('pending','confirmed');
    if correction.kind='request_amount' then
      if total_reserved > correction.amount_minor then raise exception 'invalid_correction' using errcode='P0001'; end if;
      before_value:=jsonb_build_object('amount',req.amount_minor);
      after_value:=jsonb_build_object('amount',correction.amount_minor);
      update public.money_requests set amount_minor=correction.amount_minor where id=req.id;
    elsif correction.kind='request_reason' then
      before_value:=jsonb_build_object('reason',req.reason);
      after_value:=jsonb_build_object('reason',correction.new_reason);
      update public.money_requests set reason=correction.new_reason where id=req.id;
    else
      select * into payment from public.request_payments where id=correction.payment_id and request_id=req.id;
      if not found or payment.state <> 'confirmed' then raise exception 'stale_correction' using errcode='P0001'; end if;
      before_value:=jsonb_build_object('payment_id',payment.id,'amount',payment.amount_minor,'state',payment.state);
      if correction.kind='payment_amount' then
        if total_reserved - payment.amount_minor + correction.amount_minor > req.amount_minor then raise exception 'invalid_correction' using errcode='P0001'; end if;
        update public.request_payments set amount_minor=correction.amount_minor where id=payment.id;
        after_value:=jsonb_build_object('payment_id',payment.id,'amount',correction.amount_minor,'state','confirmed');
      else
        update public.request_payments set state='cancelled' where id=payment.id;
        after_value:=jsonb_build_object('payment_id',payment.id,'amount',payment.amount_minor,'state','cancelled');
      end if;
    end if;
    select coalesce(sum(amount_minor),0) into total_confirmed from public.request_payments where request_id=req.id and state='confirmed';
    update public.money_requests set version=version+1,
      state=case when total_confirmed=amount_minor then 'settled' else 'accepted' end where id=req.id;
  end if;
  update public.request_corrections set state=p_decision where id=p_correction;
  insert into public.request_events(request_id,actor,event,details)
    values(req.id,auth.uid(),'correction_' || p_decision,
      jsonb_build_object('correction_id',p_correction,'kind',correction.kind,'explanation',correction.explanation,'before',before_value,'after',after_value));
  if p_decision='approved' then
    if previous_state='settled' and total_confirmed < (select amount_minor from public.money_requests where id=req.id) then
      insert into public.request_events(request_id,actor,event) values(req.id,auth.uid(),'reopened');
    elsif previous_state='accepted' and total_confirmed = (select amount_minor from public.money_requests where id=req.id) then
      insert into public.request_events(request_id,actor,event) values(req.id,auth.uid(),'settled');
    end if;
  end if;
end;
$$;

revoke all on function public.record_request_payment(uuid,integer,uuid), public.respond_request_payment(uuid,text),
  public.propose_request_correction(uuid,text,text,uuid,uuid,integer,text), public.respond_request_correction(uuid,text)
  from public, anon, authenticated;
grant execute on function public.record_request_payment(uuid,integer,uuid), public.respond_request_payment(uuid,text),
  public.propose_request_correction(uuid,text,text,uuid,uuid,integer,text), public.respond_request_correction(uuid,text) to authenticated;
