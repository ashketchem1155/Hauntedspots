import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Badge,
  Comment,
  InsertBadge,
  InsertComment,
  InsertInteraction,
  InsertSpot,
  InsertUser,
  Interaction,
  Spot,
  User,
  badges,
  comments,
  interactions,
  spots,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

// ─── Spots ────────────────────────────────────────────────────────────────────

export async function createSpot(data: InsertSpot): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(spots).values(data);
  return (result[0] as { insertId: number }).insertId;
}

export async function getSpotById(id: number): Promise<Spot | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(spots).where(eq(spots.id, id)).limit(1);
  return result[0];
}

export async function getAllSpots(): Promise<Spot[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(spots).orderBy(desc(spots.createdAt));
}

export async function getSpotsByCreator(creatorId: number): Promise<Spot[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(spots).where(eq(spots.creatorId, creatorId)).orderBy(desc(spots.createdAt));
}

export async function deleteSpot(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(spots).where(eq(spots.id, id));
}

// ─── Interactions ─────────────────────────────────────────────────────────────

export async function getInteractionsForSpot(spotId: number): Promise<Interaction[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(interactions).where(eq(interactions.spotId, spotId));
}

export async function getInteractionsForUser(userId: number): Promise<Interaction[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(interactions)
    .where(eq(interactions.userId, userId))
    .orderBy(desc(interactions.createdAt));
}

export async function getUserInteractionForSpot(
  userId: number,
  spotId: number
): Promise<Interaction | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(interactions)
    .where(and(eq(interactions.userId, userId), eq(interactions.spotId, spotId)))
    .limit(1);
  return result[0];
}

export async function upsertInteraction(data: InsertInteraction): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete existing interaction for this user+spot (enforce one-per-user-per-spot)
  await db
    .delete(interactions)
    .where(and(eq(interactions.userId, data.userId!), eq(interactions.spotId, data.spotId!)));
  await db.insert(interactions).values(data);
}

export async function removeInteraction(userId: number, spotId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(interactions)
    .where(and(eq(interactions.userId, userId), eq(interactions.spotId, spotId)));
}

export interface SpotCounts {
  confirms: number;
  debunks: number;
  visits: number;
}

export async function getSpotCounts(spotId: number): Promise<SpotCounts> {
  const db = await getDb();
  if (!db) return { confirms: 0, debunks: 0, visits: 0 };
  const rows = await db
    .select({ type: interactions.type, count: sql<number>`count(*)` })
    .from(interactions)
    .where(eq(interactions.spotId, spotId))
    .groupBy(interactions.type);

  const counts: SpotCounts = { confirms: 0, debunks: 0, visits: 0 };
  for (const row of rows) {
    if (row.type === "confirm") counts.confirms = Number(row.count);
    else if (row.type === "debunk") counts.debunks = Number(row.count);
    else if (row.type === "visit") counts.visits = Number(row.count);
  }
  return counts;
}

export async function getAllSpotCountsBulk(): Promise<Map<number, SpotCounts>> {
  const db = await getDb();
  const map = new Map<number, SpotCounts>();
  if (!db) return map;
  const rows = await db
    .select({ spotId: interactions.spotId, type: interactions.type, count: sql<number>`count(*)` })
    .from(interactions)
    .groupBy(interactions.spotId, interactions.type);

  for (const row of rows) {
    const id = row.spotId;
    if (!map.has(id)) map.set(id, { confirms: 0, debunks: 0, visits: 0 });
    const c = map.get(id)!;
    if (row.type === "confirm") c.confirms = Number(row.count);
    else if (row.type === "debunk") c.debunks = Number(row.count);
    else if (row.type === "visit") c.visits = Number(row.count);
  }
  return map;
}

export async function getRecentVisitsBySpot(): Promise<Map<number, Date>> {
  const db = await getDb();
  const map = new Map<number, Date>();
  if (!db) return map;
  const rows = await db
    .select({
      spotId: interactions.spotId,
      lastVisit: sql<Date>`MAX(${interactions.createdAt})`,
    })
    .from(interactions)
    .where(eq(interactions.type, "visit"))
    .groupBy(interactions.spotId);

  for (const row of rows) {
    map.set(row.spotId, new Date(row.lastVisit));
  }
  return map;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getCommentsForSpot(spotId: number): Promise<Comment[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(comments)
    .where(eq(comments.spotId, spotId))
    .orderBy(desc(comments.createdAt));
}

export async function createComment(data: InsertComment): Promise<Comment> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(comments).values(data);
  const insertId = (result[0] as { insertId: number }).insertId;
  const row = await db.select().from(comments).where(eq(comments.id, insertId)).limit(1);
  return row[0];
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export async function getBadgesForUser(userId: number): Promise<Badge[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(badges).where(eq(badges.userId, userId));
}

export async function awardBadge(data: InsertBadge): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Avoid duplicate badges
  const existing = await db
    .select()
    .from(badges)
    .where(and(eq(badges.userId, data.userId!), eq(badges.badgeType, data.badgeType!)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(badges).values(data);
  }
}

export async function checkAndAwardBadges(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const userInteractions = await getInteractionsForUser(userId);
  const confirms = userInteractions.filter((i) => i.type === "confirm").length;
  const debunks = userInteractions.filter((i) => i.type === "debunk").length;
  const visits = userInteractions.filter((i) => i.type === "visit").length;
  const submitted = await getSpotsByCreator(userId);

  // Ghost Hunter: confirmed 5+ spots
  if (confirms >= 5) await awardBadge({ userId, badgeType: "ghost_hunter" });
  // Skeptic: debunked 5+ spots
  if (debunks >= 5) await awardBadge({ userId, badgeType: "skeptic" });
  // Explorer: visited 3+ spots OR submitted 3+ spots
  if (visits >= 3 || submitted.length >= 3) await awardBadge({ userId, badgeType: "explorer" });
}

// ─── Haunted Score Algorithm ──────────────────────────────────────────────────

export function computeHauntedScore(
  counts: SpotCounts,
  createdAt: Date,
  creatorCredibility: number = 100
): number {
  const { confirms, debunks, visits } = counts;
  const total = confirms + debunks;

  // Base score from confirms vs debunks
  let base = 0;
  if (total > 0) {
    base = (confirms / total) * 100;
  }

  // Visit bonus (each visit adds credibility)
  const visitBonus = Math.min(visits * 3, 30);

  // Recency factor: decay over 180 days
  const ageMs = Date.now() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.max(0.5, 1 - ageDays / 180);

  // Credibility weight from creator (0.5x to 1.5x)
  const credWeight = 0.5 + (creatorCredibility / 200);

  // Controversy bonus: high confirms AND high debunks = more engagement
  const controversyBonus = total > 10 ? Math.min((debunks / (total + 1)) * 20, 15) : 0;

  const raw = (base + visitBonus + controversyBonus) * recencyFactor * credWeight;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function getScoreLabel(score: number): "highly_haunted" | "controversial" | "likely_fake" | "unknown" {
  if (score >= 60) return "highly_haunted";
  if (score >= 35) return "controversial";
  if (score > 0) return "likely_fake";
  return "unknown";
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

export async function seedDemoData(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Check if already seeded
  const existing = await db.select().from(spots).where(eq(spots.isSeeded, true)).limit(1);
  if (existing.length > 0) return;

  // Create a seed system user
  await db
    .insert(users)
    .values({
      openId: "seed_system_user",
      name: "The Archivist",
      email: "archivist@hauntedspots.app",
      loginMethod: "system",
      role: "user",
      credibilityScore: 150,
    })
    .onDuplicateKeyUpdate({ set: { name: "The Archivist" } });

  const seedUser = await db
    .select()
    .from(users)
    .where(eq(users.openId, "seed_system_user"))
    .limit(1);
  const seedUserId = seedUser[0]?.id;
  if (!seedUserId) return;

  const seedSpots: InsertSpot[] = [
    {
      title: "Eastern State Penitentiary",
      description:
        "Once the most famous and most expensive prison in the world, Eastern State Penitentiary housed some of America's most notorious criminals. Inmates reported hearing ghostly whispers and cackling laughter echoing through the cellblocks. Shadow figures have been spotted in Cell Block 12, and a shadowy locksmith was seen in the 1990s during renovation work. The prison's solitary confinement practices drove many inmates to madness.",
      lat: 39.9681,
      lng: -75.1727,
      address: "2027 Fairmount Ave, Philadelphia, PA",
      category: "ghost",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "The Winchester Mystery House",
      description:
        "Sarah Winchester, widow of rifle magnate William Winchester, was told by a medium that she must continuously build her house to appease the spirits of those killed by Winchester rifles. The result is a sprawling 160-room Victorian mansion with staircases leading to ceilings, doors opening to walls, and windows built into floors. Construction never stopped for 38 years until Sarah's death in 1922. Visitors report cold spots, moving shadows, and the sound of hammering at night.",
      lat: 37.3184,
      lng: -121.9511,
      address: "525 S Winchester Blvd, San Jose, CA",
      category: "cursed_place",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "Poveglia Island",
      description:
        "Known as one of the most haunted places on Earth, this small island in the Venetian Lagoon served as a quarantine station for plague victims in the 18th century. Over 160,000 people died here. In the 20th century, a psychiatric hospital was built on the island where a doctor allegedly performed gruesome experiments on patients before going mad himself and jumping from the bell tower. The soil is said to be 50% human ash. The Italian government has banned public access.",
      lat: 45.3767,
      lng: 12.3322,
      address: "Poveglia Island, Venice Lagoon, Italy",
      category: "demonic",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "The Stanley Hotel",
      description:
        "The inspiration for Stephen King's 'The Shining,' this grand Colorado hotel has been the site of countless paranormal reports since its opening in 1909. Room 217 is the most famous — King himself stayed there and was inspired by a nightmare he had in that very room. Staff and guests report hearing children playing in empty hallways, pianos playing by themselves in the ballroom, and apparitions of former owner F.O. Stanley in the billiard room.",
      lat: 40.3772,
      lng: -105.5217,
      address: "333 Wonderview Ave, Estes Park, CO",
      category: "ghost",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "Aokigahara Forest",
      description:
        "At the base of Mount Fuji lies Aokigahara, known as the 'Sea of Trees' and Japan's most infamous suicide forest. The dense forest is so thick that wind cannot penetrate it, creating an eerie silence broken only by the sound of footsteps on volcanic rock. Compasses malfunction due to magnetic iron deposits in the soil. Locals believe the forest is haunted by the yūrei — angry spirits of those who died there. Signs at the forest entrance urge visitors to reconsider and seek help.",
      lat: 35.4722,
      lng: 138.6289,
      address: "Aokigahara Forest, Yamanashi Prefecture, Japan",
      category: "urban_legend",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "Château de Brissac",
      description:
        "The tallest castle in France harbors a dark secret — the ghost of Charlotte of France, known as 'La Dame Verte' (The Green Lady). Charlotte was murdered in the castle in the 15th century by her husband who discovered her infidelity. Her ghost, dressed in a green dress with hollow eye sockets and gaping mouth, haunts the tower room where she died. Guests staying in the castle's hotel rooms report waking to find her standing at the foot of their beds.",
      lat: 47.3597,
      lng: -0.4394,
      address: "Château de Brissac, Maine-et-Loire, France",
      category: "ghost",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "Gettysburg Battlefield",
      description:
        "The site of the bloodiest battle of the American Civil War, where over 50,000 soldiers were killed, wounded, or went missing in three days in July 1863. The battlefield is considered one of the most haunted locations in America. Visitors report seeing phantom soldiers marching through the fields at dusk, hearing cannon fire and screams with no source, and photographing orbs and mists in the Devil's Den area. The Triangular Field is particularly active with apparitions.",
      lat: 39.8118,
      lng: -77.2353,
      address: "Gettysburg National Military Park, Gettysburg, PA",
      category: "ghost",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "The Myrtles Plantation",
      description:
        "Built in 1796 on a Tunica burial ground, the Myrtles Plantation in St. Francisville, Louisiana is said to be home to at least 12 ghosts. The most famous is Chloe, a former slave who wore a green turban to hide her mutilated ear. She allegedly poisoned the plantation owner's family and was hanged by fellow slaves. Guests report seeing her apparition in the mirror — a mirror that was never properly cleansed after the family's deaths and is said to trap souls inside.",
      lat: 30.7799,
      lng: -91.3762,
      address: "7747 US-61, St. Francisville, LA",
      category: "poltergeist",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "Leap Castle",
      description:
        "Considered Ireland's most haunted castle, Leap Castle was the site of a massacre in 1532 when the O'Carroll clan killed a rival family during a feast. The castle's dungeon, called the 'Oubliette,' was discovered in the 1900s to contain a pit filled with human remains — thousands of skeletons impaled on wooden spikes. The most terrifying entity is 'The Elemental,' described as the size of a sheep with a decaying smell and black holes for eyes. Mediums refuse to enter the castle.",
      lat: 52.9833,
      lng: -7.9,
      address: "Leap, County Offaly, Ireland",
      category: "demonic",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "Centralia, Pennsylvania",
      description:
        "A ghost town where an underground coal mine fire has been burning since 1962. The fire, which may burn for another 250 years, has caused the ground to collapse and release toxic gases. The population dropped from 1,000 to fewer than 10 residents. Steam rises from cracks in the earth, roads have buckled and split open, and the town inspired the video game and film 'Silent Hill.' Remaining residents report strange sounds from underground and claim the town has a malevolent presence that drove people away.",
      lat: 40.8048,
      lng: -76.3408,
      address: "Centralia, Columbia County, PA",
      category: "urban_legend",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "Island of the Dolls",
      description:
        "On a small island in the canals of Xochimilco near Mexico City, thousands of mutilated dolls hang from trees, their blank eyes staring at visitors. The island's caretaker, Don Julián Santana Barrera, began hanging dolls in the 1950s to appease the spirit of a girl who drowned in the canal. He collected and hung dolls for 50 years until his own death — found drowned in the same spot as the girl. Visitors report the dolls moving their heads, opening their eyes, and whispering to each other.",
      lat: 19.2875,
      lng: -99.0997,
      address: "Isla de las Muñecas, Xochimilco, Mexico City, Mexico",
      category: "cryptid",
      creatorId: seedUserId,
      isSeeded: true,
    },
    {
      title: "Hoia-Baciu Forest",
      description:
        "Known as the 'Bermuda Triangle of Romania,' this forest near Cluj-Napoca has been the site of unexplained phenomena since the 1960s. Trees grow in bizarre twisted shapes, and a circular clearing in the center of the forest refuses to grow vegetation despite fertile soil. Visitors report intense feelings of anxiety, nausea, and being watched. Electronic equipment malfunctions. UFO sightings have been documented since 1968. Locals believe the forest is a portal to another dimension and that those who enter may never return.",
      lat: 46.7667,
      lng: 23.45,
      address: "Hoia-Baciu Forest, Cluj-Napoca, Romania",
      category: "cryptid",
      creatorId: seedUserId,
      isSeeded: true,
    },
  ];

  const insertedIds: number[] = [];
  for (const spot of seedSpots) {
    const result = await db.insert(spots).values(spot);
    insertedIds.push((result[0] as { insertId: number }).insertId);
  }

  // Add seed interactions
  const interactionPatterns = [
    { confirms: 45, debunks: 3, visits: 12 },
    { confirms: 38, debunks: 8, visits: 9 },
    { confirms: 52, debunks: 2, visits: 5 },
    { confirms: 41, debunks: 6, visits: 15 },
    { confirms: 29, debunks: 18, visits: 7 },
    { confirms: 33, debunks: 11, visits: 4 },
    { confirms: 47, debunks: 4, visits: 20 },
    { confirms: 36, debunks: 9, visits: 8 },
    { confirms: 44, debunks: 5, visits: 6 },
    { confirms: 22, debunks: 25, visits: 3 },
    { confirms: 31, debunks: 14, visits: 11 },
    { confirms: 28, debunks: 19, visits: 2 },
  ];

  for (let i = 0; i < insertedIds.length; i++) {
    const spotId = insertedIds[i];
    const pattern = interactionPatterns[i] || { confirms: 10, debunks: 5, visits: 3 };

    // We'll store aggregate counts as virtual users (seed_confirm_N, etc.)
    // Just insert a batch of synthetic interactions using unique fake user IDs
    // We'll use negative IDs conceptually but since we can't, we'll create fake users
    const batchInsert = async (type: "confirm" | "debunk" | "visit", count: number) => {
      const batchValues: InsertInteraction[] = [];
      for (let j = 0; j < count; j++) {
        // Use seed user for aggregation purposes (will be overridden per real user)
        batchValues.push({ userId: seedUserId, spotId, type });
      }
      // Only insert one per type for seed user to avoid constraint issues
      if (batchValues.length > 0) {
        try {
          await db.insert(interactions).values(batchValues[0]);
        } catch (_) {
          // ignore duplicates
        }
      }
    };

    await batchInsert("confirm", pattern.confirms);
    await batchInsert("debunk", pattern.debunks);
    await batchInsert("visit", pattern.visits);
  }
}
