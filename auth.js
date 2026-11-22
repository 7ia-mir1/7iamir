(function () {
  const USER_ID_KEY = "GORNITSA_USER_ID";
  const isIndexPage = location.pathname === "/" || location.pathname.endsWith("/index.html");
  const isAdminPage = location.pathname.endsWith("/admin.html");
  const loginUrl = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
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

  async function logout() {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: "{}",
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem("GORNITSA_ADMIN_MODE");
    sessionStorage.removeItem("7ia_my_id");
    sessionStorage.removeItem("GORNITSA_ADMIN_MODE");
    location.replace("/login.html");
  }

  function bindLogoutButton(button) {
    button.addEventListener("click", async event => {
      const currentButton = event.currentTarget;
      currentButton.disabled = true;
      try {
        await logout();
      } catch (error) {
        currentButton.disabled = false;
        console.error("Не удалось завершить сеанс.", error);
        alert("Не удалось завершить сеанс. Проверьте соединение и повторите попытку.");
      }
    });
  }

  function addLogoutControl(user) {
    const existingButton = document.getElementById("adminLogoutButton");
    if (existingButton) {
      bindLogoutButton(existingButton);
      return;
    }
    const toolbar = document.createElement("div");
    toolbar.className = "auth-toolbar";
    toolbar.innerHTML = `<span></span><button type="button">🚪 Выйти</button>`;
    toolbar.querySelector("span").textContent = user.email;
    bindLogoutButton(toolbar.querySelector("button"));
    document.body.appendChild(toolbar);
  }

  const style = document.createElement("style");
  style.textContent = `
    .auth-toolbar {
      position: fixed;
      z-index: 10000;
      top: 10px;
      left: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: calc(100vw - 20px);
      padding: 6px 8px;
      color: #fff2cc;
      background: rgba(43, 23, 8, 0.94);
      border: 1px solid #d4af37;
      border-radius: 8px;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.55);
      font: 13px Georgia, serif;
    }
    .auth-toolbar span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .auth-toolbar button {
      flex: 0 0 auto;
      padding: 5px 10px;
      color: #fff2cc;
      background: #6b210e;
      border: 1px solid #d4af37;
      border-radius: 6px;
      font: bold 13px Georgia, serif;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  const ready = requestSession().then(user => {
    if (!user || typeof user.id !== "string") {
      throw new Error("Сервер вернул некорректные данные пользователя.");
    }
    if (isAdminPage && user.role !== "admin") {
      location.replace("/index.html");
      return null;
    }

    localStorage.setItem(USER_ID_KEY, user.id);
    sessionStorage.setItem("7ia_my_id", user.id);

    if (isAdminPage) document.body.style.visibility = "";
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
    addLogoutControl(user);
    return user;
  }).catch(error => {
    if (!location.pathname.endsWith("/login.html")) {
      console.error("Не удалось получить авторизованную сессию.", error);
    }
    return null;
  });

  window.GornitsaAuth = { ready, logout };
}());
