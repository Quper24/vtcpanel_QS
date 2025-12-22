let rawData;
let currentDate;
let compareDate;
let currentData = [];
let sortKey = null;
let sortDir = 1;
let sortDiff = false;

fetch("data.json")
  .then((r) => r.json())
  .then((data) => {
    rawData = data.employees;
    initDates();
  });

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

  main.value = dates[dates.length - 2] || dates[dates.length - 1];
  cmp.value = dates[dates.length - 1];

  currentDate = main.value;
  compareDate = cmp.value;

  main.onchange = () => {
    currentDate = main.value;
    updateData();
  };

  cmp.onchange = () => {
    compareDate = cmp.value;
    updateData();
  };

  updateData();
}

function getDiff(id, field) {
  const cur = rawData[currentDate]?.find((u) => u.id_user === id);
  const cmp = rawData[compareDate]?.find((u) => u.id_user === id);

  // новый водитель
  if (cmp && !cur) {
    return {
      type: "new",
      value: cmp[field] ?? 0,
      diff: cmp[field] ?? 0,
    };
  }

  // водитель был, но ушёл (обычно не рендерится)
  if (cur && !cmp) {
    return {
      type: "left",
      value: null,
      diff: -(cur[field] ?? 0),
    };
  }

  // есть в обеих датах
  const a = Number(cur?.[field] ?? 0);
  const b = Number(cmp?.[field] ?? 0);

  return {
    type: "normal",
    value: b,
    diff: a - b,
  };
}

function valueWithDiff(data) {
  if (data.type === "new") {
    return `
      ${data.value}
      <span class="diff plus">NEW</span>
    `;
  }

  if (data.type === "left") {
    return `<span class="diff minus">LEFT</span>`;
  }

  if (data.diff === 0) {
    return `${data.value} <span class="diff zero">(0)</span>`;
  }

  const cls = data.diff < 0 ? "plus" : "minus";
  const sign = data.diff < 0 ? "+" : "";

  return `
    ${data.value}
    <span class="diff ${cls}">
      (${sign}${data.diff.toFixed(2)})
    </span>
  `;
}

function updateData() {
  currentData = [...rawData[currentDate]];

  // если сортировка уже выбрана — применяем её снова
  if (sortKey) {
    sortBy(sortKey, sortDiff);
  } else {
    renderTable();
  }
}

function renderTable() {
  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";

  currentData.forEach((u) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
  <td><img class="avatar" src="${u.image_url}"></td>
  <td><a href="https://vtcpanel.com/id${u.id_user}" target="_blank">${
      u.steam_name
    }</a></td>
  <td>${u.name}</td>
  <td>${u.family}</td>
  <td>${u.country}</td>
  <td>${u.city}</td>
  
  
  <td class="number">${u.pokazatel}</td>
  <td class="number">
    ${valueWithDiff(getDiff(u.id_user, "pokazatel"))}
  </td>
  
  
  <td class="number">${u.karma}</td>
  <td class="number">
    ${valueWithDiff(getDiff(u.id_user, "karma"))}
  </td>
  
  <td class="number">${u.karma_vtc}</td>
  <td class="number">
    ${valueWithDiff(getDiff(u.id_user, "karma_vtc"))}
  </td>
  
  <td class="number">${u.point_m}</td>
  <td class="number">
    ${valueWithDiff(getDiff(u.id_user, "point_m"))}
  </td>

  
  <td class="number">${u.point}</td>
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
    const A = isDiff ? getDiff(a.id_user, key).diff : a[key];
    const B = isDiff ? getDiff(b.id_user, key).diff : b[key];
    return (Number(A) - Number(B)) * sortDir;
  });

  renderTable();
}

document.querySelectorAll("th").forEach((th) => {
  const key = th.dataset.key;
  if (!key) return;
  th.onclick = () => sortBy(key, th.dataset.diff === "true");
});
