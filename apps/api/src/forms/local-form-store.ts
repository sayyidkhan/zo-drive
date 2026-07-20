import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type PublishedForm = {
  id: string;
  shortCode: string;
  ownerUserId: string;
  key: string;
  createdAt: string;
};

export type FormResponse = {
  id: string;
  formId: string;
  submittedAt: string;
  answers: Record<string, string | string[]>;
};

type StoredForms = { forms: PublishedForm[]; responses: FormResponse[] };

export class LocalFormStore {
  private readonly formsFile: string;

  constructor({ root }: { root: string }) {
    this.formsFile = join(root, "v1", "forms", "forms.json");
  }

  async publish({ ownerUserId, key }: { ownerUserId: string; key: string }): Promise<PublishedForm> {
    const stored = await this.readForms();
    const existing = stored.forms.find((form) => form.ownerUserId === ownerUserId && form.key === key);
    if (existing) return existing;
    const form = { id: randomUUID(), shortCode: randomUUID().replaceAll("-", "").slice(0, 10), ownerUserId, key, createdAt: new Date().toISOString() };
    stored.forms.push(form);
    await this.writeForms(stored);
    return form;
  }

  async find(id: string): Promise<PublishedForm | null> {
    return (await this.readForms()).forms.find((form) => form.id === id || form.shortCode === id) ?? null;
  }

  async addResponse({ formId, answers }: { formId: string; answers: Record<string, string | string[]> }): Promise<FormResponse | null> {
    const stored = await this.readForms();
    if (!stored.forms.some((form) => form.id === formId)) return null;
    const response = { id: randomUUID(), formId, submittedAt: new Date().toISOString(), answers };
    stored.responses.push(response);
    await this.writeForms(stored);
    return response;
  }

  async listResponses({ formId, ownerUserId }: { formId: string; ownerUserId: string }): Promise<FormResponse[] | null> {
    const stored = await this.readForms();
    if (!stored.forms.some((form) => form.id === formId && form.ownerUserId === ownerUserId)) return null;
    return stored.responses.filter((response) => response.formId === formId).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  }

  async renameOwner({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }): Promise<void> {
    const stored = await this.readForms();
    let changed = false;
    for (const form of stored.forms) {
      if (form.ownerUserId === fromUserId) {
        form.ownerUserId = toUserId;
        changed = true;
      }
    }
    if (changed) await this.writeForms(stored);
  }

  async renameKey({ ownerUserId, fromKey, toKey }: { ownerUserId: string; fromKey: string; toKey: string }): Promise<void> {
    if (fromKey === toKey) return;
    const stored = await this.readForms();
    let changed = false;
    for (const form of stored.forms) {
      if (form.ownerUserId === ownerUserId && form.key === fromKey) {
        form.key = toKey;
        changed = true;
      }
    }
    if (changed) await this.writeForms(stored);
  }

  async removeByKey({ ownerUserId, key }: { ownerUserId: string; key: string }): Promise<void> {
    const stored = await this.readForms();
    const ids = new Set(stored.forms.filter((form) => form.ownerUserId === ownerUserId && form.key === key).map((form) => form.id));
    if (ids.size === 0) return;
    stored.forms = stored.forms.filter((form) => !ids.has(form.id));
    stored.responses = stored.responses.filter((response) => !ids.has(response.formId));
    await this.writeForms(stored);
  }

  async removeByOwner(ownerUserId: string): Promise<void> {
    const stored = await this.readForms();
    const ids = new Set(stored.forms.filter((form) => form.ownerUserId === ownerUserId).map((form) => form.id));
    if (ids.size === 0) return;
    stored.forms = stored.forms.filter((form) => form.ownerUserId !== ownerUserId);
    stored.responses = stored.responses.filter((response) => !ids.has(response.formId));
    await this.writeForms(stored);
  }

  private async readForms(): Promise<StoredForms> {
    try {
      const parsed = JSON.parse(await readFile(this.formsFile, "utf8")) as Partial<StoredForms>;
      return { forms: Array.isArray(parsed.forms) ? parsed.forms.map((form) => ({ ...form, shortCode: typeof form.shortCode === "string" && form.shortCode ? form.shortCode : form.id.replaceAll("-", "").slice(0, 10) })) : [], responses: Array.isArray(parsed.responses) ? parsed.responses : [] };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { forms: [], responses: [] };
      throw error;
    }
  }

  private async writeForms(forms: StoredForms): Promise<void> {
    await mkdir(dirname(this.formsFile), { recursive: true });
    const temporaryFile = `${this.formsFile}.${randomUUID()}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(forms, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryFile, this.formsFile);
  }
}
