import RenderPage from "./RenderPage";
import ViewerPage from "./ViewerPage";

export default function App() {
  return window.location.pathname === "/render" ? <RenderPage /> : <ViewerPage />;
}
