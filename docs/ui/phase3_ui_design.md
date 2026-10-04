# Phase 3 UI & Design System

## Design Principles
The Radio Club Management ERP design system is built to communicate professionalism, clarity, and administrative efficiency. It avoids excessive flair (such as gaming aesthetics or heavy glassmorphism) in favor of a clean, structured interface tailored for daily operational use. 

## Tokens
### Colors
- **Background**: `var(--background)` - Clean, neutral canvas.
- **Surface**: `var(--surface)` - Cards, dropdowns, panels.
- **Primary**: `var(--primary)` - Brand identity (blue spectrum).
- **Secondary**: `var(--secondary)` - Subtle actions, non-distracting elements.
- **Feedback**: Success (Green), Warning (Orange), Error (Red), Info (Blue).

### Typography
- **Stack**: `Inter`, `system-ui`, `sans-serif`.
- **Hierarchy**:
  - H1: 3xl, bold, tight tracking
  - H2: 2xl, semibold, tight tracking
  - H3: xl, semibold, tight tracking
  - Body: base size, leading-7

### Spacing & Borders
- **Spacing**: Follows standard Tailwind spacing scale (4, 6, 8 for internal card padding).
- **Border Radius**: Semantic tokens (`--radius`) mapped to `.5rem` default for cards/buttons.
- **Shadows**: Subtle shadows reserved for layering (dropdowns, overlapping cards).

## Component System
- **Buttons**: Reusable `Button.tsx` (default, secondary, outline, ghost, destructive).
- **Inputs**: Reusable `Input.tsx` with consistent focus rings and disabled states.
- **Cards**: Composable structural blocks (`CardHeader`, `CardTitle`, `CardContent`).
- **Tables**: Semantic HTML implementation (`Table`, `TableRow`, `TableCell`) designed for dense administrative data.
- **Forms**: Integrated tightly with React Hook Form and Radix UI Primitives for accessible labels and validation (`Form.tsx`).

## Layout & Navigation
The Application Shell (`AppShell.tsx`) encapsulates the primary layout:
- **Desktop**: Persistent left-hand `Sidebar.tsx` and top `Header.tsx`. 
- **Mobile**: The sidebar collapses into an overlay triggered by a hamburger menu. The header remains fixed.
- **Routing**: Routes correspond directly to Phase 1 module definitions. Non-implemented modules render a `Placeholder.tsx` instead of fake functionality.

## Mock Data Strategy
All mock data used for UI development must be strictly isolated to UI components and clearly separated from application logic, paving the way for real Supabase data integration in Phase 4.

## Accessibility
The system relies on Radix UI primitives where applicable for complex interactive elements. Semantic HTML is enforced, inputs are strictly associated with `<label>`, and focus states are clearly delineated via standard ring utilities (`focus-visible:ring-primary`).
