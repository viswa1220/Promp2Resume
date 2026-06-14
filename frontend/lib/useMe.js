"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Loads the current user; redirects to /login if not signed in.
export function useMe(redirect = true) {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { ok, data } = await api.get("/auth/me");
    if (ok) setMe(data);
    else if (redirect) router.replace("/login");
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);
  return { me, setMe, loading, refresh };
}
