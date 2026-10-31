import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./Product";

const root = createRoot(document.getElementById("root")!);
if (import.meta.env.MODE === "qa") {
  void import("./qa/setup").then(async ({ setupQA }) => {
    setupQA();
    if (window.location.pathname === "/__qa") {
      const { default: VisualQA } = await import("./qa/VisualQA");
      root.render(<VisualQA />);
    } else
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
  });
} else
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
