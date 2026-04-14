-- Uppearance OS — PostgreSQL schema for Supabase
-- Run in Supabase SQL editor or via CLI migrations.

create extension if not exists "pgcrypto";

-- Roles: admin, team, client
create type public.user_role as enum ('admin', 'team', 'client');

create type public.client_status as enum ('lead', 'active', 'paused', 'inactive');

create type public.retainer_status as enum ('active', 'paused', 'cancelled');

create type public.invoice_status as enum ('paid', 'unpaid', 'overdue');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'team',
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  status public.client_status not null default 'lead',
  assigned_manager uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.profiles
  add constraint profiles_client_fk
  foreign key (client_id) references public.clients (id) on delete set null;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  created_at timestamptz not null default now()
);

create table public.retainers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  monthly_fee numeric(12, 2) not null default 0,
  start_date date not null,
  renewal_date date not null,
  billing_cycle text not null default 'monthly',
  status public.retainer_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.retainer_deliverables (
  id uuid primary key default gen_random_uuid(),
  retainer_id uuid not null references public.retainers (id) on delete cascade,
  platform text not null,
  number_of_posts integer not null default 0,
  campaigns integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  retainer_id uuid references public.retainers (id) on delete set null,
  contract_url text,
  storage_path text,
  signed_status text not null default 'unsigned',
  signed_date date,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  retainer_id uuid references public.retainers (id) on delete set null,
  amount numeric(12, 2) not null,
  due_date date not null,
  status public.invoice_status not null default 'unpaid',
  invoice_link text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount_paid numeric(12, 2) not null,
  payment_date date not null,
  method text not null default 'other',
  reference_note text,
  created_at timestamptz not null default now()
);

create index idx_clients_status on public.clients (status) where archived_at is null;
create index idx_retainers_client on public.retainers (client_id);
create index idx_retainers_status on public.retainers (status);
create index idx_invoices_client on public.invoices (client_id);
create index idx_invoices_due on public.invoices (due_date);
create index idx_payments_invoice on public.payments (invoice_id);

-- New auth user → profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'team'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role in ('admin', 'team')
  );
$$;

create or replace function public.user_client_id(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.client_id from public.profiles p where p.id = uid;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.retainers enable row level security;
alter table public.retainer_deliverables enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

-- Profiles: users read/update self; staff read all
create policy "profiles_select_self_or_staff"
  on public.profiles for select
  using (auth.uid() = id or public.is_staff(auth.uid()));

create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id);

-- Clients
create policy "clients_select"
  on public.clients for select
  using (
    public.is_staff(auth.uid())
    or (public.user_client_id(auth.uid()) is not null and id = public.user_client_id(auth.uid()))
  );

create policy "clients_write_staff"
  on public.clients for insert
  with check (public.is_staff(auth.uid()));

create policy "clients_update_staff"
  on public.clients for update
  using (public.is_staff(auth.uid()));

-- Contacts
create policy "contacts_select"
  on public.contacts for select
  using (
    public.is_staff(auth.uid())
    or client_id = public.user_client_id(auth.uid())
  );

create policy "contacts_insert_staff"
  on public.contacts for insert
  with check (public.is_staff(auth.uid()));

create policy "contacts_update_staff"
  on public.contacts for update
  using (public.is_staff(auth.uid()));

create policy "contacts_delete_staff"
  on public.contacts for delete
  using (public.is_staff(auth.uid()));

-- Retainers
create policy "retainers_select"
  on public.retainers for select
  using (
    public.is_staff(auth.uid())
    or client_id = public.user_client_id(auth.uid())
  );

create policy "retainers_insert_staff"
  on public.retainers for insert
  with check (public.is_staff(auth.uid()));

create policy "retainers_update_staff"
  on public.retainers for update
  using (public.is_staff(auth.uid()));

create policy "retainers_delete_staff"
  on public.retainers for delete
  using (public.is_staff(auth.uid()));

-- Deliverables
create policy "deliverables_select"
  on public.retainer_deliverables for select
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.retainers r
      where r.id = retainer_id and r.client_id = public.user_client_id(auth.uid())
    )
  );

create policy "deliverables_insert_staff"
  on public.retainer_deliverables for insert
  with check (public.is_staff(auth.uid()));

create policy "deliverables_update_staff"
  on public.retainer_deliverables for update
  using (public.is_staff(auth.uid()));

create policy "deliverables_delete_staff"
  on public.retainer_deliverables for delete
  using (public.is_staff(auth.uid()));

-- Contracts
create policy "contracts_select"
  on public.contracts for select
  using (
    public.is_staff(auth.uid())
    or client_id = public.user_client_id(auth.uid())
  );

create policy "contracts_write_staff"
  on public.contracts for insert
  with check (public.is_staff(auth.uid()));

create policy "contracts_update_staff"
  on public.contracts for update
  using (public.is_staff(auth.uid()));

-- Invoices
create policy "invoices_select"
  on public.invoices for select
  using (
    public.is_staff(auth.uid())
    or client_id = public.user_client_id(auth.uid())
  );

create policy "invoices_write_staff"
  on public.invoices for insert
  with check (public.is_staff(auth.uid()));

create policy "invoices_update_staff"
  on public.invoices for update
  using (public.is_staff(auth.uid()));

-- Payments
create policy "payments_select"
  on public.payments for select
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.client_id = public.user_client_id(auth.uid())
    )
  );

create policy "payments_write_staff"
  on public.payments for insert
  with check (public.is_staff(auth.uid()));

-- Storage bucket (create in dashboard or SQL)
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

create policy "contracts_bucket_staff_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'contracts'
    and public.is_staff(auth.uid())
  );

create policy "contracts_bucket_read"
  on storage.objects for select
  using (
    bucket_id = 'contracts'
    and (
      public.is_staff(auth.uid())
      or (storage.foldername(name))[1] = public.user_client_id(auth.uid())::text
    )
  );

create policy "contracts_bucket_staff_update"
  on storage.objects for update
  using (bucket_id = 'contracts' and public.is_staff(auth.uid()));

create policy "contracts_bucket_staff_delete"
  on storage.objects for delete
  using (bucket_id = 'contracts' and public.is_staff(auth.uid()));
