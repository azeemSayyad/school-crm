import { redirect } from "next/navigation";

/**
 * /login is not a real route in this app — the login screen lives
 * at the root (/). This page exists solely to catch any stale links
 * or deep-links to /login and silently redirect them to the root.
 */
export default function LoginRedirect() {
  redirect("/");
}
