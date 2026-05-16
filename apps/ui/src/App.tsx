import { AppShell, type ScreenId } from "./components/AppShell";
import { useTheme } from "./lib/useTheme";
import { Today } from "./screens/Today";
import { Apps } from "./screens/Apps";
import { Destinations } from "./screens/Destinations";
import { Settings } from "./screens/Settings";
import { WorldMapScreen } from "./screens/Map";
import { Rules } from "./screens/Rules";
import { Reports } from "./screens/Reports";

function renderScreen(screen: ScreenId) {
  switch (screen) {
    case "today":
      return <Today />;
    case "map":
      return <WorldMapScreen />;
    case "apps":
      return <Apps />;
    case "destinations":
      return <Destinations />;
    case "rules":
      return <Rules />;
    case "reports":
      return <Reports />;
    case "settings":
      return <Settings />;
  }
}

export default function App() {
  // Wire the theme/density hook so the data-theme/data-density attributes are applied.
  useTheme();
  return <AppShell renderScreen={renderScreen} />;
}
