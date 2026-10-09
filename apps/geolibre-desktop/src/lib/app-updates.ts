import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";

/** Keep open web sessions informed without discarding their map or unsaved work. */
export function registerAppUpdates() {
  registerSW({
    immediate: true,
    onNeedReload() {
      toast.info("Update available", {
        id: "app-update",
        duration: Infinity,
        description: "Reload to get the latest settings and features. Save any unsaved work first.",
        action: { label: "Reload", onClick: () => window.location.reload() },
      });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const checkForUpdate = () => {
        if (
          document.visibilityState !== "visible" ||
          !navigator.onLine ||
          registration.installing
        ) {
          return;
        }
        void registration.update().catch((error: unknown) => {
          console.warn("[GeoLibre] Could not check for an app update", error);
        });
      };
      window.addEventListener("focus", checkForUpdate);
      window.addEventListener("online", checkForUpdate);
      document.addEventListener("visibilitychange", checkForUpdate);
      window.setInterval(checkForUpdate, 60_000);
    },
    onRegisterError(error) {
      console.error("[GeoLibre] Service worker registration failed", error);
    },
  });
}
