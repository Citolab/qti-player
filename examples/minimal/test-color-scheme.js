// A test plugin of your own: <test-color-scheme>, a switch between light and dark.
//
// It is built on nothing but the public plugin API of @citolab/qti-components:
//  - computedContext (qti-base): the one read model a plugin gets, provided by <test-navigation>; here it reads
//    its own entry, computedContext.plugins.colorScheme
//  - qc-test-update-plugin-state (plugin-api): the request that stores that entry in the test's state
//    (session.plugins.colorScheme), so a host that stores the state keeps the choice over a reload
//  - controlStyles (plugin-api): the look of the test controls, so the switch sits level with test-next and friends
// It sets `color-scheme` on the document root; every light-dark() token of the theme follows, so the items, the
// test controls and the page flip together. Until it is pressed it follows the system's scheme.
// No Lit: a plain custom element, so this file has no dependency the page does not have already.

import { ContextEvent } from "@lit/context"; // the context protocol's request event (context-request), nothing more
import { computedContext } from "@citolab/qti-components/qti-base";
import { controlStyles, dispatchPublic } from "@citolab/qti-components/qti-test/plugin-api";

const system = matchMedia("(prefers-color-scheme: dark)");

export class TestColorScheme extends HTMLElement {
  #context; // the computed context, as <test-navigation> provides it

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.adoptedStyleSheets = [controlStyles.button.styleSheet];
    root.innerHTML = `<span class="control" part="button"><span aria-hidden="true"></span><slot></slot></span>`;
    this.addEventListener("click", () => this.#toggle());
    this.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.#toggle(); } });
  }

  #unsubscribe;

  connectedCallback() {
    if (!this.hasAttribute("role")) this.setAttribute("role", "switch");
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    system.addEventListener("change", this.#render);
    // Subscribe to the context (the context protocol: a context-request event that <test-navigation> answers):
    // #render runs again on every change of the test's state
    this.dispatchEvent(new ContextEvent(computedContext, this, (value, unsubscribe) => { this.#context = value; this.#unsubscribe = unsubscribe; this.#render(); }, true));
    this.#render();
  }

  disconnectedCallback() {
    system.removeEventListener("change", this.#render);
    this.#unsubscribe?.();
  }

  /** The scheme the candidate chose, or undefined while the page follows the system's */
  get #chosen() {
    return this.#context?.plugins?.colorScheme;
  }

  #render = () => {
    const scheme = this.#chosen ?? (system.matches ? "dark" : "light");
    document.documentElement.style.colorScheme = scheme; // always explicit, so the page's own CSS can read it (Tailwind's dark: does)
    this.setAttribute("scheme", scheme);
    this.setAttribute("aria-checked", String(scheme === "dark"));
    this.shadowRoot.querySelector("[aria-hidden]").textContent = scheme === "dark" ? "☀ " : "☾ ";
  };

  #toggle() {
    dispatchPublic(this, "qc-test-update-plugin-state", { plugin: "colorScheme", value: this.getAttribute("scheme") === "dark" ? "light" : "dark" });
  }
}

customElements.define("test-color-scheme", TestColorScheme);
