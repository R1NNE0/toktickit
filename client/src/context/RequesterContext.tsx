import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  RequesterUser,
  getActiveRequesters,
  getStoredRequesterId,
  setStoredRequesterId,
} from "../api.js";

export interface RequesterContextType {
  currentRequester: RequesterUser | null;
  requesters: RequesterUser[];
  loading: boolean;
  error: string | null;
  isSwitching: boolean;
  setIsSwitching: (open: boolean) => void;
  selectRequester: (requester: RequesterUser) => void;
  clearRequester: () => void;
  refreshRequesters: () => Promise<void>;
}

const RequesterContext = createContext<RequesterContextType | undefined>(
  undefined
);

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requesters, setRequesters] = useState<RequesterUser[]>([]);
  const [currentRequester, setCurrentRequester] =
    useState<RequesterUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  const fetchRequesters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getActiveRequesters();
      setRequesters(list);

      // Check if stored requester is still valid
      const storedId = getStoredRequesterId();
      if (storedId) {
        const found = list.find((r) => r.id === storedId);
        if (found) {
          setCurrentRequester(found);
        } else {
          // Stored requester is no longer active or found
          setCurrentRequester(null);
          setStoredRequesterId(null);
        }
      }
    } catch (err: unknown) {
      console.error("Failed to load active requesters:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to connect to TokTickIT API to load requesters.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequesters();
  }, [fetchRequesters]);

  const selectRequester = useCallback((user: RequesterUser) => {
    setCurrentRequester(user);
    setStoredRequesterId(user.id);
    setIsSwitching(false);
  }, []);

  const clearRequester = useCallback(() => {
    setCurrentRequester(null);
    setStoredRequesterId(null);
  }, []);

  return (
    <RequesterContext.Provider
      value={{
        currentRequester,
        requesters,
        loading,
        error,
        isSwitching,
        setIsSwitching,
        selectRequester,
        clearRequester,
        refreshRequesters: fetchRequesters,
      }}
    >
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester(): RequesterContextType {
  const ctx = useContext(RequesterContext);
  if (!ctx) {
    throw new Error("useRequester must be used within a RequesterProvider");
  }
  return ctx;
}
// Issue 2 adapter for existing Requester screens. The legacy selector provider is
// retained only for its historical tests until the Issue 3 cleanup.
export function SessionRequesterProvider({ user, children }: { user: RequesterUser | null; children: ReactNode }) {
  return <RequesterContext.Provider value={{
    currentRequester: user, requesters: user ? [user] : [], loading: false, error: null, isSwitching: false,
    setIsSwitching: () => {}, selectRequester: () => {}, clearRequester: () => {}, refreshRequesters: async () => {}
  }}>{children}</RequesterContext.Provider>;
}
