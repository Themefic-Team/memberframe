import { useState, useEffect, useCallback } from "react";

export interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: string; // "free" | "silver" | "gold" | "vip"
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: number; // Unix timestamp
  siteId: string;
}

export function useMemberSession(): {
  session: MemberSessionData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isEligible: (requiredTier: string) => boolean;
  login: (sessionData: MemberSessionData) => void;
  logout: () => void;
} {
  const [session, setSession] = useState<MemberSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("memberframe_session");
        if (raw) {
          const parsed = JSON.parse(raw) as MemberSessionData;
          setSession(parsed);
        } else {
          // Check for legacy session token
          const token = localStorage.getItem("memberframe_session_token");
          if (token) {
            setSession({
              memberId: "mbr_demo_101",
              email: "member@example.com",
              name: "Demo Member",
              activeTier: "silver",
              status: "active",
              currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
              siteId: "site_framer_demo",
            });
          }
        }
      }
    } catch (err) {
      console.warn("[MemberFrame] Failed to read member session:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isEligible = useCallback(
    (requiredTier: string): boolean => {
      if (!session) return false;
      if (session.status !== "active" && session.status !== "trialing") {
        return false;
      }

      if (requiredTier === "free") return true;
      if (requiredTier === "all_paid") {
        return session.activeTier !== "free";
      }

      const tierRanks: Record<string, number> = {
        free: 0,
        silver: 1,
        gold: 2,
        vip: 3,
        pro: 2,
      };

      const userRank = tierRanks[session.activeTier.toLowerCase()] ?? 0;
      const reqRank = tierRanks[requiredTier.toLowerCase()] ?? 1;

      return userRank >= reqRank;
    },
    [session]
  );

  const login = useCallback((sessionData: MemberSessionData) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("memberframe_session", JSON.stringify(sessionData));
      localStorage.setItem("memberframe_session_token", sessionData.memberId);
    }
    setSession(sessionData);
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("memberframe_session");
      localStorage.removeItem("memberframe_session_token");
    }
    setSession(null);
  }, []);

  return {
    session,
    isAuthenticated: Boolean(session),
    isLoading,
    isEligible,
    login,
    logout,
  };
}
