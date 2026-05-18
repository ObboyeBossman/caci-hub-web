-- Migration: get_available_primary_contacts RPC
-- Description: Returns a list of assembly members matching search criteria,
-- explicitly excluding members who are ALREADY primary contacts of other households.
-- This prevents PGRST116 Unique Constraint violations natively in the UI.

CREATE OR REPLACE FUNCTION public.get_available_primary_contacts(
  p_assembly_id UUID, 
  p_search TEXT, 
  p_current_household_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID, first_name TEXT, last_name TEXT, phone_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.first_name, m.last_name, m.phone_number
  FROM public.members_view m
  WHERE m.assembly_id = p_assembly_id
    AND m.is_active = true
    AND (
      p_search IS NULL 
      OR p_search = '' 
      OR m.first_name ILIKE '%' || p_search || '%' 
      OR m.last_name ILIKE '%' || p_search || '%'
    )
    AND NOT EXISTS (
       SELECT 1 FROM public.households h 
       WHERE h.primary_contact_id = m.id 
         AND (p_current_household_id IS NULL OR h.id != p_current_household_id)
    )
  ORDER BY m.last_name, m.first_name;
END;
$$;
