let rawData;
let currentDate;
let compareDate;
let currentData = [];
let sortKey = null;
let sortDir = 1;
let sortDiff = false;
let filterStatus = "all";
let filterRole = "all";

// Маппинг должностей
const roleNames = {
  0: "Админ",
  1: "Проверка СБ",
  2: "Неактив",
  3: "Младший водитель",
  4: "Водитель",
  5: "Старший водитель",
  6: "Ведущий водитель",
  7: "Водитель-эксперт",
  8: "Руководство",
};

fetch("data.json")
  .then((r) => r.json())
  .then((data) => {
    rawData = data.employees;
    initApp();
  });

function initApp() {
  const app = document.querySelector(".app");

  app.innerHTML = `
      <div class="container">
        <h1>Сотрудники — сравнение по датам</h1>
        
        <div class="controls">
          <div class="date-selectors">
            <div class="date-group">
              <label>Основная дата:</label>
              <select id="dateMain"></select>
            </div>
            <div class="date-group">
              <label>Дата сравнения:</label>
              <select id="dateCompare"></select>
            </div>
          </div>
          
          <div class="filters">
            <div class="filter-group">
              <label>Фильтр по изменению показателя:</label>
              <div class="filter-buttons">
                <button class="filter-btn active" data-filter="all">Все</button>
                <button class="filter-btn" data-filter="increased">Вырос</button>
                <button class="filter-btn" data-filter="decreased">Упал</button>
                <button class="filter-btn" data-filter="unchanged">Без изменений</button>
              </div>
            </div>
            
            <div class="filter-group">
              <label>Фильтр по должности:</label>
              <div class="role-filters" id="roleFilters">
                <button class="role-filter-btn active" data-role="all">Все</button>
                <!-- Роли будут добавлены динамически -->
              </div>
            </div>
            
            <div class="filter-group">
              <label>Фильтр по изменению должности:</label>
              <div class="change-filters">
                <button class="change-filter-btn active" data-change="all">Все</button>
                <button class="change-filter-btn" data-change="changed">Должность изменилась</button>
                <button class="change-filter-btn" data-change="unchanged">Должность не менялась</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <span class="stat-label">Всего сотрудников:</span>
            <span class="stat-value" id="totalEmployees">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Показатель вырос:</span>
            <span class="stat-value increased" id="increasedEmployees">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Показатель упал:</span>
            <span class="stat-value decreased" id="decreasedEmployees">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Без изменений:</span>
            <span class="stat-value unchanged" id="unchangedEmployees">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Повысились:</span>
            <span class="stat-value role-increased" id="roleIncreased">0</span>
          </div>
        </div>
        
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Аватар</th>
                <th data-key="steam_name">Steam</th>
                <th data-key="name">Имя</th>
                <th data-key="family">Фамилия</th>
                <th data-key="country">Страна</th>
                <th data-key="city">Город</th>
                <th data-key="active_role" data-diff="true">Должность Δ</th>
                <th data-key="pokazatel">Показатель</th>
                <th data-key="pokazatel" data-diff="true">Δ</th>
                <th data-key="karma">Карма</th>
                <th data-key="karma" data-diff="true">Δ</th>
                <th data-key="karma_vtc">Карма VTC</th>
                <th data-key="karma_vtc" data-diff="true">Δ</th>
                <th data-key="point_m">Очки мес</th>
                <th data-key="point_m" data-diff="true">Δ</th>
                <th data-key="point">Очки</th>
                <th data-key="point" data-diff="true">Δ</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    `;

  initDates();
  setupEventListeners();
}

function initDates() {
  const main = document.getElementById("dateMain");
  const cmp = document.getElementById("dateCompare");

  const dates = Object.keys(rawData).sort(
    (a, b) =>
      new Date(a.split(".").reverse().join("-")) -
      new Date(b.split(".").reverse().join("-")),
  );

  dates.forEach((d) => {
    main.add(new Option(d, d));
    cmp.add(new Option(d, d));
  });

  if (dates.length >= 2) {
    main.value = dates[dates.length - 2];
    cmp.value = dates[dates.length - 1];
  } else if (dates.length === 1) {
    main.value = dates[0];
    cmp.value = dates[0];
  }

  currentDate = main.value;
  compareDate = cmp.value;

  initRoleFilters();
  updateData();
}

function initRoleFilters() {
  const roleFiltersContainer = document.getElementById("roleFilters");

  // Создаем кнопки для каждой должности
  Object.entries(roleNames).forEach(([id, name]) => {
    const button = document.createElement("button");
    button.className = "role-filter-btn";
    button.dataset.role = id;
    button.textContent = name;
    roleFiltersContainer.appendChild(button);
  });
}

let filterRoleChange = "all";

function setupEventListeners() {
  document.getElementById("dateMain").onchange = () => {
    currentDate = document.getElementById("dateMain").value;
    updateData();
  };

  document.getElementById("dateCompare").onchange = () => {
    compareDate = document.getElementById("dateCompare").value;
    updateData();
  };

  // Фильтры по изменению показателя
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.onclick = () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterStatus = btn.dataset.filter;
      updateData();
    };
  });

  // Фильтры по должности
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("role-filter-btn")) {
      document
        .querySelectorAll(".role-filter-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      filterRole = e.target.dataset.role;
      updateData();
    }
  });

  // Сортировка
  document.querySelectorAll("th[data-key]").forEach((th) => {
    const key = th.dataset.key;
    if (!key) return;
    th.onclick = () => sortBy(key, th.dataset.diff === "true");
  });

  // Фильтры по изменению должности
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("change-filter-btn")) {
      document
        .querySelectorAll(".change-filter-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      filterRoleChange = e.target.dataset.change;
      updateData();
    }
  });
}

function getLatestEmployee(id) {
  const dates = Object.keys(rawData).sort(
    (a, b) =>
      new Date(b.split(".").reverse().join("-")) -
      new Date(a.split(".").reverse().join("-")),
  );

  for (const date of dates) {
    const employee = rawData[date]?.find((u) => u.id_user === id);
    if (employee) return employee;
  }

  return null;
}

// Получаем сотрудника из указанной даты или из самой свежей из двух выбранных
function getEmployeeForDisplay(id, field = null) {
  // Сначала пробуем взять из compareDate (более свежая дата)
  let employee = rawData[compareDate]?.find((u) => u.id_user === id);

  // Если нет в compareDate, берем из currentDate
  if (!employee) {
    employee = rawData[currentDate]?.find((u) => u.id_user === id);
  }

  // Если все еще нет, ищем во всех датах (крайний случай)
  if (!employee) {
    const dates = Object.keys(rawData).sort(
      (a, b) =>
        new Date(b.split(".").reverse().join("-")) -
        new Date(a.split(".").reverse().join("-")),
    );

    for (const date of dates) {
      const found = rawData[date]?.find((u) => u.id_user === id);
      if (found) {
        employee = found;
        break;
      }
    }
  }

  // Если нужен конкретный field
  if (field && employee) {
    return employee[field];
  }

  return employee;
}

// Получаем самые свежие данные для отображения
function getDisplayData(id) {
  // Создаем базовый объект с данными из compareDate (если есть)
  let displayData = rawData[compareDate]?.find((u) => u.id_user === id);

  // Если нет в compareDate, берем из currentDate
  if (!displayData) {
    displayData = rawData[currentDate]?.find((u) => u.id_user === id);
  }

  // Если все еще нет, ищем в любых данных
  if (!displayData) {
    const dates = Object.keys(rawData).sort(
      (a, b) =>
        new Date(b.split(".").reverse().join("-")) -
        new Date(a.split(".").reverse().join("-")),
    );

    for (const date of dates) {
      const found = rawData[date]?.find((u) => u.id_user === id);
      if (found) {
        displayData = found;
        break;
      }
    }
  }

  return displayData;
}

function getDiff(id, field) {
  const cur = rawData[currentDate]?.find((u) => u.id_user === id);
  const cmp = rawData[compareDate]?.find((u) => u.id_user === id);

  if (!cur && cmp) {
    return {
      type: "new",
      value: cmp[field] ?? 0,
      diff: cmp[field] ?? 0,
      rawDiff: cmp[field] ?? 0,
    };
  }

  if (cur && !cmp) {
    return {
      type: "left",
      value: null,
      diff: -(cur[field] ?? 0),
      rawDiff: -(cur[field] ?? 0),
    };
  }

  const a = Number(cur?.[field] ?? 0);
  const b = Number(cmp?.[field] ?? 0);

  return {
    type: "normal",
    value: b,
    diff: (b - a).toFixed(2),
    rawDiff: b - a,
  };
}

function valueWithDiff(data) {
  if (data.type === "new") {
    return `
      ${data.value}
      <span class="diff new">NEW</span>
    `;
  }

  if (data.type === "left") {
    return `<span class="diff left">LEFT</span>`;
  }

  if (data.rawDiff === 0) {
    return `${data.value} <span class="diff zero">(0)</span>`;
  }

  const cls = data.rawDiff > 0 ? "plus" : "minus";
  const sign = data.rawDiff > 0 ? "+" : "";

  return `
    ${data.value}
    <span class="diff ${cls}">
      (${sign}${data.diff})
    </span>
  `;
}

function applyFilter(employee) {
  // Фильтр по изменению показателя
  if (filterStatus !== "all") {
    const diff = getDiff(employee.id_user, "pokazatel");

    if (diff.type !== "normal") return false;

    const diffValue = diff.rawDiff;

    switch (filterStatus) {
      case "increased":
        if (diffValue <= 0) return false;
        break;
      case "decreased":
        if (diffValue >= 0) return false;
        break;
      case "unchanged":
        if (diffValue !== 0) return false;
        break;
    }
  }

  // Фильтр по должности
  if (filterRole !== "all") {
    const displayData = getDisplayData(employee.id_user);
    if (!displayData || displayData.active_role.toString() !== filterRole) {
      return false;
    }
  }

  // Фильтр по изменению должности
  if (filterRoleChange !== "all") {
    const roleChange = getRoleChange(employee.id_user);

    switch (filterRoleChange) {
      case "changed":
        if (!roleChange.changed || roleChange.type !== "normal") return false;
        break;
      case "unchanged":
        if (roleChange.changed) return false;
        break;
    }
  }

  return true;
}

function updateStats() {
  const total = currentData.length;
  let increased = 0;
  let decreased = 0;
  let unchanged = 0;
  let roleIncreased = 0;

  currentData.forEach((employee) => {
    const diff = getDiff(employee.id_user, "pokazatel");
    if (diff.type === "normal") {
      if (diff.rawDiff > 0) increased++;
      else if (diff.rawDiff < 0) decreased++;
      else unchanged++;
    }

    // Считаем повышения по должности
    const roleChange = getRoleChange(employee.id_user);
    if (
      roleChange.changed &&
      roleChange.type === "normal" &&
      roleChange.currentRole > roleChange.previousRole
    ) {
      roleIncreased++;
    }
  });

  document.getElementById("totalEmployees").textContent = total;
  document.getElementById("increasedEmployees").textContent = increased;
  document.getElementById("decreasedEmployees").textContent = decreased;
  document.getElementById("unchangedEmployees").textContent = unchanged;
  document.getElementById("roleIncreased").textContent = roleIncreased;
}

function getRoleChange(id) {
  const cur = rawData[currentDate]?.find((u) => u.id_user === id);
  const cmp = rawData[compareDate]?.find((u) => u.id_user === id);

  // Если нет в текущей дате - новый сотрудник
  if (!cur && cmp) {
    return {
      type: "new",
      currentRole: cmp.active_role,
      previousRole: null,
      changed: true,
    };
  }

  // Если нет в дате сравнения - ушел
  if (cur && !cmp) {
    return {
      type: "left",
      currentRole: cur.active_role,
      previousRole: null,
      changed: false,
    };
  }

  // Есть в обеих датах
  const currentRole = cmp?.active_role ?? cur?.active_role;
  const previousRole = cur?.active_role;

  return {
    type: "normal",
    currentRole: currentRole,
    previousRole: previousRole,
    changed: currentRole !== previousRole,
  };
}

// Функция для форматирования отображения должности с изменениями
function formatRoleDisplay(id) {
  const roleChange = getRoleChange(id);

  if (roleChange.type === "new") {
    return `
      <span class="role-badge role-${roleChange.currentRole} new-role">
        ${
          roleNames[roleChange.currentRole] || "Неизвестно"
        } <span class="role-change-indicator">NEW</span>
      </span>
    `;
  }

  if (roleChange.type === "left") {
    return `
      <span class="role-badge role-${roleChange.currentRole} left-role">
        ${
          roleNames[roleChange.currentRole] || "Неизвестно"
        } <span class="role-change-indicator">LEFT</span>
      </span>
    `;
  }

  // Если должность изменилась
  if (roleChange.changed) {
    return `
      <div class="role-change-container">
        <div class="previous-role">
          <span class="role-badge role-${roleChange.previousRole}">
            ${roleNames[roleChange.previousRole] || "Неизвестно"}
          </span>
          <span class="role-arrow">→</span>
        </div>
        <div class="current-role">
          <span class="role-badge role-${roleChange.currentRole} changed">
            ${roleNames[roleChange.currentRole] || "Неизвестно"}
          </span>
        </div>
      </div>
    `;
  }

  // Если должность не изменилась
  return `
    <span class="role-badge role-${roleChange.currentRole}">
      ${roleNames[roleChange.currentRole] || "Неизвестно"}
    </span>
  `;
}

function updateData() {
  const currentEmployees = rawData[currentDate] || [];
  const compareEmployees = rawData[compareDate] || [];

  const allIds = new Set([
    ...currentEmployees.map((e) => e.id_user),
    ...compareEmployees.map((e) => e.id_user),
  ]);

  currentData = Array.from(allIds)
    .map((id) => {
      // Получаем данные для отображения (самые свежие из двух выбранных дат)
      const displayData = getDisplayData(id);

      if (!displayData) return null;

      // Получаем данные для сравнения
      const curEmployee = currentEmployees.find((e) => e.id_user === id);
      const cmpEmployee = compareEmployees.find((e) => e.id_user === id);

      const employeeForComparison = curEmployee || cmpEmployee || {};

      // Создаем объединенный объект
      return {
        ...employeeForComparison, // Данные для сравнения показателей
        // Переопределяем отображаемые поля свежими данными
        id_user: id,
        steam_name: displayData.steam_name,
        active_role: displayData.active_role,
        image_url: displayData.image_url,
        name: displayData.name,
        family: displayData.family,
        country: displayData.country,
        city: displayData.city,
        // Также можно добавить другие поля, которые должны быть свежими
        admin_role_name: displayData.admin_role_name,
        userbar_url: displayData.userbar_url,
      };
    })
    .filter((employee) => employee && applyFilter(employee));

  if (sortKey) {
    sortBy(sortKey, sortDiff);
  } else {
    renderTable();
  }

  updateStats();
}

function renderTable() {
  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";

  if (currentData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="17" style="text-align: center; padding: 40px;">
          Нет данных для отображения с выбранными фильтрами
        </td>
      </tr>
    `;
    return;
  }

  currentData.forEach((u) => {
    const tr = document.createElement("tr");

    const pokazatelDiff = getDiff(u.id_user, "pokazatel");
    if (pokazatelDiff.type === "normal") {
      if (pokazatelDiff.rawDiff > 0) tr.classList.add("row-increased");
      else if (pokazatelDiff.rawDiff < 0) tr.classList.add("row-decreased");
      else tr.classList.add("row-unchanged");
    }

    // Также добавляем класс, если изменилась должность
    const roleChange = getRoleChange(u.id_user);
    if (roleChange.changed && roleChange.type === "normal") {
      tr.classList.add("role-changed");
    }

    tr.innerHTML = `
      <td><img class="avatar" src="${u.image_url}" alt="${u.steam_name}"></td>
      <td><a href="https://vtcpanel.com/id${u.id_user}" target="_blank">${
      u.steam_name
    }</a></td>
      <td>${u.name}</td>
      <td>${u.family}</td>
      <td>${u.country}</td>
      <td>${u.city}</td>
      <td>${formatRoleDisplay(u.id_user)}</td>
      <td class="number">${u.pokazatel || "-"}</td>
      <td class="number">
        ${valueWithDiff(getDiff(u.id_user, "pokazatel"))}
      </td>
      <td class="number">${u.karma || "-"}</td>
      <td class="number">
        ${valueWithDiff(getDiff(u.id_user, "karma"))}
      </td>
      <td class="number">${u.karma_vtc || "-"}</td>
      <td class="number">
        ${valueWithDiff(getDiff(u.id_user, "karma_vtc"))}
      </td>
      <td class="number">${u.point_m || "-"}</td>
      <td class="number">
        ${valueWithDiff(getDiff(u.id_user, "point_m"))}
      </td>
      <td class="number">${u.point || "-"}</td>
      <td class="number">
        ${valueWithDiff(getDiff(u.id_user, "point"))}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function sortBy(key, isDiff) {
  if (sortKey === key && sortDiff === isDiff) sortDir *= -1;
  else {
    sortKey = key;
    sortDiff = isDiff;
    sortDir = 1;
  }

  currentData.sort((a, b) => {
    let A, B;

    if (isDiff) {
      // Для сортировки по изменению должности
      if (key === "active_role") {
        const roleChangeA = getRoleChange(a.id_user);
        const roleChangeB = getRoleChange(b.id_user);

        // Сортируем по изменению: сначала те, у кого изменилась должность
        if (roleChangeA.changed && !roleChangeB.changed) return -sortDir;
        if (!roleChangeA.changed && roleChangeB.changed) return sortDir;

        // Если оба изменились или не изменились, сортируем по текущей должности
        A = roleChangeA.currentRole || 0;
        B = roleChangeB.currentRole || 0;
      } else {
        A = getDiff(a.id_user, key).rawDiff;
        B = getDiff(b.id_user, key).rawDiff;
      }
    } else {
      if (key === "steam_name") {
        A = a[key] || "";
        B = b[key] || "";
        return A.localeCompare(B, "ru") * sortDir;
      }

      if (key === "active_role") {
        // Получаем текущую должность для сортировки
        const roleChangeA = getRoleChange(a.id_user);
        const roleChangeB = getRoleChange(b.id_user);
        A = roleChangeA.currentRole || 0;
        B = roleChangeB.currentRole || 0;
      } else {
        A = Number(a[key]) || 0;
        B = Number(b[key]) || 0;
      }
    }

    return (A - B) * sortDir;
  });

  renderTable();
}
