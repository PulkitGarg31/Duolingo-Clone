import type { Metadata } from "next";
import { SignupView } from "@/features/auth/SignupView";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return <SignupView />;
}
