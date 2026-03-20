const express = require("express");
const session = require("express-session");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || "roland-dg-brasil-flow-premium-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, "public")));

const roleLabels = {
  requester: "Solicitante",
  approver: "Aprovador",
  import: "Importação Master",
  ti: "TI Admin"
};

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Não autenticado." });
  const user = db.findUserById(req.session.userId);
  if (!user || !user.active) return res.status(401).json({ error: "Usuário inválido." });
  req.user = user;
  next();
}
function allow(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Sem permissão para esta ação." });
    next();
  };
}
function publicUser(user) { return db.sanitizeUser(user); }
function requestForRole(user, request) {
  if (user.role === "ti" || user.role === "import") return true;
  if (user.role === "requester") return Number(request.requesterId) === Number(user.id);
  if (user.role === "approver") return request.approverTeam === user.team;
  return false;
}

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db.findUserByEmail(email || "");
  if (!user || db.hashPassword(password || "") !== user.passwordHash) {
    return res.status(401).json({ error: "E-mail ou senha inválidos." });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});
app.post("/api/logout", auth, (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get("/api/requests", auth, (req, res) => {
  res.json(db.getRequests().filter(r => requestForRole(req.user, r)));
});
app.post("/api/requests", auth, allow("requester"), (req, res) => {
  const body = req.body || {};
  const approver = db.getUsers().find(u => u.role === "approver" && u.team === req.user.team);
  const created = db.addRequest({
    title: body.title,
    productCode: body.productCode,
    description: body.description,
    category: body.category,
    quantityRequested: Number(body.quantityRequested),
    quantityApproved: Number(body.quantityRequested),
    urgency: body.urgency,
    justification: body.justification,
    desiredDate: body.desiredDate,
    requesterId: req.user.id,
    requesterName: req.user.name,
    requesterTeam: req.user.team,
    approverTeam: req.user.team,
    approverName: approver ? approver.name : "Gestor não definido",
    status: "Pendente aprovação",
    importDecision: "",
    approverComment: "",
    importComment: ""
  });
  db.appendHistory(created.id, {
    by: req.user.name, role: roleLabels[req.user.role],
    action: "Solicitação criada",
    detail: `Pedido criado com ${created.quantityRequested} unidade(s).`
  });
  res.json(created);
});
app.put("/api/requests/:id/approve", auth, allow("approver"), (req, res) => {
  const id = Number(req.params.id);
  const request = db.getRequests().find(r => Number(r.id) === id);
  if (!request) return res.status(404).json({ error: "Solicitação não encontrada." });
  if (request.approverTeam !== req.user.team) return res.status(403).json({ error: "Sem permissão." });
  const updated = db.updateRequest(id, { status: "Aprovado pelo gestor", approverComment: req.body.comment || "" });
  db.appendHistory(id, {
    by: req.user.name, role: roleLabels[req.user.role],
    action: "Aprovado pelo gestor", detail: req.body.comment || "Sem observações."
  });
  res.json(updated);
});
app.put("/api/requests/:id/return", auth, allow("approver"), (req, res) => {
  const id = Number(req.params.id);
  const request = db.getRequests().find(r => Number(r.id) === id);
  if (!request) return res.status(404).json({ error: "Solicitação não encontrada." });
  if (request.approverTeam !== req.user.team) return res.status(403).json({ error: "Sem permissão." });
  const updated = db.updateRequest(id, { status: "Devolvido para ajuste", approverComment: req.body.comment || "" });
  db.appendHistory(id, {
    by: req.user.name, role: roleLabels[req.user.role],
    action: "Devolvido para ajuste", detail: req.body.comment || "Revisar informações."
  });
  res.json(updated);
});
app.put("/api/requests/:id/reject", auth, allow("approver"), (req, res) => {
  const id = Number(req.params.id);
  const request = db.getRequests().find(r => Number(r.id) === id);
  if (!request) return res.status(404).json({ error: "Solicitação não encontrada." });
  if (request.approverTeam !== req.user.team) return res.status(403).json({ error: "Sem permissão." });
  const updated = db.updateRequest(id, { status: "Reprovado pelo gestor", approverComment: req.body.comment || "" });
  db.appendHistory(id, {
    by: req.user.name, role: roleLabels[req.user.role],
    action: "Reprovado pelo gestor", detail: req.body.comment || "Solicitação reprovada."
  });
  res.json(updated);
});
app.put("/api/requests/:id/import", auth, allow("import"), (req, res) => {
  const id = Number(req.params.id);
  const request = db.getRequests().find(r => Number(r.id) === id);
  if (!request) return res.status(404).json({ error: "Solicitação não encontrada." });

  const quantityApproved = Number(req.body.quantityApproved);
  const importStatus = req.body.status;
  const importComment = req.body.comment || "";
  const importDecision = req.body.importDecision || "";
  const allowed = ["Em análise importação","Aprovado parcialmente","Aprovado pela importação","Reprovado pela importação","Concluído"];
  if (!allowed.includes(importStatus)) return res.status(400).json({ error: "Status inválido para importação." });

  const updated = db.updateRequest(id, {
    quantityApproved: Number.isFinite(quantityApproved) ? quantityApproved : request.quantityApproved,
    status: importStatus, importComment, importDecision
  });
  db.appendHistory(id, {
    by: req.user.name, role: roleLabels[req.user.role],
    action: `Importação atualizou para "${importStatus}"`,
    detail: `${importDecision || "Sem decisão detalhada."} Quantidade final: ${updated.quantityApproved}.`
  });
  res.json(updated);
});
app.get("/api/users", auth, allow("ti"), (req, res) => {
  res.json(db.getUsers().map(publicUser));
});
app.post("/api/users", auth, allow("ti"), (req, res) => {
  const { name, email, role, team, password } = req.body || {};
  if (!name || !email || !role || !password) return res.status(400).json({ error: "Preencha nome, e-mail, perfil e senha." });
  if (db.findUserByEmail(email)) return res.status(400).json({ error: "Já existe um usuário com esse e-mail." });
  const user = db.addUser({
    name, email, role, team: team || "", passwordHash: db.hashPassword(password)
  });
  res.json(user);
});
app.put("/api/users/:id/password", auth, allow("ti"), (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).length < 4) return res.status(400).json({ error: "A nova senha deve ter ao menos 4 caracteres." });
  const user = db.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
  const updated = db.updateUser(req.params.id, { passwordHash: db.hashPassword(password) });
  res.json(updated);
});
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`Roland DG Brasil Flow Premium em http://localhost:${PORT}`));