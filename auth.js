(function () {
  const USER_ID_KEY = "GORNITSA_USER_ID";
  const isIndexPage = location.pathname === "/" || location.pathname.endsWith("/index.html");
  const isAdminPage = location.pathname.endsWith("/admin.html");
  const loginUrl = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
  let lastPresenceHeartbeatErrorAt = 0;
  if (isIndexPage) {
    const navigation = document.getElementById("topNavBar");
    const gear = document.getElementById("topGearBtn");
    if (navigation) navigation.style.visibility = "hidden";
    if (gear) gear.style.visibility = "hidden";
  }

  async function requestSession() {
    const response = await fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      if (response.status === 401) location.replace(loginUrl);
      throw new Error(`Не удалось проверить сессию (HTTP ${response.status}).`);
    }
    return (await response.json()).user;
  }

  async function sendPresenceHeartbeat() {
    try {
      const response = await fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: "{}",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      lastPresenceHeartbeatErrorAt = 0;
    } catch (error) {
      if (Date.now() - lastPresenceHeartbeatErrorAt > 30000) {
        console.warn("Не удалось обновить статус присутствия.", error);
        lastPresenceHeartbeatErrorAt = Date.now();
      }
    }
  }

  function revealAdminInterface() {
    const body = document.body;
    const panel = document.querySelector("main.admin-scroll");
    for (const element of [document.documentElement, body, panel]) {
      if (!element) continue;
      element.hidden = false;
      element.removeAttribute("hidden");
      element.classList.remove("hidden");
      element.style.removeProperty("display");
      element.style.removeProperty("opacity");
      element.style.removeProperty("visibility");
      element.style.setProperty("opacity", "1", "important");
      element.style.setProperty("visibility", "visible", "important");
    }
    document.documentElement.style.setProperty("display", "block", "important");
    if (body) body.style.setProperty("display", "flex", "important");
    if (panel) panel.style.setProperty("display", "block", "important");
  }

  const ready = requestSession().then(user => {
    if (!user || typeof user.id !== "string") {
      throw new Error("Сервер вернул некорректные данные пользователя.");
    }
    if (isAdminPage && user.role !== "admin") {
      location.replace("/index.html");
      return null;
    }
    sendPresenceHeartbeat();
    window.setInterval(sendPresenceHeartbeat, 15000);
    if (isAdminPage) revealAdminInterface();

    localStorage.setItem(USER_ID_KEY, user.id);
    sessionStorage.setItem("7ia_my_id", user.id);

    if (isIndexPage) {
      const isAdmin = user.role === "admin";
      if (!isAdmin) {
        document.getElementById("topNavBar")?.remove();
        document.getElementById("topGearBtn")?.remove();
      } else {
        const navigation = document.getElementById("topNavBar");
        const gear = document.getElementById("topGearBtn");
        if (navigation) navigation.style.visibility = "";
        if (gear) gear.style.visibility = "";
        document.querySelectorAll(".admin-only-control").forEach(control => {
          control.style.display = "";
        });
      }
    }
    return user;
  }).catch(error => {
    if (!location.pathname.endsWith("/login.html")) {
      console.error("Не удалось получить авторизованную сессию.", error);
    }
    return null;
  });

  window.GornitsaAuth = { ready };
}());
