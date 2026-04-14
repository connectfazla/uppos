import path from "path";
import fs from "fs/promises";

export function contractsRootDir(): string {
  return process.env.CONTRACTS_DIR ?? path.join(process.cwd(), "data", "contracts");
}

export async function ensureContractsRoot(): Promise<string> {
  const root = contractsRootDir();
  await fs.mkdir(root, { recursive: true });
  return root;
}

export function absoluteContractPath(storagePath: string): string {
  const root = path.resolve(contractsRootDir());
  const abs = path.resolve(root, storagePath);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error("Invalid storage path");
  }
  return abs;
}
