import SettingsPage from "./components/SettingsPage";
import PreviewPage from "./components/PreviewPage";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const windowType = params.get("window") || "settings";

  if (windowType === "preview") {
    return <PreviewPage />;
  }

  return <SettingsPage />;
}
