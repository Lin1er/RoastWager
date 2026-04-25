import type { QueryClient } from "@tanstack/react-query";

export async function refreshRoastWagerQueries(
  queryClient: QueryClient,
  address?: string,
) {
  const keys = [
    ["feed-posts"],
    ["explore-posts"],
    ["profile-user", address],
    ["profile-posts", address],
    ["profile-wagers", address],
    ["explore-my-wagers", address],
  ];

  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );

  setTimeout(() => {
    void Promise.all(
      keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }, 4000);
}
