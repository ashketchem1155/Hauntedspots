import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { HauntedScoreBadge } from "@/components/HauntedScoreBadge";
import {
  Skull, Ghost, Eye, MapPin, Star, Shield, Compass, User,
  CheckCircle, XCircle, Footprints, Calendar, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

const CATEGORY_LABELS: Record<string, string> = {
  ghost: "Ghost", poltergeist: "Poltergeist", urban_legend: "Urban Legend",
  cursed_place: "Cursed Place", demonic: "Demonic", cryptid: "Cryptid", other: "Other",
};

const BADGE_CONFIG = {
  ghost_hunter: {
    label: "Ghost Hunter",
    desc: "Confirmed 5+ haunted spots",
    icon: Ghost,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    glow: "glow-blood",
  },
  skeptic: {
    label: "Skeptic",
    desc: "Debunked 5+ spots",
    icon: Shield,
    color: "text-accent-foreground",
    bg: "bg-accent/20",
    border: "border-accent/30",
    glow: "glow-eerie",
  },
  explorer: {
    label: "Explorer",
    desc: "Visited 3+ locations in person",
    icon: Compass,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    glow: "",
  },
};

export default function Profile() {
  const [, params] = useRoute("/profile/:id");
  const { user: authUser, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  // If no ID param, use logged-in user
  const { data: meData } = trpc.users.me.useQuery(undefined, { enabled: isAuthenticated && !params?.id });
  const userId = params?.id ? parseInt(params.id) : meData?.id;

  const { data: profile, isLoading } = trpc.users.profile.useQuery(
    { userId: userId! },
    { enabled: !!userId }
  );

  if (!isAuthenticated && !params?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm">
          <User size={48} className="text-primary mx-auto mb-4" />
          <h2 className="font-heading text-2xl font-bold text-foreground mb-3">Sign In Required</h2>
          <p className="font-body text-muted-foreground mb-6">
            Sign in to view your profile, badges, and investigation history.
          </p>
          <Button
            className="bg-primary hover:bg-primary/80 text-primary-foreground font-ui glow-blood"
            onClick={() => (window.location.href = getLoginUrl())}
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Ghost size={40} className="text-primary animate-pulse" />
      </div>
    );
  }

  const { user, submittedSpots, visitedSpots, badges, stats } = profile;
  const badgeTypes = badges.map((b) => b.badgeType);
  const isOwnProfile = authUser?.id === user.id;

  return (
    <div className="min-h-screen py-10">
      <div className="container max-w-4xl">
        {/* Profile header */}
        <div className="bg-card rounded-xl border border-border p-8 mb-8 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, oklch(0.52 0.22 25) 0%, transparent 60%)",
            }}
          />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center glow-blood shrink-0">
              <User size={32} className="text-primary" />
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="font-heading text-2xl font-bold text-foreground mb-1">
                {user.name ?? "Anonymous Hunter"}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm font-ui text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                </span>
                <span className="flex items-center gap-1">
                  <Star size={12} className="text-yellow-400" />
                  Credibility: {user.credibilityScore}
                </span>
              </div>

              {/* Badges */}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge) => {
                    const config = BADGE_CONFIG[badge.badgeType];
                    const Icon = config.icon;
                    return (
                      <div
                        key={badge.id}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${config.bg} ${config.border} ${config.glow}`}
                      >
                        <Icon size={12} className={config.color} />
                        <span className={`font-ui text-xs font-semibold ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full sm:w-auto">
              {[
                { label: "Submitted", value: stats.totalSubmitted, icon: MapPin, color: "text-primary" },
                { label: "Confirms", value: stats.totalConfirms, icon: CheckCircle, color: "text-green-400" },
                { label: "Debunks", value: stats.totalDebunks, icon: XCircle, color: "text-red-400" },
                { label: "Visits", value: stats.totalVisits, icon: Eye, color: "text-blue-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-secondary rounded-lg p-3 text-center">
                  <Icon size={14} className={`${color} mx-auto mb-1`} />
                  <div className="font-heading text-xl font-bold text-foreground">{value}</div>
                  <div className="font-ui text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Badge showcase */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
            <Star size={16} className="text-yellow-400" />
            Badges
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(BADGE_CONFIG).map(([key, config]) => {
              const earned = badgeTypes.includes(key as "ghost_hunter" | "skeptic" | "explorer");
              const Icon = config.icon;
              return (
                <div
                  key={key}
                  className={`rounded-lg p-4 border transition-all ${
                    earned
                      ? `${config.bg} ${config.border} ${config.glow}`
                      : "bg-secondary/30 border-border opacity-40"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-full ${earned ? config.bg : "bg-secondary"} flex items-center justify-center`}>
                      <Icon size={18} className={earned ? config.color : "text-muted-foreground"} />
                    </div>
                    <div>
                      <div className={`font-heading text-sm font-semibold ${earned ? config.color : "text-muted-foreground"}`}>
                        {config.label}
                      </div>
                      {earned && (
                        <div className="font-ui text-xs text-muted-foreground">Earned</div>
                      )}
                    </div>
                  </div>
                  <p className="font-body text-xs text-muted-foreground">{config.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Submitted spots */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
              <Skull size={16} className="text-primary" />
              Submitted Spots
              <span className="font-ui text-sm font-normal text-muted-foreground">({submittedSpots.length})</span>
            </h2>

            {submittedSpots.length === 0 ? (
              <div className="text-center py-8">
                <Ghost size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">
                  {isOwnProfile ? "You haven't submitted any spots yet." : "No spots submitted yet."}
                </p>
                {isOwnProfile && (
                  <Button asChild size="sm" className="mt-3 bg-primary hover:bg-primary/80 text-primary-foreground font-ui">
                    <Link href="/submit">Submit a Spot</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {submittedSpots.slice(0, 5).map((spot) => (
                  <Link key={spot.id} href={`/spot/${spot.id}`} className="no-underline block">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`cat-${spot.category} text-xs px-1.5 py-0.5 rounded font-ui`}>
                            {CATEGORY_LABELS[spot.category] ?? spot.category}
                          </span>
                        </div>
                        <p className="font-heading text-sm font-semibold text-foreground truncate">
                          {spot.title}
                        </p>
                        <div className="flex items-center gap-3 text-xs font-ui text-muted-foreground mt-0.5">
                          <span className="text-green-400">✓ {spot.counts.confirms}</span>
                          <span className="text-red-400">✗ {spot.counts.debunks}</span>
                          <span className="text-blue-400"><Eye size={8} className="inline" /> {spot.counts.visits}</span>
                        </div>
                      </div>
                      <HauntedScoreBadge score={spot.hauntedScore} scoreLabel={spot.scoreLabel} size="sm" showLabel={false} />
                    </div>
                  </Link>
                ))}
                {submittedSpots.length > 5 && (
                  <p className="font-ui text-xs text-muted-foreground text-center pt-1">
                    +{submittedSpots.length - 5} more spots
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Visit history */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
              <Footprints size={16} className="text-blue-400" />
              Visited Locations
              <span className="font-ui text-sm font-normal text-muted-foreground">({visitedSpots.length})</span>
            </h2>

            {visitedSpots.length === 0 ? (
              <div className="text-center py-8">
                <Compass size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">
                  {isOwnProfile ? "You haven't visited any spots yet." : "No visits recorded yet."}
                </p>
                {isOwnProfile && (
                  <Button asChild size="sm" variant="outline" className="mt-3 border-border font-ui">
                    <Link href="/map">Explore the Map</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {visitedSpots.slice(0, 5).filter(Boolean).map((spot) => (
                  spot && (
                    <Link key={spot.id} href={`/spot/${spot.id}`} className="no-underline block">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-blue-400/10 flex items-center justify-center shrink-0">
                          <Footprints size={12} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-heading text-sm font-semibold text-foreground truncate">
                            {spot.title}
                          </p>
                          {spot.address && (
                            <p className="font-ui text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <MapPin size={8} />
                              {spot.address}
                            </p>
                          )}
                        </div>
                        <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  )
                ))}
                {visitedSpots.length > 5 && (
                  <p className="font-ui text-xs text-muted-foreground text-center pt-1">
                    +{visitedSpots.length - 5} more visits
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
