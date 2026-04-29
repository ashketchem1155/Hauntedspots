import { useEffect } from "react";
import { Link } from "wouter";
import { Map, Compass, PlusCircle, Skull, Eye, Ghost, Flame, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { HauntedScoreBadge } from "@/components/HauntedScoreBadge";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const CATEGORY_LABELS: Record<string, string> = {
  ghost: "Ghost",
  poltergeist: "Poltergeist",
  urban_legend: "Urban Legend",
  cursed_place: "Cursed Place",
  demonic: "Demonic",
  cryptid: "Cryptid",
  other: "Other",
};

export default function Home() {
  const { isAuthenticated } = useAuth();
  const seedMutation = trpc.seed.seed.useMutation();
  const { data: topSpots } = trpc.spots.feed.useQuery({ tab: "most_haunted" });

  useEffect(() => {
    seedMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const featured = topSpots?.slice(0, 3) ?? [];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/80" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, oklch(0.52 0.22 25 / 0.3) 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, oklch(0.35 0.14 145 / 0.2) 0%, transparent 40%),
                              radial-gradient(circle at 60% 80%, oklch(0.52 0.22 25 / 0.15) 0%, transparent 40%)`,
          }}
        />

        {/* Fog layers */}
        <div
          className="fog-layer absolute bottom-0 left-0 right-0 h-48 opacity-30 pointer-events-none"
          style={{
            background: "linear-gradient(to top, oklch(0.55 0.005 260 / 0.4), transparent)",
          }}
        />
        <div
          className="fog-layer-2 absolute bottom-0 left-0 right-0 h-32 opacity-20 pointer-events-none"
          style={{
            background: "linear-gradient(to top, oklch(0.52 0.22 25 / 0.15), transparent)",
          }}
        />

        {/* Floating skulls decoration */}
        <div className="absolute top-20 right-10 opacity-10 float hidden lg:block">
          <Skull size={80} className="text-primary" />
        </div>
        <div className="absolute bottom-40 left-10 opacity-8 float hidden lg:block" style={{ animationDelay: "1.5s" }}>
          <Ghost size={60} className="text-accent-foreground" />
        </div>

        <div className="container relative z-10 py-20">
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-6">
              <div className="horror-divider w-8" />
              <span className="font-ui text-xs uppercase tracking-[0.3em] text-primary">
                Explore the Unknown
              </span>
              <div className="horror-divider w-8" />
            </div>

            {/* Title */}
            <h1 className="font-display text-5xl md:text-7xl font-black mb-6 leading-none">
              <span className="text-foreground">Where Fear</span>
              <br />
              <span className="text-gradient-blood glow-blood-text">Meets Truth</span>
            </h1>

            <p className="font-body text-xl text-muted-foreground mb-10 max-w-xl leading-relaxed">
              Discover, investigate, and debate the world's most haunted locations.
              Every spot has a story. Every story has a score. Are you brave enough to find out?
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="bg-primary hover:bg-primary/80 text-primary-foreground font-ui glow-blood px-6"
              >
                <Link href="/map">
                  <Map size={16} className="mr-2" />
                  Explore the Map
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-border text-foreground hover:bg-secondary font-ui px-6"
              >
                <Link href="/feed">
                  <Compass size={16} className="mr-2" />
                  Discovery Feed
                </Link>
              </Button>
              {!isAuthenticated && (
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground font-ui"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  Sign in to submit spots
                  <ChevronRight size={14} className="ml-1" />
                </Button>
              )}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 mt-14 pt-10 border-t border-border">
              {[
                { icon: Skull, label: "Haunted Spots", value: "12+" },
                { icon: Eye, label: "Investigations", value: "200+" },
                { icon: Flame, label: "Debates Active", value: "Live" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <div className="font-heading text-xl font-bold text-foreground">{value}</div>
                    <div className="font-ui text-xs text-muted-foreground">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Spots */}
      {featured.length > 0 && (
        <section className="py-20 border-t border-border">
          <div className="container">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="font-heading text-2xl font-bold text-foreground mb-1">
                  Most Haunted
                </h2>
                <p className="font-body text-muted-foreground">The highest-rated paranormal locations</p>
              </div>
              <Button asChild variant="ghost" className="font-ui text-muted-foreground hover:text-foreground">
                <Link href="/feed">
                  View all <ChevronRight size={14} className="ml-1" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map((spot) => (
                <Link key={spot.id} href={`/spot/${spot.id}`} className="no-underline">
                  <div className="spot-card bg-card rounded-lg p-5 cursor-pointer h-full">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`cat-${spot.category} text-xs px-2 py-0.5 rounded font-ui`}>
                        {CATEGORY_LABELS[spot.category] ?? spot.category}
                      </span>
                      <HauntedScoreBadge
                        score={spot.hauntedScore}
                        scoreLabel={spot.scoreLabel}
                        size="sm"
                        showLabel={false}
                      />
                    </div>

                    <h3 className="font-heading text-base font-semibold text-foreground mb-2 line-clamp-2">
                      {spot.title}
                    </h3>

                    <p className="font-body text-sm text-muted-foreground line-clamp-3 mb-4">
                      {spot.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs font-ui text-muted-foreground border-t border-border pt-3">
                      <span className="flex items-center gap-1">
                        <span className="text-primary">✓</span> {spot.counts.confirms} confirms
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-accent-foreground">✗</span> {spot.counts.debunks} debunks
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={10} /> {spot.counts.visits} visits
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="py-20 border-t border-border">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="font-heading text-2xl font-bold text-foreground mb-3">How It Works</h2>
            <p className="font-body text-muted-foreground max-w-xl mx-auto">
              A battlefield of belief vs. skepticism. Every interaction shapes the truth.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Map,
                title: "Discover Spots",
                desc: "Browse the interactive map to find haunted locations near you or anywhere in the world.",
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                icon: Skull,
                title: "Investigate & React",
                desc: "Confirm, debunk, or mark a spot as visited. Your actions update the Haunted Score in real time.",
                color: "text-accent-foreground",
                bg: "bg-accent/20",
              },
              {
                icon: Flame,
                title: "Earn Badges",
                desc: "Become a Ghost Hunter, Skeptic, or Explorer as you interact with the community.",
                color: "text-yellow-400",
                bg: "bg-yellow-400/10",
              },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="flex flex-col items-center text-center p-6 rounded-lg bg-card border border-border">
                <div className={`w-14 h-14 rounded-full ${bg} flex items-center justify-center mb-4`}>
                  <Icon size={24} className={color} />
                </div>
                <h3 className="font-heading text-base font-semibold text-foreground mb-2">{title}</h3>
                <p className="font-body text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border">
        <div className="container text-center">
          <div
            className="rounded-2xl p-12 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, oklch(0.09 0.008 260), oklch(0.12 0.01 260))",
              border: "1px solid oklch(0.52 0.22 25 / 0.3)",
              boxShadow: "0 0 60px oklch(0.52 0.22 25 / 0.1)",
            }}
          >
            <div className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle at 50% 50%, oklch(0.52 0.22 25 / 0.4) 0%, transparent 60%)",
              }}
            />
            <div className="relative z-10">
              <Ghost size={40} className="text-primary mx-auto mb-4 float" />
              <h2 className="font-heading text-3xl font-bold text-foreground mb-3">
                Know a Haunted Place?
              </h2>
              <p className="font-body text-muted-foreground mb-8 max-w-md mx-auto">
                Submit a location and let the community decide — is it real, or just an urban legend?
              </p>
              {isAuthenticated ? (
                <Button asChild size="lg" className="bg-primary hover:bg-primary/80 text-primary-foreground font-ui glow-blood">
                  <Link href="/submit">
                    <PlusCircle size={16} className="mr-2" />
                    Submit a Haunted Spot
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/80 text-primary-foreground font-ui glow-blood"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  Sign In to Submit
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Ghost size={14} className="text-primary" />
            <span className="font-display text-xs text-muted-foreground">HauntedSpots</span>
          </div>
          <p className="font-ui text-xs text-muted-foreground">
            Explore the unknown. Question everything.
          </p>
        </div>
      </footer>
    </div>
  );
}
