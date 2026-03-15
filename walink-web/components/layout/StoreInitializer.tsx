"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/user.store";

export function StoreInitializer() {
  const fetchUser = useUserStore((s) => s.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return null;
}
