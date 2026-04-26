// ========== НАСТРОЙКИ SUPABASE ==========
const SUPABASE_URL = "https://vpcxtuwhrpgcgdipgnxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwY3h0dXdocnBnY2dkaXBnbnh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDM0MzgsImV4cCI6MjA5MjQxOTQzOH0.-l17k9yaD2Gx6fXEBSoBCVMoyevVVVOjHCxO51qvlTE";
// =========================================================

let allConvoys = [];

async function loadConvoys() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/convoys?select=*&order=id.desc`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) throw new Error('Ошибка загрузки');
    allConvoys = await response.json();
    renderConvoys('all');
  } catch (error) {
    document.getElementById('convoyGrid').innerHTML = `
      <div class="empty-state">
        <h3>❌ Ошибка загрузки</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function getStatusText(status) {
  switch (status) {
    case 'active': return '🟢 Активен';
    case 'upcoming': return '🟡 Запланирован';
    case 'ended': return '⚪ Завершён';
    default: return '🟡 Запланирован';
  }
}

// Функция для открытия ссылки в новой вкладке
function openLink(url, name) {
  if (!url) {
    alert(`❌ ${name}: ссылка не найдена`);
    return;
  }
  
  // Проверяем, что ссылка валидная
  if (url.startsWith('http://') || url.startsWith('https://')) {
    window.open(url, '_blank');
  } else {
    // Если ссылка без протокола, добавляем https://
    window.open('https://' + url, '_blank');
  }
}

function renderConvoys(filter) {
  const grid = document.getElementById('convoyGrid');

  let filtered = [...allConvoys];

  if (filter !== 'all') {
    if (filter === 'active') {
      filtered = filtered.filter(c => c.status === 'active');
    } else if (filter === 'upcoming') {
      filtered = filtered.filter(c => c.status === 'upcoming' || !c.status);
    } else if (filter === 'ended') {
      filtered = filtered.filter(c => c.status === 'ended');
    } else {
      filtered = filtered.filter(c => c.game === filter);
    }
  }

  const statusOrder = { 'active': 0, 'upcoming': 1, 'ended': 2 };
  filtered.sort((a, b) => (statusOrder[a.status] || 1) - (statusOrder[b.status] || 1));

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><h3>📭 Нет конвоев</h3><p>В выбранной категории пока нет конвоев</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(convoy => {
    const status = convoy.status || 'upcoming';
    const statusText = getStatusText(status);

    // ПОКАЗЫВАЕМ для активных И запланированных (если есть trucky_code или cargoman_file)
    const showLinks = (status !== 'ended') && (convoy.trucky_code || convoy.cargoman_file);
    const creationLinks = showLinks ? `
      <div class="creation-links">
        <h4>🔧 Создать заказ:</h4>
        <div class="link-buttons">
          ${convoy.trucky_code ? `<button class="link-btn trucky" onclick="copyToClipboard('${escapeHtml(convoy.trucky_code).replace(/'/g, "\\'")}', 'Trucky код')">🚛 Trucky | ${escapeHtml(convoy.trucky_code)}</button>` : ''}
          ${convoy.cargoman_file ? `<button class="link-btn cargoman" onclick="openLink('${escapeHtml(convoy.cargoman_file).replace(/'/g, "\\'")}', 'CargoMan ссылка')">📦 CargoMan | Открыть ссылку</button>` : ''}
        </div>
      </div>
    ` : '';

    return `
      <div class="convoy-card">
        <div class="card-header ${escapeHtml(convoy.game)}">
          <div class="game-badge ${escapeHtml(convoy.game)}">${convoy.game === 'ATS' ? 'ATS' : 'ETS2'}</div>
          <h3>${escapeHtml(convoy.from_city)} → ${escapeHtml(convoy.to_city)}</h3>
          <div class="time-range">
            📅 ${escapeHtml(convoy.date)} | ⏰ ${escapeHtml(convoy.time_start)} - ${escapeHtml(convoy.time_end)} МСК
            <span class="status-badge status-${status}">${statusText}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="route">
            <div class="route-item"><div class="route-icon">📍</div><div class="route-text"><strong>Откуда:</strong> ${escapeHtml(convoy.from_city)} (${escapeHtml(convoy.from_state)}), ${escapeHtml(convoy.from_base)}</div></div>
            <div class="route-item"><div class="route-icon">🏁</div><div class="route-text"><strong>Куда:</strong> ${escapeHtml(convoy.to_city)} (${escapeHtml(convoy.to_state)}), ${escapeHtml(convoy.to_base)}</div></div>
          </div>
          <div class="cargo">
            <div class="cargo-item"><span class="cargo-label">📦 Груз:</span><span>${escapeHtml(convoy.cargo_name)}</span></div>
            <div class="cargo-item"><span class="cargo-label">🆔 ID груза:</span><span>${escapeHtml(convoy.cargo_id)}</span></div>
            <div class="cargo-item"><span class="cargo-label">📏 Дистанция:</span><span>${escapeHtml(convoy.distance)}</span></div>
          </div>
          ${creationLinks}
          ${convoy.notes ? `<div class="info-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ecf0f1;"><span class="cargo-label">📝 Примечание:</span><span>${escapeHtml(convoy.notes)}</span></div>` : ''}
        </div>
        <div class="card-footer">
          <button class="join-btn" onclick="copyConvoyMessage(${convoy.id})">📋 Скопировать в чат</button>
        </div>
      </div>
    `;
  }).join('');
}

// Простая защита от XSS
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

async function copyConvoyMessage(id) {
  const convoy = allConvoys.find(c => c.id === id);
  if (!convoy) return;

  const status = convoy.status || 'upcoming';
  const statusEmoji = status === 'active' ? '🟢 АКТИВЕН' : (status === 'upcoming' ? '🟡 ПРЕДСТОИТ' : '⚪ ЗАВЕРШЁН');

  // Вычисляем время закрытия конвоя (time_end + 3 часа)
  const timeEndDate = new Date(`2000-01-01T${convoy.time_end}:00`);
  timeEndDate.setHours(timeEndDate.getHours() + 3);
  const closeTime = timeEndDate.toTimeString().slice(0, 5);

  let message = `🚛 LONG CONVOY в ${convoy.game} ${statusEmoji}\n\n⏰ Взять груз можно с **${convoy.time_start}** до **${convoy.time_end}** (МСК)\n⏰ Сдавать груз не раньше **${convoy.time_end}** (МСК)\n🖥 В оверлее ВТК панели появится надпись "Конвой"\n\n📍 Откуда: ${convoy.from_city} (${convoy.from_state}), ${convoy.from_base}\n📍 Куда: ${convoy.to_city} (${convoy.to_state}), ${convoy.to_base}\n📏 Дистанция: ${convoy.distance}\n📦 Груз: ${convoy.cargo_name} (${convoy.cargo_id})`;

  if (convoy.trucky_code) {
    message += `\n\n🚛 Trucky код: ${convoy.trucky_code}`;
  }
  if (convoy.cargoman_file) {
    message += `\n\n📦 CargoMan ссылка: ${convoy.cargoman_file}`;
  }

  message += `\n\n👉 Как участвовать:\n- Заходите на сервер и берете мой заказ или создаете через Trucky/Cargoman\n- Можно ехать вместе на сервере или в одиночку\n- В дискорде объясню все детали: https://discord.gg/KbjtTFgbbB\n\n✅ Важно: конвой засчитается всем, кто сдаст груз после **${convoy.time_end}**. Раньше сдавать нельзя, не начислят бонусы.\n\n⚠️ **Важно:** Конвой закроется в **${closeTime}** (МСК) / Если сдавать позже, то бонусы за конвой не получите ⏰\n\n🔗 Подробнее: ${window.location.href}`;

  await navigator.clipboard.writeText(message);
  alert('✅ Информация о конвое скопирована!');
}

function copyToClipboard(text, name) {
  navigator.clipboard.writeText(text);
  alert(`✅ ${name} скопирован!`);
}

// Функция для открытия ссылки в новой вкладке (глобальная для вызова из HTML)
window.openLink = function(url, name) {
  if (!url) {
    alert(`❌ ${name}: ссылка не найдена`);
    return;
  }
  
  // Проверяем, что ссылка валидная
  if (url.startsWith('http://') || url.startsWith('https://')) {
    window.open(url, '_blank');
  } else {
    // Если ссылка без протокола, добавляем https://
    window.open('https://' + url, '_blank');
  }
};

function initFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderConvoys(btn.dataset.filter);
    });
  });
}

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  loadConvoys();
  initFilters();
  setInterval(loadConvoys, 60000);
});