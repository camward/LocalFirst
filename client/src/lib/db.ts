import { openDB } from "idb";

export type Point = { x: number; y: number };
export type Stroke = { points: Point[] };
export type DocState = {
  id: string;
  text: string;
  canvas: Stroke[];
  version: number;
  lastSyncedVersion: number;
};

const DB_NAME = "lf-app";
const STORE_NAME = "doc";
const DOC_ID = "main-doc";
const DB_VERSION = 1;

let dbPromise: ReturnType<typeof openDB> | null = null;

const initDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Удаляем старое хранилище, если оно было без keyPath
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        // Создаём новое с keyPath: ключ берётся из doc.id
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      },
    });
  }
  return dbPromise;
};

export const loadState = async (): Promise<DocState | undefined> => {
  const db = await initDB();
  return db.get(STORE_NAME, DOC_ID) as Promise<DocState | undefined>;
};

export const saveState = async (doc: DocState): Promise<void> => {
  const db = await initDB();
  await db.put(STORE_NAME, doc);
};

export const createInitialState = (): DocState => ({
  id: DOC_ID,
  text: "",
  canvas: [],
  version: 0,
  lastSyncedVersion: 0,
});
