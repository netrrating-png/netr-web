-- Custom domain mapping for leagues
alter table leagues
  add column if not exists custom_domain text unique,
  add column if not exists custom_domain_status text not null default 'pending'
    check (custom_domain_status in ('pending','active','error'));

-- Commissioner updates their own league via existing owner RLS policy on leagues
