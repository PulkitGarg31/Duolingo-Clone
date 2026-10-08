import { ModalsGallery } from "./ModalsGallery";
import { NodeStatesGallery } from "./NodeStatesGallery";
import { UnitsGallery } from "./UnitsGallery";

/** The learning path's parts on fixture data. The whole page in its frame is /kitchen-sink/shell. */
export default function PathKitchenSinkPage() {
  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-12 px-6 py-10">
      <h1 className="text-title-lg text-fg-strong">Learning path</h1>
      <NodeStatesGallery />
      <UnitsGallery />
      <ModalsGallery />
    </main>
  );
}
