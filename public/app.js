const state = {
  user: null,
  requests: [],
  users: [],
  currentView: "dashboard",
  filterStatus: "",
  searchText: "",
  modalOpen: false
};

const roleText = {
  requester: "Solicitante",
  approver: "Aprovador",
  import: "Importação Master",
  ti: "TI Admin"
};

const $ = (id) => document.getElementById(id);

function badgeClass(status = "") {
  if (status.includes("Aprovado parcialmente")) return "orange";
  if (status.includes("Aprovado")) return "green";
  if (status.includes("Reprovado")) return "red";
  if (status.includes("Devolvido")) return "orange";
  if (status.includes("Em análise")) return "blue";
  return "gray";
}

function statusIcon(status = "") {
  if (status.includes("Aprovado parcialmente")) return "🟠";
  if (status.includes("Aprovado")) return "🟢";
  if (status.includes("Reprovado")) return "🔴";
  if (status.includes("Devolvido")) return "🟡";
  if (status.includes("Em análise")) return "🔵";
  return "⚪";
}

function toast(msg, ok = true) {
  const box = $("toast");
  box.textContent = msg;
  box.style.background = ok ? "#152738" : "#7a1f2a";
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 2600);
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
  return date ? new Date(date).toLocaleString("pt-BR") : "-";
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
  $("loginView").classList.remove("hidden");
  $("appView").classList.add("hidden");
}

function mountNav() {
  const items = [{ key: "dashboard", label: "Dashboard" }];
  if (state.user.role === "requester") items.push({ key: "new", label: "Nova solicitação" });
  items.push({ key: "requests", label: "Solicitações" });
  if (state.user.role === "ti") items.push({ key: "users", label: "Painel TI" });

  $("navArea").innerHTML = items.map(item =>
    `<button class="nav-btn ${state.currentView === item.key ? "active" : ""}" onclick="changeView('${item.key}')">${item.label}</button>`
  ).join("");
}

function renderStats() {
  const c = statusCounts(state.requests);
  $("statTotal").textContent = c.total;
  $("statPendentes").textContent = c.pendentes;
  $("statAprovadas").textContent = c.aprovadas;
  $("statReprovadas").textContent = c.reprovadas;
}

function filteredRequests() {
  return state.requests.filter(item => {
    const okStatus = !state.filterStatus || item.status === state.filterStatus;
    const text = `${item.title} ${item.productCode || ""} ${item.requesterName || ""}`.toLowerCase();
    const okText = !state.searchText || text.includes(state.searchText.toLowerCase());
    return okStatus && okText;
  });
}

function requestCard(item) {
  const canApprove = state.user.role === "approver" && item.status === "Pendente aprovação";
  const canImport = state.user.role === "import" && ["Aprovado pelo gestor", "Em análise importação", "Aprovado parcialmente"].includes(item.status);
  const timeline = (item.history || []).slice(0, 3).map(h => `
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
        <span class="badge ${badgeClass(item.status)}">${statusIcon(item.status)} ${item.status}</span>
      </div>
      <p class="muted">${item.description || "Sem descrição."}</p>
      <div class="request-meta">
        <div class="meta-pill"><strong>Qtd. solicitada</strong><br>${item.quantityRequested}</div>
        <div class="meta-pill"><strong>Qtd. final</strong><br>${item.quantityApproved ?? item.quantityRequested}</div>
        <div class="meta-pill"><strong>Urgência</strong><br>${item.urgency}</div>
        <div class="meta-pill"><strong>Data desejada</strong><br>${item.desiredDate || "-"}</div>
        <div class="meta-pill"><strong>Gestor</strong><br>${item.approverName || "-"}</div>
        <div class="meta-pill"><strong>Equipe</strong><br>${item.requesterTeam || "-"}</div>
      </div>
      <div class="actions">
        <button class="btn-secondary" onclick="openHistoryModal(${item.id})">Histórico</button>
        ${canApprove ? `<button class="btn-success" onclick="openManagerModal(${item.id}, 'approve')">Aprovar</button>
                        <button class="btn-warning" onclick="openManagerModal(${item.id}, 'return')">Devolver</button>
                        <button class="btn-danger" onclick="openManagerModal(${item.id}, 'reject')">Reprovar</button>` : ""}
        ${canImport ? `<button class="btn-primary" onclick="openImportModal(${item.id})">Decisão da importação</button>` : ""}
      </div>
      <div class="timeline">${timeline || `<span class="muted small">Sem histórico ainda.</span>`}</div>
    </div>
  `;
}

function renderAppShell() {
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("sidebarUserName").textContent = state.user.name;
  $("sidebarUserRole").textContent = `${roleText[state.user.role]} • ${state.user.team || "Sem equipe"}`;
  $("heroTitle").textContent = `Bem-vindo, ${state.user.name.split(" ")[0]}`;
  $("heroSubtitle").textContent =
    state.user.role === "requester"
      ? "Abra pedidos com rapidez e acompanhe um fluxo visual mais premium."
      : state.user.role === "approver"
      ? "Aprove, devolva ou reprove pedidos com uma experiência mais elegante."
      : state.user.role === "import"
      ? "Faça a decisão final da importação com ajuste de quantidade e rastreabilidade."
      : "Gerencie acessos e mantenha o controle do ecossistema do app.";

  mountNav();
  renderStats();
  renderView();
}

function renderView() {
  const view = $("viewContainer");

  if (state.currentView === "dashboard") {
    const recent = filteredRequests().slice(0, 4).map(requestCard).join("") || `<div class="panel"><p class="muted">Nenhuma solicitação disponível.</p></div>`;
    view.innerHTML = `
      <div class="split">
        <div class="panel">
          <h3>Radar operacional premium</h3>
          <div class="kpi-strip">
            <div class="kpi"><strong>Fluxo real</strong><br><span class="muted">Solicitação → gestor → importação</span></div>
            <div class="kpi"><strong>Segurança</strong><br><span class="muted">Acesso por perfil e senha</span></div>
            <div class="kpi"><strong>Rastreio</strong><br><span class="muted">Timeline de ações por pedido</span></div>
          </div>
          <div class="card-list" style="margin-top:14px">${recent}</div>
        </div>
        <div class="panel">
          <h3>Guia rápido do perfil</h3>
          <div class="timeline">
            ${state.user.role === "requester" ? `
              <div class="timeline-item"><strong>1. Criar solicitação</strong><br><span>Preencha produto, quantidade, urgência e justificativa.</span></div>
              <div class="timeline-item"><strong>2. Acompanhar aprovação</strong><br><span>Seu gestor analisa e a importação decide no final.</span></div>
              <div class="timeline-item"><strong>3. Consultar histórico</strong><br><span>Veja tudo o que aconteceu em cada pedido.</span></div>
            ` : state.user.role === "approver" ? `
              <div class="timeline-item"><strong>1. Ler contexto</strong><br><span>Visualize dados completos antes da decisão.</span></div>
              <div class="timeline-item"><strong>2. Agir com modal</strong><br><span>Aprovar, devolver ou reprovar com comentário.</span></div>
              <div class="timeline-item"><strong>3. Encaminhar</strong><br><span>Pedidos aprovados seguem para a importação master.</span></div>
            ` : state.user.role === "import" ? `
              <div class="timeline-item"><strong>1. Receber aprovados</strong><br><span>Os pedidos chegam validados pela liderança.</span></div>
              <div class="timeline-item"><strong>2. Ajustar quantidade</strong><br><span>Registre o retorno do Japão com clareza.</span></div>
              <div class="timeline-item"><strong>3. Fechar a decisão</strong><br><span>Defina parcial, aprovado, reprovado ou concluído.</span></div>
            ` : `
              <div class="timeline-item"><strong>1. Criar acessos</strong><br><span>Cadastre usuários por equipe e perfil.</span></div>
              <div class="timeline-item"><strong>2. Alterar senhas</strong><br><span>Você controla suporte e administração.</span></div>
              <div class="timeline-item"><strong>3. Evoluir o app</strong><br><span>Base pronta para novas funções futuras.</span></div>
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
        <p class="muted">Uma abertura de pedido com cara de produto premium.</p>
        <form id="requestForm" class="form-grid">
          <div class="field"><label>Nome do produto</label><input name="title" required></div>
          <div class="field"><label>Código do produto</label><input name="productCode"></div>
          <div class="field"><label>Categoria</label><input name="category"></div>
          <div class="field"><label>Quantidade</label><input name="quantityRequested" type="number" min="1" required></div>
          <div class="field"><label>Urgência</label>
            <select name="urgency"><option>Baixa</option><option>Média</option><option>Alta</option><option>Crítica</option></select>
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
    $("requestForm").addEventListener("submit", submitRequest);
    return;
  }

  if (state.currentView === "requests") {
    const items = filteredRequests();
    view.innerHTML = `
      <div class="panel">
        <h3>Solicitações</h3>
        <div class="search-row">
          <input placeholder="Buscar por produto, código ou solicitante" value="${state.searchText}" oninput="state.searchText=this.value; renderView()">
          <select onchange="state.filterStatus=this.value; renderView()">
            <option value="">Todos os status</option>
            ${["Pendente aprovação","Devolvido para ajuste","Reprovado pelo gestor","Aprovado pelo gestor","Em análise importação","Aprovado parcialmente","Aprovado pela importação","Reprovado pela importação","Concluído"]
              .map(s => `<option ${state.filterStatus===s?'selected':''}>${s}</option>`).join("")}
          </select>
          <button class="btn-ghost" onclick="state.searchText='';state.filterStatus='';renderView()">Limpar filtros</button>
        </div>
        <div class="card-list">${items.map(requestCard).join("") || `<div class="request-card"><span class="muted">Nenhuma solicitação encontrada.</span></div>`}</div>
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
        <td><div class="row-actions"><button class="btn-secondary" onclick="openPasswordModal(${u.id}, '${u.name.replace(/'/g, "\\'")}')">Alterar senha</button></div></td>
      </tr>
    `).join("");
    view.innerHTML = `
      <div class="split">
        <div class="panel">
          <h3>Painel TI</h3>
          <p class="muted">Seu centro de administração de acessos.</p>
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
    $("userForm").addEventListener("submit", submitUser);
    return;
  }

  view.innerHTML = `<div class="panel"><p class="muted">View indisponível para este perfil.</p></div>`;
}

function openModal(title, body, footer = "") {
  state.modalOpen = true;
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = body;
  $("modalFooter").innerHTML = footer;
  $("modalBackdrop").classList.add("show");
}
function closeModal() {
  state.modalOpen = false;
  $("modalBackdrop").classList.remove("show");
}
function openHistoryModal(id) {
  const item = state.requests.find(r => r.id === id);
  if (!item) return;
  const body = `
    <div class="timeline">
      ${(item.history || []).map(h => `
        <div class="timeline-item">
          <strong>${h.action}</strong><br>
          <span class="small muted">${h.by} • ${h.role} • ${formatDate(h.at)}</span><br>
          <span>${h.detail}</span>
        </div>
      `).join("") || `<span class="muted">Sem histórico.</span>`}
    </div>
  `;
  openModal(`Histórico • ${item.title}`, body, `<button class="btn-secondary" onclick="closeModal()">Fechar</button>`);
}

function openManagerModal(id, action) {
  const item = state.requests.find(r => r.id === id);
  if (!item) return;
  const actionLabel = action === "approve" ? "Aprovar" : action === "return" ? "Devolver" : "Reprovar";
  const body = `
    <div class="form-grid">
      <div class="field full">
        <label>Comentário da ação</label>
        <textarea id="managerComment" placeholder="Descreva a decisão do gestor."></textarea>
      </div>
    </div>
  `;
  const footer = `
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="${action==='approve'?'btn-success':action==='return'?'btn-warning':'btn-danger'}" onclick="submitManagerAction(${id}, '${action}')">${actionLabel}</button>
  `;
  openModal(`${actionLabel} solicitação`, body, footer);
}

async function submitManagerAction(id, action) {
  const comment = $("managerComment").value || "";
  try {
    await api(`/api/requests/${id}/${action}`, { method: "PUT", body: JSON.stringify({ comment }) });
    closeModal();
    toast("Ação registrada.");
    await refreshData();
    renderAppShell();
  } catch (err) {
    toast(err.message, false);
  }
}

function openImportModal(id) {
  const item = state.requests.find(r => r.id === id);
  if (!item) return;
  const body = `
    <div class="form-grid">
      <div class="field">
        <label>Quantidade final aprovada</label>
        <input id="importQty" type="number" min="0" value="${item.quantityApproved ?? item.quantityRequested}">
      </div>
      <div class="field">
        <label>Status final</label>
        <select id="importStatus">
          ${["Em análise importação","Aprovado parcialmente","Aprovado pela importação","Reprovado pela importação","Concluído"]
            .map(s => `<option ${item.status===s?'selected':''}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="field full">
        <label>Decisão / retorno do Japão</label>
        <textarea id="importDecision">${item.importDecision || ""}</textarea>
      </div>
      <div class="field full">
        <label>Comentário da importação</label>
        <textarea id="importComment">${item.importComment || ""}</textarea>
      </div>
    </div>
  `;
  const footer = `
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn-primary" onclick="submitImportAction(${id})">Salvar decisão</button>
  `;
  openModal(`Decisão da importação • ${item.title}`, body, footer);
}

async function submitImportAction(id) {
  const payload = {
    quantityApproved: Number($("importQty").value),
    status: $("importStatus").value,
    importDecision: $("importDecision").value,
    comment: $("importComment").value
  };
  try {
    await api(`/api/requests/${id}/import`, { method: "PUT", body: JSON.stringify(payload) });
    closeModal();
    toast("Decisão da importação salva.");
    await refreshData();
    renderAppShell();
  } catch (err) {
    toast(err.message, false);
  }
}

function openPasswordModal(id, name) {
  const body = `
    <div class="form-grid">
      <div class="field full">
        <label>Nova senha para ${name}</label>
        <input id="newPassword" type="password" placeholder="Digite a nova senha">
      </div>
    </div>
  `;
  const footer = `
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn-primary" onclick="submitPasswordChange(${id})">Salvar nova senha</button>
  `;
  openModal(`Alterar senha`, body, footer);
}

async function submitPasswordChange(id) {
  try {
    await api(`/api/users/${id}/password`, {
      method: "PUT",
      body: JSON.stringify({ password: $("newPassword").value })
    });
    closeModal();
    toast("Senha alterada.");
  } catch (err) {
    toast(err.message, false);
  }
}

async function submitRequest(e) {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  payload.quantityRequested = Number(payload.quantityRequested);
  try {
    await api("/api/requests", { method: "POST", body: JSON.stringify(payload) });
    toast("Solicitação criada com sucesso.");
    e.target.reset();
    state.currentView = "requests";
    await refreshData();
    renderAppShell();
  } catch (err) {
    toast(err.message, false);
  }
}

async function submitUser(e) {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
    toast("Usuário criado.");
    e.target.reset();
    state.users = await api("/api/users");
    renderAppShell();
  } catch (err) {
    toast(err.message, false);
  }
}

async function refreshData() {
  const [me, requests] = await Promise.all([api("/api/me"), api("/api/requests")]);
  state.user = me.user;
  state.requests = requests;
  if (state.user.role === "ti") state.users = await api("/api/users");
  else state.users = [];
}

async function doLogin(e) {
  e.preventDefault();
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: $("email").value.trim(), password: $("password").value.trim() })
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
  try { await api("/api/logout", { method: "POST" }); } catch (_) {}
  state.user = null; state.requests = []; state.users = [];
  renderLogin();
}

function togglePassword() {
  const input = $("password");
  input.type = input.type === "password" ? "text" : "password";
  $("togglePwd").textContent = input.type === "password" ? "Mostrar" : "Ocultar";
}

function changeView(view) {
  state.currentView = view;
  renderAppShell();
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
window.openManagerModal = openManagerModal;
window.submitManagerAction = submitManagerAction;
window.openImportModal = openImportModal;
window.submitImportAction = submitImportAction;
window.openHistoryModal = openHistoryModal;
window.openPasswordModal = openPasswordModal;
window.submitPasswordChange = submitPasswordChange;
window.closeModal = closeModal;
window.togglePassword = togglePassword;
window.doLogout = doLogout;
window.state = state;
window.renderView = renderView;

document.addEventListener("DOMContentLoaded", () => {
  $("loginForm").addEventListener("submit", doLogin);
  $("togglePwd").addEventListener("click", togglePassword);
  $("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
  bootstrap();
});