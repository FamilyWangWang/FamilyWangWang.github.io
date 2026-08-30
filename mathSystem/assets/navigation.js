(() => {
  const desktop = window.matchMedia("(min-width: 1024px)");

  function syncNavigation() {
    document.querySelectorAll("nav.toc details.toc-menu").forEach((menu) => {
      if (desktop.matches) {
        menu.open = true;
        menu.dataset.desktopOpen = "true";
      } else if (menu.dataset.desktopOpen === "true") {
        menu.open = false;
        delete menu.dataset.desktopOpen;
      }
    });
  }

  syncNavigation();
  desktop.addEventListener("change", syncNavigation);
})();
