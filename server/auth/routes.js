import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  findByEmail,
  findByUsername,
  findByEmailOrUsername,
  createUser,
} from "./usersStore.js";

const router = express.Router();

// ---------- REGISTER ----------
router.post("/register", async (req, res) => {
  const { name, username, email, password } = req.body || {};
  if (!name || !username || !email || !password)
    return res.status(400).json({ error: "Missing fields" });

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET not set in .env" });
  }

  const emailExists = await findByEmail(email);
  if (emailExists) return res.status(409).json({ error: "Email already used" });

  const userExists = await findByUsername(username);
  if (userExists)
    return res.status(409).json({ error: "Username already taken" });

  const hash = await bcrypt.hash(password, 10);
  const user = await createUser({ name, username, email, hash });
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ user, token });
});

// ---------- LOGIN ----------
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password)
    return res.status(400).json({ error: "Missing fields" });

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET not set in .env" });
  }

  const u = await findByEmailOrUsername(identifier);
  if (!u)
    return res
      .status(401)
      .json({ error: "Invalid username/email or password" });

  const ok = await bcrypt.compare(password, u.hash);
  if (!ok)
    return res
      .status(401)
      .json({ error: "Invalid username/email or password" });

  const user = { id: u.id, name: u.name, username: u.username, email: u.email };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ user, token });
});

export default router;
