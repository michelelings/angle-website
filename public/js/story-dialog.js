// Shared focus management for the gallery and stream story dialogs.
let returnFocus;
let background = [];
const focusable = 'a[href], button:not([disabled]), [tabindex="0"]';

export function showStoryDialog(modal) {
  if (modal.classList.contains("open")) return;
  returnFocus = document.activeElement;
  modal.classList.add("open");
  document.body.classList.add("modal-open");
  modal.querySelector(".modal-content").scrollTop = 0;
  // Wait for visibility to update before focusing an element in the dialog.
  requestAnimationFrame(() => {
    if (modal.classList.contains("open")) {
      modal.querySelector(".modal-close").focus({ preventScroll: true });
    }
  });
  background = [...document.body.children]
    .filter(
      (element) =>
        element !== modal && !["SCRIPT", "STYLE"].includes(element.tagName),
    )
    .map((element) => [element, element.inert]);
  background.forEach(([element]) => {
    element.inert = true;
  });
  modal.addEventListener("keydown", trapFocus);
}

export function hideStoryDialog(modal) {
  modal.classList.remove("open");
  document.body.classList.remove("modal-open");
  modal.removeEventListener("keydown", trapFocus);
  background.forEach(([element, inert]) => {
    element.inert = inert;
  });
  background = [];
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
}

function trapFocus(event) {
  if (event.key !== "Tab") return;
  const items = [...event.currentTarget.querySelectorAll(focusable)].filter(
    (element) => element.getClientRects().length > 0,
  );
  const first = items[0],
    last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
