import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { DbHandle } from "./client";
import { suppliers } from "./schema";

describe("banco de dados", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = await createTestDb();
  });
  afterAll(() => handle.close());

  it("aplica as migrations e grava/lê registros", async () => {
    await handle.db.insert(suppliers).values({ name: "Fornecedor Teste" });
    const rows = await handle.db.select().from(suppliers);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Fornecedor Teste");
    expect(rows[0].lastImportAt).toBeNull();
  });
});
