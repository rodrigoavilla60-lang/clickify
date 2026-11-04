import fs from "node:fs";
import path from "node:path";
import { axe, expect, register, test, logout } from "./helpers";

// Os e-mails do teste vão para uma pasta (EMAIL_OUTBOX, ver playwright.config.ts).
function lastEmailTo(to: string): { subject: string; text: string } | null {
  const dir = path.join(process.env.E2E_DIR!, "outbox");
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.includes(to.replace(/[^a-z0-9@.]/gi, "_"))).sort();
  return files.length ? JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), "utf8")) : null;
}

test.describe("Senha: recuperar e trocar", () => {
  test("SENHA-1 esqueci a senha: link por e-mail, uma vez só, e a senha antiga para de valer", async ({ page, browser }) => {
    const email = await register(page, "senha");
    // Uma segunda sessão aberta, que precisa cair quando a senha mudar
    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto("/login");
    await p2.getByLabel("E-mail").fill(email);
    await p2.getByLabel("Senha").fill("senha-de-teste-123");
    await p2.getByRole("button", { name: "Entrar" }).click();
    await expect(p2).toHaveURL(/\/hoje$/);

    await logout(page);
    await page.getByRole("link", { name: "Esqueci minha senha" }).click();
    await axe(page);

    // E-mail que não existe: mesma resposta, nenhum e-mail
    await page.getByLabel("E-mail da conta").fill("ninguem-aqui@clickify.test");
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText(/Se existir uma conta com ninguem-aqui@clickify.test/)).toBeVisible();
    expect(lastEmailTo("ninguem-aqui@clickify.test")).toBeNull();

    await page.goto("/esqueci-senha");
    await page.getByLabel("E-mail da conta").fill(email.toUpperCase());
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText(/Se existir uma conta com/)).toBeVisible();
    const mail = lastEmailTo(email);
    expect(mail?.subject).toBe("Redefinir sua senha do Clickify");
    const link = mail!.text.match(/http\S+redefinir-senha\?token=\S+/)![0];
    expect(link.startsWith("http://localhost:3100/")).toBe(true);

    await page.goto(link);
    await page.getByLabel("Senha nova", { exact: true }).fill("nova-senha-456");
    await page.getByLabel("Repita a senha nova").fill("outra-coisa-789");
    await page.getByRole("button", { name: "Salvar senha nova" }).click();
    await expect(page.getByText("As duas senhas não estão iguais.")).toBeVisible();
    await page.getByLabel("Senha nova", { exact: true }).fill("nova-senha-456");
    await page.getByLabel("Repita a senha nova").fill("nova-senha-456");
    await page.getByRole("button", { name: "Salvar senha nova" }).click();
    await expect(page).toHaveURL(/\/hoje$/);

    // A outra sessão caiu
    await p2.goto("/dashboard");
    await expect(p2).toHaveURL(/\/login$/);
    await other.close();

    // O link não vale de novo
    await page.goto(link);
    await expect(page.getByText("Esse link expirou ou já foi usado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar senha nova" })).toHaveCount(0);
    // Token inventado também não
    await page.goto("/redefinir-senha?token=abcdefghijklmnopqrstuvwxyz123456");
    await expect(page.getByText("Esse link expirou ou já foi usado.")).toBeVisible();

    // Senha antiga não entra; a nova sim
    await page.goto("/hoje");
    await logout(page);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-de-teste-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha não conferem.")).toBeVisible();
    await page.getByLabel("Senha").fill("nova-senha-456");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/hoje$/);
  });

  test("SENHA-2 trocar senha em Configurações pede a atual", async ({ page }) => {
    const email = await register(page, "troca");
    await page.goto("/configuracoes");
    const card = page.getByRole("region", { name: "Trocar senha" }).or(page.locator("section").filter({ hasText: "Trocar senha" }));
    await page.getByLabel("Senha atual").fill("errada-123456");
    await page.getByLabel("Senha nova", { exact: true }).fill("trocada-789");
    await page.getByLabel("Repita a senha nova").fill("trocada-789");
    await page.getByRole("button", { name: "Trocar senha" }).click();
    await expect(card.getByText("A senha atual não confere.")).toBeVisible();

    await page.getByLabel("Senha atual").fill("senha-de-teste-123");
    await page.getByLabel("Senha nova", { exact: true }).fill("trocada-789");
    await page.getByLabel("Repita a senha nova").fill("trocada-789");
    await page.getByRole("button", { name: "Trocar senha" }).click();
    await expect(page.getByText("Senha trocada.")).toBeVisible();
    await axe(page);

    // Continua logado aqui; a senha nova vale no próximo login
    await page.goto("/hoje");
    await logout(page);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("trocada-789");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/hoje$/);
  });
});
