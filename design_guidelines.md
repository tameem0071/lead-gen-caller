# Design Guidelines: Lead Generation & Outbound Calling System

## Design Approach
**System-Based Approach** inspired by Linear and Stripe - prioritizing clarity, efficiency, and professional trust. This is a B2B utility tool where function and speed matter most.

## Core Design Principles
1. **Functional Clarity**: Every element serves a clear purpose - no decorative bloat
2. **Instant Comprehension**: Users should understand actions and states at a glance
3. **Professional Trust**: Design communicates reliability and competence
4. **Speed Over Spectacle**: Fast interactions, minimal animations

---

## Typography System

**Font Stack**: Inter (via Google Fonts CDN)
- **Headings**: 
  - H1: 2xl (24px), font-semibold
  - H2: xl (20px), font-semibold
  - H3: lg (18px), font-medium
- **Body Text**: base (16px), font-normal
- **Small Text** (metadata, timestamps): sm (14px), font-normal
- **Labels**: sm (14px), font-medium
- **Buttons**: base (16px), font-medium

---

## Layout & Spacing System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16** exclusively
- Component padding: p-4 to p-6
- Section spacing: space-y-6 to space-y-8
- Card padding: p-6
- Input padding: px-4 py-3
- Button padding: px-6 py-3

**Container Strategy**:
- Admin dashboard: max-w-7xl mx-auto px-6
- Chat widget: max-w-md
- Form sections: max-w-2xl

**Grid Layouts**:
- Lead list: Single column table on mobile, full table on desktop
- Call status cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6

---

## Component Library

### Navigation (Admin Dashboard)
- Top navigation bar with logo left, user profile right
- Height: h-16, items vertically centered
- Subtle bottom border for separation
- Active state: medium weight text

### Lead Generation Chat Widget
- **Conversational Form Design**:
  - Message bubbles for questions (left-aligned, max-w-sm)
  - Input fields appear below current question
  - Progressive disclosure: one question at a time
  - Friendly micro-copy (e.g., "Great! What's your business name?")
- **Submit State**: Shows success message with checkmark icon, "We'll call you shortly" confirmation
- **Positioning**: Fixed bottom-right on main site, or centered full-page on dedicated /leads page

### Admin Dashboard

**Lead Table**:
- Table headers: uppercase text-xs font-medium tracking-wide
- Row height: py-4, hover state with subtle background
- Columns: Business Name | Contact | Phone | Product Category | Status | Actions
- Status badges: inline-flex items-center with dot indicator and text
- Action buttons: Icon buttons (phone icon for "Call Now")

**Call Session Cards**:
- Card structure: border rounded-lg p-6
- Header: Business name + timestamp (text-sm)
- Status indicator: Large pill badge (INTRO/DIALING/COMPLETED/FAILED)
- Metadata grid: 2-column layout showing Phone, Product Category, Brand Name
- Transcript section: Ordered list with timestamps (if applicable)
- Call details: Twilio SID and status in monospace font (text-xs)

**Manual Call Trigger**:
- Primary button: "Place Call Now" with phone icon
- Confirmation modal: Simple centered modal (max-w-md) with call details summary and dual-action (Cancel/Confirm)

### Forms & Inputs

**Text Inputs**:
- Height: h-12
- Border: 1px solid, rounded-lg
- Focus: 2px ring
- Font size: base (16px) to prevent mobile zoom

**Phone Input**:
- Format helper text below input: "Format: +1234567890"
- Real-time E.164 validation with inline error message

**Select Dropdowns**:
- Match input height and styling
- Chevron icon on right

**Primary Buttons**:
- Height: h-12, rounded-lg
- Icon placement: left of text with mr-2 spacing
- Loading state: Spinner icon replaces action icon

**Secondary Buttons**:
- Same height, transparent background with border
- Medium font weight

### Status Indicators

**Call State Badges**:
- INTRO: Neutral state (outlined style)
- DIALING: Active state with pulse animation (subtle)
- COMPLETED: Success state
- FAILED: Error state
- Size: px-3 py-1, rounded-full, text-sm font-medium

**Real-time Updates**:
- Polling indicator: Small pulsing dot in top-right of status badge
- Update timestamp: "Updated 3s ago" in text-xs

### Data Display

**Empty States**:
- Centered layout with icon (heroicons phone icon)
- Heading: "No calls yet"
- Subtext: "Leads will appear here once created"
- CTA: "Create First Lead" button

**Loading States**:
- Skeleton loaders for table rows (3 animated rectangles)
- Spinner for button actions

---

## Icons
**Library**: Heroicons (via CDN)
- Phone (phone icon): Call actions
- CheckCircle: Success confirmations  
- ExclamationTriangle: Error states
- Clock: Pending/waiting states
- Refresh: Retry actions
- User: Contact/profile

---

## Responsive Behavior

**Mobile (< 768px)**:
- Lead table: Convert to card layout, stack all info vertically
- Chat widget: Full-screen takeover instead of floating
- Admin nav: Hamburger menu

**Desktop (>= 1024px)**:
- Full table view with all columns visible
- Multi-column call session grid (3 columns)
- Side-by-side layouts for detail views

---

## Animations
**Minimal & Purposeful Only**:
- Page transitions: None
- Status change: Subtle fade (200ms)
- Button click: Scale down 98% (100ms) - built into component
- DIALING badge: Gentle pulse (1.5s interval)
- Loading spinners: Standard rotation
- No scroll animations, no parallax

---

## Page Layouts

### 1. Lead Generation Page (`/`)
- Clean, centered layout (max-w-2xl)
- Hero headline: "Get a Call From Us in Minutes" (text-3xl font-bold)
- Subheadline explaining the process
- Chat widget directly below (no separate widget popup)

### 2. Admin Dashboard (`/admin`)
- Full-width layout with top nav
- Two-tab interface: "Leads" | "Call Sessions"
- Leads tab: Searchable table with "Call Now" actions
- Call Sessions tab: Grid of call status cards with filters (All/Active/Completed/Failed)

### 3. Call Detail Page (`/admin/call/:id`)
- Back button to dashboard
- Large status badge at top
- Two-column layout: Call info (left) | Timeline/Transcript (right)
- Action buttons at bottom (Retry Call, Close)

---

## Trust & Professional Elements
- Verified badge/indicator for Twilio integration status
- Timestamp on every action
- Clear error messages with recovery paths
- Rate limiting notification: "Please wait 60s before calling this lead again"
- Trial mode banner: "Trial Mode: Only verified numbers" (dismissible, top of admin)