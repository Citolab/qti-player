import { QtiPlayer } from "@citolab/qti-extended/qti-player";

const html = String.raw;

export class QtiIOLPlayer extends QtiPlayer {
  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.innerHTML = html`
      <style>
        @import url("https://unpkg.com/@citolab/qti-components@6.9.1-beta.55/dist/item.css");
        @import url("https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css");
      </style>

      <div class="flex-grow-1 overflow-auto">
        <qti-assessment-test-container
          class="d-block"
        ></qti-assessment-test-container>
      </div>

      <div class="d-flex align-items-center justify-content-between">
        <test-prev class="d-flex btn btn-primary">
          <hi-24-outline-chevron-left></hi-24-outline-chevron-left>
          <div>Vorige</div>
        </test-prev>
        <test-next class="d-flex btn btn-primary">
          <div>Volgende</div>
          <hi-24-outline-chevron-right></hi-24-outline-chevron-right>
        </test-next>
      </div>
    `;
  }
}
customElements.define("qti-iol-player", QtiIOLPlayer);
