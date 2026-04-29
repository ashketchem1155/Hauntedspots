import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { HauntedScoreBadge, ScoreRing } from "@/components/HauntedScoreBadge";
import {
  Skull, Eye, MapPin, ChevronLeft, MessageSquare, Clock, User, Send, Ghost,
  CheckCircle, XCircle, Footprints, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const CATEGORY_LABELS: Record<string, string> = {
  ghost: "Ghost", poltergeist: "Poltergeist", urban_legend: "Urban Legend",
  cursed_place: "Cursed Place", demonic: "Demonic", cryptid: "Cryptid", other: "Other",
};

export default function SpotDetail() {
  const [, params] = useRoute("/spot/:id");
  const id = parseInt(params?.id ?? "0");
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [comment, setComment] = useState("");

  const { data: spot, isLoading } = trpc.spots.get.useQuery({ id }, { enabled: !!id });
  const { data: comments = [] } = trpc.comments.list.useQuery({ spotId: id }, { enabled: !!id });
  const { data: userInteraction } = trpc.interactions.getUserInteraction.useQuery(
    { spotId: id },
    { enabled: !!id && isAuthenticated }
  );

  const interactMutation = trpc.interactions.interact.useMutation({
    onSuccess: (data) => {
      utils.spots.get.invalidate({ id });
      toast.success("Interaction recorded!");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = trpc.interactions.remove.useMutation({
    onSuccess: () => {
      utils.spots.get.invalidate({ id });
      utils.interactions.getUserInteraction.invalidate({ spotId: id });
      toast.success("Interaction removed");
    },
  });

  const commentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ spotId: id });
      setComment("");
      toast.success("Comment posted");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleInteract = (type: "confirm" | "debunk" | "visit") => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (userInteraction?.type === type) {
      removeMutation.mutate({ spotId: id });
    } else {
      interactMutation.mutate({ spotId: id, type });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Ghost size={40} className="text-primary animate-pulse" />
          <p className="font-ui text-muted-foreground">Investigating...</p>
        </div>
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Skull size={48} className="text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading text-xl text-foreground mb-2">Spot Not Found</h2>
          <p className="font-body text-muted-foreground mb-6">This location has vanished into the void.</p>
          <Button asChild variant="outline">
            <Link href="/map">Back to Map</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentInteraction = userInteraction?.type;

  return (
    <div className="min-h-screen py-8">
      <div className="container max-w-4xl">
        {/* Back */}
        <Link href="/map" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-ui text-sm mb-6 no-underline transition-colors">
          <ChevronLeft size={14} />
          Back to Map
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className={`cat-${spot.category} text-xs px-2 py-0.5 rounded font-ui`}>
              {CATEGORY_LABELS[spot.category] ?? spot.category}
            </span>
            {spot.creator && (
              <Link href={`/profile/${spot.creator.id}`} className="flex items-center gap-1.5 text-xs font-ui text-muted-foreground hover:text-foreground no-underline">
                <User size={10} />
                {spot.creator.name ?? "Anonymous"}
              </Link>
            )}
          </div>

          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            {spot.title}
          </h1>

          {spot.address && (
            <div className="flex items-center gap-2 text-sm font-ui text-muted-foreground mb-4">
              <MapPin size={14} className="text-primary" />
              {spot.address}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Photo */}
            {spot.photoUrl && (
              <div className="rounded-lg overflow-hidden border border-border">
                <img
                  src={spot.photoUrl}
                  alt={spot.title}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            {/* Description */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Ghost size={16} className="text-primary" />
                The Story
              </h2>
              <p className="font-body text-base text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {spot.description}
              </p>
            </div>

            {/* Community Interactions */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <h2 className="font-heading text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                <Skull size={16} className="text-primary" />
                Community Verdict
              </h2>
              <p className="font-body text-sm text-muted-foreground mb-5">
                {isAuthenticated
                  ? "Cast your verdict. One action per location."
                  : "Sign in to confirm, debunk, or mark as visited."}
              </p>

              {!isAuthenticated && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-secondary mb-5 text-sm font-ui text-muted-foreground">
                  <AlertCircle size={14} className="text-primary shrink-0" />
                  <span>
                    <button
                      onClick={() => (window.location.href = getLoginUrl())}
                      className="text-primary hover:underline"
                    >
                      Sign in
                    </button>{" "}
                    to interact with this spot
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    type: "confirm" as const,
                    label: "Confirm",
                    icon: CheckCircle,
                    count: spot.counts.confirms,
                    activeClass: "bg-green-900/40 border-green-600 text-green-400",
                    hoverClass: "hover:bg-green-900/20 hover:border-green-800",
                  },
                  {
                    type: "debunk" as const,
                    label: "Debunk",
                    icon: XCircle,
                    count: spot.counts.debunks,
                    activeClass: "bg-red-900/40 border-red-600 text-red-400",
                    hoverClass: "hover:bg-red-900/20 hover:border-red-800",
                  },
                  {
                    type: "visit" as const,
                    label: "Mark as Visited",
                    icon: Footprints,
                    count: spot.counts.visits,
                    activeClass: "bg-blue-900/40 border-blue-600 text-blue-400",
                    hoverClass: "hover:bg-blue-900/20 hover:border-blue-800",
                  },
                ].map(({ type, label, icon: Icon, count, activeClass, hoverClass }) => {
                  const isActive = currentInteraction === type;
                  return (
                    <button
                      key={type}
                      onClick={() => handleInteract(type)}
                      disabled={interactMutation.isPending || removeMutation.isPending}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all font-ui text-sm ${
                        isActive
                          ? activeClass
                          : `border-border text-muted-foreground bg-secondary/50 ${hoverClass}`
                      }`}
                    >
                      <Icon size={20} />
                      <span className="font-semibold tabular-nums text-lg">{count}</span>
                      <span className="text-xs opacity-80">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <h2 className="font-heading text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
                <MessageSquare size={16} className="text-primary" />
                Testimonials
                <span className="font-ui text-sm font-normal text-muted-foreground">({comments.length})</span>
              </h2>

              {isAuthenticated && (
                <div className="mb-6">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience or investigation findings..."
                    className="bg-secondary border-border text-foreground font-body resize-none mb-2"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/80 text-primary-foreground font-ui"
                    onClick={() => {
                      if (comment.trim()) commentMutation.mutate({ spotId: id, content: comment.trim() });
                    }}
                    disabled={!comment.trim() || commentMutation.isPending}
                  >
                    <Send size={12} className="mr-1.5" />
                    Post
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="font-body text-muted-foreground text-sm italic text-center py-4">
                    No testimonials yet. Be the first to share your experience.
                  </p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                            <User size={10} className="text-primary" />
                          </div>
                          <span className="font-ui text-sm font-medium text-foreground">
                            {c.userName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-ui text-muted-foreground">
                          <Clock size={10} />
                          {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                      <p className="font-body text-sm text-foreground/80 pl-8">{c.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Score */}
            <div className="bg-card rounded-lg p-6 border border-border flex flex-col items-center">
              <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Haunted Score
              </h3>
              <ScoreRing score={spot.hauntedScore} scoreLabel={spot.scoreLabel} />
            </div>

            {/* Stats */}
            <div className="bg-card rounded-lg p-5 border border-border">
              <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Statistics
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Confirmations", value: spot.counts.confirms, color: "text-green-400", icon: CheckCircle },
                  { label: "Debunks", value: spot.counts.debunks, color: "text-red-400", icon: XCircle },
                  { label: "Visits", value: spot.counts.visits, color: "text-blue-400", icon: Eye },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-ui text-muted-foreground">
                      <Icon size={12} className={color} />
                      {label}
                    </div>
                    <span className={`font-heading text-base font-bold ${color}`}>{value}</span>
                  </div>
                ))}
                <div className="horror-divider my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-ui text-muted-foreground">Total Interactions</span>
                  <span className="font-heading text-base font-bold text-foreground">
                    {spot.counts.confirms + spot.counts.debunks + spot.counts.visits}
                  </span>
                </div>
              </div>
            </div>

            {/* Activity */}
            <div className="bg-card rounded-lg p-5 border border-border">
              <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock size={12} />
                Activity
              </h3>
              <div className="space-y-2 text-xs font-ui text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Submitted {formatDistanceToNow(new Date(spot.createdAt), { addSuffix: true })}
                </div>
                {spot.counts.confirms > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {spot.counts.confirms} people confirmed this spot
                  </div>
                )}
                {spot.counts.debunks > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {spot.counts.debunks} people debunked this spot
                  </div>
                )}
                {spot.counts.visits > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {spot.counts.visits} brave souls visited
                  </div>
                )}
              </div>
            </div>

            {/* Your status */}
            {isAuthenticated && currentInteraction && (
              <div className="bg-card rounded-lg p-4 border border-primary/30 glow-blood">
                <p className="font-ui text-xs text-muted-foreground mb-1">Your verdict</p>
                <p className="font-heading text-sm font-semibold text-primary capitalize">
                  {currentInteraction === "visit" ? "Marked as Visited" : currentInteraction + "ed"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
