# Client Name Navigation Audit Report

**Date:** February 4, 2026  
**Scope:** Audit of all client name text rendering to ensure consistent navigation behavior  
**Requirement:** Client names should navigate to client detail page when clicked, using proper link elements, without affecting adjacent UI controls.

---

## Summary

**Total Locations Found:** 10  
**Currently Navigates Correctly:** 3  
**Needs Fix:** 7  
**Inconsistencies:** Multiple - some use Link components, some rely on parent container clicks, some are not clickable at all.

---

## Detailed Findings

### ✅ 1. **src/app/recordings/page.tsx**
- **Component:** `RecordingsContent`
- **Location:** Recording card title (line ~754-759)
- **Current Implementation:** 
  - Uses `<Link>` component with proper href
  - Navigates to `/clients?highlight=${recording.clientId || recording.client_id}`
  - Only renders as link if `clientId` and `clientName` exist
- **Navigates Correctly:** ✅ **YES**
- **Issues:** None - proper implementation
- **Recommendation:** None - this is the correct pattern to follow

---

### ✅ 2. **src/app/session-notes/page.tsx**
- **Component:** `SessionNotesContent`
- **Location:** Session note group header (line ~961-971)
- **Current Implementation:**
  - Uses `<Link>` component with proper href
  - Navigates to `/clients?highlight=${group.notes[0].clientId}${group.sessionId ? `&session=${group.sessionId}` : ''}`
  - Only renders as link if `clientId` exists
- **Navigates Correctly:** ✅ **YES**
- **Issues:** None - proper implementation
- **Recommendation:** None - this is the correct pattern to follow

---

### ⚠️ 3. **src/app/reminders/page.tsx**
- **Component:** `RemindersPage`
- **Location:** Reminder card client name (line ~689-699)
- **Current Implementation:**
  - Uses `<Link>` component
  - Navigates to `/clients` (generic, no highlight parameter)
  - Only renders as link if `reminder.clientId` exists
- **Navigates Correctly:** ⚠️ **PARTIAL** - Goes to clients page but doesn't highlight specific client
- **Issues:** 
  - Missing `highlight` query parameter to focus on specific client
  - User must manually find the client after navigation
- **Recommendation:** Update href to include `highlight` parameter: `/clients?highlight=${reminder.clientId}`

---

### ❌ 4. **src/app/clients/page.tsx**
- **Component:** `ClientsPageContent`
- **Location:** Client card name display (line ~4596-4598)
- **Current Implementation:**
  - Client name rendered as plain `<p>` tag
  - Entire `Card` component has `onClick` handler that calls `handleEdit(client)`
  - Navigation happens via parent container click, not the name text itself
- **Navigates Correctly:** ❌ **NO** - Name text itself is not a link
- **Issues:**
  - Violates requirement: "Scope strictly to the client name text only"
  - Parent container click affects other UI elements (buttons, checkboxes)
  - Not using proper link element
  - In selection mode, clicking name toggles selection instead of navigating
- **Recommendation:** 
  - Wrap client name in `<Link>` component
  - Remove `onClick` from Card container
  - Add `onClick={(e) => e.stopPropagation()}` to action buttons/checkboxes to prevent navigation when clicking them
  - Use href: `/clients?highlight=${client.id}` or `/clients?client=${encodeURIComponent(client.name)}`

---

### ❌ 5. **src/components/scheduling.tsx**
- **Component:** `Scheduling`
- **Location:** Appointment detail view - client name header (line ~1513-1515)
- **Current Implementation:**
  - Client name rendered as plain `<h4>` tag
  - No navigation functionality
- **Navigates Correctly:** ❌ **NO**
- **Issues:**
  - Client name is not clickable
  - Missing navigation to client detail page
- **Recommendation:** 
  - Wrap client name in `<Link>` component
  - Use href: `/clients?highlight=${appointment.clientId}` (if available) or match by name
  - Ensure link doesn't interfere with appointment editing/viewing functionality

---

### ❌ 6. **src/components/email-tab.tsx**
- **Component:** `EmailTab`
- **Location:** Clients without email list (line ~1274)
- **Current Implementation:**
  - Client name rendered as plain `<div>` with `font-medium` class
  - No navigation functionality
- **Navigates Correctly:** ❌ **NO**
- **Issues:**
  - Client name is not clickable
  - Missing navigation to client detail page
- **Recommendation:** 
  - Wrap client name in `<Link>` component
  - Use href: `/clients?highlight=${client.id}` or `/clients?client=${encodeURIComponent(client.name)}`
  - Ensure link doesn't interfere with email input functionality

---

### ❌ 7. **src/app/dashboard/page.tsx**
- **Component:** `DashboardOverview`
- **Location:** Upcoming sessions list (line ~801)
- **Current Implementation:**
  - Client name rendered as plain `<p>` tag with `font-medium` class
  - Entire session card has `onClick` that navigates to schedule page
  - Navigation happens via parent container click, not the name text itself
- **Navigates Correctly:** ❌ **NO** - Name text itself is not a link
- **Issues:**
  - Violates requirement: "Scope strictly to the client name text only"
  - Parent container click navigates to schedule, not client detail
  - Not using proper link element
- **Recommendation:** 
  - Wrap client name in `<Link>` component
  - Use href: `/clients?highlight=${session.clientId}` or match by name
  - Remove or modify parent container `onClick` to prevent conflict
  - Add `onClick={(e) => e.stopPropagation()}` to prevent navigation when clicking other parts of card

---

### ❌ 8. **src/app/payments/page.tsx**
- **Component:** `PaymentsContent`
- **Location:** Unpaid sessions report modal (line ~1368)
- **Current Implementation:**
  - Client name rendered as plain `<p>` tag with `font-semibold` class
  - Entire button has `onClick` that opens payment dialog
  - No navigation to client detail page
- **Navigates Correctly:** ❌ **NO**
- **Issues:**
  - Client name is not clickable
  - Missing navigation to client detail page
  - Clicking anywhere on the button opens payment dialog, not client detail
- **Recommendation:** 
  - Wrap client name in `<Link>` component
  - Use href: `/clients?highlight=${apt.clientId}` or match by name
  - Add `onClick={(e) => e.stopPropagation()}` to prevent payment dialog from opening when clicking name
  - Consider making name link open in new tab or handle navigation without closing payment modal

---

### ❌ 9. **src/app/documents/page.tsx**
- **Component:** `DocumentsContent`
- **Location:** Document card description (line ~711)
- **Current Implementation:**
  - Client name rendered as plain text in `CardDescription`: `Client: ${doc.clientName || "Unassigned"}`
  - No navigation functionality
- **Navigates Correctly:** ❌ **NO**
- **Issues:**
  - Client name is not clickable
  - Missing navigation to client detail page
- **Recommendation:** 
  - Extract client name from the description text
  - Wrap client name portion in `<Link>` component
  - Use href: `/clients?highlight=${doc.clientId}` or match by name if clientId not available
  - Keep "Client:" label as plain text, only make name clickable

---

### ❌ 10. **src/app/clients/archived/page.tsx**
- **Component:** `ArchivedClientsPage`
- **Location:** Archived client card name (line ~172)
- **Current Implementation:**
  - Client name rendered as plain `<h3>` tag with `font-semibold` class
  - No navigation functionality
- **Navigates Correctly:** ❌ **NO**
- **Issues:**
  - Client name is not clickable
  - Missing navigation to client detail page
- **Recommendation:** 
  - Wrap client name in `<Link>` component
  - Use href: `/clients?highlight=${client.id}` or `/clients?client=${encodeURIComponent(client.name)}`
  - Ensure link doesn't interfere with restore/delete buttons

---

## Additional Considerations

### Navigation Pattern Consistency
- **Current Pattern (Working):** `/clients?highlight=${clientId}` - Used in recordings and session-notes
- **Alternative Pattern:** `/clients?client=${encodeURIComponent(clientName)}` - Used in some URL params
- **Recommendation:** Standardize on `highlight` parameter with client ID for consistency

### Link Component Usage
- **Current:** Some locations use Next.js `<Link>` component (correct)
- **Missing:** Most locations use plain text elements
- **Recommendation:** All client names should use `<Link>` from `next/link`

### Adjacent UI Controls
- **Risk Areas:**
  - Client cards with action buttons (clients page)
  - Payment dialog buttons (payments page)
  - Dashboard session cards
- **Recommendation:** Use `onClick={(e) => e.stopPropagation()}` on all buttons, checkboxes, and inputs to prevent navigation when clicking adjacent controls

### Editable/Disabled Fields
- **Status:** No editable client name fields found in audit
- **Recommendation:** If editable fields are added in future, ensure they do NOT navigate when clicked

---

## Priority Recommendations

### High Priority (User-Facing, Frequently Used)
1. **src/app/clients/page.tsx** - Main client list page (most critical)
2. **src/components/scheduling.tsx** - Appointment details view
3. **src/app/reminders/page.tsx** - Fix missing highlight parameter

### Medium Priority (Secondary Views)
4. **src/app/dashboard/page.tsx** - Upcoming sessions
5. **src/app/payments/page.tsx** - Unpaid sessions report
6. **src/app/documents/page.tsx** - Document client references

### Low Priority (Less Frequently Used)
7. **src/components/email-tab.tsx** - Clients without email list
8. **src/app/clients/archived/page.tsx** - Archived clients

---

## Implementation Guidelines

### Standard Pattern to Follow:
```tsx
import Link from 'next/link';

// If clientId is available:
<Link 
  href={`/clients?highlight=${client.id}`}
  className="hover:underline text-primary"
  onClick={(e) => e.stopPropagation()} // If inside clickable container
>
  {client.name || `${client.firstName} ${client.lastName}`}
</Link>

// If only clientName is available:
<Link 
  href={`/clients?client=${encodeURIComponent(client.name)}`}
  className="hover:underline text-primary"
  onClick={(e) => e.stopPropagation()} // If inside clickable container
>
  {client.name}
</Link>
```

### Key Requirements:
1. ✅ Use `<Link>` component from `next/link`
2. ✅ Only wrap the client name text, not parent containers
3. ✅ Use `onClick={(e) => e.stopPropagation()}` when inside clickable containers
4. ✅ Use `highlight` parameter with client ID when available
5. ✅ Fallback to `client` parameter with encoded name if ID unavailable
6. ✅ Add `hover:underline` and `text-primary` classes for visual indication
7. ✅ Ensure adjacent buttons/inputs have `stopPropagation` to prevent navigation

---

## Testing Checklist

After implementation, verify:
- [ ] Clicking client name navigates to correct client detail page
- [ ] Clicking buttons/checkboxes/inputs does NOT trigger navigation
- [ ] Navigation works in all identified locations
- [ ] URL parameters correctly highlight/focus the client
- [ ] Mobile touch interactions work correctly
- [ ] Keyboard navigation (Tab + Enter) works correctly
- [ ] No console errors or warnings
- [ ] Visual indication (underline on hover) is present

---

**End of Audit Report**
