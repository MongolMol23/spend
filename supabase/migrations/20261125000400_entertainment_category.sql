insert into public.expense_categories (code) values ('entertainment')
on conflict (code) do nothing;
