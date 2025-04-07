# QTI Player Example

This repository contains a minimal, fully functional example of a **QTI Player** using [`@citolab/qti-components`](https://github.com/Citolab/qti-components). It serves as a _"Hello World"_ or _cookbook-style_ reference for implementing a QTI player using:

- Plain JavaScript (no frameworks)
- Web Components
- Tailwind CSS with DaisyUI
- `Navigo` for client-side routing
- QTI-specific components from `@citolab/qti-components`

## 🧩 What’s in the Box

This example demonstrates how to:

- Embed and use the core QTI test component (`<qti-test>`)
- Render a test from XML using `<test-container>`
- Handle linear and nonlinear navigation (`<test-next>`, `<test-prev>`, etc.)
- Display navigation UI with `<test-navigation>`
- Add custom view toggles and scoring controls
- Switch themes using `theme-change`
- Use `<test-stamp>` for dynamic templating with contextual conditions
- Maintain session state via `sessionStorage`
- Route between test packages and specific items using `Navigo`
- Render debug/test context with `<test-print-context>` and `<test-stamp debug>`

## 📂 Project Structure

There’s just a single HTML file:

```
index.html
```

This file includes:

- QTI component imports via `@citolab/qti-components`
- Test loading logic using JavaScript and routing with Navigo
- Theme support (custom themes + DaisyUI)
- Custom test toolbar with:
  - View toggle
  - Scoring buttons
  - Feedback and correct answer display
  - Navigation via list or thumbnail grid
- A collapsible side pane for:
  - Test package selection
  - Theme switching
  - Debug context info display

## 🧠 Stamp Context

Dynamic rendering is handled using the `<test-stamp>` element, which provides contextual access to:

- `item`
- `section`
- `testpart`
- `test`

This allows you to conditionally show/hhide components based on the current context.

### Example

```html
<test-stamp>
  <template>
    <template type="if" if="{{ testpart.navigationMode == 'nonlinear' }}">
      <test-prev class="btn btn-outline" role="button">
        <i class="bi bi-arrow-left-short"></i>
      </test-prev>
    </template>
  </template>
</test-stamp>
```

Use `<test-stamp debug></test-stamp>` to inspect the available context in the UI.

## 🗂️ Test Packages

The following example test packages are configured:

```js
map.set("kennisnet1", "/kennisnet-1");
map.set("kennisnet2", "/kennisnet-2");
```

You can navigate to these using:

```
/kennisnet1
/kennisnet2
```

Each test is expected to include:

- `/AssessmentTest.xml`
- `/items.json` (metadata)

## 🌈 Theme Support

Built-in themes are available through [DaisyUI](https://daisyui.com/) and can be changed using the theme dropdown in the side pane. A custom `wikiwijs` theme is also included.

To add your own themes, extend the `data-theme` styles in the `<style>` block inside the HTML.

## 🔧 Development Setup

No build step or framework needed! Just serve this HTML with a simple HTTP server.

### Option 1: Live Server (VS Code)

Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension and right-click `index.html` → **"Open with Live Server"**.

### Option 2: Using `vite`

Create a minimal `vite.config.js`:

```js
export default {
  base: './',
};
```

Install Vite and run:

```bash
npm install vite
npx vite
```

Make sure `%VITE_BASE_HREF%` is replaced with `'/'` or a relative path in the final build if needed.

## 📦 Dependencies (CDN-based)

- [@citolab/qti-components](https://github.com/Citolab/qti-components)
- [Navigo](https://github.com/krasimir/navigo)
- [Tailwind via CDN](https://tailwindcss.com/docs/installation/play-cdn)
- [DaisyUI](https://daisyui.com/)
- [Bootstrap Icons](https://icons.getbootstrap.com/)
- [theme-change](https://github.com/saadeghi/theme-change)

## 🧪 Testing & Debugging

Open the side pane (gear icon) to:

- Switch themes
- View `test-stamp` context with `<test-stamp debug>`
- Inspect current test item variables via `<test-print-item-variables>`

---

## 📎 License

This project is open source and can be used freely as a reference or starting point for building your own QTI players.
