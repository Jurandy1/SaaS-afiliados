-- Allow UI status "desativada" (replaces/extends "pausada")
alter table if exists subid_ops drop constraint if exists subid_ops_status_check;

update subid_ops set status = 'desativada' where status = 'pausada';

alter table subid_ops
  add constraint subid_ops_status_check
  check (status is null or status in ('ativa', 'teste', 'desativada', 'pausada'));
