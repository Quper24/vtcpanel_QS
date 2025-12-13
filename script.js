let rawData;
let currentData = [];
let sortKey = null;
let sortDir = 1;

fetch("data.json")
  .then((res) => res.json())
  .then((data) => {
    rawData = data.employees;
    initDates();
  });

function initDates() {
  const select = document.getElementById("dateSelect");
  Object.keys(rawData)
    .sort(
      (a, b) =>
        new Date(a.split(".").reverse().join("-")) -
        new Date(b.split(".").reverse().join("-")),
    )
    .forEach((date) => {
      const option = document.createElement("option");
      option.value = date;
      option.textContent = date;
      select.appendChild(option);
    });

  select.addEventListener("change", () => {
    loadDate(select.value);
  });

  loadDate(select.value);
}

function loadDate(date) {
  currentData = [...rawData[date]];
  renderTable();
}

function renderTable() {
  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";

  currentData.forEach((item) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><img class="avatar" src="${item.image_url}" alt=""></td>
      <td><a href="https://vtcpanel.com/id${item.id_user}" target="_blank">${
      item.steam_name
    }</a></td>
      <td>${item.name}</td>
      <td>${item.family}</td>
      <td>${item.country}</td>
      <td>${item.city}</td>
      <td class="number">${Number(item.pokazatel)}</td>
      <td class="number">${item.year}</td>
      <td class="number">${item.karma}</td>
      <td class="number">${item.karma_vtc}</td>
      <td class="number">${item.point_m}</td>
      <td class="number">${item.point}</td>
    `;

    tbody.appendChild(tr);
  });
}

function sortBy(key) {
  if (sortKey === key) {
    sortDir *= -1;
  } else {
    sortKey = key;
    sortDir = 1;
  }

  currentData.sort((a, b) => {
    let valA = a[key];
    let valB = b[key];

    if (!isNaN(valA) && !isNaN(valB)) {
      return (Number(valA) - Number(valB)) * sortDir;
    }

    return String(valA).localeCompare(String(valB), "ru") * sortDir;
  });

  renderTable();
}

document.querySelectorAll("th").forEach((th) => {
  const key = th.dataset.key;
  if (!key || key === "image_url") return;

  th.addEventListener("click", () => sortBy(key));
});
