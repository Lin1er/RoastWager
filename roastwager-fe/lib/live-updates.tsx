"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function LiveUpdatesBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateCore = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["feed-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["explore-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["profile-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["profile-wagers"] }),
        queryClient.invalidateQueries({ queryKey: ["explore-my-wagers"] }),
        queryClient.invalidateQueries({ queryKey: ["post"] }),
      ]);
    };

    const interval = window.setInterval(() => {
      invalidateCore();
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile-user"] }),
        queryClient.invalidateQueries({ queryKey: ["header-user"] }),
      ]);
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [queryClient]);

  return null;
}
