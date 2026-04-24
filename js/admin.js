// ========== НАСТРОЙКИ SUPABASE ==========
const SUPABASE_URL = "https://vpcxtuwhrpgcgdipgnxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwY3h0dXdocnBnY2dkaXBnbnh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDM0MzgsImV4cCI6MjA5MjQxOTQzOH0.-l17k9yaD2Gx6fXEBSoBCVMoyevVVVOjHCxO51qvlTE";
// ========================================

let currentConvoys = [];
let currentUser = null;

// Базы данных из txt файлов
let cargoDatabase = [];
let citiesDatabase = [];
let companiesDatabase = [];

// Флаги загрузки
let cargoLoaded = false;
let citiesLoaded = false;
let companiesLoaded = false;

// Supabase клиент
const supabaseClient = {
    async request(endpoint, options = {}) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
            ...options,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': currentUser ? `Bearer ${currentUser.access_token}` : `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return response;
    },
    async get(endpoint) {
        const res = await this.request(endpoint);
        return res.json();
    },
    async post(endpoint, data) {
        const res = await this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
        return res;
    },
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },
    async patch(endpoint, data) {
        return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async signIn(email, password) {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (response.ok) {
            const data = await response.json();
            currentUser = data;
            localStorage.setItem('supabase_session', JSON.stringify(data));
            return { success: true };
        }
        return { success: false, error: 'Неверный email или пароль' };
    },
    signOut() {
        currentUser = null;
        localStorage.removeItem('supabase_session');
    },
    checkSession() {
        const session = localStorage.getItem('supabase_session');
        if (session) {
            currentUser = JSON.parse(session);
            return true;
        }
        return false;
    }
};

// Загрузка словарей из txt файлов
async function loadDictionaryFromTxt(files, storageArrayName, storageLoadedFlagName) {
    if (window[storageLoadedFlagName]) {
        console.log(`📦 Данные уже загружены: ${window[storageArrayName].length} записей`);
        return window[storageArrayName];
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
        if (line === "" || line.startsWith('[')) continue;
        
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        
        let id = line.substring(0, colonIndex).trim();
        let name = line.substring(colonIndex + 1).trim();
        name = name.replace(/^["']|["']$/g, '').replace(/;$/, '');
        
        if (id && name) {
            map.set(id, { id, name });
        }
    }
    
    window[storageArrayName] = Array.from(map.values());
    window[storageLoadedFlagName] = true;
    console.log(`✅ Загружено ${window[storageArrayName].length} записей из ${files.join(', ')}`);
    return window[storageArrayName];
}

async function loadCargo() {
    return loadDictionaryFromTxt(['data/cargo.txt', 'data/cargo_my.txt'], 'cargoDatabase', 'cargoLoaded');
}

async function loadCities() {
    return loadDictionaryFromTxt(['data/cities.txt', 'data/cities_my.txt'], 'citiesDatabase', 'citiesLoaded');
}

async function loadCompanies() {
    return loadDictionaryFromTxt(['data/companies.txt', 'data/companies_my.txt'], 'companiesDatabase', 'companiesLoaded');
}

// Автозаполнение для городов
function initCityAutocomplete(inputId) {
    const input = document.getElementById(inputId);
    if (!input) {
        console.error(`❌ Элемент с id="${inputId}" не найден для автозаполнения`);
        return;
    }
    
    console.log(`✅ Инициализация автозаполнения для ${inputId}`);
    
    // Удаляем старый обработчик
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    const freshInput = document.getElementById(inputId);
    
    freshInput.addEventListener('input', async function(e) {
        const val = this.value.trim();
        console.log(`🔍 Ввод в ${inputId}: "${val}"`);
        
        const existingDiv = this.parentNode.querySelector('.autocomplete-items');
        if (existingDiv) existingDiv.remove();
        
        if (val.length === 0) return;
        
        // Проверяем и загружаем данные
        let cities = window.citiesDatabase;
        if (!window.citiesLoaded || cities.length === 0) {
            console.log('⏳ Загрузка городов...');
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'autocomplete-items';
            loadingDiv.innerHTML = `<div style="color:#888;"><span class="loading-spinner-small"></span> Загрузка городов...</div>`;
            this.parentNode.appendChild(loadingDiv);
            cities = await loadCities();
            loadingDiv.remove();
            console.log(`✅ Города загружены: ${cities.length} записей`);
        }
        
        const searchVal = val.toLowerCase();
        let matches = cities.filter(item => 
            item.name.toLowerCase().includes(searchVal) || 
            item.id.toLowerCase().includes(searchVal)
        );
        
        console.log(`📊 Найдено совпадений: ${matches.length}`);
        
        if (matches.length === 0) return;
        
        matches = matches.slice(0, 15);
        
        matches.sort((a, b) => {
            const aStarts = a.name.toLowerCase().startsWith(searchVal);
            const bStarts = b.name.toLowerCase().startsWith(searchVal);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.name.localeCompare(b.name);
        });
        
        const autocompleteDiv = document.createElement('div');
        autocompleteDiv.className = 'autocomplete-items';
        
        matches.forEach(match => {
            const div = document.createElement('div');
            div.innerHTML = `${match.name} [${match.id}]`;
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                freshInput.value = `${match.name} [${match.id}]`;
                autocompleteDiv.remove();
                freshInput.dispatchEvent(new Event('input'));
                console.log(`✅ Выбран город: ${match.name} [${match.id}]`);
            });
            autocompleteDiv.appendChild(div);
        });
        
        this.parentNode.appendChild(autocompleteDiv);
    });
    
    document.addEventListener('click', function(e) {
        if (!freshInput.contains(e.target)) {
            const items = freshInput.parentNode.querySelectorAll('.autocomplete-items');
            items.forEach(el => el.remove());
        }
    });
}

// Автозаполнение для компаний
function initCompanyAutocomplete(inputId) {
    const input = document.getElementById(inputId);
    if (!input) {
        console.error(`❌ Элемент с id="${inputId}" не найден для автозаполнения`);
        return;
    }
    
    console.log(`✅ Инициализация автозаполнения для ${inputId}`);
    
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    const freshInput = document.getElementById(inputId);
    
    freshInput.addEventListener('input', async function(e) {
        const val = this.value.trim();
        const existingDiv = this.parentNode.querySelector('.autocomplete-items');
        if (existingDiv) existingDiv.remove();
        
        if (val.length === 0) return;
        
        let companies = window.companiesDatabase;
        if (!window.companiesLoaded || companies.length === 0) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'autocomplete-items';
            loadingDiv.innerHTML = `<div style="color:#888;"><span class="loading-spinner-small"></span> Загрузка компаний...</div>`;
            this.parentNode.appendChild(loadingDiv);
            companies = await loadCompanies();
            loadingDiv.remove();
        }
        
        const searchVal = val.toLowerCase();
        let matches = companies.filter(item => 
            item.name.toLowerCase().includes(searchVal) || 
            item.id.toLowerCase().includes(searchVal)
        );
        
        if (matches.length === 0) return;
        
        matches = matches.slice(0, 15);
        matches.sort((a, b) => a.name.localeCompare(b.name));
        
        const autocompleteDiv = document.createElement('div');
        autocompleteDiv.className = 'autocomplete-items';
        
        matches.forEach(match => {
            const div = document.createElement('div');
            div.innerHTML = `${match.name} (${match.id})`;
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                freshInput.value = `${match.name} (${match.id})`;
                autocompleteDiv.remove();
                freshInput.dispatchEvent(new Event('input'));
            });
            autocompleteDiv.appendChild(div);
        });
        
        this.parentNode.appendChild(autocompleteDiv);
    });
    
    document.addEventListener('click', function(e) {
        if (!freshInput.contains(e.target)) {
            const items = freshInput.parentNode.querySelectorAll('.autocomplete-items');
            items.forEach(el => el.remove());
        }
    });
}

// Автозаполнение для грузов
function initCargoAutocomplete() {
    const cargoNameInput = document.getElementById('cargo_name');
    const cargoIdInput = document.getElementById('cargo_id');
    
    if (!cargoNameInput || !cargoIdInput) {
        console.error('❌ Элементы cargo_name или cargo_id не найдены');
        return;
    }
    
    console.log('✅ Инициализация автозаполнения для грузов');
    
    const newNameInput = cargoNameInput.cloneNode(true);
    cargoNameInput.parentNode.replaceChild(newNameInput, cargoNameInput);
    const freshNameInput = document.getElementById('cargo_name');
    const freshIdInput = document.getElementById('cargo_id');
    
    freshNameInput.addEventListener('input', async function(e) {
        const val = this.value.trim();
        const existingDiv = this.parentNode.querySelector('.autocomplete-items');
        if (existingDiv) existingDiv.remove();
        
        if (val.length === 0) return;
        
        let cargo = window.cargoDatabase;
        if (!window.cargoLoaded || cargo.length === 0) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'autocomplete-items';
            loadingDiv.innerHTML = `<div style="color:#888;"><span class="loading-spinner-small"></span> Загрузка грузов...</div>`;
            this.parentNode.appendChild(loadingDiv);
            cargo = await loadCargo();
            loadingDiv.remove();
        }
        
        const searchVal = val.toLowerCase();
        let matches = cargo.filter(item => 
            item.name.toLowerCase().includes(searchVal) || 
            item.id.toLowerCase().includes(searchVal)
        );
        
        if (matches.length === 0) return;
        
        matches = matches.slice(0, 15);
        matches.sort((a, b) => {
            const aStarts = a.name.toLowerCase().startsWith(searchVal);
            const bStarts = b.name.toLowerCase().startsWith(searchVal);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.name.localeCompare(b.name);
        });
        
        const autocompleteDiv = document.createElement('div');
        autocompleteDiv.className = 'autocomplete-items';
        
        matches.forEach(match => {
            const sameNameCount = cargo.filter(c => c.name === match.name).length;
            const dupHint = sameNameCount > 1 ? ` ⚠️ дубль (${sameNameCount})` : '';
            const div = document.createElement('div');
            div.innerHTML = `${match.name} (${match.id})${dupHint}`;
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                freshNameInput.value = match.name;
                freshIdInput.value = match.id;
                autocompleteDiv.remove();
                freshNameInput.dispatchEvent(new Event('input'));
                freshIdInput.dispatchEvent(new Event('input'));
            });
            autocompleteDiv.appendChild(div);
        });
        
        this.parentNode.appendChild(autocompleteDiv);
    });
    
    freshIdInput.addEventListener('input', async function() {
        let cargo = window.cargoDatabase;
        if (!window.cargoLoaded || cargo.length === 0) {
            cargo = await loadCargo();
        }
        const found = cargo.find(c => c.id === this.value.trim());
        if (found && freshNameInput.value !== found.name) {
            freshNameInput.value = found.name;
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!freshNameInput.contains(e.target)) {
            const items = freshNameInput.parentNode.querySelectorAll('.autocomplete-items');
            items.forEach(el => el.remove());
        }
    });
}

// Загрузка конвоев
async function loadConvoys() {
    const data = await supabaseClient.get('convoys?select=*&order=id.desc');
    currentConvoys = data;
    renderConvoyList();
}

// Обновление единицы измерения расстояния
function updateDistanceUnit() {
    const gameSelect = document.getElementById('game');
    const distanceInput = document.getElementById('distance');
    const unitHint = document.getElementById('unitHint');
    
    if (gameSelect && distanceInput && unitHint) {
        const isATS = gameSelect.value === 'ATS';
        if (isATS) {
            unitHint.textContent = '⛽ Введите расстояние в милях (только число)';
            distanceInput.placeholder = '1670';
        } else {
            unitHint.textContent = '🛣️ Введите расстояние в километрах (только число)';
            distanceInput.placeholder = '1050';
        }
    }
}

// Валидация формы
function validateForm() {
    let isValid = true;
    
    const requiredFields = [
        'game', 'date', 'time_start', 'time_end',
        'from_city', 'from_state', 'from_base',
        'to_city', 'to_state', 'to_base',
        'distance', 'cargo_name', 'cargo_id'
    ];
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(`error_${fieldId}`);
        if (field && !field.value.trim()) {
            field.classList.add('error');
            if (errorDiv) errorDiv.classList.add('show');
            isValid = false;
        } else {
            field?.classList.remove('error');
            if (errorDiv) errorDiv.classList.remove('show');
        }
    });
    
    const timeStart = document.getElementById('time_start').value;
    const timeEnd = document.getElementById('time_end').value;
    const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!timePattern.test(timeStart)) {
        document.getElementById('time_start').classList.add('error');
        document.getElementById('error_time_start').classList.add('show');
        isValid = false;
    }
    if (!timePattern.test(timeEnd)) {
        document.getElementById('time_end').classList.add('error');
        document.getElementById('error_time_end').classList.add('show');
        isValid = false;
    }
    
    const distance = document.getElementById('distance').value;
    if (!/^\d+$/.test(distance) || parseInt(distance) < 1) {
        document.getElementById('distance').classList.add('error');
        document.getElementById('error_distance').classList.add('show');
        isValid = false;
    }
    return isValid;
}

// Добавление конвоя
async function addConvoy(event) {
    event.preventDefault();
    if (!validateForm()) {
        alert('❌ Пожалуйста, заполните все обязательные поля правильно');
        return;
    }
    
    const game = document.getElementById('game').value;
    const distanceValue = document.getElementById('distance').value;
    const distance = game === 'ATS' ? `${distanceValue} миль` : `${distanceValue} км`;
    
    const newConvoy = {
        game: game,
        status: document.getElementById('status').value,
        date: document.getElementById('date').value,
        time_start: document.getElementById('time_start').value,
        time_end: document.getElementById('time_end').value,
        from_city: document.getElementById('from_city').value,
        from_state: document.getElementById('from_state').value,
        from_base: document.getElementById('from_base').value,
        to_city: document.getElementById('to_city').value,
        to_state: document.getElementById('to_state').value,
        to_base: document.getElementById('to_base').value,
        distance: distance,
        cargo_name: document.getElementById('cargo_name').value,
        cargo_id: document.getElementById('cargo_id').value,
        trucky_code: document.getElementById('trucky_code').value,
        cargoman_file: document.getElementById('cargoman_file').value,
        notes: document.getElementById('notes').value
    };
    
    await supabaseClient.post('convoys', newConvoy);
    document.getElementById('convoyForm').reset();
    document.getElementById('distance').value = '';
    updateDistanceUnit();
    loadConvoys();
    
    const successMsg = document.getElementById('successMsg');
    if (successMsg) {
        successMsg.textContent = '✅ Конвой успешно создан!';
        setTimeout(() => successMsg.textContent = '', 3000);
    }
}

// Удаление конвоя
async function deleteConvoy(id) {
    if (!confirm('Удалить конвой?')) return;
    await supabaseClient.delete(`convoys?id=eq.${id}`);
    loadConvoys();
    alert('✅ Конвой удалён');
}

// Обновление статуса
async function updateStatus(id, newStatus) {
    await supabaseClient.patch(`convoys?id=eq.${id}`, { status: newStatus });
    loadConvoys();
}

// Отображение списка конвоев
function renderConvoyList() {
    const container = document.getElementById('convoyList');
    if (!container) return;
    
    if (!currentConvoys || currentConvoys.length === 0) {
        container.innerHTML = '<p>📭 Нет конвоев</p>';
        return;
    }
    
    container.innerHTML = currentConvoys.map(convoy => `
        <div class="convoy-item">
            <div class="convoy-info">
                <div class="convoy-title">🚛 ${convoy.game} | ${convoy.from_city} → ${convoy.to_city}</div>
                <div class="convoy-meta">⏰ ${convoy.time_start} - ${convoy.time_end} | 📦 ${convoy.cargo_name} (${convoy.cargo_id}) | ${convoy.distance}</div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <select class="status-select" onchange="updateStatus(${convoy.id}, this.value)">
                    <option value="active" ${convoy.status === 'active' ? 'selected' : ''}>🟢 Активен</option>
                    <option value="upcoming" ${convoy.status === 'upcoming' ? 'selected' : ''}>🟡 Запланирован</option>
                    <option value="ended" ${convoy.status === 'ended' ? 'selected' : ''}>⚪ Завершён</option>
                </select>
                <button onclick="deleteConvoy(${convoy.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Обработка входа
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const result = await supabaseClient.signIn(email, password);
    if (result.success) {
        renderAdminPanel();
    } else {
        document.getElementById('loginError').textContent = result.error;
    }
}

// Выход
function logout() {
    supabaseClient.signOut();
    renderLoginPage();
}

// Страница входа
function renderLoginPage() {
    document.getElementById('app').innerHTML = `
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
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

// Админ панель
async function renderAdminPanel() {
    document.getElementById('app').innerHTML = `
        <div class="admin-panel">
            <div class="clearfix">
                <button class="logout-btn" onclick="logout()">🚪 Выйти</button>
            </div>
            <h2 style="margin-bottom: 20px;">➕ Создать конвой</h2>
            <div id="successMsg" class="success-msg"></div>
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
                    <label>📦 CargoMan ссылка</label>
                    <input type="url" id="cargoman_file" placeholder="https://example.com/file.json (опционально)" autocomplete="off">
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
    
    document.getElementById('convoyForm').addEventListener('submit', addConvoy);
    updateDistanceUnit();
    loadConvoys();
    
    // Предзагружаем данные
    await Promise.all([loadCargo(), loadCities(), loadCompanies()]);
    
    // Инициализация автозаполнения
    initCargoAutocomplete();
    initCityAutocomplete('from_city');
    initCityAutocomplete('to_city');
    initCompanyAutocomplete('from_base');
    initCompanyAutocomplete('to_base');
    
    console.log('✅ Автозаполнение инициализировано');
    console.log(`📊 Статистика: города=${citiesDatabase.length}, грузы=${cargoDatabase.length}, компании=${companiesDatabase.length}`);
    
    // Очистка ошибок
    const inputs = document.querySelectorAll('#convoyForm input, #convoyForm select, #convoyForm textarea');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('error');
            const errorDiv = document.getElementById(`error_${this.id}`);
            if (errorDiv) errorDiv.classList.remove('show');
        });
    });
}

// Запуск приложения
if (supabaseClient.checkSession()) {
    renderAdminPanel();
} else {
    renderLoginPage();
}

// Делаем функции глобальными для вызова из HTML
window.deleteConvoy = deleteConvoy;
window.updateStatus = updateStatus;
window.logout = logout;