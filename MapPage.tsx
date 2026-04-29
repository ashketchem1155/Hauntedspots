import { useState, useCallback, useRef } from "react";
import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";
import { HauntedScoreBadge } from "@/components/HauntedScoreBadge";
import { Link } from "wouter";
import { Eye, MapPin, X, Skull, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORY_LABELS: Record<string, string> = {
  ghost: "Ghost",
  poltergeist: "Poltergeist",
  urban_legend: "Urban Legend",
  cursed_place: "Cursed Place",
  demonic: "Demonic",
  cryptid: "Cryptid",
  other: "Other",
};

type SpotWithScore = {
  id: number;
  title: string;
  description: string;
  lat: number;
  lng: number;
  address?: string | null;
  category: string;
  hauntedScore: number;
  scoreLabel: string;
  counts: { confirms: number; debunks: number; visits: number };
};

function getMarkerColor(scoreLabel: string): string {
  switch (scoreLabel) {
    case "highly_haunted": return "#cc2200";
    case "controversial": return "#cc7700";
    case "likely_fake": return "#226622";
    default: return "#444466";
  }
}

export default function MapPage() {
  const { data: spots = [], isLoading } = trpc.spots.list.useQuery();
  const [selectedSpot, setSelectedSpot] = useState<SpotWithScore | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const handleMapReady = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      // Clear old markers
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      spots.forEach((spot) => {
        const color = getMarkerColor(spot.scoreLabel);

        // Custom SVG marker
        const svgMarker = {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "rgba(255,255,255,0.3)",
          strokeWeight: 1,
          scale: 1.8,
          anchor: new google.maps.Point(12, 22),
        };

        const marker = new google.maps.Marker({
          position: { lat: spot.lat, lng: spot.lng },
          map,
          title: spot.title,
          icon: svgMarker,
          animation: google.maps.Animation.DROP,
        });

        marker.addListener("click", () => {
          setSelectedSpot(spot as SpotWithScore);
          map.panTo({ lat: spot.lat, lng: spot.lng });
        });

        markersRef.current.push(marker);
      });
    },
    [spots]
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Map header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <MapPin size={14} className="text-primary" />
          <span className="font-ui text-sm text-foreground">
            {isLoading ? "Loading..." : `${spots.length} haunted locations`}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-ui text-muted-foreground">
          {[
            { color: "#cc2200", label: "Highly Haunted" },
            { color: "#cc7700", label: "Controversial" },
            { color: "#226622", label: "Likely Fake" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Map + sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <div className="flex-1">
          <MapView
            onMapReady={handleMapReady}
            initialCenter={{ lat: 20, lng: 0 }}
            initialZoom={2}
            className="w-full h-full"
          />
        </div>

        {/* Spot info panel */}
        {selectedSpot && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l border-border overflow-y-auto z-10 shadow-2xl">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <span className={`cat-${selectedSpot.category} text-xs px-2 py-0.5 rounded font-ui`}>
                  {CATEGORY_LABELS[selectedSpot.category] ?? selectedSpot.category}
                </span>
                <button
                  onClick={() => setSelectedSpot(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <h3 className="font-heading text-lg font-semibold text-foreground mb-3">
                {selectedSpot.title}
              </h3>

              <div className="mb-4">
                <HauntedScoreBadge
                  score={selectedSpot.hauntedScore}
                  scoreLabel={selectedSpot.scoreLabel}
                  size="md"
                />
              </div>

              {selectedSpot.address && (
                <div className="flex items-start gap-2 mb-3 text-xs font-ui text-muted-foreground">
                  <MapPin size={12} className="mt-0.5 shrink-0" />
                  <span>{selectedSpot.address}</span>
                </div>
              )}

              <p className="font-body text-sm text-muted-foreground mb-4 line-clamp-4">
                {selectedSpot.description}
              </p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Confirms", value: selectedSpot.counts.confirms, color: "text-green-400" },
                  { label: "Debunks", value: selectedSpot.counts.debunks, color: "text-red-400" },
                  { label: "Visits", value: selectedSpot.counts.visits, color: "text-blue-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-secondary rounded-md p-2 text-center">
                    <div className={`font-heading text-lg font-bold ${color}`}>{value}</div>
                    <div className="font-ui text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              <Button asChild className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-ui">
                <Link href={`/spot/${selectedSpot.id}`}>
                  <Skull size={14} className="mr-2" />
                  Investigate
                  <ChevronRight size={14} className="ml-auto" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
