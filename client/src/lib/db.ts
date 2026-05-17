import { openDB } from "idb";

export type Stroke = { points: { x: number; y: number }[] };
export type DocState = {
  id: string;
  text: string;
  canvas: Stroke[];
  version: number;
  lastSyncedVersion: number;
};

let db;

export const initDB = async () => {
  if (!db)
    db = await openDB("lf-app", 1, {
      upgrade: (d) => d.createObjectStore("doc"),
    });
  return db;
};

export const loadState = async (id: string) => (await initDB()).get("doc", id);
export const saveState = async (doc: DocState) =>
  (await initDB()).put("doc", doc.id, doc);
