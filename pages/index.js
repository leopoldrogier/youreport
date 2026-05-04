import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  useEffect(() => {
    if (status === "authenticated") router.push("/dashboard");
    else if (status === "unauthenticated") router.push("/api/auth/signin");
  }, [status, router]);
  return <div style={{ padding: 24, fontFamily: "system-ui" }}>Redirection…</div>;
}
