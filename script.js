let rawData = {};
let contractsData = {};
let currentDate;
let compareDate;
let totalCompareDate;
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

// Правила для недельной эффективности
const ROLE_RULES = {
  3: { min: 0, max: 1 },
  4: { min: 1, max: 5 },
  5: { min: 5, max: 30 },
  6: { min: 30, max: 50 },
  7: { min: 50, max: 70 },
  8: { min: 70, max: 300 },
};

// Правила для общей эффективности (за 2 недели)
const ROLE_RULES_TOTAL = {
  3: { min: 0, max: 5 },
  4: { min: 5, max: 20 },
  5: { min: 20, max: 45 },
  6: { min: 45, max: 70 },
  7: { min: 70, max: 90 },
  8: { min: 90, max: 999 },
};

// Конфигурация для расчёта эффективности
const CONFIG = {
  contracts: {
    min: 1,
    baseTarget: 8,
    midTarget: 12,
    highTarget: 24,
    midBonus: 50,
    highBonus: 25,
    extraStep: 0.5,
  },
  pokazatel: {
    max: 100,
  },
  karma: {
    max: 2,
  },
  points: {
    base: 20,
    step: 3,
    stepBonus: 5,
  },
};

const WEIGHTS = {
  contracts: 0.35,
  pokazatel: 0.25,
  karma: 0.15,
  points: 0.25,
};

// --- Вспомогательные функции ---

function parseDate(dateStr) {
  const [day, month, year] = dateStr.split(".");
  return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
}

function getTwoWeeksAgoDate(dateStr) {
  const [day, month, year] = dateStr.split(".").map(Number);
  const dateObj = new Date(2000 + year, month - 1, day);
  dateObj.setDate(dateObj.getDate() - 14);
  const d = String(dateObj.getDate()).padStart(2, "0");
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const y = String(dateObj.getFullYear()).slice(-2);
  return `${d}.${m}.${y}`;
}

function getEmployeeByIdAndDate(id, date) {
  return rawData[date]?.find((u) => u.id_user === id) || null;
}

function getDisplayData(id) {
  let displayData = getEmployeeByIdAndDate(id, compareDate);
  if (!displayData) displayData = getEmployeeByIdAndDate(id, currentDate);
  if (!displayData) {
    const dates = Object.keys(rawData).sort((a, b) => {
      const convertDate = (d) => {
        const [day, month, year] = d.split(".");
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
  return { type: "normal", value: b, diff: (b - a).toFixed(2), rawDiff: b - a };
}

function getRoleChange(id) {
  const cur = getEmployeeByIdAndDate(id, currentDate);
  const cmp = getEmployeeByIdAndDate(id, compareDate);
  if (!cur && cmp)
    return {
      type: "new",
      currentRole: cmp.active_role,
      previousRole: null,
      changed: true,
    };
  if (cur && !cmp)
    return {
      type: "left",
      currentRole: cur.active_role,
      previousRole: null,
      changed: false,
    };
  const currentRole = cmp?.active_role ?? cur?.active_role;
  const previousRole = cur?.active_role;
  return {
    type: "normal",
    currentRole: currentRole,
    previousRole: previousRole,
    changed: currentRole !== previousRole,
  };
}

// --- Функции нормализации ---

function calcKontf(konts) {
  const {
    min,
    baseTarget,
    midTarget,
    highTarget,
    midBonus,
    highBonus,
    extraStep,
  } = CONFIG.contracts;
  if (konts < min) return 0;
  if (konts <= baseTarget) return (konts - min) * (100 / (baseTarget - min));
  if (konts <= midTarget)
    return 100 + (konts - baseTarget) * (midBonus / (midTarget - baseTarget));
  if (konts <= highTarget)
    return (
      100 +
      midBonus +
      (konts - midTarget) * (highBonus / (highTarget - midTarget))
    );
  return 100 + midBonus + highBonus + (konts - highTarget) * extraStep;
}

function calcPokaz(val) {
  const v = parseFloat(val) || 0;
  if (v <= 0) return 0;
  return Math.min(100, (v / CONFIG.pokazatel.max) * 100);
}

function calcKarma(val) {
  const v = parseFloat(val) || 0;
  if (v <= 0) return 0;
  return Math.min(100, (v / CONFIG.karma.max) * 100);
}

function calcBally(val) {
  const v = parseFloat(val) || 0;
  if (v <= 0) return 0;
  const { base, step, stepBonus } = CONFIG.points;
  if (v <= base) return (v / base) * 100;
  const extra = v - base;
  return 100 + (extra / step) * stepBonus;
}

// --- Расчёт эффективности (недельной) ---

function calcEfficiency(employee) {
  const type = getDiff(employee.id_user, "pokazatel").type;
  if (type === "new" || type === "left") return 0;
  const konts = employee.contracts_weekly || 0;
  const pokaz = parseFloat(getDiff(employee.id_user, "pokazatel").diff) || 0;
  const karma = parseFloat(getDiff(employee.id_user, "karma_vtc").diff) || 0;
  const bally = parseFloat(getDiff(employee.id_user, "point").diff) || 0;
  const fKonts = calcKontf(konts);
  const fPokaz = calcPokaz(pokaz);
  const fKarma = calcKarma(karma);
  const fBally = calcBally(bally);
  return Number(
    (
      WEIGHTS.contracts * fKonts +
      WEIGHTS.pokazatel * fPokaz +
      WEIGHTS.karma * fKarma +
      WEIGHTS.points * fBally
    ).toFixed(2),
  );
}

function getRoleStatus(employee) {
  let role = employee.active_role;
  const change = getRoleChange(employee.id_user);
  if (change.changed) role = change.previousRole;
  const eff = employee.koeff;
  const rule = ROLE_RULES[role];
  if (!rule) return "neutral";
  if (eff < rule.min) return "down";
  if (eff > rule.max) return "up";
  return "ok";
}

function getRoleHint(employee) {
  const role = employee.active_role;
  const rule = ROLE_RULES[role];
  return rule ? `Норма: ${rule.min}–${rule.max}` : "";
}

// --- Расчёт общей эффективности (за 2 недели) ---

function calcTotalEfficiency(employee) {
  // Контракты за месяц (суммарно)
  const konts = employee.contracts_total || 0;
  // Разницы за 2 недели
  const pokaz = parseFloat(employee.pokazatel_diff_2w ?? 0);
  const karma = parseFloat(employee.karma_vtc_diff_2w ?? 0);
  const bally = parseFloat(employee.point_diff_2w ?? 0);

  const fKonts = calcKontf(konts);
  const fPokaz = calcPokaz(pokaz);
  const fKarma = calcKarma(karma);
  const fBally = calcBally(bally);

  return Number(
    (
      WEIGHTS.contracts * fKonts +
      WEIGHTS.pokazatel * fPokaz +
      WEIGHTS.karma * fKarma +
      WEIGHTS.points * fBally
    ).toFixed(2),
  );
}

function getRoleStatusTotal(employee) {
  let role = employee.active_role;
  const change = getRoleChange(employee.id_user);
  if (change.changed) role = change.previousRole;
  const eff = employee.koeff_total;
  const rule = ROLE_RULES_TOTAL[role];
  if (!rule) return "neutral";
  if (eff < rule.min) return "down";
  if (eff > rule.max) return "up";
  return "ok";
}

function getRoleHintTotal(employee) {
  const role = employee.active_role;
  const rule = ROLE_RULES_TOTAL[role];
  return rule ? `Норма: ${rule.min}–${rule.max}` : "";
}

// --- Контракты ---

function getContractTrips(steamName, date) {
  if (!steamName || !contractsData[date]) return 0;
  const lower = steamName.toLowerCase();
  for (const [name, trips] of Object.entries(contractsData[date])) {
    if (name.toLowerCase() === lower) return trips;
  }
  return 0;
}

function getTotalContractsForMonth(steamName, dateStr) {
  if (!steamName) return 0;
  const targetDate = parseDate(dateStr);
  let total = 0;
  for (const [dateKey, contracts] of Object.entries(contractsData)) {
    const d = parseDate(dateKey);
    if (
      d.getFullYear() === targetDate.getFullYear() &&
      d.getMonth() === targetDate.getMonth()
    ) {
      total += getContractTrips(steamName, dateKey);
    }
  }
  return total;
}

// --- Форматирование ---

function valueWithDiff(data) {
  if (data.type === "new")
    return `${data.value} <span class="diff new">NEW</span>`;
  if (data.type === "left") return `<span class="diff left">LEFT</span>`;
  if (data.rawDiff === 0)
    return `${data.value} <span class="diff zero">(0)</span>`;
  const cls = data.rawDiff > 0 ? "plus" : "minus";
  const sign = data.rawDiff > 0 ? "+" : "";
  return `${data.value} <span class="diff ${cls}">(${sign}${data.diff})</span>`;
}

function formatRoleDisplay(id) {
  const change = getRoleChange(id);
  if (change.type === "new") {
    return `<span class="role-badge role-${change.currentRole} new-role">${roleNames[change.currentRole] || "Неизвестно"} <span class="role-change-indicator">NEW</span></span>`;
  }
  if (change.type === "left") {
    return `<span class="role-badge role-${change.currentRole} left-role">${roleNames[change.currentRole] || "Неизвестно"} <span class="role-change-indicator">LEFT</span></span>`;
  }
  if (change.changed) {
    return `<div class="role-change-container">
      <div class="previous-role"><span class="role-badge role-${change.previousRole}">${roleNames[change.previousRole] || "Неизвестно"}</span><span class="role-arrow">→</span></div>
      <div class="current-role"><span class="role-badge role-${change.currentRole} changed">${roleNames[change.currentRole] || "Неизвестно"}</span></div>
    </div>`;
  }
  return `<span class="role-badge role-${change.currentRole}">${roleNames[change.currentRole] || "Неизвестно"}</span>`;
}

function formatContractsDisplay(steamName, showWeekly = true) {
  if (!steamName) return "-";
  if (!showWeekly) {
    const total = getTotalContractsForMonth(steamName, currentDate);
    return total || "0";
  }
  const weekly = getContractTrips(steamName, compareDate);
  if (weekly === 0) return `<span class="diff zero">0</span>`;
  return `<span class="diff plus">${weekly}</span>`;
}

// --- Фильтры и сортировка ---

function applyFilter(employee) {
  if (filterStatus !== "all") {
    const diff = getDiff(employee.id_user, "pokazatel");
    if (diff.type !== "normal") return false;
    const val = diff.rawDiff;
    if (filterStatus === "increased" && val <= 0) return false;
    if (filterStatus === "decreased" && val >= 0) return false;
    if (filterStatus === "unchanged" && val !== 0) return false;
  }
  if (filterRole !== "all") {
    const display = getDisplayData(employee.id_user);
    if (!display || display.active_role.toString() !== filterRole) return false;
  }
  if (filterRoleChange !== "all") {
    const change = getRoleChange(employee.id_user);
    if (
      filterRoleChange === "changed" &&
      (!change.changed || change.type !== "normal")
    )
      return false;
    if (filterRoleChange === "unchanged" && change.changed) return false;
  }
  return true;
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
        const rA = getRoleChange(a.id_user);
        const rB = getRoleChange(b.id_user);
        if (rA.changed && !rB.changed) return -sortDir;
        if (!rA.changed && rB.changed) return sortDir;
        A = rA.currentRole || 0;
        B = rB.currentRole || 0;
      } else if (key === "contracts_weekly") {
        A = a.contracts_weekly || 0;
        B = b.contracts_weekly || 0;
      } else if (key === "koeff_total") {
        A = a.koeff_total || 0;
        B = b.koeff_total || 0;
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
        const rA = getRoleChange(a.id_user);
        const rB = getRoleChange(b.id_user);
        A = rA.currentRole || 0;
        B = rB.currentRole || 0;
      } else if (key === "koeff_total") {
        A = a.koeff_total || 0;
        B = b.koeff_total || 0;
      } else {
        A = Number(a[key]) || 0;
        B = Number(b[key]) || 0;
      }
    }
    return (A - B) * sortDir;
  });

  renderTable();
}

// --- Обновление данных и рендеринг ---

function updateData() {
  const currentEmployees = rawData[currentDate] || [];
  const compareEmployees = rawData[compareDate] || [];

  // Вычисляем дату для 2-недельного сравнения
  totalCompareDate = getTwoWeeksAgoDate(currentDate);
  // Если данных за эту дату нет, берём самую близкую доступную дату до неё
  if (!rawData[totalCompareDate]) {
    const allDates = Object.keys(rawData).sort((a, b) => {
      const da = parseDate(a);
      const db = parseDate(b);
      return da - db;
    });
    const target = parseDate(totalCompareDate);
    let closest = null;
    let minDiff = Infinity;
    for (const d of allDates) {
      const diff = Math.abs(parseDate(d) - target);
      if (diff < minDiff) {
        minDiff = diff;
        closest = d;
      }
    }
    totalCompareDate = closest || totalCompareDate; // fallback
  }

  const allIds = new Set([
    ...currentEmployees.map((e) => e.id_user),
    ...compareEmployees.map((e) => e.id_user),
  ]);

  currentData = Array.from(allIds)
    .map((id) => {
      const displayData = getDisplayData(id);
      if (!displayData) return null;

      const cur = getEmployeeByIdAndDate(id, currentDate);
      const cmp = getEmployeeByIdAndDate(id, compareDate);
      const emp = cur || cmp || {};

      // Данные за 2 недели
      const prevTotal = getEmployeeByIdAndDate(id, totalCompareDate);
      const pokazatel_diff_2w = prevTotal
        ? (cur?.pokazatel || 0) - (prevTotal.pokazatel || 0)
        : cur?.pokazatel || 0;
      const karma_diff_2w = prevTotal
        ? (cur?.karma || 0) - (prevTotal.karma || 0)
        : cur?.karma || 0;
      const karma_vtc_diff_2w = prevTotal
        ? (cur?.karma_vtc || 0) - (prevTotal.karma_vtc || 0)
        : cur?.karma_vtc || 0;
      const point_diff_2w = prevTotal
        ? (cur?.point || 0) - (prevTotal.point || 0)
        : cur?.point || 0;

      // Контракты
      const contracts_weekly = getContractTrips(
        displayData.steam_name,
        compareDate,
      );
      const contracts_total = getTotalContractsForMonth(
        displayData.steam_name,
        currentDate,
      );

      return {
        ...emp,
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
        contracts_total: contracts_total,
        contracts_weekly: contracts_weekly,
        // для 2-недельной эффективности
        pokazatel_diff_2w: pokazatel_diff_2w,
        karma_diff_2w: karma_diff_2w,
        karma_vtc_diff_2w: karma_vtc_diff_2w,
        point_diff_2w: point_diff_2w,
      };
    })
    .filter((emp) => emp && applyFilter(emp));

  // Вычисляем эффективности
  currentData.forEach((emp) => {
    emp.koeff = calcEfficiency(emp);
    emp.koeff_total = calcTotalEfficiency(emp);
  });

  // Сортировка
  if (sortKey) sortBy(sortKey, sortDiff);
  else renderTable();

  updateStats();
}

function renderTable() {
  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";

  if (currentData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="14" style="text-align:center;padding:40px;">Нет данных с выбранными фильтрами</td></tr>`;
    return;
  }

  currentData.forEach((emp) => {
    const tr = document.createElement("tr");

    const pokDiff = getDiff(emp.id_user, "pokazatel");
    if (pokDiff.type === "normal") {
      if (pokDiff.rawDiff > 0) tr.classList.add("row-increased");
      else if (pokDiff.rawDiff < 0) tr.classList.add("row-decreased");
      else tr.classList.add("row-unchanged");
    }

    const roleChange = getRoleChange(emp.id_user);
    if (roleChange.changed && roleChange.type === "normal")
      tr.classList.add("role-changed");

    const statusWeek = getRoleStatus(emp);
    const statusTotal = getRoleStatusTotal(emp);

    let effClassWeek = "";
    if (statusWeek === "up") effClassWeek = "eff-up";
    if (statusWeek === "down") effClassWeek = "eff-down";

    let effClassTotal = "";
    if (statusTotal === "up") effClassTotal = "eff-up";
    if (statusTotal === "down") effClassTotal = "eff-down";

    tr.innerHTML = `
      <td><img class="avatar" src="${emp.image_url || "https://via.placeholder.com/40"}" alt="${emp.steam_name}" onerror="this.src='https://via.placeholder.com/40'"></td>
      <td><a href="https://vtcpanel.com/id${emp.id_user}" target="_blank">${emp.steam_name || "-"}</a></td>
      <td>${emp.name || "-"}</td>
      <td>${emp.city || "-"}</td>
      <td>${formatRoleDisplay(emp.id_user)}</td>
      <td class="number">${emp.contracts_total}</td>
      <td class="number">${formatContractsDisplay(emp.steam_name, true)}</td>
      <td class="number">${valueWithDiff(getDiff(emp.id_user, "pokazatel"))}</td>
      <td class="number">${valueWithDiff(getDiff(emp.id_user, "karma"))}</td>
      <td class="number">${valueWithDiff(getDiff(emp.id_user, "karma_vtc"))}</td>
      <td class="number">${emp.point_m || "-"}</td>
      <td class="number">${valueWithDiff(getDiff(emp.id_user, "point"))}</td>
      <td class="number cell-eff ${effClassWeek}" title="${getRoleHint(emp)}">${emp.koeff.toFixed(1)}</td>
      <td class="number cell-eff-total ${effClassTotal}" title="${getRoleHintTotal(emp)}">${emp.koeff_total.toFixed(1)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateStats() {
  const total = currentData.length;
  let increased = 0,
    decreased = 0,
    unchanged = 0,
    roleIncreased = 0;
  currentData.forEach((emp) => {
    const diff = getDiff(emp.id_user, "pokazatel");
    if (diff.type === "normal") {
      if (diff.rawDiff > 0) increased++;
      else if (diff.rawDiff < 0) decreased++;
      else unchanged++;
    }
    const change = getRoleChange(emp.id_user);
    if (
      change.changed &&
      change.type === "normal" &&
      change.currentRole > change.previousRole
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

// --- Загрузка данных ---

async function loadAllData() {
  try {
    await loadContracts();
    const files = [
      "data/users/2512.json",
      "data/users/2601.json",
      "data/users/2602.json",
      "data/users/2603.json",
      "data/users/2604.json",
      "data/users/2605.json",
      "data/users/2606.json",
      "data/users/2607.json",
    ];
    const promises = files.map((file) =>
      fetch(file)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
    const results = await Promise.all(promises);
    results.forEach((data, idx) => {
      if (!data) return;
      const filename = files[idx].split("/").pop().replace(".json", "");
      Object.keys(data).forEach((dateStr) => {
        const [day, month, year] = dateStr.split(".");
        const formatted = `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
        if (!rawData[formatted]) rawData[formatted] = [];
        rawData[formatted].push(...data[dateStr]);
      });
    });
    initApp();
  } catch (err) {
    console.error(err);
    document.querySelector(".app").innerHTML =
      `<div class="error"><h2>Ошибка загрузки</h2><p>${err.message}</p></div>`;
  }
}

async function loadContracts() {
  try {
    const files = [
      "data/contracts/contracts2605.json",
      "data/contracts/contracts2606.json",
      "data/contracts/contracts2607.json",
    ];
    const promises = files.map((file) =>
      fetch(file)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
    const results = await Promise.all(promises);
    results.forEach((data, idx) => {
      if (!data) return;
      const filename = files[idx];
      const match = filename.match(/contracts(\d{4})\.json/);
      if (!match) return;
      const code = match[1];
      const year = "20" + code.substring(0, 2);
      const month = code.substring(2, 4);
      const formattedDate = `01.${month}.${year.substring(2)}`;
      if (!contractsData[formattedDate]) contractsData[formattedDate] = {};
      if (Array.isArray(data)) {
        data.forEach((c) => {
          if (c && c.name && c.trips !== undefined) {
            contractsData[formattedDate][c.name] = c.trips;
            contractsData[formattedDate][c.name.toLowerCase()] = c.trips;
          }
        });
      } else {
        Object.entries(data).forEach(([dateStr, contracts]) => {
          const [day, month, year] = dateStr.split(".");
          const inner = `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
          if (!contractsData[inner]) contractsData[inner] = {};
          if (Array.isArray(contracts)) {
            contracts.forEach((c) => {
              if (c && c.name && c.trips !== undefined) {
                contractsData[inner][c.name] = c.trips;
                contractsData[inner][c.name.toLowerCase()] = c.trips;
              }
            });
          }
        });
      }
    });
    console.log(
      `Загружено контрактов за ${Object.keys(contractsData).length} дат`,
    );
  } catch (err) {
    console.error("Ошибка загрузки контрактов:", err);
  }
}

// --- Инициализация интерфейса ---

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
          <div class="date-group"><label>Предыдущая дата:</label><select id="dateMain"></select></div>
          <div class="date-group"><label>Дата сравнения:</label><select id="dateCompare"></select></div>
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
            <div class="role-filters" id="roleFilters"></div>
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
        <div class="stat-card"><span class="stat-label">Всего сотрудников:</span><span class="stat-value" id="totalEmployees">0</span></div>
        <div class="stat-card"><span class="stat-label">Показатель вырос:</span><span class="stat-value increased" id="increasedEmployees">0</span></div>
        <div class="stat-card"><span class="stat-label">Показатель упал:</span><span class="stat-value decreased" id="decreasedEmployees">0</span></div>
        <div class="stat-card"><span class="stat-label">Без изменений:</span><span class="stat-value unchanged" id="unchangedEmployees">0</span></div>
        <div class="stat-card"><span class="stat-label">Повысились:</span><span class="stat-value role-increased" id="roleIncreased">0</span></div>
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
              <th data-key="contracts_total">Контракты (месяц)</th>
              <th data-key="contracts_weekly" data-diff="true">Контракты (неделя)</th>
              <th data-key="pokazatel" data-diff="true">Показатель Δ</th>
              <th data-key="karma" data-diff="true">Карма Δ</th>
              <th data-key="karma_vtc" data-diff="true">Карма VTC Δ</th>
              <th data-key="point_m" data-diff="true">Очки мес Δ</th>
              <th data-key="point" data-diff="true">Очки Δ</th>
              <th data-key="koeff" class="number cell-eff">Недельная эффективность</th>
              <th data-key="koeff_total" class="number cell-eff-total">Эффективность</th>
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
    return parseDate(a) - parseDate(b);
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

function initRoleFilters() {
  const container = document.getElementById("roleFilters");
  Object.entries(roleNames).forEach(([id, name]) => {
    const btn = document.createElement("button");
    btn.className = "role-filter-btn";
    btn.dataset.role = id;
    btn.textContent = name;
    container.appendChild(btn);
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

// Стили
const style = document.createElement("style");
style.textContent = `
  .error { background:#1a1d24; padding:30px; border-radius:8px; border-left:4px solid #f44336; margin:20px; }
  .error h2 { color:#f44336; margin-top:0; }
  .error p { color:#aaa; margin:10px 0; }
  .cell-eff-total { font-weight:bold; }
`;
document.head.appendChild(style);

// Запуск
loadAllData();
