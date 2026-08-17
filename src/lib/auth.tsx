import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role, User } from "../lib/types";
import { supabase, isConfigured } from "../lib/supabase";
import { auth as localAuth } from "../lib/store";

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
    password: "",
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

    // Restore session
    supabase!.auth.getSession().then(({ data: { session } }) => {
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
      if (event === "SIGNED_IN" && session?.user) {
        fetchProfile(session.user.id);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
      const { data, error } = await supabase!
        .from("profiles")
        .select("*")
        .eq("id", userId);

      if (error || !data || data.length === 0) {
      // Try to get user metadata as fallback
      const { data: userData } = await supabase!.auth.getUser();
      if (userData?.user?.user_metadata) {
        const meta = userData.user.user_metadata;
        setUser(
          mapProfileToUser({
            id: userId,
            name: meta.name ?? "User",
            email: userData.user.email,
            role: meta.role ?? "staff",
            status: "active",
            created_at: userData.user.created_at,
          })
        );
      } else {
        setUser(null);
      }
    } else {
          setUser(mapProfileToUser({ ...data[0], email: data[0].email ?? "" }));
        }
    setLoading(false);
  }

  const login = async (email: string, password: string) => {
    if (!isConfigured) {
      const result = localLogin(email, password);
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setUser(JSON.parse(raw) as User);
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
      return;
    }
    await supabase!.auth.signOut();
    setUser(null);
  };

  const can = (...roles: Role[]) => (user ? roles.includes(user.role) : false);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);