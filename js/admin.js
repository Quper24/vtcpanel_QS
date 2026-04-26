// ========== НАСТРОЙКИ SUPABASE ==========
const SUPABASE_URL = "https://vpcxtuwhrpgcgdipgnxx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwY3h0dXdocnBnY2dkaXBnbnh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDM0MzgsImV4cCI6MjA5MjQxOTQzOH0.-l17k9yaD2Gx6fXEBSoBCVMoyevVVVOjHCxO51qvlTE";
// ========================================

let currentConvoys = [];
let currentUser = null;
let currentJobFileContent = null;

// Базы данных из txt файлов - ИСПРАВЛЕНО: используем обычные переменные, не window
let cargoDatabase = [];
let citiesDatabase = [];
let companiesDatabase = [];
let countriesETS2Database = [];
let countriesATSDatabase = [];

// Флаги загрузки
let cargoLoaded = false;
let citiesLoaded = false;
let companiesLoaded = false;
let countriesETS2Loaded = false;
let countriesATSLoaded = false;

// Supabase клиент
const supabaseClient = {
  async request(endpoint, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: currentUser
          ? `Bearer ${currentUser.access_token}`
          : `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    return response;
  },
  async get(endpoint) {
    const res = await this.request(endpoint);
    return res.json();
  },
  async post(endpoint, data) {
    const res = await this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
  async delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },
  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  async signIn(email, password) {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      },
    );
    if (response.ok) {
      const data = await response.json();
      currentUser = data;
      localStorage.setItem("supabase_session", JSON.stringify(data));
      return { success: true };
    }
    return { success: false, error: "Неверный email или пароль" };
  },
  signOut() {
    currentUser = null;
    localStorage.removeItem("supabase_session");
  },
  checkSession() {
    const session = localStorage.getItem("supabase_session");
    if (session) {
      currentUser = JSON.parse(session);
      return true;
    }
    return false;
  },
};

// Загрузка словарей из txt файлов
async function loadDictionaryFromTxt(files, targetArray, loadedFlag) {
  // Используем замыкание на переменные
  if (loadedFlag === true && targetArray.length > 0) {
    console.log(`📦 Данные уже загружены: ${targetArray.length} записей`);
    return targetArray;
  }

  const allLines = [];
  for (const filePath of files) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        console.warn(`Файл ${filePath} не найден, пропускаем`);
        continue;
      }
      const text = await response.text();
      const lines = text.split(/\r?\n/);
      allLines.push(...lines);
    } catch (err) {
      console.warn(`Ошибка загрузки ${filePath}:`, err);
    }
  }

  const map = new Map();
  for (let line of allLines) {
    line = line.trim();
    if (line === "" || line.startsWith("[")) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    let id = line.substring(0, colonIndex).trim();
    let name = line.substring(colonIndex + 1).trim();
    name = name.replace(/^["']|["']$/g, "").replace(/;$/, "");

    if (id && name) {
      map.set(id, { id, name });
    }
  }

  // Очищаем массив и заполняем новыми данными
  targetArray.length = 0;
  map.forEach((value) => targetArray.push(value));

  // Устанавливаем флаг
  if (loadedFlag === true) {
    // Для флага нужно передать ссылку на переменную, но проще вернуть значение
  }

  console.log(
    `✅ Загружено ${targetArray.length} записей из ${files.join(", ")}`,
  );
  console.log(
    `📋 Примеры (первые 5):`,
    targetArray.slice(0, 5).map((c) => `${c.id}: ${c.name}`),
  );
  return targetArray;
}

async function loadCargo() {
  if (cargoLoaded && cargoDatabase.length > 0) return cargoDatabase;
  await loadDictionaryFromTxt(
    ["data/cargo.txt", "data/cargo_my.txt"],
    cargoDatabase,
    cargoLoaded,
  );
  cargoLoaded = true;
  return cargoDatabase;
}

async function loadCities() {
  if (citiesLoaded && citiesDatabase.length > 0) return citiesDatabase;
  await loadDictionaryFromTxt(
    ["data/cities.txt", "data/cities_my.txt"],
    citiesDatabase,
    citiesLoaded,
  );
  citiesLoaded = true;
  return citiesDatabase;
}

async function loadCompanies() {
  if (companiesLoaded && companiesDatabase.length > 0) return companiesDatabase;
  await loadDictionaryFromTxt(
    ["data/companies.txt", "data/companies_my.txt"],
    companiesDatabase,
    companiesLoaded,
  );
  companiesLoaded = true;
  return companiesDatabase;
}

// Функция загрузки стран ETS2 из JSON
async function loadCountriesETS2() {
  if (countriesETS2Loaded && countriesETS2Database.length > 0)
    return countriesETS2Database;

  try {
    const response = await fetch("data/countries_ets2.json");
    if (!response.ok) {
      console.warn("Файл data/countries_ets2.json не найден");
      return [];
    }
    const data = await response.json();
    countriesETS2Database = Array.isArray(data) ? data : [];
    countriesETS2Loaded = true;
    console.log(
      `✅ Загружено ${countriesETS2Database.length} стран/штатов для ETS2`,
    );
    return countriesETS2Database;
  } catch (err) {
    console.warn("Ошибка загрузки countries_ets2.json:", err);
    return [];
  }
}

// Функция загрузки стран/штатов ATS из JSON
async function loadCountriesATS() {
  if (countriesATSLoaded && countriesATSDatabase.length > 0)
    return countriesATSDatabase;

  try {
    const response = await fetch("data/countries_ats.json");
    if (!response.ok) {
      console.warn("Файл data/countries_ats.json не найден");
      return [];
    }
    const data = await response.json();
    countriesATSDatabase = Array.isArray(data) ? data : [];
    countriesATSLoaded = true;
    console.log(`✅ Загружено ${countriesATSDatabase.length} штатов для ATS`);
    return countriesATSDatabase;
  } catch (err) {
    console.warn("Ошибка загрузки countries_ats.json:", err);
    return [];
  }
}

// Функция получения текущей базы стран в зависимости от выбранной игры
function getCurrentCountriesDatabase() {
  const gameSelect = document.getElementById("game");
  if (!gameSelect) return [];

  const currentGame = gameSelect.value;
  if (currentGame === "ETS2") {
    return countriesETS2Database;
  } else {
    return countriesATSDatabase;
  }
}

// Функция обновления автодополнения для поля страны/штата при смене игры
function updateStateAutocomplete(gameValue) {
  const stateInputs = ["from_state", "to_state"];
  stateInputs.forEach((inputId) => {
    const input = document.getElementById(inputId);
    if (input && input.value) {
      // Если поле уже заполнено, не очищаем его
      return;
    }
  });
}

// Автозаполнение для стран/штатов с поддержкой выбора игры
function initStateAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  let currentAutocompleteDiv = null;

  async function showSuggestions() {
    const val = input.value.trim();

    // Удаляем предыдущий блок подсказок
    if (currentAutocompleteDiv) {
      currentAutocompleteDiv.remove();
      currentAutocompleteDiv = null;
    }

    if (val.length === 0) return;

    // Получаем актуальную базу данных в зависимости от выбранной игры
    let countriesDatabase = [];
    const gameSelect = document.getElementById("game");
    if (gameSelect) {
      const currentGame = gameSelect.value;
      if (currentGame === "ETS2") {
        if (countriesETS2Database.length === 0) await loadCountriesETS2();
        countriesDatabase = countriesETS2Database;
      } else {
        if (countriesATSDatabase.length === 0) await loadCountriesATS();
        countriesDatabase = countriesATSDatabase;
      }
    }

    if (countriesDatabase.length === 0) return;

    const searchVal = val.toLowerCase();
    let matches = countriesDatabase.filter((item) => {
      const itemLower = String(item).toLowerCase();
      return itemLower.includes(searchVal);
    });

    if (matches.length === 0) return;
    matches = matches.slice(0, 15);

    const autocompleteDiv = document.createElement("div");
    autocompleteDiv.className = "autocomplete-items";
    currentAutocompleteDiv = autocompleteDiv;

    matches.forEach((match) => {
      const div = document.createElement("div");
      div.innerHTML = match;
      div.addEventListener("click", () => {
        input.value = match;
        autocompleteDiv.remove();
        currentAutocompleteDiv = null;
        input.dispatchEvent(new Event("input"));
      });
      autocompleteDiv.appendChild(div);
    });
    input.parentNode.appendChild(autocompleteDiv);
  }

  // Слушаем ввод текста
  input.addEventListener("input", function (e) {
    showSuggestions();
  });

  // Слушаем изменение игры, чтобы обновить подсказки при фокусе
  const gameSelect = document.getElementById("game");
  if (gameSelect) {
    gameSelect.addEventListener("change", function () {
      if (document.activeElement === input && input.value.trim().length > 0) {
        showSuggestions();
      }
    });
  }

  // Закрываем подсказки при клике вне поля
  document.addEventListener("click", function (e) {
    if (!input.contains(e.target) && currentAutocompleteDiv) {
      currentAutocompleteDiv.remove();
      currentAutocompleteDiv = null;
    }
  });
}

function updateGameSpecificFields() {
  const gameSelect = document.getElementById("game");
  if (!gameSelect) return;

  const currentGame = gameSelect.value;
  const stateHint = document.getElementById("stateHint");
  const stateHint2 = document.getElementById("stateHint2");

  const hintText =
    currentGame === "ATS"
      ? "🏛️ Введите штат (например: California, Texas)"
      : "🇪🇺 Введите страну (например: Germany, France)";

  if (stateHint) stateHint.textContent = hintText;
  if (stateHint2) stateHint2.textContent = hintText;
}

// Функция для принудительной перезагрузки всех данных
async function reloadAllData() {
  console.log("🔄 Принудительная перезагрузка данных...");
  cargoLoaded = false;
  citiesLoaded = false;
  companiesLoaded = false;
  cargoDatabase.length = 0;
  citiesDatabase.length = 0;
  companiesDatabase.length = 0;

  await Promise.all([loadCargo(), loadCities(), loadCompanies()]);

  console.log(
    `📊 ИТОГО: города=${citiesDatabase.length}, грузы=${cargoDatabase.length}, компании=${companiesDatabase.length}`,
  );
  console.log(
    `🔍 Проверка campbelriver в городах:`,
    citiesDatabase.find((c) => c.id === "campbelriver"),
  );
  console.log(
    `🔍 Проверка scaffolding в грузах:`,
    cargoDatabase.find((c) => c.id === "scaffolding"),
  );
  console.log(
    `🔍 Проверка sht_mkt в компаниях:`,
    companiesDatabase.find((c) => c.id === "sht_mkt"),
  );
}

// Поиск города
function findCityDisplay(cityId, cities) {
  if (!cityId) {
    return null;
  }

  // Прямое совпадение
  let found = cities.find((c) => c.id === cityId);
  if (found) {
    console.log(`✅ Город НАЙДЕН: "${found.id}" → "${found.name}"`);
    return `${found.name} [${found.id}]`;
  }

  // Без учета регистра
  found = cities.find((c) => c.id.toLowerCase() === cityId.toLowerCase());
  if (found) {
    console.log(
      `✅ Город НАЙДЕН (без учета регистра): "${found.id}" → "${found.name}"`,
    );
    return `${found.name} [${found.id}]`;
  }

  console.log(`❌ Город "${cityId}" НЕ НАЙДЕН. Проверьте наличие в базе.`);
  return null;
}

// Поиск компании
function findCompanyName(companyId, companies) {
  if (!companyId) return null;

  let found = companies.find((c) => c.id === companyId);
  if (found) {
    console.log(`✅ Компания НАЙДЕНА: "${found.id}" → "${found.name}"`);
    return found.name;
  }

  found = companies.find((c) => c.id.toLowerCase() === companyId.toLowerCase());
  if (found) {
    console.log(
      `✅ Компания НАЙДЕНА (без учета регистра): "${found.id}" → "${found.name}"`,
    );
    return found.name;
  }

  console.log(`❌ Компания "${companyId}" НЕ НАЙДЕНА`);
  return null;
}

// Поиск груза
function findCargoName(cargoId, cargo) {
  if (!cargoId) return null;

  let found = cargo.find((c) => c.id === cargoId);
  if (found) {
    console.log(`✅ Груз НАЙДЕН: "${found.id}" → "${found.name}"`);
    return found.name;
  }

  found = cargo.find((c) => c.id.toLowerCase() === cargoId.toLowerCase());
  if (found) {
    console.log(
      `✅ Груз НАЙДЕН (без учета регистра): "${found.id}" → "${found.name}"`,
    );
    return found.name;
  }

  console.log(`❌ Груз "${cargoId}" НЕ НАЙДЕН`);
  return null;
}

// Парсер файла job
function parseJobFile(content) {
  const result = {
    cargo_id: null,
    source_company: null,
    target_company: null,
    source_city: null,
    target_city: null,
    distance: null,
    cargo_mass: null,
  };

  // Ищем cargo
  const cargoMatch = content.match(/cargo:\s*cargo\.([a-zA-Z0-9_]+)/);
  if (cargoMatch) {
    result.cargo_id = cargoMatch[1];
    console.log(`🔍 Найден груз: ${result.cargo_id}`);
  }

  // Ищем source_company
  const sourceMatch = content.match(
    /source_company:\s*company\.volatile\.([a-zA-Z0-9_\.]+)/,
  );
  if (sourceMatch) {
    const parts = sourceMatch[1].split(".");
    result.source_company = parts[0];
    if (parts.length > 1) {
      result.source_city = parts[parts.length - 1];
    }
    console.log(
      `🔍 Найдена компания отправления: ${result.source_company}, город: ${result.source_city}`,
    );
  }

  // Ищем target_company
  const targetMatch = content.match(
    /target_company:\s*company\.volatile\.([a-zA-Z0-9_\.]+)/,
  );
  if (targetMatch) {
    const parts = targetMatch[1].split(".");
    result.target_company = parts[0];
    if (parts.length > 1) {
      result.target_city = parts[parts.length - 1];
    }
    console.log(
      `🔍 Найдена компания назначения: ${result.target_company}, город: ${result.target_city}`,
    );
  }

  // Ищем planned_distance_km
  const distanceMatch = content.match(/planned_distance_km:\s*(\d+)/);
  if (distanceMatch) {
    result.distance = parseInt(distanceMatch[1]);
    console.log(`🔍 Найдена дистанция: ${result.distance} км`);
  }

  // Ищем cargo_mass
  const massMatch = content.match(/cargo_mass:\s*(\d+)/);
  if (massMatch) {
    result.cargo_mass = parseInt(massMatch[1]);
    console.log(`🔍 Найден вес груза: ${result.cargo_mass} кг`);
  }

  return result;
}

// Обработка импорта файла
async function handleJobImport(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function (e) {
      const content = e.target.result; // ПОЛНОЕ СОДЕРЖИМОЕ ФАЙЛА
      const parsed = parseJobFile(content);

      // Убеждаемся что данные загружены
      if (citiesDatabase.length === 0) {
        await loadCities();
      }
      if (companiesDatabase.length === 0) {
        await loadCompanies();
      }
      if (cargoDatabase.length === 0) {
        await loadCargo();
      }

      // Ищем названия по ID
      if (parsed.source_city) {
        const cityDisplay = findCityDisplay(parsed.source_city, citiesDatabase);
        if (cityDisplay) parsed.source_city_display = cityDisplay;
      }

      if (parsed.target_city) {
        const cityDisplay = findCityDisplay(parsed.target_city, citiesDatabase);
        if (cityDisplay) parsed.target_city_display = cityDisplay;
      }

      if (parsed.source_company) {
        const companyName = findCompanyName(
          parsed.source_company,
          companiesDatabase,
        );
        if (companyName) parsed.source_company_name = companyName;
      }

      if (parsed.target_company) {
        const companyName = findCompanyName(
          parsed.target_company,
          companiesDatabase,
        );
        if (companyName) parsed.target_company_name = companyName;
      }

      if (parsed.cargo_id) {
        const cargoName = findCargoName(parsed.cargo_id, cargoDatabase);
        if (cargoName) parsed.cargo_name = cargoName;
      }

      // СОХРАНЯЕМ ПОЛНОЕ СОДЕРЖИМОЕ
      parsed.job_file_content = content;

      resolve(parsed);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Заполнение формы
function fillFormWithImportData(data) {
  console.log("📝 Заполняем форму:", data);

  if (data.cargo_name && data.cargo_id) {
    const cargoNameInput = document.getElementById("cargo_name");
    const cargoIdInput = document.getElementById("cargo_id");
    if (cargoNameInput) cargoNameInput.value = data.cargo_name;
    if (cargoIdInput) cargoIdInput.value = data.cargo_id;
  }

  // Заполнение города отправления и извлечение страны/штата
  if (data.source_city_display) {
    const fromCityInput = document.getElementById("from_city");
    const fromStateInput = document.getElementById("from_state");
    if (fromCityInput) {
      fromCityInput.value = data.source_city_display;
      // Извлекаем страну/штат из названия города
      const extractedState = extractStateFromCityName(data.source_city_display);
      if (fromStateInput && extractedState) {
        fromStateInput.value = extractedState;
      }
    }
  }

  // Заполнение города назначения и извлечение страны/штата
  if (data.target_city_display) {
    const toCityInput = document.getElementById("to_city");
    const toStateInput = document.getElementById("to_state");
    if (toCityInput) {
      toCityInput.value = data.target_city_display;
      // Извлекаем страну/штат из названия города
      const extractedState = extractStateFromCityName(data.target_city_display);
      if (toStateInput && extractedState) {
        toStateInput.value = extractedState;
      }
    }
  }

  if (data.source_company_name) {
    const fromBaseInput = document.getElementById("from_base");
    if (fromBaseInput) fromBaseInput.value = data.source_company_name;
  }

  if (data.target_company_name) {
    const toBaseInput = document.getElementById("to_base");
    if (toBaseInput) toBaseInput.value = data.target_company_name;
  }

  if (data.distance) {
    const distanceInput = document.getElementById("distance");
    if (distanceInput) distanceInput.value = data.distance;
  }

  if (data.cargo_mass) {
    const notesInput = document.getElementById("notes");
    if (notesInput) {
      const weightInfo = `Вес груза: ${data.cargo_mass} кг`;
      const currentNotes = notesInput.value;
      if (!currentNotes.includes("Вес груза:")) {
        notesInput.value = currentNotes
          ? `${currentNotes}\n${weightInfo}`
          : weightInfo;
      }
    }
  }

  // СОЗДАЕМ ИЛИ ОБНОВЛЯЕМ СКРЫТОЕ ПОЛЕ С СОДЕРЖИМЫМ ФАЙЛА
  let jobContentInput = document.getElementById("job_file_content");
  if (!jobContentInput) {
    jobContentInput = document.createElement("input");
    jobContentInput.type = "hidden";
    jobContentInput.id = "job_file_content";
    jobContentInput.name = "job_file_content";
    document.getElementById("convoyForm").appendChild(jobContentInput);
  }

  if (data.job_file_content) {
    jobContentInput.value = data.job_file_content;
    console.log(
      "✅ Сохранено содержимое job файла (",
      data.job_file_content.length,
      "символов)",
    );
  }

  // Триггерим события
  [
    "cargo_name",
    "cargo_id",
    "from_city",
    "from_state",
    "to_city",
    "to_state",
    "from_base",
    "to_base",
    "distance",
    "notes",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.dispatchEvent(new Event("input"));
  });
}

// Загрузка конвоев
async function loadConvoys() {
  try {
    const data = await supabaseClient.get("convoys?select=*&order=id.desc");
    currentConvoys = Array.isArray(data) ? data : [];
    renderConvoyList();
  } catch (error) {
    console.error("Ошибка загрузки конвоев:", error);
    currentConvoys = [];
    renderConvoyList();
  }
}

// Обновление единицы измерения
function updateDistanceUnit() {
  const gameSelect = document.getElementById("game");
  const distanceInput = document.getElementById("distance");
  const unitHint = document.getElementById("unitHint");

  if (gameSelect && distanceInput && unitHint) {
    const isATS = gameSelect.value === "ATS";
    if (isATS) {
      unitHint.textContent = "⛽ Введите расстояние в милях (только число)";
      distanceInput.placeholder = "1670";
    } else {
      unitHint.textContent =
        "🛣️ Введите расстояние в километрах (только число)";
      distanceInput.placeholder = "1050";
    }
  }

  updateGameSpecificFields();
}

// Валидация формы
function validateForm() {
  let isValid = true;

  const requiredFields = [
    "game",
    "date",
    "time_start",
    "time_end",
    "from_city",
    "from_state",
    "from_base",
    "to_city",
    "to_state",
    "to_base",
    "distance",
    "cargo_name",
    "cargo_id",
  ];

  requiredFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    const errorDiv = document.getElementById(`error_${fieldId}`);
    if (field && !field.value.trim()) {
      field.classList.add("error");
      if (errorDiv) errorDiv.classList.add("show");
      isValid = false;
    } else {
      field?.classList.remove("error");
      if (errorDiv) errorDiv.classList.remove("show");
    }
  });

  const timeStart = document.getElementById("time_start").value;
  const timeEnd = document.getElementById("time_end").value;
  const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

  if (!timePattern.test(timeStart)) {
    document.getElementById("time_start").classList.add("error");
    document.getElementById("error_time_start").classList.add("show");
    isValid = false;
  }
  if (!timePattern.test(timeEnd)) {
    document.getElementById("time_end").classList.add("error");
    document.getElementById("error_time_end").classList.add("show");
    isValid = false;
  }

  const distance = document.getElementById("distance").value;
  if (!/^\d+$/.test(distance) || parseInt(distance) < 1) {
    document.getElementById("distance").classList.add("error");
    document.getElementById("error_distance").classList.add("show");
    isValid = false;
  }
  return isValid;
}

// Добавление конвоя
async function addConvoy(event) {
  event.preventDefault();
  if (!validateForm()) {
    alert("❌ Пожалуйста, заполните все обязательные поля правильно");
    return;
  }

  const game = document.getElementById("game").value;
  const distanceValue = document.getElementById("distance").value;
  const distance =
    game === "ATS" ? `${distanceValue} миль` : `${distanceValue} км`;

  // ПОЛУЧАЕМ СОДЕРЖИМОЕ ФАЙЛА ИЗ СКРЫТОГО ПОЛЯ
  const jobContentInput = document.getElementById("job_file_content");
  const jobFileContent = jobContentInput ? jobContentInput.value : null;

  const newConvoy = {
    game: game,
    status: document.getElementById("status").value,
    date: document.getElementById("date").value,
    time_start: document.getElementById("time_start").value,
    time_end: document.getElementById("time_end").value,
    from_city: document.getElementById("from_city").value,
    from_state: document.getElementById("from_state").value,
    from_base: document.getElementById("from_base").value,
    to_city: document.getElementById("to_city").value,
    to_state: document.getElementById("to_state").value,
    to_base: document.getElementById("to_base").value,
    distance: distance,
    cargo_name: document.getElementById("cargo_name").value,
    cargo_id: document.getElementById("cargo_id").value,
    trucky_code: document.getElementById("trucky_code").value,
    notes: document.getElementById("notes").value,
    job_file_content: jobFileContent, // ← ОТПРАВЛЯЕМ В БАЗУ
  };

  await supabaseClient.post("convoys", newConvoy);
  document.getElementById("convoyForm").reset();
  document.getElementById("distance").value = "";

  // ОЧИЩАЕМ СКРЫТОЕ ПОЛЕ
  if (jobContentInput) {
    jobContentInput.remove();
  }

  updateDistanceUnit();
  loadConvoys();

  const successMsg = document.getElementById("successMsg");
  if (successMsg) {
    successMsg.textContent = "✅ Конвой успешно создан!";
    setTimeout(() => (successMsg.textContent = ""), 3000);
  }
}

// Удаление конвоя
async function deleteConvoy(id) {
  if (!confirm("Удалить конвой?")) return;
  await supabaseClient.delete(`convoys?id=eq.${id}`);
  loadConvoys();
  alert("✅ Конвой удалён");
}

// Обновление статуса
async function updateStatus(id, newStatus) {
  await supabaseClient.patch(`convoys?id=eq.${id}`, { status: newStatus });
  loadConvoys();
}

// Отображение списка конвоев
function renderConvoyList() {
  const container = document.getElementById("convoyList");
  if (!container) return;

  if (!currentConvoys || currentConvoys.length === 0) {
    container.innerHTML = "<p>📭 Нет конвоев</p>";
    return;
  }

  container.innerHTML = currentConvoys
    .map(
      (convoy) => `
        <div class="convoy-item">
            <div class="convoy-info">
                <div class="convoy-title">🚛 ${convoy.game} | ${convoy.from_city} → ${convoy.to_city}</div>
                <div class="convoy-meta">⏰ ${convoy.time_start} - ${convoy.time_end} | 📦 ${convoy.cargo_name} (${convoy.cargo_id}) | ${convoy.distance}</div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <select class="status-select" onchange="updateStatus(${convoy.id}, this.value)">
                    <option value="active" ${convoy.status === "active" ? "selected" : ""}>🟢 Активен</option>
                    <option value="upcoming" ${convoy.status === "upcoming" ? "selected" : ""}>🟡 Запланирован</option>
                    <option value="ended" ${convoy.status === "ended" ? "selected" : ""}>⚪ Завершён</option>
                </select>
                <button onclick="deleteConvoy(${convoy.id})">🗑️</button>
            </div>
        </div>
    `,
    )
    .join("");
}

// Обработка входа
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const result = await supabaseClient.signIn(email, password);
  if (result.success) {
    renderAdminPanel();
  } else {
    document.getElementById("loginError").textContent = result.error;
  }
}

// Выход
function logout() {
  supabaseClient.signOut();
  renderLoginPage();
}

// Страница входа
function renderLoginPage() {
  document.getElementById("app").innerHTML = `
        <div class="login-box">
            <h2 style="margin-bottom: 20px;">🔐 Вход в админ-панель</h2>
            <form id="loginForm">
                <input type="email" id="email" placeholder="Email" required autocomplete="email">
                <input type="password" id="password" placeholder="Пароль" required autocomplete="current-password">
                <button type="submit">Войти</button>
                <div id="loginError" class="error-msg"></div>
            </form>
        </div>
    `;
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
}

// Автозаполнение для городов (упрощенная версия)
function initCityAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener("input", async function (e) {
    const val = this.value.trim();
    const existingDiv = this.parentNode.querySelector(".autocomplete-items");
    if (existingDiv) existingDiv.remove();
    if (val.length === 0) return;

    if (citiesDatabase.length === 0) await loadCities();

    const searchVal = val.toLowerCase();
    let matches = citiesDatabase.filter(
      (item) =>
        item.name.toLowerCase().includes(searchVal) ||
        item.id.toLowerCase().includes(searchVal),
    );

    if (matches.length === 0) return;
    matches = matches.slice(0, 15);

    const autocompleteDiv = document.createElement("div");
    autocompleteDiv.className = "autocomplete-items";

    matches.forEach((match) => {
      const div = document.createElement("div");
      div.innerHTML = `${match.name} [${match.id}]`;
      div.addEventListener("click", () => {
        input.value = `${match.name} [${match.id}]`;
        autocompleteDiv.remove();
        input.dispatchEvent(new Event("input"));
      });
      autocompleteDiv.appendChild(div);
    });
    this.parentNode.appendChild(autocompleteDiv);
  });

  document.addEventListener("click", function (e) {
    if (!input.contains(e.target)) {
      const items = input.parentNode.querySelectorAll(".autocomplete-items");
      items.forEach((el) => el.remove());
    }
  });
}

// Автозаполнение для компаний
function initCompanyAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener("input", async function (e) {
    const val = this.value.trim();
    const existingDiv = this.parentNode.querySelector(".autocomplete-items");
    if (existingDiv) existingDiv.remove();
    if (val.length === 0) return;

    if (companiesDatabase.length === 0) await loadCompanies();

    const searchVal = val.toLowerCase();
    let matches = companiesDatabase.filter(
      (item) =>
        item.name.toLowerCase().includes(searchVal) ||
        item.id.toLowerCase().includes(searchVal),
    );

    if (matches.length === 0) return;
    matches = matches.slice(0, 15);

    const autocompleteDiv = document.createElement("div");
    autocompleteDiv.className = "autocomplete-items";

    matches.forEach((match) => {
      const div = document.createElement("div");
      div.innerHTML = match.name;
      div.addEventListener("click", () => {
        input.value = match.name;
        autocompleteDiv.remove();
        input.dispatchEvent(new Event("input"));
      });
      autocompleteDiv.appendChild(div);
    });
    this.parentNode.appendChild(autocompleteDiv);
  });

  document.addEventListener("click", function (e) {
    if (!input.contains(e.target)) {
      const items = input.parentNode.querySelectorAll(".autocomplete-items");
      items.forEach((el) => el.remove());
    }
  });
}

// Функция для установки текущей даты и времени по умолчанию
function setDefaultDateTime() {
  const dateInput = document.getElementById("date");
  const timeStartInput = document.getElementById("time_start");
  const timeEndInput = document.getElementById("time_end");

  // Установка текущей даты в формате YYYY-MM-DD
  if (dateInput && !dateInput.value) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    dateInput.value = `${year}-${month}-${day}`;
  }

  // Установка текущего времени и времени +2 часа
  if (timeStartInput && !timeStartInput.value) {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    // Форматируем текущее время
    const startHours = String(currentHours).padStart(2, "0");
    const startMinutes = String(currentMinutes).padStart(2, "0");
    timeStartInput.value = `${startHours}:${startMinutes}`;

    // Рассчитываем время +2 часа
    if (timeEndInput && !timeEndInput.value) {
      const endDate = new Date();
      endDate.setHours(currentHours + 2);
      endDate.setMinutes(currentMinutes);

      const endHours = String(endDate.getHours()).padStart(2, "0");
      const endMinutes = String(endDate.getMinutes()).padStart(2, "0");
      timeEndInput.value = `${endHours}:${endMinutes}`;
    }
  }
}

function extractStateFromCityName(cityDisplayName) {
  if (!cityDisplayName) return "";

  // Ищем скобки в формате " (XX)" или " (XXX)" где X - буквы
  const match = cityDisplayName.match(/\(([A-Za-z]{2,3})\)/);
  if (match && match[1]) {
    return match[1];
  }
  return "";
}

function initCityAutocompleteWithState(inputId, stateInputId) {
  const input = document.getElementById(inputId);
  const stateInput = document.getElementById(stateInputId);
  if (!input || !stateInput) return;

  input.addEventListener("input", async function (e) {
    const val = this.value.trim();
    const existingDiv = this.parentNode.querySelector(".autocomplete-items");
    if (existingDiv) existingDiv.remove();
    if (val.length === 0) return;

    if (citiesDatabase.length === 0) await loadCities();

    const searchVal = val.toLowerCase();
    let matches = citiesDatabase.filter(
      (item) =>
        item.name.toLowerCase().includes(searchVal) ||
        item.id.toLowerCase().includes(searchVal),
    );

    if (matches.length === 0) return;
    matches = matches.slice(0, 15);

    const autocompleteDiv = document.createElement("div");
    autocompleteDiv.className = "autocomplete-items";

    matches.forEach((match) => {
      const div = document.createElement("div");
      div.innerHTML = `${match.name} [${match.id}]`;
      div.addEventListener("click", () => {
        const displayValue = `${match.name} [${match.id}]`;
        input.value = displayValue;

        // Извлекаем страну/штат из названия города
        const extractedState = extractStateFromCityName(match.name);
        if (extractedState) {
          stateInput.value = extractedState;
        } else {
          // Если не нашли в скобках, пробуем искать в самом названии
          const stateMatch = match.name.match(/\(([A-Za-z]{2,3})\)/);
          if (stateMatch) {
            stateInput.value = stateMatch[1];
          } else {
            stateInput.value = "";
          }
        }

        autocompleteDiv.remove();
        input.dispatchEvent(new Event("input"));
        stateInput.dispatchEvent(new Event("input"));
      });
      autocompleteDiv.appendChild(div);
    });
    this.parentNode.appendChild(autocompleteDiv);
  });

  document.addEventListener("click", function (e) {
    if (!input.contains(e.target)) {
      const items = input.parentNode.querySelectorAll(".autocomplete-items");
      items.forEach((el) => el.remove());
    }
  });
}

function addCityManualExtraction(inputId, stateInputId) {
  const cityInput = document.getElementById(inputId);
  const stateInput = document.getElementById(stateInputId);

  if (!cityInput || !stateInput) return;

  cityInput.addEventListener("blur", function () {
    const cityValue = this.value;
    if (cityValue && !stateInput.value) {
      // Если поле страны пустое, пытаемся извлечь из названия города
      const extractedState = extractStateFromCityName(cityValue);
      if (extractedState) {
        stateInput.value = extractedState;
      }
    }
  });
}

// Автозаполнение для грузов
function initCargoAutocomplete() {
  const cargoNameInput = document.getElementById("cargo_name");
  const cargoIdInput = document.getElementById("cargo_id");
  if (!cargoNameInput || !cargoIdInput) return;

  cargoNameInput.addEventListener("input", async function (e) {
    const val = this.value.trim();
    const existingDiv = this.parentNode.querySelector(".autocomplete-items");
    if (existingDiv) existingDiv.remove();
    if (val.length === 0) return;

    if (cargoDatabase.length === 0) await loadCargo();

    const searchVal = val.toLowerCase();
    let matches = cargoDatabase.filter(
      (item) =>
        item.name.toLowerCase().includes(searchVal) ||
        item.id.toLowerCase().includes(searchVal),
    );

    if (matches.length === 0) return;
    matches = matches.slice(0, 15);

    const autocompleteDiv = document.createElement("div");
    autocompleteDiv.className = "autocomplete-items";

    matches.forEach((match) => {
      const div = document.createElement("div");
      div.innerHTML = `${match.name} (${match.id})`;
      div.addEventListener("click", () => {
        cargoNameInput.value = match.name;
        cargoIdInput.value = match.id;
        autocompleteDiv.remove();
        cargoNameInput.dispatchEvent(new Event("input"));
        cargoIdInput.dispatchEvent(new Event("input"));
      });
      autocompleteDiv.appendChild(div);
    });
    this.parentNode.appendChild(autocompleteDiv);
  });

  cargoIdInput.addEventListener("input", async function () {
    if (cargoDatabase.length === 0) await loadCargo();
    const found = cargoDatabase.find((c) => c.id === this.value.trim());
    if (found && cargoNameInput.value !== found.name) {
      cargoNameInput.value = found.name;
    }
  });

  document.addEventListener("click", function (e) {
    if (!cargoNameInput.contains(e.target)) {
      const items = cargoNameInput.parentNode.querySelectorAll(
        ".autocomplete-items",
      );
      items.forEach((el) => el.remove());
    }
  });
}

// Админ панель
async function renderAdminPanel() {
  document.getElementById("app").innerHTML = `
        <div class="admin-panel">
            <div class="clearfix">
                <button class="logout-btn" onclick="logout()">🚪 Выйти</button>
            </div>
            <h2 style="margin-bottom: 20px;">➕ Создать конвой</h2>
            <div id="successMsg" class="success-msg"></div>
            
            <div class="import-area">
                <label for="jobFileInput">📁 Импортировать delivery.job</label>
                <input type="file" id="jobFileInput" accept=".job, .txt, */*">
                <div class="import-hint">Загрузите файл delivery.job для автоматического заполнения полей</div>
                <div id="importPreview" class="import-preview" style="display: none;"></div>
            </div>
            
            <form id="convoyForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>🎮 Игра <span class="required">*</span></label>
                        <select id="game" onchange="updateDistanceUnit()" required>
                            <option value="ATS">🇺🇸 ATS (мили)</option>
                            <option value="ETS2">🇪🇺 ETS2 (километры)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>📅 Дата <span class="required">*</span></label>
                        <input type="date" id="date" autocomplete="off">
                        <div id="error_date" class="error-message">Обязательное поле</div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>⏰ Время старта <span class="required">*</span></label>
                        <input type="time" id="time_start" step="60">
                        <div id="error_time_start" class="error-message">Выберите время (ЧЧ:ММ)</div>
                    </div>
                    <div class="form-group">
                        <label>⏰ Время окончания <span class="required">*</span></label>
                        <input type="time" id="time_end" step="60">
                        <div id="error_time_end" class="error-message">Выберите время (ЧЧ:ММ)</div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>📍 Город отправления <span class="required">*</span></label>
                        <input type="text" id="from_city" placeholder="Начните вводить город..." autocomplete="off">
                        <div id="error_from_city" class="error-message">Обязательное поле</div>
                    </div>
                    <div class="form-group">
                      <label>🗺️ Штат/Страна <span class="required">*</span></label>
                      <input type="text" id="from_state" placeholder="Миссури" autocomplete="off">
                      <div id="stateHint" class="unit-hint" style="font-size: 0.8rem; margin-top: 4px;">🏛️ Введите штат (например: California, Texas)</div>
                      <div id="error_from_state" class="error-message">Обязательное поле</div>
                  </div>
                </div>
                <div class="form-group">
                    <label>🏢 База отправления <span class="required">*</span></label>
                    <input type="text" id="from_base" placeholder="Начните вводить базу..." autocomplete="off">
                    <div id="error_from_base" class="error-message">Обязательное поле</div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>📍 Город назначения <span class="required">*</span></label>
                        <input type="text" id="to_city" placeholder="Начните вводить город..." autocomplete="off">
                        <div id="error_to_city" class="error-message">Обязательное поле</div>
                    </div>
                    <div class="form-group">
                        <label>🗺️ Штат/Страна <span class="required">*</span></label>
                        <input type="text" id="to_state" placeholder="Орегон" autocomplete="off">
                        <div id="stateHint2" class="unit-hint" style="font-size: 0.8rem; margin-top: 4px;">🏛️ Введите штат (например: California, Texas)</div>
                        <div id="error_to_state" class="error-message">Обязательное поле</div>
                    </div>
                </div>
                <div class="form-group">
                    <label>🏢 База назначения <span class="required">*</span></label>
                    <input type="text" id="to_base" placeholder="Начните вводить базу..." autocomplete="off">
                    <div id="error_to_base" class="error-message">Обязательное поле</div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>📏 Дистанция <span class="required">*</span></label>
                        <input type="number" id="distance" placeholder="1670" step="1" min="1" autocomplete="off">
                        <div id="unitHint" class="unit-hint">⛽ Введите расстояние в милях (только число)</div>
                        <div id="error_distance" class="error-message">Введите число больше 0</div>
                    </div>
                    <div class="form-group">
                        <label>📦 Название груза <span class="required">*</span></label>
                        <input type="text" id="cargo_name" placeholder="Начните вводить груз..." autocomplete="off">
                        <div id="error_cargo_name" class="error-message">Обязательное поле</div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>🆔 ID груза <span class="required">*</span></label>
                        <input type="text" id="cargo_id" placeholder="cars_mix" autocomplete="off">
                        <div id="error_cargo_id" class="error-message">Обязательное поле</div>
                    </div>
                    <div class="form-group">
                        <label>🔧 Trucky код</label>
                        <input type="text" id="trucky_code" placeholder="ABC123 (опционально)" autocomplete="off">
                    </div>
                </div>
                <div class="form-group">
                    <label>📝 Статус</label>
                    <select id="status">
                        <option value="upcoming">🟡 Запланирован</option>
                        <option value="active">🟢 Активен</option>
                        <option value="ended">⚪ Завершён</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>📝 Примечание</label>
                    <textarea id="notes" rows="2" placeholder="Дополнительная информация..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary">➕ Создать конвой</button>
            </form>
            <hr>
            <h2>📋 Список конвоев</h2>
            <div id="convoyList">Загрузка...</div>
        </div>
    `;

  document.getElementById("convoyForm").addEventListener("submit", addConvoy);
  updateDistanceUnit();
  loadConvoys();
  setDefaultDateTime();

  // Загружаем данные
  await reloadAllData();

  // Загружаем базы данных стран
  await Promise.all([loadCountriesETS2(), loadCountriesATS()]);

  // Инициализация автозаполнения
  initCargoAutocomplete();
  initCityAutocompleteWithState("from_city", "from_state");
  initCityAutocompleteWithState("to_city", "to_state");
  initStateAutocomplete("from_state");
  initStateAutocomplete("to_state");
  initCompanyAutocomplete("from_base");
  initCompanyAutocomplete("to_base");
  addCityManualExtraction("from_city", "from_state");
  addCityManualExtraction("to_city", "to_state");

  // Инициализация импорта файла
  const fileInput = document.getElementById("jobFileInput");
  const importPreview = document.getElementById("importPreview");

  if (fileInput) {
    fileInput.addEventListener("change", async function (e) {
      const file = e.target.files[0];
      if (!file) return;

      importPreview.style.display = "block";
      importPreview.innerHTML =
        '<div><span class="loading-spinner-small"></span> Анализ файла...</div>';

      try {
        const importData = await handleJobImport(file);

        let previewHtml =
          '<strong>📋 Найдено в файле:</strong><div class="info-row">';
        let foundCount = 0;

        if (importData.cargo_name) {
          previewHtml += `📦 Груз: <span>${importData.cargo_name}</span> (${importData.cargo_id})<br>`;
          foundCount++;
        } else if (importData.cargo_id) {
          previewHtml += `📦 ID груза: <span>${importData.cargo_id}</span><br>`;
        }

        if (importData.source_city_display) {
          previewHtml += `📍 Город отправления: <span>${importData.source_city_display}</span><br>`;
          foundCount++;
        } else if (importData.source_city) {
          previewHtml += `📍 ID города отправления: <span>${importData.source_city}</span><br>`;
        }

        if (importData.target_city_display) {
          previewHtml += `📍 Город назначения: <span>${importData.target_city_display}</span><br>`;
          foundCount++;
        } else if (importData.target_city) {
          previewHtml += `📍 ID города назначения: <span>${importData.target_city}</span><br>`;
        }

        if (importData.source_company_name) {
          previewHtml += `🏢 База отправления: <span>${importData.source_company_name}</span><br>`;
          foundCount++;
        } else if (importData.source_company) {
          previewHtml += `🏢 ID компании отправления: <span>${importData.source_company}</span><br>`;
        }

        if (importData.target_company_name) {
          previewHtml += `🏢 База назначения: <span>${importData.target_company_name}</span><br>`;
          foundCount++;
        } else if (importData.target_company) {
          previewHtml += `🏢 ID компании назначения: <span>${importData.target_company}</span><br>`;
        }

        if (importData.distance) {
          previewHtml += `📏 Дистанция: <span>${importData.distance} км</span><br>`;
          foundCount++;
        }

        if (importData.cargo_mass) {
          previewHtml += `⚖️ Вес груза: <span>${importData.cargo_mass} кг</span><br>`;
          foundCount++;
        }

        previewHtml += "</div>";

        if (foundCount > 0) {
          previewHtml +=
            '<button type="button" id="applyImportBtn" class="btn btn-secondary" style="margin-top: 10px; padding: 6px 12px; font-size: 0.85rem;">✅ Применить к форме</button>';
        } else {
          previewHtml +=
            '<div style="color: #e74c3c; margin-top: 10px;">⚠️ Совпадений не найдено. Проверьте наличие ID в файлах баз данных.</div>';
        }

        importPreview.innerHTML = previewHtml;

        const applyBtn = document.getElementById("applyImportBtn");
        if (applyBtn) {
          applyBtn.addEventListener("click", () => {
            fillFormWithImportData(importData);
            importPreview.style.display = "none";
            fileInput.value = "";
            alert("✅ Данные импортированы в форму!");
          });
        }
      } catch (error) {
        console.error("Ошибка импорта:", error);
        importPreview.innerHTML =
          "<strong>❌ Ошибка при разборе файла</strong>";
      }
    });
  }

  // Очистка ошибок
  const inputs = document.querySelectorAll(
    "#convoyForm input, #convoyForm select, #convoyForm textarea",
  );
  inputs.forEach((input) => {
    input.addEventListener("input", function () {
      this.classList.remove("error");
      const errorDiv = document.getElementById(`error_${this.id}`);
      if (errorDiv) errorDiv.classList.remove("show");
    });
  });
}

// Запуск приложения
if (supabaseClient.checkSession()) {
  renderAdminPanel();
} else {
  renderLoginPage();
}

// Делаем функции глобальными
window.deleteConvoy = deleteConvoy;
window.updateStatus = updateStatus;
window.logout = logout;
