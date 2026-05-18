-- Migration: Automatic linking of primary contact to household membership
-- Description: When a member is assigned as the primary contact of a household, 
-- they are automatically added as a member of that household.

CREATE OR REPLACE FUNCTION public.link_household_primary_contact()
RETURNS TRIGGER AS $$
BEGIN
    -- If primary_contact_id is set or changed
    IF NEW.primary_contact_id IS NOT NULL THEN
        UPDATE public.members
        SET household_id = NEW.id
        WHERE id = NEW.primary_contact_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for households table
DROP TRIGGER IF EXISTS trg_link_household_primary_contact ON public.households;
CREATE TRIGGER trg_link_household_primary_contact
AFTER INSERT OR UPDATE OF primary_contact_id ON public.households
FOR EACH ROW
EXECUTE FUNCTION public.link_household_primary_contact();
