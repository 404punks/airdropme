import {
  type ReferralHistoryRecord,
  type ReferralLinkRecord,
  linkDocumentId,
} from "@/server/referrals/logic";
import type { ReferralRepository } from "@/server/referrals/repository";

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { nullValue: null };

type FirestoreFields = Record<string, FirestoreValue>;

export interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  base: string;
  clientEmail: string;
  privateKey: string;
}

export function readFirebaseConfig(env: NodeJS.ProcessEnv = process.env): FirebaseConfig | null {
  const projectId = env.FIREBASE_PROJECT_ID?.trim() || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "";
  const apiKey = env.FIREBASE_API_KEY?.trim() || env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || "";
  const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim() || "";
  const privateKey = (env.FIREBASE_PRIVATE_KEY || "").replaceAll("\\n", "\n").trim();
  if (!projectId) return null;
  if (!apiKey && !(clientEmail && privateKey)) return null;
  return { projectId, apiKey, base: firebaseApiBase(env), clientEmail, privateKey };
}

export function firebaseApiBase(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.FIREBASE_API_BASE?.trim();
  if (!raw) return "https://firestore.googleapis.com";
  const url = new URL(raw);
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (local && url.protocol === "http:") return url.origin;
  if (url.protocol === "https:" && url.hostname === "firestore.googleapis.com") return url.origin;
  throw new Error("FIREBASE_API_BASE is not allowed.");
}

function stringField(value: string): FirestoreValue {
  return { stringValue: value };
}

function numberField(value: number): FirestoreValue {
  return { integerValue: String(Math.trunc(value)) };
}

function nullableField(value: string | null): FirestoreValue {
  return value == null || value === "" ? { nullValue: null } : { stringValue: value };
}

function readString(fields: FirestoreFields, key: string): string {
  const value = fields[key];
  if (!value) return "";
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return value.integerValue;
  return "";
}

function readNullable(fields: FirestoreFields, key: string): string | null {
  const value = fields[key];
  if (!value || "nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue || null;
  return null;
}

function readNumber(fields: FirestoreFields, key: string): number {
  const value = fields[key];
  if (!value || !("integerValue" in value)) return 0;
  const parsed = Number(value.integerValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function historyFields(record: ReferralHistoryRecord): FirestoreFields {
  return {
    referrerUsername: stringField(record.referrerUsername),
    referrerImage: nullableField(record.referrerImage),
    referredUsername: stringField(record.referredUsername),
    referredImage: nullableField(record.referredImage),
    referrerPoints: numberField(record.referrerPoints),
    referredPoints: numberField(record.referredPoints),
    referralLink: stringField(record.referralLink),
    domain: stringField(record.domain),
    createdAt: stringField(record.createdAt),
  };
}

function linkFields(record: ReferralLinkRecord, includeCreated: boolean): FirestoreFields {
  const fields: FirestoreFields = {
    username: stringField(record.username),
    profileImage: nullableField(record.profileImage),
    link: stringField(record.link),
    domain: stringField(record.domain),
  };
  if (includeCreated) fields.createdAt = stringField(record.createdAt);
  return fields;
}

function historyFromDocument(name: string, fields: FirestoreFields): ReferralHistoryRecord {
  const id = decodeURIComponent(name.split("/").pop() || "");
  return {
    id,
    referrerUsername: readString(fields, "referrerUsername"),
    referrerImage: readNullable(fields, "referrerImage"),
    referredUsername: readString(fields, "referredUsername"),
    referredImage: readNullable(fields, "referredImage"),
    referrerPoints: readNumber(fields, "referrerPoints"),
    referredPoints: readNumber(fields, "referredPoints"),
    referralLink: readString(fields, "referralLink"),
    domain: readString(fields, "domain"),
    createdAt: readString(fields, "createdAt"),
  };
}

function linkFromDocument(fields: FirestoreFields): ReferralLinkRecord {
  return {
    username: readString(fields, "username"),
    profileImage: readNullable(fields, "profileImage"),
    link: readString(fields, "link"),
    domain: readString(fields, "domain"),
    createdAt: readString(fields, "createdAt"),
  };
}

export class FirestoreReferralStore implements ReferralRepository {
  private tokenCache: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: FirebaseConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private collection(name: string): string {
    const project = encodeURIComponent(this.config.projectId);
    return `${this.config.base}/v1/projects/${project}/databases/(default)/documents/${name}`;
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let target = url;
    if (this.config.clientEmail && this.config.privateKey) {
      headers.Authorization = `Bearer ${await this.accessToken()}`;
    } else {
      const separator = url.includes("?") ? "&" : "?";
      target = `${url}${separator}key=${encodeURIComponent(this.config.apiKey)}`;
    }
    return this.fetchImpl(target, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  }

  private async accessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) return this.tokenCache.value;
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claim = Buffer.from(
      JSON.stringify({
        iss: this.config.clientEmail,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ).toString("base64url");
    const { createSign } = await import("node:crypto");
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claim}`);
    signer.end();
    const assertion = `${header}.${claim}.${signer.sign(this.config.privateKey).toString("base64url")}`;
    const response = await this.fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    });
    if (!response.ok) throw new Error("Firebase could not authorize the service account.");
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error("Firebase did not return an access token.");
    this.tokenCache = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return body.access_token;
  }

  async getHistory(id: string): Promise<ReferralHistoryRecord | null> {
    const response = await this.request(`${this.collection("referralHistory")}/${encodeURIComponent(id)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Firebase could not read referral history (${response.status}).`);
    const body = (await response.json()) as { name?: string; fields?: FirestoreFields };
    return historyFromDocument(body.name || id, body.fields ?? {});
  }

  async createHistory(record: ReferralHistoryRecord): Promise<"created" | "exists"> {
    const response = await this.request(
      `${this.collection("referralHistory")}?documentId=${encodeURIComponent(record.id)}`,
      { method: "POST", body: JSON.stringify({ fields: historyFields(record) }) },
    );
    if (response.status === 409) return "exists";
    if (!response.ok) {
      const detail = await response.text();
      if (detail.includes("ALREADY_EXISTS")) return "exists";
      throw new Error(`Firebase could not save referral history (${response.status}).`);
    }
    return "created";
  }

  async listHistory(): Promise<ReferralHistoryRecord[]> {
    return this.listCollection("referralHistory", historyFromDocument);
  }

  async saveLink(record: ReferralLinkRecord): Promise<void> {
    const id = linkDocumentId(record.username);
    const documentUrl = `${this.collection("referralLinks")}/${encodeURIComponent(id)}`;
    const existing = await this.request(documentUrl);
    if (existing.status === 404) {
      const created = await this.request(
        `${this.collection("referralLinks")}?documentId=${encodeURIComponent(id)}`,
        { method: "POST", body: JSON.stringify({ fields: linkFields(record, true) }) },
      );
      if (created.status === 409) return;
      if (!created.ok) throw new Error(`Firebase could not save the referral link (${created.status}).`);
      return;
    }
    if (!existing.ok) throw new Error(`Firebase could not read the referral link (${existing.status}).`);
    const mask = ["profileImage", "link", "domain", "username"]
      .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
      .join("&");
    const patched = await this.request(`${documentUrl}?${mask}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: linkFields(record, false) }),
    });
    if (!patched.ok) throw new Error(`Firebase could not update the referral link (${patched.status}).`);
  }

  async listLinks(): Promise<ReferralLinkRecord[]> {
    return this.listCollection("referralLinks", (_name, fields) => linkFromDocument(fields));
  }

  private async listCollection<T>(
    name: string,
    map: (documentName: string, fields: FirestoreFields) => T,
  ): Promise<T[]> {
    const rows: T[] = [];
    let pageToken = "";
    for (let page = 0; page < 20; page += 1) {
      const token = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
      const response = await this.request(`${this.collection(name)}?pageSize=300${token}`);
      if (response.status === 404) return rows;
      if (!response.ok) throw new Error(`Firebase could not list ${name} (${response.status}).`);
      const body = (await response.json()) as {
        documents?: Array<{ name?: string; fields?: FirestoreFields }>;
        nextPageToken?: string;
      };
      for (const document of body.documents ?? []) {
        rows.push(map(document.name || "", document.fields ?? {}));
      }
      if (!body.nextPageToken) break;
      pageToken = body.nextPageToken;
    }
    return rows;
  }
}
