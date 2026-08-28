import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role, User } from "../lib/types";
import { supabase, isConfigured } from "../lib/supabase";
import { auth as localAuth, setCurrentRole } from "../lib/store";

const SESSION_KEY = "trucking-ops-session";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => ({ ok: false, error: "No provider" }),
  logout: async () => {},
  can: () => false,
});

function localLogin(email: string, password: string): { ok: boolean; error?: string } {
  const found = localAuth.login(email, password);
  if (!found) return { ok: false, error: "Invalid email or password." };
  localStorage.setItem(SESSION_KEY, JSON.stringify(found));
  return { ok: true };
}

function localLogout() {
  localStorage.removeItem(SESSION_KEY);
}

function getLocalUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function mapProfileToUser(profile: {
  id: string;
  name: string;
  email?: string;
  role: string;
  status: string;
  created_at: string;
}): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email ?? "",
    role: profile.role as Role,
    status: profile.status as "active" | "inactive",
    created_at: profile.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    !isConfigured ? getLocalUser() : null
  );
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
      if (!isConfigured) return;

      const abortController = new AbortController();

      // Restore session
      supabase!.auth.getSession().then(({ data: { session } }) => {
        if (abortController.signal.aborted) return;
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setLoading(false);
        }
      });

      // Listen for auth changes
      const {
        data: { subscription },
      } = supabase!.auth.onAuthStateChange((event, session) => {
        if (abortController.signal.aborted) return;
        if (event === "SIGNED_IN" && session?.user) {
          fetchProfile(session.user.id);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
        }
      });

      return () => {
        abortController.abort();
        subscription.unsubscribe();
      };
    }, []);

  async function fetchProfile(userId: string) {
      const { data, error } = await supabase!
        .from("profiles")
        .select("*")
        .eq("id", userId);

      if (error || !data || data.length === 0) {
        // No profile row = unprovisioned account. NEVER trust user_metadata.role:
        // it is client-supplied at signUp time and would let anyone claim "owner".
        // (C2 fix — SECURITY-AUDIT.md)
        setUser(null);
        setCurrentRole(null);
      } else {
          const u = mapProfileToUser({ ...data[0], email: data[0].email ?? "" });
          setUser(u);
          setCurrentRole(u.role);
        }
    setLoading(false);
  }

  const login = async (email: string, password: string) => {
    if (!isConfigured) {
      const result = localLogin(email, password);
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const u = JSON.parse(raw) as User;
        setUser(u);
        setCurrentRole(u.role);
      }
      return result;
    }

    const { error } = await supabase!.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const logout = async () => {
    if (!isConfigured) {
      localLogout();
      setUser(null);
      setCurrentRole(null);
      return;
    }
    await supabase!.auth.signOut();
    setUser(null);
    setCurrentRole(null);
  };

  const can = (...roles: Role[]) => (user ? roles.includes(user.role) : false);

  // Sync the current role with the store so client-side authorization
  // checks in tripActions/userActions/etc. can enforce role boundaries.
  useEffect(() => {
    setCurrentRole(user?.role ?? null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);