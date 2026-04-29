import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  checkAndAwardBadges,
  computeHauntedScore,
  createComment,
  createSpot,
  deleteSpot,
  getAllSpotCountsBulk,
  getAllSpots,
  getBadgesForUser,
  getCommentsForSpot,
  getDb,
  getInteractionsForUser,
  getRecentVisitsBySpot,
  getSpotById,
  getSpotCounts,
  getSpotsByCreator,
  getUserById,
  getUserByOpenId,
  getUserInteractionForSpot,
  removeInteraction,
  seedDemoData,
  upsertInteraction,
  getScoreLabel,
} from "./db";
import { storagePut } from "./storage";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Spots Router ─────────────────────────────────────────────────────────────

const spotsRouter = router({
  list: publicProcedure.query(async () => {
    const allSpots = await getAllSpots();
    const countMap = await getAllSpotCountsBulk();
    const visitMap = await getRecentVisitsBySpot();

    return allSpots.map((spot) => {
      const counts = countMap.get(spot.id) || { confirms: 0, debunks: 0, visits: 0 };
      const score = computeHauntedScore(counts, spot.createdAt);
      return {
        ...spot,
        counts,
        hauntedScore: score,
        scoreLabel: getScoreLabel(score),
        lastVisit: visitMap.get(spot.id) ?? null,
      };
    });
  }),

  get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const spot = await getSpotById(input.id);
    if (!spot) throw new TRPCError({ code: "NOT_FOUND", message: "Spot not found" });
    const counts = await getSpotCounts(input.id);
    const creator = await getUserById(spot.creatorId);
    const score = computeHauntedScore(counts, spot.createdAt, creator?.credibilityScore);
    return {
      ...spot,
      counts,
      hauntedScore: score,
      scoreLabel: getScoreLabel(score),
      creator: creator ? { id: creator.id, name: creator.name } : null,
    };
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(255),
        description: z.string().min(10),
        lat: z.number(),
        lng: z.number(),
        address: z.string().optional(),
        category: z.enum(["ghost", "poltergeist", "urban_legend", "cursed_place", "demonic", "cryptid", "other"]),
        photoBase64: z.string().optional(),
        photoMime: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let photoUrl: string | undefined;
      let photoKey: string | undefined;

      if (input.photoBase64 && input.photoMime) {
        const buffer = Buffer.from(input.photoBase64, "base64");
        const key = `spots/${ctx.user.id}-${Date.now()}.jpg`;
        const result = await storagePut(key, buffer, input.photoMime);
        photoUrl = result.url;
        photoKey = result.key;
      }

      const id = await createSpot({
        title: input.title,
        description: input.description,
        lat: input.lat,
        lng: input.lng,
        address: input.address,
        category: input.category,
        photoUrl,
        photoKey,
        creatorId: ctx.user.id,
      });

      // Award explorer badge if user has submitted 3+ spots
      await checkAndAwardBadges(ctx.user.id);

      return { id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const spot = await getSpotById(input.id);
      if (!spot) throw new TRPCError({ code: "NOT_FOUND" });
      if (spot.creatorId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await deleteSpot(input.id);
      return { success: true };
    }),

  feed: publicProcedure
    .input(z.object({ tab: z.enum(["most_haunted", "most_debated", "recently_visited", "scariest_week"]) }))
    .query(async ({ input }) => {
      const allSpots = await getAllSpots();
      const countMap = await getAllSpotCountsBulk();
      const visitMap = await getRecentVisitsBySpot();

      const enriched = allSpots.map((spot) => {
        const counts = countMap.get(spot.id) || { confirms: 0, debunks: 0, visits: 0 };
        const score = computeHauntedScore(counts, spot.createdAt);
        return {
          ...spot,
          counts,
          hauntedScore: score,
          scoreLabel: getScoreLabel(score),
          lastVisit: visitMap.get(spot.id) ?? null,
        };
      });

      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;

      switch (input.tab) {
        case "most_haunted":
          return enriched.sort((a, b) => b.hauntedScore - a.hauntedScore).slice(0, 20);
        case "most_debated":
          return enriched
            .sort((a, b) => {
              const aDebate = a.counts.confirms + a.counts.debunks;
              const bDebate = b.counts.confirms + b.counts.debunks;
              return bDebate - aDebate;
            })
            .slice(0, 20);
        case "recently_visited":
          return enriched
            .filter((s) => s.lastVisit !== null)
            .sort((a, b) => {
              const aTime = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
              const bTime = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
              return bTime - aTime;
            })
            .slice(0, 20);
        case "scariest_week":
          return enriched
            .filter((s) => now - new Date(s.createdAt).getTime() <= oneWeek * 4)
            .sort((a, b) => b.hauntedScore - a.hauntedScore)
            .slice(0, 20);
        default:
          return enriched.slice(0, 20);
      }
    }),
});

// ─── Interactions Router ──────────────────────────────────────────────────────

const interactionsRouter = router({
  interact: protectedProcedure
    .input(
      z.object({
        spotId: z.number(),
        type: z.enum(["confirm", "debunk", "visit"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const spot = await getSpotById(input.spotId);
      if (!spot) throw new TRPCError({ code: "NOT_FOUND", message: "Spot not found" });

      await upsertInteraction({
        userId: ctx.user.id,
        spotId: input.spotId,
        type: input.type,
      });

      await checkAndAwardBadges(ctx.user.id);

      const counts = await getSpotCounts(input.spotId);
      const score = computeHauntedScore(counts, spot.createdAt);
      return { counts, hauntedScore: score, scoreLabel: getScoreLabel(score) };
    }),

  remove: protectedProcedure
    .input(z.object({ spotId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await removeInteraction(ctx.user.id, input.spotId);
      const spot = await getSpotById(input.spotId);
      const counts = await getSpotCounts(input.spotId);
      const score = spot ? computeHauntedScore(counts, spot.createdAt) : 0;
      return { counts, hauntedScore: score, scoreLabel: getScoreLabel(score) };
    }),

  getForSpot: publicProcedure
    .input(z.object({ spotId: z.number() }))
    .query(async ({ input }) => {
      return getSpotCounts(input.spotId);
    }),

  getUserInteraction: protectedProcedure
    .input(z.object({ spotId: z.number() }))
    .query(async ({ input, ctx }) => {
      return getUserInteractionForSpot(ctx.user.id, input.spotId);
    }),

  getUserInteractionsBulk: protectedProcedure.query(async ({ ctx }) => {
    const userInteractions = await getInteractionsForUser(ctx.user.id);
    const map: Record<number, "confirm" | "debunk" | "visit"> = {};
    for (const i of userInteractions) {
      map[i.spotId] = i.type;
    }
    return map;
  }),
});

// ─── Comments Router ──────────────────────────────────────────────────────────

const commentsRouter = router({
  list: publicProcedure
    .input(z.object({ spotId: z.number() }))
    .query(async ({ input }) => {
      const commentList = await getCommentsForSpot(input.spotId);
      const db = await getDb();
      if (!db) return [];

      const enriched = await Promise.all(
        commentList.map(async (c) => {
          const user = await getUserById(c.userId);
          return { ...c, userName: user?.name ?? "Anonymous" };
        })
      );
      return enriched;
    }),

  create: protectedProcedure
    .input(z.object({ spotId: z.number(), content: z.string().min(1).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const comment = await createComment({
        userId: ctx.user.id,
        spotId: input.spotId,
        content: input.content,
      });
      return { ...comment, userName: ctx.user.name ?? "Anonymous" };
    }),
});

// ─── Users Router ─────────────────────────────────────────────────────────────

const usersRouter = router({
  profile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const user = await getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const submitted = await getSpotsByCreator(input.userId);
      const userInteractions = await getInteractionsForUser(input.userId);
      const userBadges = await getBadgesForUser(input.userId);
      const countMap = await getAllSpotCountsBulk();

      const visits = userInteractions.filter((i) => i.type === "visit");
      const visitedSpotIds = Array.from(new Set(visits.map((v) => v.spotId)));
      const visitedSpots = await Promise.all(visitedSpotIds.map((id) => getSpotById(id)));

      const submittedWithScores = submitted.map((spot) => {
        const counts = countMap.get(spot.id) || { confirms: 0, debunks: 0, visits: 0 };
        const score = computeHauntedScore(counts, spot.createdAt);
        return { ...spot, counts, hauntedScore: score, scoreLabel: getScoreLabel(score) };
      });

      return {
        user: { id: user.id, name: user.name, credibilityScore: user.credibilityScore, createdAt: user.createdAt },
        submittedSpots: submittedWithScores,
        visitedSpots: visitedSpots.filter(Boolean),
        badges: userBadges,
        stats: {
          totalSubmitted: submitted.length,
          totalVisits: visits.length,
          totalConfirms: userInteractions.filter((i) => i.type === "confirm").length,
          totalDebunks: userInteractions.filter((i) => i.type === "debunk").length,
        },
      };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    const userBadges = await getBadgesForUser(ctx.user.id);
    const userInteractions = await getInteractionsForUser(ctx.user.id);
    return {
      ...user,
      badges: userBadges,
      stats: {
        totalSubmitted: (await getSpotsByCreator(ctx.user.id)).length,
        totalVisits: userInteractions.filter((i) => i.type === "visit").length,
        totalConfirms: userInteractions.filter((i) => i.type === "confirm").length,
        totalDebunks: userInteractions.filter((i) => i.type === "debunk").length,
      },
    };
  }),
});

// ─── Seed Router ──────────────────────────────────────────────────────────────

const seedRouter = router({
  seed: publicProcedure.mutation(async () => {
    await seedDemoData();
    return { success: true };
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  spots: spotsRouter,
  interactions: interactionsRouter,
  comments: commentsRouter,
  users: usersRouter,
  seed: seedRouter,
});

export type AppRouter = typeof appRouter;
