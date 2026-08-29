---
name: Kinetic Soft-Shell
colors:
  surface: '#f9f9ff'
  surface-dim: '#d0daf0'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d9e3f9'
  on-surface: '#121c2c'
  on-surface-variant: '#424752'
  inverse-surface: '#273141'
  inverse-on-surface: '#ebf1ff'
  outline: '#737784'
  outline-variant: '#c3c6d4'
  surface-tint: '#1e5bba'
  primary: '#1a58b7'
  on-primary: '#ffffff'
  primary-container: '#3d72d2'
  on-primary-container: '#fefcff'
  inverse-primary: '#aec6ff'
  secondary: '#5e5f5c'
  on-secondary: '#ffffff'
  secondary-container: '#e0e0dd'
  on-secondary-container: '#626361'
  tertiary: '#825100'
  on-tertiary: '#ffffff'
  tertiary-container: '#a46700'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#aec6ff'
  on-primary-fixed: '#001a43'
  on-primary-fixed-variant: '#004397'
  secondary-fixed: '#e3e2df'
  secondary-fixed-dim: '#c7c6c4'
  on-secondary-fixed: '#1b1c1a'
  on-secondary-fixed-variant: '#464745'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb960'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f9f9ff'
  on-background: '#121c2c'
  surface-variant: '#d9e3f9'
typography:
  display-lg:
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 20px
  card-gap: 24px
  section-margin: 40px
---

## Brand & Style

The design system is engineered for the high-intensity environment of logistics management, specifically tailored for Trucking ERP interfaces. The brand personality is **calm, precise, and supportive**, designed to reduce the cognitive load and eye strain associated with long-duration monitoring of routes, fleet health, and dispatch schedules.

The visual style follows a **Soft-Modern** approach, blending high-end SaaS aesthetics with operational efficiency. By utilizing a "Soft-Shell" container strategy, the interface prioritizes legibility and a sense of physical ease. This is achieved through:
- **Generous negative space** to separate dense data sets.
- **Micro-interactions** that feel fluid and dampened rather than snappy.
- **Low-arousal color palettes** to prevent "dashboard fatigue."
- **Organic depth** that mimics natural light hitting soft surfaces.

## Colors

The palette is anchored by a warm off-white foundation (`#F7F6F3`), which acts as a "canvas" to make pure white cards (`#FFFFFF`) pop with subtle elevation. 

- **Primary (`#5B8DEF`)**: A muted, reliable blue used for primary actions and active states. It provides high visibility without being aggressive.
- **Neutrals**: Primary text uses a soft charcoal (`#2D3748`) to maintain high contrast while avoiding the harshness of pure black. Secondary text uses a muted gray (`#718096`) for metadata and labels.
- **Chart Palette**: A curated selection of desaturated pastels ensures that data visualization is expressive but harmonious. These tones are specifically selected to be distinguishable even when used in small data points like sparklines or heatmaps.

## Typography

This design system utilizes **Inter** across all levels to take advantage of its exceptional legibility and tall x-height, which is critical for reading license plate numbers, VINs, and timestamps.

- **Headlines**: Use a semi-bold weight with tight letter-spacing to create a strong visual anchor for page titles.
- **Body Text**: Optimized for long-form reading in tables and logs. The `body-md` (16px) is the standard for data entry to ensure touch-targets and readability remain accessible.
- **Labels**: Small-caps or uppercase labels are used sparingly for table headers and form labels to provide a distinct stylistic shift from dynamic user data.

## Layout & Spacing

The layout philosophy is built on a **Fluid Grid** with fixed maximum widths for content containers to ensure data density doesn't become overwhelming on ultra-wide monitors.

- **Base Unit**: An 8px linear scale drives all spacing.
- **Grid**: A 12-column system is used for the main dashboard. On mobile, this reflows to a single column with cards stacking vertically.
- **Breathability**: Large margins (24px) around the viewport edges and generous gaps between cards (24px) create the "airy" feel requested. No two data groups should feel crowded; if information density is high, use tabs or progressive disclosure rather than tightening the spacing.

## Elevation & Depth

In this design system, depth is communicated through **Tonal Layering** and **Ambient Shadows** rather than lines.

- **Level 0 (Background)**: `#F7F6F3` – The base surface.
- **Level 1 (Cards)**: `#FFFFFF` – Primary content containers. These use a very large blur radius (30-40px) with low opacity (4-6%) shadows tinted with the primary blue or a neutral gray to create a "floating" effect.
- **Level 2 (Dropdowns/Modals)**: Use a slightly more defined shadow and a backdrop blur (12px) to focus the user's attention on the interaction layer.
- **Outline Policy**: Avoid solid 1px borders. If separation is needed, use a 1px stroke of `#E2E8F0` at 50% opacity or rely entirely on the shadow depth.

## Shapes

The shape language is **Ultra-Rounded**, projecting a friendly and approachable toolset. 

- **Cards**: Feature a 20px radius to soften the layout and emphasize the "Soft-Shell" container concept.
- **Buttons & Inputs**: Use a 12px radius, ensuring they feel substantial and easy to interact with on both desktop and tablet (common in truck cabs).
- **Interactive Elements**: Active states for list items or navigation links should use a rounded-pill shape for the background highlight to contrast against the rectangular grid.

## Components

### Buttons
- **Primary**: Solid `#5B8DEF` with white text. High-radius corners. No gradient, but a subtle shadow on hover to simulate "pressing."
- **Secondary**: Ghost style with a light blue tinted background (`#5B8DEF10`) and primary color text.

### Input Fields
- Background should be white or a very faint gray. Focus states are indicated by a 2px soft glow of the primary color rather than a hard border change. Labels are always positioned outside the field for permanent visibility.

### Cards
- The primary container for the ERP. Must have a 20px border radius and the "Ambient" shadow profile. Header sections within cards should be separated by whitespace rather than a line.

### Chips & Status Indicators
- Use the "Pill" shape. Statuses (e.g., "In Transit", "Delayed") should use the Pastel Semantic colors. The background should be a 15% opacity version of the status color with full-saturation text for contrast.

### Data Tables
- Rows should have ample vertical padding (16px). Avoid vertical grid lines. Use a light highlight on hover to assist the eye across horizontal data points.

### Charts
- All chart elements (bars, line points) should have rounded caps/ends. Tooltips should follow the Card styling with high-radius corners and backdrop blurs.