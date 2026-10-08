import { redirect } from "next/navigation";

/** No landing wall in front of the lessons: the seeded learner goes straight to the path. */
export default function HomePage() {
  redirect("/learn");
}
