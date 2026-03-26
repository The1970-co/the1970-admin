export const API_URL = "http://localhost:3000";

export async function apiFetch(path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("API error");
  }

  return res.json();
}