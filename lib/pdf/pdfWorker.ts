// Web Worker : construit les PDF hors du thread principal pour que l'interface
// reste fluide (animations, saisie, défilement) pendant la génération d'un rapport.
import { runPdfJob, type PdfJob } from "./pdfJobs";

type WorkerScope = {
  onmessage: ((e: MessageEvent<{ id: number; job: PdfJob }>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};
const ctx = self as unknown as WorkerScope;

ctx.onmessage = (e) => {
  const { id, job } = e.data;
  try {
    const { doc, filename } = runPdfJob(job);
    const buffer = doc.output("arraybuffer");
    // Transfert (sans copie) du buffer vers le thread principal.
    ctx.postMessage({ id, ok: true, buffer, filename }, [buffer]);
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
