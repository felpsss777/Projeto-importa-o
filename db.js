const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dbPath = path.join(__dirname, "data", "db.json");

function readDB() {
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function nextId(items) {
  return items.length ? Math.max(...items.map(i => Number(i.id) || 0)) + 1 : 1;
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function getUsers() {
  return readDB().users;
}

function findUserByEmail(email) {
  return getUsers().find(u => u.email.toLowerCase() === String(email).toLowerCase());
}

function findUserById(id) {
  return getUsers().find(u => Number(u.id) === Number(id));
}

function updateUser(id, updates) {
  const db = readDB();
  const idx = db.users.findIndex(u => Number(u.id) === Number(id));
  if (idx === -1) return null;
  db.users[idx] = { ...db.users[idx], ...updates };
  writeDB(db);
  return sanitizeUser(db.users[idx]);
}

function addUser(user) {
  const db = readDB();
  const newUser = {
    id: nextId(db.users),
    active: true,
    createdAt: new Date().toISOString(),
    ...user
  };
  db.users.push(newUser);
  writeDB(db);
  return sanitizeUser(newUser);
}

function getRequests() {
  return readDB().requests;
}

function addRequest(request) {
  const db = readDB();
  const newRequest = {
    id: nextId(db.requests),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
    ...request
  };
  db.requests.unshift(newRequest);
  writeDB(db);
  return newRequest;
}

function updateRequest(id, updates) {
  const db = readDB();
  const idx = db.requests.findIndex(r => Number(r.id) === Number(id));
  if (idx === -1) return null;
  db.requests[idx] = {
    ...db.requests[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  writeDB(db);
  return db.requests[idx];
}

function appendHistory(id, event) {
  const db = readDB();
  const idx = db.requests.findIndex(r => Number(r.id) === Number(id));
  if (idx === -1) return null;
  db.requests[idx].history = db.requests[idx].history || [];
  db.requests[idx].history.unshift({
    id: Date.now(),
    at: new Date().toISOString(),
    ...event
  });
  db.requests[idx].updatedAt = new Date().toISOString();
  writeDB(db);
  return db.requests[idx];
}

module.exports = {
  readDB,
  writeDB,
  hashPassword,
  sanitizeUser,
  getUsers,
  findUserByEmail,
  findUserById,
  updateUser,
  addUser,
  getRequests,
  addRequest,
  updateRequest,
  appendHistory
};