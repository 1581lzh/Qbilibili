import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const response = NextResponse.json({ success: true });
  const cookieStore = await cookies();
  const all = cookieStore.getAll();

  for (const c of all) {
    response.cookies.set(c.name, "", { maxAge: 0, path: "/" });
  }

  response.cookies.set("authjs.csrf-token", "", { maxAge: 0, path: "/" });
  response.cookies.set("authjs.callback-url", "", { maxAge: 0, path: "/" });
  response.cookies.set("authjs.session-token", "", { maxAge: 0, path: "/" });
  response.cookies.set("__Secure-authjs.session-token", "", { maxAge: 0, path: "/" });

  return response;
}
