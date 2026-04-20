import { validateToken } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await validateToken(request);

  if (!user) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  return Response.json({ success: true, user });
}
