# Profile Update Implementation Plan

## Goal Description
The objective is to allow users to update their own profile details directly from the "Profile" tab inside the Settings Overlay. Currently, the profile is read-only and displays a "Contact your administrator" notice. This change will replace that notice with an inline form toggle allowing the user to update their personal and contact information.

## Proposed Changes

### UI & Components

#### [MODIFY] src/modules/settings/pages/panels/ProfilePanel.ts
- Update [profilePanelHTML](file:///home/obboye/dev/caci-hub-web/src/modules/settings/pages/panels/ProfilePanel.ts#165-363) to accept a boolean `editMode` parameter.
- Add `data-member-id="${member?.id ?? ''}"` to the `#s-panel-profile` section element.
- When `editMode` is true, render standard input fields (`<input class="mm-form-input">`, `<select>`) for editable fields instead of static text. Editable fields should include:
  - First Name, Last Name, Title
  - Date of Birth, Gender, Marital Status, Occupation
  - Email, Phone Number, WhatsApp Number, Physical Address
- Exclude core system fields (Membership Number, Assembly, Household, Status, Joined Date) from editing.
- Swap the "Contact your administrator" bottom notice for an "Edit Profile" button when not editing.
- In `editMode`, show "Cancel" and "Save Changes" buttons instead.
- Update [bindProfilePanel](file:///home/obboye/dev/caci-hub-web/src/modules/settings/pages/panels/ProfilePanel.ts#368-390) to handle "Edit Profile" and "Cancel" clicks by triggering a DOM replacement with the new parameter state and rebinding.
- On "Save Changes" click, collect all values, run `UpdateMemberSchema` validation, call [updateMember](file:///home/obboye/dev/caci-hub-web/src/modules/membership/repository.ts#403-428), and render back to non-edit mode.

#### [MODIFY] src/modules/settings/pages/SettingsOverlay.ts
- Export the current `realHTML.querySelector('#s-panel-profile')` DOM replacement logic into a reusable helper `reRenderProfilePanel(editMode)` inside [SettingsOverlay](file:///home/obboye/dev/caci-hub-web/src/modules/settings/pages/SettingsOverlay.ts#16-231) if possible, or trigger it directly from the bound events in [ProfilePanel.ts](file:///home/obboye/dev/caci-hub-web/src/modules/settings/pages/panels/ProfilePanel.ts).

## Verification Plan

### Automated Tests
- Run `npm run tsc` to verify TypeScript typings the components and schema align.

### Manual Verification
1. Open the application.
2. Click on the user profile to open the Settings modal.
3. Observe the "Profile" tab.
4. Scroll to the bottom and click "Edit Profile".
5. Change "Occupation" or "Marital Status".
6. Click "Save Changes".
7. Verify that the UI switches back to read-only mode and a success toast appears.
8. Verify that the newly entered string persists.
