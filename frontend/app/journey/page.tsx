import JourneyCanvas from "@/components/journey/JourneyCanvas";

export const metadata = {
  title: "Zero University — The Sovereign Cinematic Journey",
  description: "An interactive, scroll-driven cinematic digital experience traveling through organic depths to the sovereign tech metropolis.",
};

export default function JourneyPage() {
  return (
    <main className="w-full min-h-screen bg-black overflow-x-hidden">
      <JourneyCanvas />
    </main>
  );
}
