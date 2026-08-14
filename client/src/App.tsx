import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    setState("loading");
    setErrorMessage("");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch (err: unknown) {
      setState("error");
      const message = err instanceof Error ? err.message : "Unable to connect to TokTickIT API";
      setErrorMessage(message || "Unable to connect to TokTickIT API");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success mb-4" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "loading" && (
        <div className="text-muted mt-3">⌛ Loading...</div>
      )}

      {state === "success" && (
        <div className="mt-3">
          <p className="fw-bold mb-3">System Status: <span className="text-success">Online</span></p>

          <h2 className="h6 fw-bold mb-2">Supported Request Categories:</h2>
          <ol className="list-group list-group-numbered mb-3">
            {categories.map((cat) => (
              <li key={cat.id} className="list-group-item">
                {cat.name}
              </li>
            ))}
          </ol>
        </div>
      )}

      {state === "error" && (
        <div className="mt-3">
          <p className="fw-bold text-danger mb-1">System Status: Offline</p>
          <div className="alert alert-danger py-2 mt-2" role="alert">
            {errorMessage}
          </div>
        </div>
      )}
    </div>
  );
}


