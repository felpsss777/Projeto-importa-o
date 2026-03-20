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
function getUsers() { return readDB().users; }
function findUserByEmail(email) {
  return getUsers().find(u => u.email.toLowerCase() === String(email).toLowerCase());
}
function findUserById(id) {
  return getUsers().find(u => Number(u.id) === Number(id));
}
function updateUser(id, updates) {
  const data = readDB();
  const idx = data.users.findIndex(u => Number(u.id) === Number(id));
  if (idx === -1) return null;
  data.users[idx] = { ...data.users[idx], ...updates };
  writeDB(data);
  return sanitizeUser(data.users[idx]);
}
function addUser(user) {
  const data = readDB();
  const newUser = { id: nextId(data.users), active: true, createdAt: new Date().toISOString(), ...user };
  data.users.push(newUser);
  writeDB(data);
  return sanitizeUser(newUser);
}
function getRequests() { return readDB().requests; }
function addRequest(request) {
  const data = readDB();
  const newRequest = {
    id: nextId(data.requests),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
    ...request
  };
  data.requests.unshift(newRequest);
  writeDB(data);
  return newRequest;
}
function updateRequest(id, updates) {
  const data = readDB();
  const idx = data.requests.findIndex(r => Number(r.id) === Number(id));
  if (idx === -1) return null;
  data.requests[idx] = { ...data.requests[idx], ...updates, updatedAt: new Date().toISOString() };
  writeDB(data);
  return data.requests[idx];
}
function appendHistory(id, event) {
  const data = readDB();
  const idx = data.requests.findIndex(r => Number(r.id) === Number(id));
  if (idx === -1) return null;
  data.requests[idx].history = data.requests[idx].history || [];
  data.requests[idx].history.unshift({ id: Date.now(), at: new Date().toISOString(), ...event });
  data.requests[idx].updatedAt = new Date().toISOString();
  writeDB(data);
  return data.requests[idx];
}
module.exports = {
  readDB, writeDB, hashPassword, sanitizeUser,
  getUsers, findUserByEmail, findUserById, updateUser, addUser,
  getRequests, addRequest, updateRequest, appendHistory
};