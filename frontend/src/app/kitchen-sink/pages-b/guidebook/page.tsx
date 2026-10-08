import { GuidebookView } from "@/features/guidebook/GuidebookView";
import { guidebook, purpleGuidebook } from "../fixtures";

/** Unit 1's full guidebook, then a short unit 2 one to show another unit colour. */
export default function GuidebookPreview() {
  return (
    <div className="space-y-16">
      <GuidebookView guidebook={guidebook} />
      <GuidebookView guidebook={purpleGuidebook} />
    </div>
  );
}
