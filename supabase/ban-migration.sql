-- Run once on an existing Sentinel database before using /ban or report buttons.
alter table public.sanctions
  drop constraint if exists sanctions_type_check;

alter table public.sanctions
  add constraint sanctions_type_check
  check (type in ('warning', 'timeout', 'ban'));