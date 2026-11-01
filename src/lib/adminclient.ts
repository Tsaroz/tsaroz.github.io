
export {
  insert, update, remove, list, rpc, nowIso, slugify,
  getSettings, saveSettings, entryNames, invalidateEntries,
} from "./store";
export { userRole } from "./auth";
import { adminToast } from "./admin";

export function adminGuard(): boolean {
  const ok = !!document.getElementById("nr-live-config");
  if (!ok) adminToast("No live backend configured, panel is read-only.", false);
  return ok;
}

export function saved(msg = "Saved to the database.") {
  adminToast(`${msg} Static pages refresh on the next publish.`);
}
