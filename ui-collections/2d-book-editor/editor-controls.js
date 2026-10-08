export function themeSelect(select) {
  const wrapper = document.createElement("div");
  wrapper.className = "editor-dropdown";
  select.after(wrapper);
  wrapper.append(select);
  select.hidden = true;
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "dropdown-trigger";
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-label", select.closest("label").querySelector("span").textContent);
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-haspopup", "listbox");
  const menu = document.createElement("div");
  menu.className = "dropdown-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  wrapper.append(trigger, menu);

  function sync() {
    trigger.textContent = select.selectedOptions[0]?.textContent || "";
    trigger.style.fontFamily = select.selectedOptions[0]?.style.fontFamily || "";
    menu.querySelectorAll("button").forEach((option) => option.setAttribute("aria-selected", String(option.dataset.value === select.value)));
  }
  function close() {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }
  for (const option of select.options) {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "option");
    item.dataset.value = option.value;
    item.textContent = option.textContent;
    item.style.fontFamily = option.style.fontFamily;
    item.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
      close();
      trigger.focus();
    });
    menu.append(item);
  }
  trigger.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    trigger.setAttribute("aria-expanded", String(!menu.hidden));
  });
  wrapper.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { close(); trigger.focus(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      const options = [...menu.querySelectorAll("button")];
      const index = options.indexOf(document.activeElement);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      options[(index + direction + options.length) % options.length].focus();
    }
  });
  document.addEventListener("pointerdown", (event) => { if (!wrapper.contains(event.target)) close(); });
  select.addEventListener("editor-sync", sync);
  sync();
}
