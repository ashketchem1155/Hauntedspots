import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { HauntedScoreBadge } from "@/components/HauntedScoreBadge";
import { Skull, Eye, MapPin, Flame, Clock, Compass, TrendingUp, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CATEGORY_LABELS: Record<string, string> = {
  ghost: "Ghost", poltergeist: "Poltergeist", urban_legend: "Urban Legend",
  cursed_place: "Cursed Place", demonic: "Demonic", cryptid: "Cryptid", other: "Other",
};

type Tab = "most_haunted" | "most_debated" | "recently_visited" | "scariest_week";

const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "most_haunted", label: "Most Haunted", icon: Skull, desc: "Highest haunted score" },
  { id: "most_debated", label: "Most Debated", icon: TrendingUp, desc: "Most community activity" },
  { id: "recently_visited", label: "Recently Visited", icon: Clock, desc: "Latest brave explorers" },
  { id: "scariest_week", label: "Scariest This Week", icon: Flame, desc: "Recent high-score spots" },
];

export default function Feed() {
  const [activeTab, setActiveTab] = useState<Tab>("most_haunted");
  const { data: spots = [], isLoading } = trpc.spots.feed.useQuery({ tab: activeTab });

  return (
    <div className="min-h-screen py-10">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="horror-divider w-6" />
            <span className="font-ui text-xs uppercase tracking-[0.3em] text-primary">Discover</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Discovery Feed</h1>
          <p className="font-body text-muted-foreground mt-2">
            The world's most compelling paranormal locations, ranked by community verdict.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 p-1 bg-card rounded-lg border border-border">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md font-ui text-sm transition-all flex-1 justify-center ${
                activeTab === id
                  ? "bg-primary text-primary-foreground glow-blood"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        {/* Tab description */}
        <div className="flex items-center gap-2 mb-6">
          {(() => {
            const tab = TABS.find((t) => t.id === activeTab)!;
            const Icon = tab.icon;
            return (
              <>
                <Icon size={14} className="text-primary" />
                <span className="font-ui text-sm text-muted-foreground">{tab.desc}</span>
              </>
            );
          })()}
          {!isLoading && (
            <span className="ml-auto font-ui text-xs text-muted-foreground">
              {spots.length} locations
            </span>
          )}
        </div>

        {/* Spots list */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card rounded-lg p-5 border border-border animate-pulse">
                <div className="h-4 bg-secondary rounded w-1/4 mb-3" />
                <div className="h-6 bg-secondary rounded w-3/4 mb-2" />
                <div className="h-4 bg-secondary rounded w-full mb-1" />
                <div className="h-4 bg-secondary rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : spots.length === 0 ? (
          <div className="text-center py-20">
            <Compass size={48} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading text-xl text-foreground mb-2">Nothing here yet</h3>
            <p className="font-body text-muted-foreground">
              {activeTab === "recently_visited"
                ? "No spots have been visited yet. Be the first explorer!"
                : "No spots found. Submit one to get started!"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {spots.map((spot, index) => (
              <Link key={spot.id} href={`/spot/${spot.id}`} className="no-underline block">
                <div className="spot-card bg-card rounded-lg p-5 cursor-pointer">
                  <div className="flex items-start gap-4">
                    {/* Rank */}
                    <div className="shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <span className="font-heading text-sm font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`cat-${spot.category} text-xs px-2 py-0.5 rounded font-ui`}>
                          {CATEGORY_LABELS[spot.category] ?? spot.category}
                        </span>
                        {spot.address && (
                          <span className="flex items-center gap-1 text-xs font-ui text-muted-foreground">
                            <MapPin size={9} />
                            <span className="truncate max-w-40">{spot.address}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="font-heading text-lg font-semibold text-foreground mb-2 line-clamp-1">
                        {spot.title}
                      </h3>

                      <p className="font-body text-sm text-muted-foreground line-clamp-2 mb-3">
                        {spot.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-ui text-muted-foreground">
                        <span className="flex items-center gap-1 text-green-400">
                          <span>✓</span> {spot.counts.confirms}
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                          <span>✗</span> {spot.counts.debunks}
                        </span>
                        <span className="flex items-center gap-1 text-blue-400">
                          <Eye size={10} /> {spot.counts.visits}
                        </span>
                        {spot.lastVisit && (
                          <span className="flex items-center gap-1">
                            <Clock size={9} />
                            {formatDistanceToNow(new Date(spot.lastVisit), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="shrink-0">
                      <HauntedScoreBadge
                        score={spot.hauntedScore}
                        scoreLabel={spot.scoreLabel}
                        size="sm"
                        showLabel={false}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
