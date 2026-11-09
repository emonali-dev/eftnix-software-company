-- EFTNIX production foundation for Supabase
-- Run this file in Supabase SQL Editor. Never put service_role keys in the browser.
create extension if not exists pgcrypto;

create table if not exists public.quotes (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 user_id uuid references auth.users(id) on delete set null,
 name text not null check (char_length(name) between 2 and 120),
 email text not null check (char_length(email) <= 254),
 phone text,
 service text not null,
 complexity text,
 currency text not null default 'USD' check (currency in ('USD','BDT','EUR')),
 features text[] not null default '{}',
 estimate text,
 timeline text,
 budget text,
 details text,
 status text not null default 'new' check (status in ('new','contacted','quoted','in_progress','completed','cancelled'))
);
create index if not exists quotes_created_at_idx on public.quotes(created_at desc);

create table if not exists public.payment_submissions (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 user_id uuid not null references auth.users(id) on delete restrict,
 customer_name text not null,
 email text not null,
 method text not null check (method in ('bKash','Nagad')),
 amount_bdt numeric(12,2) not null check (amount_bdt > 0),
 reference text,
 transaction_id text not null,
 proof_path text not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 admin_note text,
 unique(method, transaction_id)
);
create index if not exists payment_submissions_created_at_idx on public.payment_submissions(created_at desc);

create or replace function public.is_eftnix_admin()
returns boolean language sql stable security definer
set search_path = '' as $$
 select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'eftnix_admin', false);
$$;
revoke all on function public.is_eftnix_admin() from public;
grant execute on function public.is_eftnix_admin() to authenticated;

alter table public.quotes enable row level security;
alter table public.payment_submissions enable row level security;

drop policy if exists "Public can submit quote requests" on public.quotes;
create policy "Public can submit quote requests" on public.quotes
 for insert to anon, authenticated with check (status = 'new');
drop policy if exists "Customers can view own quotes" on public.quotes;
create policy "Customers can view own quotes" on public.quotes
 for select to authenticated using (user_id = auth.uid() or public.is_eftnix_admin());
drop policy if exists "Admins manage quotes" on public.quotes;
create policy "Admins manage quotes" on public.quotes
 for update to authenticated using (public.is_eftnix_admin()) with check (public.is_eftnix_admin());

drop policy if exists "Customers submit own payments" on public.payment_submissions;
create policy "Customers submit own payments" on public.payment_submissions
 for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "Customers view own payments" on public.payment_submissions;
create policy "Customers view own payments" on public.payment_submissions
 for select to authenticated using (user_id = auth.uid() or public.is_eftnix_admin());
drop policy if exists "Admins review payments" on public.payment_submissions;
create policy "Admins review payments" on public.payment_submissions
 for update to authenticated using (public.is_eftnix_admin())
 with check (public.is_eftnix_admin());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','application/pdf'];

drop policy if exists "Customers upload own payment proofs" on storage.objects;
create policy "Customers upload own payment proofs" on storage.objects
 for insert to authenticated with check (
  bucket_id='payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text
 );
drop policy if exists "Customers and admins read payment proofs" on storage.objects;
create policy "Customers and admins read payment proofs" on storage.objects
 for select to authenticated using (
  bucket_id='payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_eftnix_admin())
 );

-- IMPORTANT: Create admin in Supabase Auth first, then set app_metadata.role='eftnix_admin'
-- using a trusted server/admin console. Never set admin role from client-side user metadata.
