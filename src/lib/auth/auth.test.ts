import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/db/client";
import { createTestDb } from "@/test/db";
import { authenticate, countUsers, createUser, DuplicateEmailError } from "../users";
import { hashPassword, verifyPassword } from "./password";
import {
  createSession,
  deleteSession,
  findUserBySessionToken,
  SESSION_DURATION_MS,
} from "./sessions";

describe("senhas", () => {
  it("confere a senha correta e rejeita a errada", async () => {
    const hash = await hashPassword("segredo-123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("segredo-123", hash)).toBe(true);
    expect(await verifyPassword("segredo-124", hash)).toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt aleatório)", async () => {
    expect(await hashPassword("abc12345")).not.toBe(await hashPassword("abc12345"));
  });

  it("rejeita hash em formato desconhecido", async () => {
    expect(await verifyPassword("x", "md5$abc")).toBe(false);
  });
});

describe("usuários e sessões", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = await createTestDb();
  });
  afterAll(() => handle.close());

  it("cria usuário, autentica e normaliza o e-mail", async () => {
    await createUser(handle.db, { name: "Ana", email: "ana@spj.test", password: "senha-forte" });
    expect(await countUsers(handle.db)).toBe(1);
    expect(await authenticate(handle.db, " ANA@spj.test ", "senha-forte")).not.toBeNull();
    expect(await authenticate(handle.db, "ana@spj.test", "errada")).toBeNull();
    expect(await authenticate(handle.db, "ninguem@spj.test", "senha-forte")).toBeNull();
  });

  it("não permite e-mail duplicado", async () => {
    await expect(
      createUser(handle.db, { name: "Ana 2", email: "ana@spj.test", password: "outra-senha" }),
    ).rejects.toBeInstanceOf(DuplicateEmailError);
  });

  it("cria, valida, expira e encerra sessões", async () => {
    const user = await authenticate(handle.db, "ana@spj.test", "senha-forte");
    if (!user) throw new Error("usuário de teste não encontrado");
    const now = new Date("2026-01-01T12:00:00Z");
    const { token } = await createSession(handle.db, user.id, now);

    expect(await findUserBySessionToken(handle.db, token, now)).toMatchObject({
      email: "ana@spj.test",
    });
    expect(await findUserBySessionToken(handle.db, "token-invalido", now)).toBeNull();

    const afterExpiry = new Date(now.getTime() + SESSION_DURATION_MS + 1);
    expect(await findUserBySessionToken(handle.db, token, afterExpiry)).toBeNull();

    await deleteSession(handle.db, token);
    expect(await findUserBySessionToken(handle.db, token, now)).toBeNull();
  });
});
