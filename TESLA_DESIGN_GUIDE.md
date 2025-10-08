# Tesla Design System - Quick Reference Guide

## 🎨 Color Usage

### Primary Colors
```tsx
// Backgrounds
className="bg-tesla-dark-gray"  // Main dark background
className="bg-tesla-silver"     // Subtle light background
className="bg-white"            // Clean white background

// Text
className="text-tesla-dark-gray"  // Primary text
className="text-tesla-light-gray" // Secondary text
className="text-white"            // On dark backgrounds
```

### Accent Colors (Use Sparingly)
```tsx
className="bg-tesla-blue"  // Primary CTA only
className="bg-tesla-red"   // Critical actions only
```

## 🔤 Typography

### Headings
```tsx
<h1 className="text-4xl lg:text-5xl font-bold text-tesla-dark-gray tracking-tight">
  Main Headline
</h1>

<h2 className="text-3xl font-bold text-tesla-dark-gray tracking-tight">
  Section Title
</h2>

<h3 className="text-2xl font-bold text-tesla-dark-gray">
  Subsection
</h3>
```

### Body Text
```tsx
<p className="text-base font-light text-tesla-dark-gray leading-relaxed">
  Regular paragraph text
</p>

<p className="text-lg font-light text-tesla-light-gray">
  Secondary information
</p>

<p className="text-sm font-light text-tesla-light-gray">
  Caption or small text
</p>
```

## 🔘 Buttons

### Primary CTA
```tsx
<button className="btn-tesla btn-tesla-primary px-12 py-4">
  Get Started
</button>
```

### Secondary Action
```tsx
<button className="btn-tesla btn-tesla-secondary px-8 py-3">
  Learn More
</button>
```

### Outline Buttons
```tsx
// On light background
<button className="btn-tesla btn-tesla-outline-dark px-6 py-3">
  Cancel
</button>

// On dark background
<button className="btn-tesla btn-tesla-outline-light px-6 py-3">
  Explore
</button>
```

### Full Width Button
```tsx
<button className="btn-tesla btn-tesla-secondary w-full py-4">
  Sign In
</button>
```

## 📝 Form Elements

### Input Fields
```tsx
<div>
  <label className="block text-sm font-medium text-tesla-dark-gray mb-2">
    Email Address
  </label>
  <input
    type="email"
    className="input-tesla-minimal"
    placeholder="you@example.com"
  />
</div>
```

### Text Area
```tsx
<textarea
  className="input-tesla-minimal resize-none"
  rows={4}
  placeholder="Enter your message"
/>
```

### Select Dropdown
```tsx
<select className="input-tesla-minimal">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

## 🎴 Cards

### Basic Card
```tsx
<div className="bg-white border border-gray-200 rounded-lg p-8">
  <h3 className="text-xl font-bold text-tesla-dark-gray mb-4">
    Card Title
  </h3>
  <p className="text-tesla-light-gray font-light">
    Card content goes here
  </p>
</div>
```

### Dark Card
```tsx
<div className="bg-tesla-dark-gray text-white rounded-lg p-8">
  <h3 className="text-xl font-bold mb-4">
    Dark Card Title
  </h3>
  <p className="font-light text-gray-300">
    Content on dark background
  </p>
</div>
```

## 📐 Layouts

### Hero Section
```tsx
<section className="bg-tesla-dark-gray text-white py-32">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="max-w-3xl">
      <h1 className="text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
        Hero Headline
      </h1>
      <p className="text-xl font-light text-gray-300 mb-8">
        Supporting text description
      </p>
      <button className="btn-tesla btn-tesla-primary px-12 py-4">
        Take Action
      </button>
    </div>
  </div>
</section>
```

### Feature Grid
```tsx
<section className="py-24 bg-tesla-silver">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="grid md:grid-cols-3 gap-12">
      <div className="text-center">
        <h3 className="text-xl font-bold text-tesla-dark-gray mb-4">
          Feature One
        </h3>
        <p className="text-tesla-light-gray font-light">
          Description text
        </p>
      </div>
      {/* Repeat for other features */}
    </div>
  </div>
</section>
```

### Modal / Dialog
```tsx
<div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
  <div className="bg-white border border-gray-200 rounded-lg p-8 w-full max-w-md">
    <h3 className="text-xl font-bold text-tesla-dark-gray mb-6">
      Modal Title
    </h3>

    <div className="space-y-5">
      {/* Modal content */}
    </div>

    <div className="flex gap-3 mt-8">
      <button className="flex-1 btn-tesla btn-tesla-secondary py-3">
        Confirm
      </button>
      <button className="btn-tesla btn-tesla-outline-dark py-3 px-6">
        Cancel
      </button>
    </div>
  </div>
</div>
```

## 🔄 Loading States

### Spinner
```tsx
<div className="flex items-center justify-center py-12">
  <div className="spinner-tesla"></div>
</div>
```

### With Text
```tsx
<div className="text-center">
  <div className="spinner-tesla mx-auto mb-4"></div>
  <p className="text-tesla-light-gray font-light">Loading...</p>
</div>
```

## 📊 Progress Bar

### Minimal Progress
```tsx
<div className="mb-8">
  <div className="flex justify-between text-sm font-light text-tesla-light-gray mb-3">
    <span>Progress</span>
    <span>75%</span>
  </div>
  <div className="w-full bg-tesla-silver rounded h-1">
    <div
      className="bg-tesla-dark-gray h-1 transition-all duration-500"
      style={{ width: '75%' }}
    />
  </div>
</div>
```

## 🔗 Links

### Standard Link
```tsx
<a href="#" className="link-tesla">
  Learn more
</a>
```

### Light Link (on dark background)
```tsx
<a href="#" className="link-tesla-light">
  Explore options
</a>
```

## ⚠️ Alerts & Messages

### Error Message
```tsx
<div className="bg-red-50 border border-red-200 rounded p-4">
  <p className="text-red-700 text-sm font-light">
    Error message text
  </p>
</div>
```

### Info Message
```tsx
<div className="bg-tesla-silver border border-gray-200 rounded p-4">
  <p className="text-tesla-dark-gray text-sm font-light">
    Information message
  </p>
</div>
```

## 📱 Responsive Patterns

### Mobile-First Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Grid items */}
</div>
```

### Responsive Text
```tsx
<h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
  Responsive Headline
</h1>
```

### Responsive Spacing
```tsx
<section className="py-12 md:py-16 lg:py-24">
  {/* Section content */}
</section>
```

## 🎯 Best Practices

### DO ✅
- Use generous whitespace (py-8, py-12, py-24)
- Stick to black, dark gray, silver, and white
- Use font-light (300) for body text
- Use font-bold (700) for headlines
- Apply tracking-tight to headlines
- Use minimal shadows (1-3px max)
- Keep buttons pill-shaped (rounded-full)
- Use subtle transitions (200-300ms)

### DON'T ❌
- Use gradients (solid colors only)
- Add emojis or colorful icons
- Use heavy drop shadows
- Apply pulse or glow animations
- Mix multiple accent colors
- Use rounded corners everywhere
- Add unnecessary visual effects
- Use bold body text

## 🚀 Quick Start Template

```tsx
export default function MyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-tesla-dark-gray">
              TSHLA
            </h1>
            <button className="btn-tesla btn-tesla-secondary text-sm">
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-tesla-dark-gray mb-6 tracking-tight">
          Page Title
        </h2>
        <p className="text-lg font-light text-tesla-light-gray mb-8">
          Page description
        </p>

        <button className="btn-tesla btn-tesla-primary px-12 py-4">
          Call to Action
        </button>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-light text-tesla-light-gray">
            © 2025 TSHLA Medical
          </p>
        </div>
      </footer>
    </div>
  );
}
```

---

**Need help?** Reference the implemented pages:
- [LandingPage.tsx](src/pages/LandingPage.tsx) - Hero sections, features
- [Login.tsx](src/pages/Login.tsx) - Forms and inputs
- [DoctorDashboardUnified.tsx](src/pages/DoctorDashboardUnified.tsx) - Modals and cards
