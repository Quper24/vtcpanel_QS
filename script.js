let rawData = {};
let contractsData = {}; // Новый объект для хранения контрактов
let currentDate;
let compareDate;
let currentData = [];
let sortKey = null;
let sortDir = 1;
let sortDiff = false;
let filterStatus = "all";
let filterRole = "all";
let filterRoleChange = "all";

// Маппинг должностей
const roleNames = {
  0: "Админ",
  1: "Проверка СБ",
  2: "Неактив",
  3: "Стажёр",
  4: "Младший водитель",
  5: "Водитель",
  6: "Опытный водитель",
  7: "Ведущий водитель",
  8: "Ветеран компании",
};

// Загрузка всех JSON файлов из папки data
async function loadAllData() {
  try {
    // Загружаем контракты
    await loadContracts();

    // Предполагаем, что файлы хранятся в папке data
    const files = [
      "data/2512.json", // 2025 декабрь
      "data/2601.json", // 2026 январь
      "data/2602.json", // 2026 февраль
      "data/2603.json", // 2026 март
      "data/2604.json", // 2026 апрель
    ];

    const promises = files.map((file) =>
      fetch(file)
        .then((response) => {
          if (!response.ok) {
            console.warn(`Файл ${file} не найден, пропускаем`);
            return null;
          }
          return response.json();
        })
        .catch((err) => {
          console.warn(`Ошибка загрузки ${file}:`, err);
          return null;
        }),
    );

    const results = await Promise.all(promises);

    // Собираем все данные в один объект
    results.forEach((data, index) => {
      if (data) {
        const filename = files[index].split("/").pop().replace(".json", "");
        const year = "20" + filename.substring(0, 2);
        const month = filename.substring(2, 4);

        Object.keys(data).forEach((dateStr) => {
          const [day, monthStr, yearStr] = dateStr.split(".");
          const formattedDate = `${day.padStart(2, "0")}.${monthStr.padStart(
            2,
            "0",
          )}.${yearStr}`;

          if (!rawData[formattedDate]) {
            rawData[formattedDate] = [];
          }

          rawData[formattedDate].push(...data[dateStr]);
        });
      }
    });


    initApp();
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    document.querySelector(".app").innerHTML = `
      <div class="error">
        <h2>Ошибка загрузки данных</h2>
        <p>${error.message}</p>
        <p>Проверьте наличие файлов в папке data/</p>
      </div>
    `;
  }
}

// Загрузка контрактов
async function loadContracts() {
  try {
    const response = await fetch("data/contracts.json");
    if (!response.ok) {
      console.warn("Файл contracts.json не найден");
      return;
    }

    const data = await response.json();

    // Форматируем даты в единый формат
    Object.keys(data).forEach((dateStr) => {
      const [day, month, year] = dateStr.split(".");
      const formattedDate = `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;

      contractsData[formattedDate] = {};

      // Проверяем, что данные не пустые
      if (data[dateStr] && Array.isArray(data[dateStr])) {
        // Преобразуем массив в объект для быстрого доступа по имени
        data[dateStr].forEach((contract) => {
          // Сохраняем оригинальное имя и имя в нижнем регистре
          const originalName = contract.name;
          contractsData[formattedDate][originalName] = contract.trips;
          contractsData[formattedDate][originalName.toLowerCase()] =
            contract.trips;
        });
      }
    });

  } catch (error) {
    console.error("Ошибка загрузки контрактов:", error);
  }
}
// Получение данных по контрактам для пользователя
function getContractsData(steamName, currentDate, compareDate) {
  if (!steamName) return { total: 0, weekly: 0, diff: null };

  const currentContracts =
    contractsData[currentDate]?.[steamName.toLowerCase()] || 0;
  const compareContracts =
    contractsData[compareDate]?.[steamName.toLowerCase()] || 0;

  // Для недельной статистики - берем разницу между текущей и предыдущей датой
  // Если даты разные, то разница и будет недельной (или за период)
  const weeklyTrips = currentContracts - compareContracts;

  return {
    total: currentContracts,
    weekly: weeklyTrips > 0 ? weeklyTrips : 0,
    diff: weeklyTrips,
  };
}

function getContractsDiff(id, steamName) {
  const currentContracts =
    contractsData[currentDate]?.[steamName?.toLowerCase()] || 0;
  const compareContracts =
    contractsData[compareDate]?.[steamName?.toLowerCase()] || 0;

  const cur = getEmployeeByIdAndDate(id, currentDate);
  const cmp = getEmployeeByIdAndDate(id, compareDate);

  if (!cur && cmp) {
    return {
      type: "new",
      value: currentContracts,
      diff: currentContracts,
      rawDiff: currentContracts,
    };
  }

  if (cur && !cmp) {
    return {
      type: "left",
      value: null,
      diff: -compareContracts,
      rawDiff: -compareContracts,
    };
  }

  // Если нет данных за предыдущую дату, показываем все контракты как новые
  if (!contractsData[compareDate]) {
    return {
      type: "normal",
      value: currentContracts,
      diff: currentContracts,
      rawDiff: currentContracts,
    };
  }

  return {
    type: "normal",
    value: currentContracts,
    diff: (currentContracts - compareContracts).toFixed(0),
    rawDiff: currentContracts - compareContracts,
  };
}

// Загрузка динамических данных (оставляем как есть)
async function loadDataDynamically() {
  try {
    await loadContracts();

    const years = ["25", "26"];
    const months = [
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
    ];

    const promises = [];

    for (const year of years) {
      for (const month of months) {
        const filename = `${year}${month}`;
        promises.push(
          fetch(`data/${filename}.json`)
            .then((response) => {
              if (!response.ok) return null;
              return response.json().then((data) => ({ filename, data }));
            })
            .catch(() => null),
        );
      }
    }

    const results = await Promise.all(promises);

    results.forEach((result) => {
      if (result && result.data) {
        const { filename, data } = result;
        const year = "20" + filename.substring(0, 2);
        const month = filename.substring(2, 4);

        Object.keys(data).forEach((dateStr) => {
          const [day, monthStr, yearStr] = dateStr.split(".");
          const formattedDate = `${day.padStart(2, "0")}.${monthStr.padStart(
            2,
            "0",
          )}.${yearStr}`;

          if (!rawData[formattedDate]) {
            rawData[formattedDate] = [];
          }

          const employeesWithId = data[dateStr].map((emp, idx) => ({
            ...emp,
            id_user: emp.id_user || `temp_${formattedDate}_${idx}`,
          }));

          rawData[formattedDate].push(...employeesWithId);
        });
      }
    });

    initApp();
  } catch (error) {
    console.error("Ошибка динамической загрузки:", error);
  }
}

function initApp() {
  const app = document.querySelector(".app");

  app.innerHTML = `
      <div class="container">
        <header class="main-header">
          <div class="header-content">
            <div class="logo-section">
              <h1 class="site-title">Сотрудники VTC</h1>
              <p class="site-subtitle">Сравнение по датам</p>
            </div>
            <nav class="header-nav">
              <a href="/convoy.html" target="_blank" class="nav-link">🚚 Конвои</a>
              <a href="/admin.html" target="_blank" class="nav-link">⚙️ Админка</a>
            </nav>
          </div>
        </header>
        
        <div class="controls">
          <div class="date-selectors">
            <div class="date-group">
              <label>Предыдущая дата:</label>
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
                <th data-key="city">Город</th>
                <th data-key="active_role" data-diff="true">Должность Δ</th>
                <th data-key="contracts_total">Контракты(месяц)</th>
                <th data-key="contracts_weekly" data-diff="true">Контракты(неделя)</th>
                <th data-key="pokazatel" data-diff="true">Показатель Δ</th>
                <th data-key="karma" data-diff="true">Карма Δ</th>
                <th data-key="karma_vtc" data-diff="true">Карма VTC Δ</th>
                <th data-key="point_m" data-diff="true">Очки мес Δ</th>
                <th data-key="point" data-diff="true">Очки Δ</th>
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

  const dates = Object.keys(rawData).sort((a, b) => {
    const convertDate = (dateStr) => {
      const [day, month, year] = dateStr.split(".");
      return `20${year}-${month}-${day}`;
    };
    return new Date(convertDate(a)) - new Date(convertDate(b));
  });

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

function parseDate(dateStr) {
  const [day, month, year] = dateStr.split(".");
  // Добавляем 2000 к году (т.к. формат '25' -> 2025)
  // month - 1 потому что в JS месяцы от 0 до 11
  return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
}

function initRoleFilters() {
  const roleFiltersContainer = document.getElementById("roleFilters");

  Object.entries(roleNames).forEach(([id, name]) => {
    const button = document.createElement("button");
    button.className = "role-filter-btn";
    button.dataset.role = id;
    button.textContent = name;
    roleFiltersContainer.appendChild(button);
  });
}

function setupEventListeners() {
  document.getElementById("dateMain").onchange = () => {
    currentDate = document.getElementById("dateMain").value;
    updateData();
  };

  document.getElementById("dateCompare").onchange = () => {
    compareDate = document.getElementById("dateCompare").value;
    updateData();
  };

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

  document.querySelectorAll("th[data-key]").forEach((th) => {
    const key = th.dataset.key;
    if (!key) return;
    th.onclick = () => sortBy(key, th.dataset.diff === "true");
  });

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

function getEmployeeByIdAndDate(id, date) {
  return rawData[date]?.find((u) => u.id_user === id) || null;
}

function getDisplayData(id) {
  let displayData = getEmployeeByIdAndDate(id, compareDate);

  if (!displayData) {
    displayData = getEmployeeByIdAndDate(id, currentDate);
  }

  if (!displayData) {
    const dates = Object.keys(rawData).sort((a, b) => {
      const convertDate = (dateStr) => {
        const [day, month, year] = dateStr.split(".");
        return `20${year}-${month}-${day}`;
      };
      return new Date(convertDate(b)) - new Date(convertDate(a));
    });

    for (const date of dates) {
      const found = getEmployeeByIdAndDate(id, date);
      if (found) {
        displayData = found;
        break;
      }
    }
  }

  return displayData;
}

function getDiff(id, field) {
  const cur = getEmployeeByIdAndDate(id, currentDate);
  const cmp = getEmployeeByIdAndDate(id, compareDate);

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

  if (filterRole !== "all") {
    const displayData = getDisplayData(employee.id_user);
    if (!displayData || displayData.active_role.toString() !== filterRole) {
      return false;
    }
  }

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
  const cur = getEmployeeByIdAndDate(id, currentDate);
  const cmp = getEmployeeByIdAndDate(id, compareDate);

  if (!cur && cmp) {
    return {
      type: "new",
      currentRole: cmp.active_role,
      previousRole: null,
      changed: true,
    };
  }

  if (cur && !cmp) {
    return {
      type: "left",
      currentRole: cur.active_role,
      previousRole: null,
      changed: false,
    };
  }

  const currentRole = cmp?.active_role ?? cur?.active_role;
  const previousRole = cur?.active_role;

  return {
    type: "normal",
    currentRole: currentRole,
    previousRole: previousRole,
    changed: currentRole !== previousRole,
  };
}

function formatRoleDisplay(id) {
  const roleChange = getRoleChange(id);

  if (roleChange.type === "new") {
    return `
      <span class="role-badge role-${roleChange.currentRole} new-role">
        ${roleNames[roleChange.currentRole] || "Неизвестно"} <span class="role-change-indicator">NEW</span>
      </span>
    `;
  }

  if (roleChange.type === "left") {
    return `
      <span class="role-badge role-${roleChange.currentRole} left-role">
        ${roleNames[roleChange.currentRole] || "Неизвестно"} <span class="role-change-indicator">LEFT</span>
      </span>
    `;
  }

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

  return `
    <span class="role-badge role-${roleChange.currentRole}">
      ${roleNames[roleChange.currentRole] || "Неизвестно"}
    </span>
  `;
}

// Функция для получения контрактов по имени (регистронезависимая)
function getContractTrips(steamName, date) {
  if (!steamName || !contractsData[date]) return 0;

  // Пробуем найти по оригинальному имени
  if (contractsData[date][steamName] !== undefined) {
    return contractsData[date][steamName];
  }

  // Пробуем найти в нижнем регистре
  const lowerName = steamName.toLowerCase();
  if (contractsData[date][lowerName] !== undefined) {
    return contractsData[date][lowerName];
  }

  // Ищем любое совпадение без учета регистра
  for (const [name, trips] of Object.entries(contractsData[date])) {
    if (name.toLowerCase() === lowerName) {
      return trips;
    }
  }

  return 0;
}

// Функция для получения общего количества контрактов (для сортировки)
function getTotalContracts(steamName) {
  if (!steamName) return 0;

  if (!currentDate || !compareDate || currentDate === compareDate) {
    // Если даты одинаковые или нет данных, берем только текущую дату
    return getContractTrips(steamName, currentDate);
  }

  // Получаем все даты между compareDate и currentDate
  const allDates = Object.keys(contractsData).sort((a, b) => {
    const dateA = a.split(".").reverse().join("-");
    const dateB = b.split(".").reverse().join("-");
    return new Date(dateA) - new Date(dateB);
  });

  // Находим индексы наших дат
  const startIndex = allDates.indexOf(compareDate);
  const endIndex = allDates.indexOf(currentDate);

  if (startIndex === -1 || endIndex === -1) {
    // Если одна из дат не найдена, берем только текущую
    return getContractTrips(steamName, currentDate);
  }

  // Суммируем контракты за все даты в периоде
  let totalContracts = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    const date = allDates[i];
    totalContracts += getContractTrips(steamName, date);
  }

  return totalContracts;
}

function formatContractsDisplay(steamName, showWeekly = true) {
  if (!steamName) return "-";

  const currentContracts = getContractTrips(steamName, currentDate);
  const compareContracts = getContractTrips(steamName, compareDate);

  // Для отображения в колонке "Всего" - показываем текущее количество
  if (!showWeekly) {
    return currentContracts || "0";
  }

  // Для отображения в колонке "Неделя" - показываем только compareContracts (контракты за неделю)
  if (compareContracts === 0) {
    return `<span class="diff zero">0</span>`;
  }

  // Просто показываем количество контрактов за неделю, без знака +
  return `<span class="diff plus">${compareContracts}</span>`;
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
      const displayData = getDisplayData(id);
      if (!displayData) return null;

      const curEmployee = currentEmployees.find((e) => e.id_user === id);
      const cmpEmployee = compareEmployees.find((e) => e.id_user === id);
      const employeeForComparison = curEmployee || cmpEmployee || {};

      // Получаем данные по контрактам

      const compareContracts = getContractTrips(
        displayData.steam_name,
        compareDate,
      );
      const filteredDataFunctionalSimple = Object.fromEntries(
        Object.entries(contractsData).filter(([dataKey]) => {
          const dataDate = parseDate(dataKey);
          const current = parseDate(compareDate);

          return (
            dataDate.getFullYear() === current.getFullYear() &&
            dataDate.getMonth() === current.getMonth()
          );
        }),
      );

      const allContractsMonth = Object.entries(
        filteredDataFunctionalSimple,
      ).reduce( (acc,[date, data]) => {
        for (const steam_name in data) {
          if (!Object.hasOwn(data, steam_name)) continue;

          const contracts = data[steam_name];
          if (displayData.steam_name === steam_name) {
            acc += contracts;
          }
        }

        return acc;
      }, 0);

      return {
        ...employeeForComparison,
        id_user: id,
        steam_name: displayData.steam_name,
        active_role: displayData.active_role,
        image_url: displayData.image_url,
        name: displayData.name,
        family: displayData.family,
        country: displayData.country,
        city: displayData.city,
        pokazatel: displayData.pokazatel,
        karma: displayData.karma,
        karma_vtc: displayData.karma_vtc,
        point_m: displayData.point_m,
        point: displayData.point,
        contracts_total: allContractsMonth, // Общее количество
        contracts_weekly: compareContracts, // Недельное изменение
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
        <td colspan="12" style="text-align: center; padding: 40px;">
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

    const roleChange = getRoleChange(u.id_user);
    if (roleChange.changed && roleChange.type === "normal") {
      tr.classList.add("role-changed");
    }

    tr.innerHTML = `
    <td>
      <img class="avatar" src="${u.image_url || "https://via.placeholder.com/40"}"
          alt="${u.steam_name}"
          onerror="this.src='https://via.placeholder.com/40'">
    </td>

    <td>
      <a href="https://vtcpanel.com/id${u.id_user}" target="_blank">
        ${u.steam_name || "-"}
      </a>
    </td>

    <td>${u.name || "-"}</td>
    <td>${u.city || "-"}</td>

    <td>${formatRoleDisplay(u.id_user)}</td>

    <td class="number">
      ${u.contracts_total}
    </td>

    <td class="number">
      ${formatContractsDisplay(u.steam_name, true)}
    </td>

    <td class="number">
      ${valueWithDiff(getDiff(u.id_user, "pokazatel"))}
    </td>

    <td class="number">
      ${valueWithDiff(getDiff(u.id_user, "karma"))}
    </td>

    <td class="number">
      ${valueWithDiff(getDiff(u.id_user, "karma_vtc"))}
    </td>

    <td class="number">
      ${valueWithDiff(getDiff(u.id_user, "point_m"))}
    </td>

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
      if (key === "active_role") {
        const roleChangeA = getRoleChange(a.id_user);
        const roleChangeB = getRoleChange(b.id_user);

        if (roleChangeA.changed && !roleChangeB.changed) return -sortDir;
        if (!roleChangeA.changed && roleChangeB.changed) return sortDir;

        A = roleChangeA.currentRole || 0;
        B = roleChangeB.currentRole || 0;
      } else if (key === "contracts_weekly") {
        // Сортировка по недельному значению (уже есть в объекте)
        A = a.contracts_weekly || 0;
        B = b.contracts_weekly || 0;
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

      if (key === "contracts_total") {
        A = a.contracts_total || 0;
        B = b.contracts_total || 0;
      } else if (key === "contracts_weekly") {
        A = a.contracts_weekly || 0;
        B = b.contracts_weekly || 0;
      } else if (key === "active_role") {
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

const style = document.createElement("style");
style.textContent = `
  .error {
    background: #1a1d24;
    padding: 30px;
    border-radius: 8px;
    border-left: 4px solid #f44336;
    margin: 20px;
  }
  
  .error h2 {
    color: #f44336;
    margin-top: 0;
  }
  
  .error p {
    color: #aaa;
    margin: 10px 0;
  }
`;
document.head.appendChild(style);

loadAllData();
