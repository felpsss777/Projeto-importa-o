const state = {
  user: null,
  requests: [],
  users: [],
  currentView: "dashboard",
  filterStatus: "",
  searchText: ""
};

const roleText = {
  requester: "Solicitante",
  approver: "Aprovador",
  import: "Importação Master",
  ti: "TI Admin"
};

const el = (id) => document.getElementById(id);

function badgeClass(status = "") {
  if (status.includes("Aprovado")) return "green";
  if (status.includes("Crítica")) return "red";
  if (status.includes("Reprovado")) return "red";
  if (status.includes("Devolvido")) return "orange";
  if (status.includes("Em análise")) return "blue";
  return "gray";
}

function toast(msg, ok = true) {
  const box = el("toast");
  box.textContent = msg;
  box.style.background = ok ? "#152738" : "#7a1f2a";
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 2500);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro inesperado.");
  return data;
}

function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString("pt-BR");
}

function statusCounts(list) {
  return {
    total: list.length,
    pendentes: list.filter(i => i.status === "Pendente aprovação").length,
    aprovadas: list.filter(i => i.status.includes("Aprovado")).length,
    reprovadas: list.filter(i => i.status.includes("Reprovado")).length
  };
}

function renderLogin() {
  el("loginView").classList.remove("hidden");
  el("appView").classList.add("hidden");
}

function renderAppShell() {
  el("loginView").classList.add("hidden");
  el("appView").classList.remove("hidden");

  el("sidebarUserName").textContent = state.user.name;
  el("sidebarUserRole").textContent = `${roleText[state.user.role]} • ${state.user.team || "Sem equipe"}`;
  el("heroTitle").textContent = `Bem-vindo, ${state.user.name.split(" ")[0]}`;
  el("heroSubtitle").textContent =
    state.user.role === "requester"
      ? "Abra pedidos com rapidez, acompanhe status e histórico em um fluxo elegante."
      : state.user.role === "approver"
      ? "Revise pedidos da sua equipe em uma aba de aprovação clara, dinâmica e segura."
      : state.user.role === "import"
      ? "Dê a cartada final, ajuste quantidades e registre a decisão da importação com total rastreabilidade."
      : "Gerencie acessos, redefina senhas e acompanhe a saúde operacional do app.";

  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  const nav = document.querySelector(`.nav-btn[data-view="${state.currentView}"]`);
  if (nav) nav.classList.add("active");

  renderStats();
  renderView();
}

function renderStats() {
  const c = statusCounts(state.requests);
  el("statTotal").textContent = c.total;
  el("statPendentes").textContent = c.pendentes;
  el("statAprovadas").textContent = c.aprovadas;
  el("statReprovadas").textContent = c.reprovadas;
}

function filteredRequests() {
  return state.requests.filter(item => {
    const okStatus = !state.filterStatus || item.status === state.filterStatus;
    const text = `${item.title} ${item.productCode} ${item.requesterName}`.toLowerCase();
    const okText = !state.searchText || text.includes(state.searchText.toLowerCase());
    return okStatus && okText;
  });
}

function navItems() {
  const base = [{ key: "dashboard", label: "Dashboard" }];
  if (state.user.role === "requester") base.push({ key: "new", label: "Nova solicitação" });
  if (["requester", "approver", "import", "ti"].includes(state.user.role)) base.push({ key: "requests", label: "Solicitações" });
  if (state.user.role === "ti") base.push({ key: "users", label: "Painel TI" });
  return base;
}

function mountNav() {
  el("navArea").innerHTML = navItems().map(item => (
    `<button class="nav-btn ${state.currentView === item.key ? "active":""}" data-view="${item.key}" onclick="changeView('${item.key}')">${item.label}</button>`
  )).join("");
}

function requestCard(item) {
  const canApprove = state.user.role === "approver" && item.status === "Pendente aprovação";
  const canImport = state.user.role === "import" && ["Aprovado pelo gestor","Em análise importação","Aprovado parcialmente"].includes(item.status);
  const timeline = (item.history || []).slice(0, 4).map(h => `
    <div class="timeline-item">
      <strong>${h.action}</strong><br>
      <span class="small muted">${h.by} • ${h.role} • ${formatDate(h.at)}</span><br>
      <span>${h.detail}</span>
    </div>
  `).join("");

  return `
    <div class="request-card">
      <div class="head">
        <div>
          <h4>${item.title}</h4>
          <div class="muted">Código ${item.productCode || "-"} • ${item.category || "-"} • Solicitante: ${item.requesterName}</div>
        </div>
        <span class="badge ${badgeClass(item.status)}">${item.status}</span>
      </div>
      <p class="muted">${item.description || "Sem descrição."}</p>
      <div class="form-grid">
        <div><strong>Qtd. solicitada:</strong> ${item.quantityRequested}</div>
        <div><strong>Qtd. final:</strong> ${item.quantityApproved ?? item.quantityRequested}</div>
        <div><strong>Urgência:</strong> ${item.urgency}</div>
        <div><strong>Data desejada:</strong> ${item.desiredDate || "-"}</div>
        <div><strong>Gestor:</strong> ${item.approverName || "-"}</div>
        <div><strong>Equipe:</strong> ${item.requesterTeam || "-"}</div>
      </div>
      <div class="actions">
        <button class="btn-secondary" onclick="showHistory(${item.id})">Histórico</button>
        ${canApprove ? `<button class="btn-success" onclick="managerAction(${item.id}, 'approve')">Aprovar</button>
                        <button class="btn-warning" onclick="managerAction(${item.id}, 'return')">Devolver</button>
                        <button class="btn-danger" onclick="managerAction(${item.id}, 'reject')">Reprovar</button>` : ""}
        ${canImport ? `<button class="btn-primary" onclick="openImportPanel(${item.id})">Decisão da importação</button>` : ""}
      </div>
      <div class="timeline">${timeline || '<span class="muted small">Sem histórico ainda.</span>'}</div>
    </div>
  `;
}

function renderView() {
  mountNav();
  const view = el("viewContainer");

  if (state.currentView === "dashboard") {
    const recent = filteredRequests().slice(0, 4).map(requestCard).join("") || `<div class="panel"><p class="muted">Nenhuma solicitação disponível.</p></div>`;
    view.innerHTML = `
      <div class="split">
        <div class="panel">
          <h3>Radar operacional</h3>
          <p class="muted">Uma visão rápida do fluxo Roland DG Brasil Flow.</p>
          <div class="card-list">${recent}</div>
        </div>
        <div class="panel">
          <h3>Guia rápido do seu perfil</h3>
          <div class="timeline">
            ${state.user.role === "requester" ? `
              <div class="timeline-item"><strong>1. Criar solicitação</strong><br><span>Preencha produto, quantidade, urgência e justificativa.</span></div>
              <div class="timeline-item"><strong>2. Acompanhar aprovação</strong><br><span>Seu gestor revisa e devolve, aprova ou reprova.</span></div>
              <div class="timeline-item"><strong>3. Importação finaliza</strong><br><span>As meninas da importação ajustam quantidade e decisão final.</span></div>
            ` : state.user.role === "approver" ? `
              <div class="timeline-item"><strong>1. Revisar pedidos da equipe</strong><br><span>Veja urgência, contexto e histórico.</span></div>
              <div class="timeline-item"><strong>2. Tomar decisão</strong><br><span>Aprove, devolva para ajuste ou reprove.</span></div>
              <div class="timeline-item"><strong>3. Encaminhar para importação</strong><br><span>Pedidos aprovados seguem para decisão master.</span></div>
            ` : state.user.role === "import" ? `
              <div class="timeline-item"><strong>1. Receber aprovado do gestor</strong><br><span>Os pedidos já chegam validados pela liderança.</span></div>
              <div class="timeline-item"><strong>2. Ajustar quantidade</strong><br><span>Registre o que o Japão liberou.</span></div>
              <div class="timeline-item"><strong>3. Finalizar</strong><br><span>Defina aprovado, parcial, reprovado ou concluído.</span></div>
            ` : `
              <div class="timeline-item"><strong>1. Controlar acessos</strong><br><span>Cadastre usuários e redefina senhas.</span></div>
              <div class="timeline-item"><strong>2. Suporte contínuo</strong><br><span>Seu painel já está pronto para futuras melhorias.</span></div>
              <div class="timeline-item"><strong>3. Evoluir o produto</strong><br><span>Esse é o ponto de partida para novas automações.</span></div>
            `}
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (state.currentView === "new" && state.user.role === "requester") {
    view.innerHTML = `
      <div class="panel">
        <h3>Nova solicitação</h3>
        <p class="muted">Abra um pedido com visual premium e fluxo real para aprovação.</p>
        <form id="requestForm" class="form-grid">
          <div class="field"><label>Nome do produto</label><input name="title" required></div>
          <div class="field"><label>Código do produto</label><input name="productCode"></div>
          <div class="field"><label>Categoria</label><input name="category"></div>
          <div class="field"><label>Quantidade</label><input name="quantityRequested" type="number" min="1" required></div>
          <div class="field"><label>Urgência</label>
            <select name="urgency">
              <option>Baixa</option><option>Média</option><option>Alta</option><option>Crítica</option>
            </select>
          </div>
          <div class="field"><label>Data desejada</label><input name="desiredDate" type="date"></div>
          <div class="field full"><label>Descrição</label><textarea name="description"></textarea></div>
          <div class="field full"><label>Justificativa</label><textarea name="justification" required></textarea></div>
          <div class="actions">
            <button class="btn-primary" type="submit">Enviar solicitação</button>
            <button class="btn-secondary" type="reset">Limpar</button>
          </div>
        </form>
      </div>
    `;
    el("requestForm").addEventListener("submit", submitRequest);
    return;
  }

  if (state.currentView === "requests") {
    const items = filteredRequests();
    view.innerHTML = `
      <div class="panel">
        <h3>Solicitações</h3>
        <div class="search-row">
          <input placeholder="Buscar por produto, código ou solicitante" oninput="state.searchText=this.value; renderView()">
          <select onchange="state.filterStatus=this.value; renderView()">
            <option value="">Todos os status</option>
            <option>Pendente aprovação</option>
            <option>Devolvido para ajuste</option>
            <option>Reprovado pelo gestor</option>
            <option>Aprovado pelo gestor</option>
            <option>Em análise importação</option>
            <option>Aprovado parcialmente</option>
            <option>Aprovado pela importação</option>
            <option>Reprovado pela importação</option>
            <option>Concluído</option>
          </select>
          <button class="btn-ghost" onclick="state.searchText='';state.filterStatus='';renderView()">Limpar filtros</button>
        </div>
        <div class="card-list">
          ${items.map(requestCard).join("") || `<div class="request-card"><span class="muted">Nenhuma solicitação encontrada.</span></div>`}
        </div>
      </div>
    `;
    return;
  }

  if (state.currentView === "users" && state.user.role === "ti") {
    const rows = (state.users || []).map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${roleText[u.role] || u.role}</td>
        <td>${u.team || "-"}</td>
        <td>
          <div class="row-actions">
            <button class="btn-secondary" onclick="resetPasswordPrompt(${u.id}, '${u.name.replace(/'/g, "\\'")}')">Alterar senha</button>
          </div>
        </td>
      </tr>
    `).join("");

    view.innerHTML = `
      <div class="split">
        <div class="panel">
          <h3>Painel TI</h3>
          <p class="muted">Seu espaço para gerenciar acessos e preparar futuras melhorias.</p>
          <form id="userForm" class="form-grid">
            <div class="field"><label>Nome</label><input name="name" required></div>
            <div class="field"><label>E-mail</label><input name="email" type="email" required></div>
            <div class="field"><label>Perfil</label>
              <select name="role">
                <option value="requester">Solicitante</option>
                <option value="approver">Aprovador</option>
                <option value="import">Importação Master</option>
                <option value="ti">TI Admin</option>
              </select>
            </div>
            <div class="field"><label>Equipe</label><input name="team"></div>
            <div class="field full"><label>Senha inicial</label><input name="password" required></div>
            <div class="actions"><button class="btn-primary" type="submit">Criar usuário</button></div>
          </form>
        </div>
        <div class="panel">
          <h3>Usuários do sistema</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Equipe</th><th>Ação</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    el("userForm").addEventListener("submit", submitUser);
    return;
  }

  view.innerHTML = `<div class="panel"><p class="muted">View indisponível para este perfil.</p></div>`;
}

async function refreshData() {
  const [me, requests] = await Promise.all([
    api("/api/me"),
    api("/api/requests")
  ]);
  state.user = me.user;
  state.requests = requests;

  if (state.user.role === "ti") {
    const users = await api("/api/users");
    state.users = users;
  } else {
    state.users = [];
  }
}

async function submitRequest(e) {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());
  payload.quantityRequested = Number(payload.quantityRequested);
  try {
    await api("/api/requests", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    toast("Solicitação criada com sucesso.");
    e.target.reset();
    state.currentView = "requests";
    await refreshData();
    renderAppShell();
  } catch (err) {
    toast(err.message, false);
  }
}

async function managerAction(id, action) {
  const comment = prompt(
    action === "approve" ? "Comentário da aprovação:" :
    action === "return" ? "Motivo da devolução:" :
    "Motivo da reprovação:"
  ) || "";
  try {
    await api(`/api/requests/${id}/${action}`, {
      method: "PUT",
      body: JSON.stringify({ comment })
    });
    toast("Ação registrada.");
    await refreshData();
    renderAppShell();
  } catch (err) {
    toast(err.message, false);
  }
}

function openImportPanel(id) {
  const item = state.requests.find(r => r.id === id);
  if (!item) return;
  const qty = prompt("Quantidade final aprovada pelo Japão:", item.quantityApproved ?? item.quantityRequested);
  if (qty === null) return;
  const status = prompt("Status final (Em análise importação, Aprovado parcialmente, Aprovado pela importação, Reprovado pela importação, Concluído):", item.status === "Aprovado pelo gestor" ? "Em análise importação" : item.status);
  if (!status) return;
  const importDecision = prompt("Decisão/retorno do Japão:", item.importDecision || "");
  const comment = prompt("Comentário da importação:", item.importComment || "");
  sendImportDecision(id, qty, status, importDecision, comment);
}

async function sendImportDecision(id, qty, status, importDecision, comment) {
  try {
    await api(`/api/requests/${id}/import`, {
      method: "PUT",
      body: JSON.stringify({
        quantityApproved: Number(qty),
        status,
        importDecision,
        comment
      })
    });
    toast("Decisão da importação salva.");
    await refreshData();
    renderAppShell();
  } catch (err) {
    toast(err.message, false);
  }
}

function showHistory(id) {
  const item = state.requests.find(r => r.id === id);
  if (!item) return;
  const text = (item.history || []).map(h =>
    `${new Date(h.at).toLocaleString("pt-BR")} • ${h.by} (${h.role})\n${h.action}\n${h.detail}`
  ).join("\n\n");
  alert(text || "Sem histórico.");
}

async function submitUser(e) {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    toast("Usuário criado.");
    e.target.reset();
    state.users = await api("/api/users");
    renderAppShell();
  } catch (err) {
    toast(err.message, false);
  }
}

async function resetPasswordPrompt(id, name) {
  const password = prompt(`Nova senha para ${name}:`);
  if (!password) return;
  try {
    await api(`/api/users/${id}/password`, {
      method: "PUT",
      body: JSON.stringify({ password })
    });
    toast("Senha alterada.");
  } catch (err) {
    toast(err.message, false);
  }
}

function changeView(view) {
  state.currentView = view;
  renderAppShell();
}

async function doLogin(e) {
  e.preventDefault();
  try {
    const email = el("email").value.trim();
    const password = el("password").value.trim();
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    state.user = data.user;
    state.currentView = "dashboard";
    await refreshData();
    renderAppShell();
    toast("Login realizado.");
  } catch (err) {
    toast(err.message, false);
  }
}

async function doLogout() {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (_) {}
  state.user = null;
  state.requests = [];
  state.users = [];
  renderLogin();
}

async function bootstrap() {
  try {
    await refreshData();
    renderAppShell();
  } catch {
    renderLogin();
  }
}

window.changeView = changeView;
window.managerAction = managerAction;
window.openImportPanel = openImportPanel;
window.showHistory = showHistory;
window.resetPasswordPrompt = resetPasswordPrompt;
window.doLogout = doLogout;
window.state = state;

document.addEventListener("DOMContentLoaded", () => {
  el("loginForm").addEventListener("submit", doLogin);
  bootstrap();
});