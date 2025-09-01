drop extension if exists "pg_net";

alter table "public"."todos" add column "user_id" uuid not null default auth.uid();

alter table "public"."todos" enable row level security;


  create policy "Users can delete own todos"
  on "public"."todos"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert own todos"
  on "public"."todos"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can read own todos"
  on "public"."todos"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own todos"
  on "public"."todos"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



