import jsonfile from "jsonfile";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always points to: server/users.json
const FILE = path.join(__dirname, "..", "users.json");

export async function getUsers() {
  try {
    return await jsonfile.readFile(FILE);
  } catch {
    return [];
  }
}

export async function saveUsers(users) {
  await jsonfile.writeFile(FILE, users, { spaces: 2 });
}

export async function findByEmailOrUsername(identifier) {
  const users = await getUsers();
  return users.find(
    (u) =>
      u.email.toLowerCase() === identifier.toLowerCase() ||
      u.username.toLowerCase() === identifier.toLowerCase()
  );
}

export async function findByEmail(email) {
  const users = await getUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function findByUsername(username) {
  const users = await getUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export async function createUser({ name, username, email, hash }) {
  const users = await getUsers();
  const id = crypto.randomUUID();
  users.push({
    id,
    name,
    username,
    email,
    hash,
    createdAt: new Date().toISOString(),
  });
  await saveUsers(users);
  return { id, name, username, email };
}
