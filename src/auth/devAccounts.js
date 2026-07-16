import { seedUsers } from "../data/seedUsers";

export const DEV_PASSWORD = "conexia123";

// Skill-test login map: each listed email uses the same development password.
export const devAccounts = seedUsers.reduce((accounts, user) => {
  accounts[user.email.toLowerCase()] = {
    ...user,
    password: DEV_PASSWORD,
  };
  return accounts;
}, {});

export function authenticateDevAccount(email, password) {
  const account = devAccounts[email.trim().toLowerCase()];

  if (!account) {
    return { ok: false, message: "No development account exists for that email." };
  }

  if (account.password !== password) {
    return { ok: false, message: "Incorrect development password." };
  }

  return { ok: true, account };
}
