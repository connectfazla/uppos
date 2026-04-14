-- Allow admin/team to link client users to organizations (profiles.client_id, role).
create policy "profiles_update_staff"
  on public.profiles for update
  using (public.is_staff(auth.uid()));
