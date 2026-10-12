import type { PdfJob } from "./pdfJobs";

// Client du worker PDF (thread principal) : envoie le job, reçoit le PDF, déclenche
// le téléchargement. Si les Web Workers sont indisponibles ou plantent pour une
// raison d'infrastructure, on retombe sur la génération sur le thread principal
// (comportement d'avant) : un rapport n'est jamais perdu à cause du worker.

/** Erreur levée PAR le constructeur de document (le worker fonctionne, la donnée ou le code de rendu est en cause). */
class PdfBuildError extends Error {}

type Pending = { resolve: (r: { buffer: ArrayBuffer; filename: string }) => void; reject: (e: Error) => void };

const IDLE_TERMINATE_MS = 60_000; // libère la mémoire du worker après 1 min d'inactivité

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function disposeWorker(reason?: Error) {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  worker?.terminate();
  worker = null;
  if (reason) {
    pending.forEach((p) => p.reject(reason));
    pending.clear();
  }
}

function scheduleIdleTerminate() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (pending.size === 0) disposeWorker(); }, IDLE_TERMINATE_MS);
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL("./pdfWorker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent) => {
    const msg = e.data as { id: number; ok: boolean; buffer?: ArrayBuffer; filename?: string; error?: string };
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.ok && msg.buffer && msg.filename) p.resolve({ buffer: msg.buffer, filename: msg.filename });
    else p.reject(new PdfBuildError(msg.error ?? "Échec de la génération du PDF"));
    scheduleIdleTerminate();
  };
  w.onerror = (ev) => disposeWorker(new Error(ev.message || "Le worker PDF a rencontré une erreur"));
  worker = w;
  return w;
}

function download(buffer: ArrayBuffer, filename: string) {
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function renderInWorker(job: PdfJob): Promise<{ buffer: ArrayBuffer; filename: string }> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    try {
      getWorker().postMessage({ id, job });
    } catch (e) {
      pending.delete(id);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/** Génère le rapport (dans un Web Worker) puis le télécharge. */
export async function renderPdf(job: PdfJob): Promise<void> {
  if (typeof Worker !== "undefined") {
    try {
      const { buffer, filename } = await renderInWorker(job);
      download(buffer, filename);
      return;
    } catch (err) {
      // Erreur de construction du document (donnée invalide…) : le worker a bien tourné, inutile de
      // réessayer sur le thread principal, on la remonte à l'appelant.
      if (err instanceof PdfBuildError) throw err;
      console.warn("[pdf] worker indisponible, génération sur le thread principal :", err);
    }
  }
  const { runPdfJob } = await import("./pdfJobs");
  const { doc, filename } = runPdfJob(job);
  doc.save(filename);
}
