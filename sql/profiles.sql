-- Perfis de usuário + controle de aprovação (admin)
create table if not exists user_profiles (
  user_id uuid primary key,
  email text not null default '',
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  display_name text not null default '',
  company text not null default '',
  notes text not null default '',
  approved_by uuid,
  approved_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_status on user_profiles (status);
create index if not exists idx_user_profiles_email on user_profiles (email);
create index if not exists idx_user_profiles_role on user_profiles (role);
