// src/services/githubRepoClient.ts
import {auth} from './auth'

export interface TeamMember {
    id: string;
    name: string;
    role?: string;
    email?: string;
    avatarUrl?: string;
    [key: string]: any;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
    id: string;
    title: string;
    description?: string;
    assigneeId?: string;
    status?: TaskStatus;
    createdAt?: string; // ISO
    updatedAt?: string; // ISO
    [key: string]: any;
}

// ---- Env & helpers -------------------------------------------------------

const PROVIDER = (import.meta as any).env?.VITE_REPO_PROVIDER?.toLowerCase();
const OWNER = (import.meta as any).env?.VITE_REPO_OWNER;
const REPO = (import.meta as any).env?.VITE_REPO_NAME;
const BRANCH = (import.meta as any).env?.VITE_REPO_BRANCH || "main";
const BASEPATH = (((import.meta as any).env?.VITE_REPO_BASEPATH) || "public/data").replace(/^\/+|\/+$/g, "");

if (PROVIDER !== "github") {
    console.warn(`githubRepoClient: expected VITE_REPO_PROVIDER=github, got '${PROVIDER}'`);
}

const GH_API = "https://api.github.com";
const GH_API_VERSION = "2022-11-28";

function checkAuthAndThrow(res: Response, ctx: string) {
    if (res.status === 401 || res.status === 403) {
        auth.handleAuthFailure();
        throw new Error('Нет доступа: ' + ctx + ` (HTTP ${res.status})`);
    }
}

function defaultHeaders(): Record<string, string> {
    const token = auth.getToken();
    return {
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': GH_API_VERSION,
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
    };
}

function pathJoin(...parts: string[]) {
    return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

function encodePath(p: string) {
    return p
        .split("/")
        .map((seg) => encodeURIComponent(seg))
        .join("/");
}

function nowIso() {
    return new Date().toISOString();
}

// Robust UTF-8 <-> base64 for browser
function toBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function fromBase64(b64: string): string {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

// ---- Low-level GitHub Contents API --------------------------------------

type ContentsGet = {
    content: string; // base64
    encoding: "base64";
    sha: string;
    path: string;
    html_url: string;
} & Record<string, any>;

async function getFile(path: string): Promise<{ text: string; sha: string | null }> {
    const url = `${GH_API}/repos/${OWNER}/${REPO}/contents/${encodePath(path)}?ref=${encodeURIComponent(BRANCH)}`;
    console.log("GET GitHub:", url);
    const res = await fetch(url, {headers: defaultHeaders(), cache: "no-store"});
    if (res.status === 404) return {text: "", sha: null};
    if (!res.ok) throw new Error(`GitHub GET failed ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as ContentsGet;
    const text = json.encoding === "base64" ? fromBase64(json.content) : (json as any).content;
    return {text, sha: json.sha};
}

async function putFile(path: string, newText: string, prevSha: string | null, message: string) {
    const url = `${GH_API}/repos/${OWNER}/${REPO}/contents/${encodePath(path)}`;
    const body = {
        message,
        content: toBase64(newText),
        branch: BRANCH,
        ...(prevSha ? {sha: prevSha} : {}),
    };
    const res = await fetch(url, {method: "PUT", headers: defaultHeaders(), body: JSON.stringify(body)});
    if (!res.ok) throw new Error(`GitHub PUT failed ${res.status}: ${await res.text()}`);
    return res.json();
}

async function deleteFile(path: string, sha: string, message: string) {
    const url = `${GH_API}/repos/${OWNER}/${REPO}/contents/${encodePath(path)}`;
    const body = {message, sha, branch: BRANCH};
    const res = await fetch(url, {method: "DELETE", headers: defaultHeaders(), body: JSON.stringify(body)});
    if (!res.ok) throw new Error(`GitHub DELETE failed ${res.status}: ${await res.text()}`);
    return res.json();
}

// ---- JSON-array file helpers --------------------------------------------

type Updater<T> = (items: T[]) => T[];

/**
 * Читает JSON-массив из файла. Если файла нет — возвращает пустой массив и sha=null.
 */
async function readJsonArray<T = any>(path: string): Promise<{ items: T[]; sha: string | null; raw: string }> {
    const {text, sha} = await getFile(path);
    if (!text) return {items: [], sha, raw: ""};
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return {items: parsed as T[], sha, raw: text};
        throw new Error("JSON is not an array");
    } catch (e: any) {
        throw new Error(`Failed to parse JSON at ${path}: ${e?.message || e}`);
    }
}

/**
 * Пишет JSON-массив только если есть реальный diff.
 * Делает одну повторную попытку при конфликте sha.
 */
async function writeJsonArray<T = any>(path: string, update: Updater<T>, commitMsg: string) {
    const writeOnce = async () => {
        const {items: oldItems, sha, raw: oldText} = await readJsonArray<T>(path);
        const newItems = update(oldItems);
        const newText = JSON.stringify(newItems, null, 2) + "\n";

        if (oldText === newText) {
            console.info("writeJsonArray:", path, "— skip PUT (no changes)");
            return {skipped: true};
        }

        return putFile(path, newText, sha, commitMsg);
    };

    try {
        return await writeOnce();
    } catch (e: any) {
        if (String(e).includes("409") || String(e).includes("sha")) {
            const {items: againItems, sha: againSha, raw: againText} = await readJsonArray<T>(path);
            const afterUpdate = update(againItems);
            const afterText = JSON.stringify(afterUpdate, null, 2) + "\n";
            if (afterText === againText) {
                console.info("writeJsonArray:", path, "— server already has desired content, skip PUT");
                return {skipped: true};
            }
            return putFile(path, afterText, againSha, commitMsg);
        }
        throw e;
    }
}

function ensureId<T extends { id?: string }>(obj: T): asserts obj is T & { id: string } {
    if (!obj.id) (obj as any).id = (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now());
}

// ---- Public API: Team ----------------------------------------------------

const TEAM_PATH = pathJoin(BASEPATH, "team.json");

export const teamApi = {
    async list(): Promise<TeamMember[]> {
        const {items} = await readJsonArray<TeamMember>(TEAM_PATH);
        return items;
    },

    async create(member: Omit<TeamMember, "id"> & Partial<Pick<TeamMember, "id">>): Promise<TeamMember> {
        const m = {...member} as TeamMember;
        ensureId(m);
        const createdAt = nowIso();
        await writeJsonArray<TeamMember>(
            TEAM_PATH,
            (items) => {
                if (items.some((i) => i.id === m.id)) throw new Error(`Team member id already exists: ${m.id}`);
                return [...items, {...m, createdAt, updatedAt: createdAt} as any];
            },
            `feat(team): add ${m.name} (${m.id})`
        );
        return m;
    },

    async update(id: string, patch: Partial<TeamMember>): Promise<void> {
        await writeJsonArray<TeamMember>(
            TEAM_PATH,
            (items) => {
                let found = false;
                const next = items.map((i) => {
                    if (i.id !== id) return i;
                    found = true;
                    return {...i, ...patch, updatedAt: nowIso()} as TeamMember;
                });
                if (!found) throw new Error(`Team member not found: ${id}`);
                return next;
            },
            `chore(team): update ${id}`
        );
    },

    async remove(id: string): Promise<void> {
        await writeJsonArray<TeamMember>(
            TEAM_PATH,
            (items) => {
                const before = items.length;
                const next = items.filter((i) => i.id !== id);
                if (next.length === before) throw new Error(`Team member not found: ${id}`);
                return next;
            },
            `chore(team): remove ${id}`
        );
    },
};

// ---- Public API: Tasks ---------------------------------------------------

const TASKS_PATH = pathJoin(BASEPATH, "tasks.json");

const REPORTS_INDEX_PATH = pathJoin(BASEPATH, "reports/index.json");

function reportIdForMonthly(year: number, month: number) {
    const mm = String(month).padStart(2, "0");
    return `R-${year}-${mm}`;
}

export const tasksApi = {
    async list(): Promise<Task[]> {
        const {items} = await readJsonArray<Task>(TASKS_PATH);
        return items;
    },

    async create(task: Omit<Task, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Task, "id">>): Promise<Task> {
        const t = {status: "todo", ...task} as Task;
        ensureId(t);
        const createdAt = nowIso();
        const withMeta = {...t, createdAt, updatedAt: createdAt} as Task;
        await writeJsonArray<Task>(
            TASKS_PATH,
            (items) => {
                if (items.some((i) => i.id === withMeta.id)) throw new Error(`Task id already exists: ${withMeta.id}`);
                return [...items, withMeta];
            },
            `feat(tasks): add ${withMeta.title} (${withMeta.id})`
        );
        return withMeta;
    },

    async update(id: string, patch: Partial<Task>): Promise<Task> {
        let updated!: Task;
        await writeJsonArray<Task>(
            TASKS_PATH,
            (items) => {
                let found = false;
                const next = items.map((i) => {
                    if (i.id !== id) return i;
                    found = true;
                    updated = {...i, ...patch, updatedAt: nowIso()} as Task;
                    return updated;
                });
                if (!found) throw new Error(`Task not found: ${id}`);
                return next;
            },
            `chore(tasks): update ${id}`
        );
        return updated;
    },

    async remove(id: string): Promise<void> {
        await writeJsonArray<Task>(
            TASKS_PATH,
            (items) => {
                const before = items.length;
                const next = items.filter((i) => i.id !== id);
                if (next.length === before) throw new Error(`Task not found: ${id}`);
                return next;
            },
            `chore(tasks): remove ${id}`
        );
    },
};

// ---- Optional: raw file ops (get/put/delete) -----------------------------

export const filesApi = {
    async get(pathRelativeToBase: string) {
        const full = pathJoin(BASEPATH, pathRelativeToBase);
        return getFile(full);
    },
    async put(pathRelativeToBase: string, text: string, message: string) {
        const full = pathJoin(BASEPATH, pathRelativeToBase);
        const {sha, text: old} = await getFile(full);
        if (old === text || (old && (old.trimEnd() + "\n") === (text.trimEnd() + "\n"))) {
            console.info("filesApi.put:", full, "— skip PUT (no changes)");
            return {skipped: true};
        }
        return putFile(full, text.endsWith("\n") ? text : text + "\n", sha, message);
    },
    async delete(pathRelativeToBase: string, message: string) {
        const full = pathJoin(BASEPATH, pathRelativeToBase);
        const {sha} = await getFile(full);
        if (!sha) throw new Error("Cannot delete non-existent file");
        return deleteFile(full, sha, message);
    },
};

async function writeRawJson(path: string, obj: any, commitMsg: string) {
    const text = JSON.stringify(obj, null, 2) + "\n";
    const {sha} = await getFile(path);
    await putFile(path, text, sha || undefined, commitMsg);
}

async function readJsonAtBase<T = any>(pathRelativeToBase: string): Promise<T> {
    const full = pathJoin(BASEPATH, pathRelativeToBase);
    const {text} = await getFile(full);
    if (!text) throw new Error(`File not found: ${full}`);
    try {
        return JSON.parse(text) as T;
    } catch (e: any) {
        throw new Error(`Failed to parse JSON at ${full}: ${e?.message || e}`);
    }
}

async function writeJsonAtBase(pathRelativeToBase: string, obj: any, commitMsg: string) {
    const full = pathJoin(BASEPATH, pathRelativeToBase);
    const text = JSON.stringify(obj, null, 2) + "\n";
    const {sha, text: old} = await getFile(full);
    if (old === text || (old && (old.trimEnd() + "\n") === text)) {
        console.info("writeJsonAtBase:", full, "— skip PUT (no changes)");
        return {skipped: true};
    }
    return putFile(full, text, sha, commitMsg);
}

// ---- Reports API (range by createdAt) ------------------------------------

type DateField = 'createdAt' | 'updatedAt' | 'due';

export const reportsApi = {
    async generateMonthly(year?: number, month?: number, ownerId?: string) {
        const now = new Date();
        const y = year ?? now.getUTCFullYear();
        const m = month ?? (now.getUTCMonth() + 1);

        const start = new Date(Date.UTC(y, m - 1, 1));
        const end = new Date(Date.UTC(y, m, 0)); // последний день месяца (0-й день следующего)

        const startDate = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
        const endDate   = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;

        return this.generateByRange({ startDate, endDate, ownerId: ownerId ?? "—", dateField: 'createdAt' });
    },

    async generateByRange({startDate, endDate, ownerId, dateField = 'createdAt'}: {
        startDate: string;   // YYYY-MM-DD
        endDate: string;     // YYYY-MM-DD
        ownerId?: string;
        dateField?: DateField;
    }) {
        const tasksRel = "tasks.json";
        const tasksPath = pathJoin(BASEPATH, tasksRel);
        let tasksAny: any;
        try {
            const {text} = await getFile(tasksPath);
            tasksAny = text ? JSON.parse(text) : [];
        } catch {
            tasksAny = [];
        }

        const getId       = (t: any) => t.id || t.key || t.ticket || t.uid || "";
        const getDue      = (t: any) => t.due || t.deadline || t.date || "";
        const getStatus   = (t: any) => String(t.status || t.state || "").toLowerCase();
        const getAssignee = (t: any) => t.assigneeId || t.assignee || t.owner || "unassigned";
        const getTags     = (t: any) => t.tags || t.labels || [];

        const getDateForRange = (t: any) => {
            if (dateField === 'createdAt') return t.createdAt || '';
            if (dateField === 'updatedAt') return t.updatedAt || '';
            return getDue(t);
        };

        const from = new Date(startDate + "T00:00:00Z");
        const to   = new Date(endDate   + "T23:59:59Z");

        const inRange = (isoOrDate: string) => {
            if (!isoOrDate) return false;
            const d = new Date(isoOrDate.length === 10 ? (isoOrDate + "T00:00:00Z") : isoOrDate);
            return d >= from && d <= to;
        };

        const rows: any[] = Array.isArray(tasksAny) ? tasksAny : (tasksAny.items ?? []);
        const picked = rows.filter((t: any) => inRange(getDateForRange(t)));

        const totals = {
            tasks: picked.length,
            done: picked.filter((t: any) => getStatus(t) === "done").length,
            overdue: picked.filter((t: any) => {
                const d = getDue(t);
                if (!d) return false;
                const dt = new Date(d.length === 10 ? (d + "T00:00:00Z") : d);
                return dt < new Date() && getStatus(t) !== "done";
            }).length,
        };

        const byStatus = picked.reduce((acc: any, t: any) => {
            const k = getStatus(t) || "unknown";
            acc[k] = (acc[k] ?? 0) + 1;
            return acc;
        }, {});

        const byAssigneeMap: Record<string, { total: number; done: number }> = {};
        for (const t of picked) {
            const k = getAssignee(t);
            byAssigneeMap[k] = byAssigneeMap[k] ?? { total: 0, done: 0 };
            byAssigneeMap[k].total += 1;
            if (getStatus(t) === "done") byAssigneeMap[k].done += 1;
        }
        const byAssignee = Object.entries(byAssigneeMap).map(([key, v]) => ({ key, label: key, ...v }));

        const byTagMap: Record<string, { total: number; done: number }> = {};
        for (const t of picked) {
            for (const tag of getTags(t) || []) {
                byTagMap[tag] = byTagMap[tag] ?? { total: 0, done: 0 };
                byTagMap[tag].total += 1;
                if (getStatus(t) === "done") byTagMap[tag].done += 1;
            }
        }
        const byTag = Object.entries(byTagMap).map(([tag, v]) => ({ tag, ...v }));

        const id = `R-${startDate.replaceAll("-", "")}-${endDate.replaceAll("-", "")}`;
        const createdAt = nowIso();
        const safeOwner = (ownerId && String(ownerId).trim()) ? ownerId : "—";

        const detail = {
            id,
            period: {type: "range" as const, startDate, endDate},
            createdAt,
            ownerId: safeOwner,
            status: "ready" as const,
            source: {
                tasksPath: pathJoin(BASEPATH, "tasks.json"),
                commit: "<commit-sha>",
                filters: { startDate, endDate, dateField }
            },
            metrics: {
                tasksTotal: totals.tasks,
                tasksDone: totals.done,
                tasksOverdue: totals.overdue,
                byStatus, byAssignee, byTag
            },
            topOverdue: picked
                .filter((t: any) => {
                    const d = getDue(t);
                    if (!d) return false;
                    const dt = new Date(d.length === 10 ? (d + "T00:00:00Z") : d);
                    return dt < new Date() && getStatus(t) !== "done";
                })
                .sort((a: any, b: any) => new Date(getDue(b) || 0).valueOf() - new Date(getDue(a) || 0).valueOf())
                .slice(0, 10)
                .map((t: any) => getId(t)),
        };

        const indexRel = "reports/index.json";
        const reportRel = `reports/${id}.json`;

        let index: any;
        try {
            index = await readJsonAtBase<any>(indexRel);
        } catch {
            index = {schema: "v2", items: []};
        }

        const summary = {
            id,
            period: detail.period,
            title: `Отчёт ${startDate} — ${endDate}`,
            createdAt,
            ownerId: safeOwner,
            status: "ready",
            totals: {tasks: totals.tasks, done: totals.done, overdue: totals.overdue},
        };

        await writeJsonAtBase(reportRel, detail, `reports: add ${id}`);

        const items = [summary, ...(index.items || []).filter((i: any) => i.id !== id)];
        await writeJsonAtBase(indexRel, {schema: "v2", items}, `reports: update index ${id}`);

        return {id, summary};
    },
};