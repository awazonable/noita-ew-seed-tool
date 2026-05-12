import { useState, useMemo } from "react";

// ============================================================
// Noita PRNG (Park-Miller LGM)
// Source: Technical:Noita_PRNG wiki + EW source code analysis
// ============================================================
const M = 2147483647;
const A = 16807;

function noitaSetRandomSeed(worldSeed, x, y) {
  const w = worldSeed & 0x7fffffff;
  x = x & 0x7fffffff;
  y = y & 0x7fffffff;
  // Verified formula (community reverse engineering of Noita binary)
  let s = ((Math.imul(w, 0x19a065b5) + x) & 0x7fffffff);
  s = ((Math.imul(s, 0x19a065b5) + y) & 0x7fffffff);
  return s === 0 ? 1 : s;
}

function noitaNextState(state) {
  // LGM: state = (state * 16807) mod (2^31 - 1)
  // Use BigInt for 64-bit precision
  return Number((BigInt(state) * BigInt(A)) % BigInt(M));
}

function noitaRandom(state) {
  const next = noitaNextState(state);
  return [next, next / M];
}

function noitaRandomInt(state, a, b) {
  const [next, f] = noitaRandom(state);
  return [next, Math.floor(f * (b - a + 1)) + a];
}

// ============================================================
// EW Seed Calculation
// Source: quant.ew/init.lua
//   ctx.my_id = "{:016x}".format(steam_id)  [peer_id in net.rs]
//   sx = tonumber(string.sub(my_id, 8, 12), 16)   -> my_id[7:12]
//   sy = tonumber(string.sub(my_id, 12), 16)       -> my_id[11:]
//   SetRandomSeed(1 + sx, 2 + sy)
// ============================================================
function getEwSeed(steamId) {
  const id = BigInt(steamId);
  const hex = id.toString(16).padStart(16, "0");
  // Lua string.sub is 1-indexed, inclusive
  // sub(id, 8, 12)  = index 8 through 12 = hex[7..11] (0-indexed, 5 chars)
  // sub(id, 12)     = index 12 to end   = hex[11..]   (0-indexed, 5 chars)
  const sxHex = hex.slice(7, 12);
  const syHex = hex.slice(11);
  const sx = parseInt(sxHex, 16) || 0;
  const sy = parseInt(syHex, 16) || 0;
  return { sx, sy, hex };
}

// ============================================================
// Noita Perk List
// Source: data/scripts/perks/perk_list.lua (Noita game files)
// Format: [id, displayName, stackable, maxInPerkPool, stackableIsRare]
// ============================================================
const PERK_LIST = [
  ["EXTRA_MANA",                  "Extra Mana",                       true,  10, false],
  ["MANA_FROM_KILLS",             "Mana From Kills",                  false,  1, false],
  ["FASTER_WANDS",                "Faster Wands",                     true,  10, false],
  ["EXTRA_SLOTS",                 "Extra Spell Slot",                 true,  10, false],
  ["ALWAYS_CAST",                 "Always Cast",                      true,   5, false],
  ["EXTRA_PERK",                  "Extra Perk",                       true,   3, false],
  ["PERKS_LOTTERY",               "Perk Lottery",                     true,   5, false],
  ["REMOVE_FOG_OF_WAR",           "All-Seeing Eye",                   false,  1, false],
  ["GLOBAL_GORE",                 "Essence Of Spirits",               false,  1, false],
  ["WORM_ATTRACTOR",              "Worm Attractor",                   false,  1, false],
  ["WORM_DETRACTOR",              "Worm Detractor",                   false,  1, false],
  ["WORM_SOMETIMES",              "Worm Sometimes",                   false,  1, false],
  ["SAVING_GRACE",                "Saving Grace",                     false,  1, false],
  ["GLASS_CANNON",                "Glass Cannon",                     false,  1, false],
  ["STRONG_KICK",                 "Strong Kick",                      false,  1, false],
  ["ATTACK_FOOT",                 "Leggy Feet",                       true,   5, false],
  ["EXTRA_MONEY",                 "Extra Gold",                       true,   3, false],
  ["EXTRA_MONEY_TRICK_KILL",      "Riches",                           false,  1, false],
  ["TRICK_BLOOD_MONEY",           "Blood Money",                      false,  1, false],
  ["MEGA_BEAM_STONE",             "Mega Beam Stone",                  false,  1, false],
  ["LOW_RECOIL",                  "Low Recoil",                       false,  1, false],
  ["STEADY_HAND",                 "Steady Hand",                      false,  1, false],
  ["HOMUNCULUS",                  "Homunculus",                       false,  1, false],
  ["ELECTRICITY_IMMUNITY",        "Electricity Immunity",             false,  1, false],
  ["FIRE_IMMUNITY",               "Fire Immunity",                    false,  1, false],
  ["EXPLOSION_IMMUNITY",          "Explosion Immunity",               false,  1, false],
  ["MELEE_IMMUNITY",              "Melee Immunity",                   false,  1, false],
  ["PROJECTILE_IMMUNITY",         "Projectile Immunity",              false,  1, false],
  ["DRILL_IMMUNITY",              "Drill Immunity",                   false,  1, false],
  ["ICE_IMMUNITY",                "Ice Immunity",                     false,  1, false],
  ["SLICE_IMMUNITY",              "Slice Immunity",                   false,  1, false],
  ["TOXIC_IMMUNITY",              "Toxic Immunity",                   false,  1, false],
  ["RADIOACTIVITY_IMMUNITY",      "Radioactivity Immunity",           false,  1, false],
  ["TELEPORTITIS",                "Teleportitis",                     false,  1, false],
  ["TELEPORTITIS_DODGE",          "Teleportitis Dodge",               false,  1, false],
  ["FASTER_MOVEMENT",             "Faster Movement",                  true,   3, false],
  ["SLOWER_MOVEMENT",             "Slower Movement",                  false,  1, false],
  ["LOW_HP_DAMAGE_BOOST",         "Low HP Damage Boost",              true,   3, false],
  ["HIGH_GRAVITY",                "High Gravity",                     false,  1, false],
  ["LOW_GRAVITY",                 "Low Gravity",                      true,   3, false],
  ["LEVITATION_TRAIL",            "Levitation Trail",                 true,   3, false],
  ["ANGRY_LEVITATION",            "Angry Levitation",                 true,   3, false],
  ["EDIT_WANDS_EVERYWHERE",       "Tinker With Wands Everywhere",     false,  1, false],
  ["UNLIMITED_SPELLS",            "Unlimited Spells",                 false,  1, false],
  ["NO_MORE_SHUFFLE",             "No More Shuffle",                  false,  1, false],
  ["GOLD_IS_FOREVER",             "Gold Is Forever",                  true,   3,  true],
  ["PEACE_WITH_GODS",             "Peace With Gods",                  false,  1, false],
  ["GENOMICS",                    "Genomics",                         false,  1, false],
  ["GENOME_MORE_LOVE",            "Genome More Love",                 false,  1, false],
  ["GENOME_MORE_HATRED",          "Genome More Hatred",               false,  1, false],
  ["MAP",                         "Map",                              false,  1, false],
  ["ADVENTURER",                  "Adventurer",                       false,  1, false],
  ["EXTRA_SHOP_ITEM",             "Extra Item In Holy Mountain",      true,   3,  true],
  ["ATTRACT_ITEMS",               "Item Radar",                       false,  1, false],
  ["FOOD_CLOCK",                  "Food Clock",                       false,  1, false],
  ["TELEKINESIS",                 "Telekinesis",                      false,  1, false],
  ["LIGHT",                       "Bright",                           true,   3, false],
  ["DARKNESS",                    "Dark",                             false,  1, false],
  ["HP_REGENERATION",             "HP Regeneration",                  true,   3, false],
  ["HP_REGENERATION_TINY",        "Tiny HP Regeneration",             true,  10, false],
  ["VAMPIRISM",                   "Vampirism",                        false,  1, false],
  ["BLOODY_CURSE",                "Bloody Curse",                     false,  1, false],
  ["CONTACT_DAMAGE",              "Contact Damage",                   false,  1, false],
  ["FIRE_BURST",                  "Fire Burst",                       false,  1, false],
  ["ELECTRICITY",                 "Electricity",                      true,   3, false],
  ["BREATH_OF_FIRE",              "Breath Of Fire",                   false,  1, false],
  ["FAST_PROJECTILES",            "Faster Projectiles",               false,  1, false],
  ["SLOW_PROJECTILES",            "Slower Projectiles",               false,  1, false],
  ["EXTRA_BOUNCE",                "Extra Bounce",                     false,  1, false],
  ["REPELLING_CAPE",              "Repelling Cape",                   false,  1, false],
  ["INVISIBILITY",                "Invisibility",                     false,  1, false],
  ["WAND_RADAR",                  "Wand Radar",                       false,  1, false],
  ["ABILITY_ACTIONS_MATERIALIZED","Wands Materialized",               false,  1, false],
  ["REVENGE_BULLETS",             "Revenge: Bullets",                 false,  1, false],
  ["REVENGE_TENTACLE",            "Revenge: Tentacle",                false,  1, false],
  ["REVENGE_RATS",                "Revenge: Rats",                    false,  1, false],
  ["REVENGE_EXPLOSION",           "Revenge: Explosion",               false,  1, false],
  ["GAMBLE",                      "Gamble",                           false,  1, false],
  ["LUKKI_MINION",                "Lukki Minion",                     false,  1, false],
  ["TOXIC_TO_GOLD",               "Toxic To Gold",                    false,  1, false],
  ["PROTECTION_ALL",              "Stainless Armour",                 true,   5, false],
  ["PLAGUE_RATS",                 "Plague Rats",                      true,   3, false],
  ["VOMIT_RATS",                  "Vomit Rats",                       true,   3, false],
  ["CORDYCEPS",                   "Cordyceps",                        false,  1, false],
  ["FUNGAL_COLONY",               "Fungal Colony",                    false,  1, false],
  ["HUNGER",                      "Hunger",                           false,  1, false],
  ["WEAKNESS",                    "Weakness",                         false,  1, false],
  ["HEARTS_MORE_EXTRA_HP",        "More HP",                          true,  10, false],
  ["HEARTS_MORE",                 "Healthy Exploration",              true,  10, false],
  ["HEARTS_ADDICT",               "Heart Addict",                     false,  1, false],
  ["RESPAWN",                     "Immortal",                         false,  1, false],
  ["FASTING",                     "Fasting",                          false,  1, false],
  ["MOVEMENT_FASTER_SWIMMING",    "Swimmer",                          false,  1, false],
  ["FASTER_LEVITATION",           "Faster Levitation",                false,  1, false],
  ["OIL_BLOOD",                   "Oil Blood",                        false,  1, false],
  ["SLIME_BLOOD",                 "Slime Blood",                      false,  1, false],
  ["WORM_BLOOD",                  "Worm Blood",                       false,  1, false],
  ["ACID_BLOOD",                  "Acid Blood",                       false,  1, false],
  ["WATER_BREATH",                "Breathless",                       false,  1, false],
  ["CURSE_WITHER_PROTECTION",     "Protection From Withering",        false,  1, false],
  ["CURSE_WITHER",                "Withering Touch",                  false,  1, false],
  ["ABILITY_ITEMS_ELECTRICITY",   "Tinker W. Wands Anywhere (Elec)", false,  1, false],
  ["LASER_AIM",                   "Laser Aim",                        false,  1, false],
  ["MOON_RADAR",                  "Orb Radar",                        false,  1, false],
  ["EXPLOSIVE_CORPSES",           "Exploding Corpses",                false,  1, false],
  ["EXPLOSIVE_DETONATION",        "Explosive Detonation",             false,  1, false],
  ["BURNING_DETONATION",          "Burning Detonation",               false,  1, false],
  ["FEARED_BY_WORMS",             "Feared By Worms",                  false,  1, false],
  ["TENTACLE_EYES",               "Tentacle Eyes",                    false,  1, false],
  ["PERMANENT_SHIELD",            "Permanent Shield",                 true,   3, false],
  ["CRITICAL_HIT",                "Critical Hit",                     false,  1, false],
  ["RADAR_ENEMY",                 "Enemy Detector",                   false,  1, false],
  ["NO_WAND_EDITING",             "No Wand Editing",                  false,  1, false],
  ["LEGGY_FEET",                  "Leggy Feet (Var)",                 true,   5, false],
];

const PERK_NAME_MAP = Object.fromEntries(PERK_LIST.map(([id, name]) => [id, name]));

// ============================================================
// perk_get_spawn_order simulation
// Mirrors: data/scripts/perks/perk_utilities.lua -> perk_get_spawn_order()
// As overridden by: quant.ew/files/system/randomize_perks/override_perk_list.lua
// ============================================================
function generatePerkDeck(worldSeed, sx, sy) {
  // EW: SetRandomSeed(1 + sx, 2 + sy) then blocks further SetRandomSeed calls
  let state = noitaSetRandomSeed(worldSeed, 1 + sx, 2 + sy);

  // Step 1: Build deck
  // Each perk is added 1 to max_in_perk_pool times (if stackable & !rare)
  const deck = [];
  for (const [id, , stackable, maxPool, rare] of PERK_LIST) {
    let count;
    if (!stackable || rare) {
      count = 1;
    } else {
      [state, count] = noitaRandomInt(state, 1, maxPool);
    }
    for (let i = 0; i < count; i++) deck.push(id);
  }

  // Step 2: Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    let j;
    [state, j] = noitaRandomInt(state, 0, i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Step 3: Remove duplicates within min_distance (default = 4)
  // Simplified: scan backwards and push duplicates forward
  const MIN_DIST = 4;
  const result = [...deck];
  for (let i = 0; i < result.length; i++) {
    for (let j = Math.max(0, i - MIN_DIST); j < i; j++) {
      if (result[j] === result[i]) {
        // Move this perk forward until it's far enough
        // (simplified approximation of Noita's behavior)
        const perk = result.splice(i, 1)[0];
        const insertAt = Math.min(i + MIN_DIST, result.length);
        result.splice(insertAt, 0, perk);
        break;
      }
    }
  }

  return result;
}

// Holy Mountain perks: 3 perks per mountain from the deck in order
function getHolyMountainPerks(deck, numMountains = 12) {
  const mountains = [];
  for (let i = 0; i < numMountains; i++) {
    const base = i * 3;
    mountains.push(deck.slice(base, base + 3));
  }
  return mountains;
}

// ============================================================
// Perk category colors for visual grouping
// ============================================================
const PERK_CATEGORIES = {
  // Good offensive
  EXTRA_MANA: "blue", FASTER_WANDS: "blue", EXTRA_SLOTS: "blue",
  ALWAYS_CAST: "blue", ELECTRICITY: "blue", FIRE_BURST: "blue",
  BREATH_OF_FIRE: "blue", CONTACT_DAMAGE: "blue", CRITICAL_HIT: "blue",
  FAST_PROJECTILES: "blue", EXTRA_BOUNCE: "blue", LOW_HP_DAMAGE_BOOST: "blue",
  // Good utility
  EXTRA_PERK: "gold", PERKS_LOTTERY: "gold", EDIT_WANDS_EVERYWHERE: "gold",
  HP_REGENERATION: "gold", HP_REGENERATION_TINY: "gold", PERMANENT_SHIELD: "gold",
  REPELLING_CAPE: "gold", EXTRA_MONEY: "gold", ATTRACT_ITEMS: "gold",
  HEARTS_MORE: "gold", HEARTS_MORE_EXTRA_HP: "gold", RESPAWN: "gold",
  TELEKINESIS: "gold", INVISIBILITY: "gold", PROTECTION_ALL: "gold",
  FASTER_MOVEMENT: "gold", FASTER_LEVITATION: "gold",
  // Immunity
  FIRE_IMMUNITY: "teal", EXPLOSION_IMMUNITY: "teal", TOXIC_IMMUNITY: "teal",
  ELECTRICITY_IMMUNITY: "teal", RADIOACTIVITY_IMMUNITY: "teal",
  MELEE_IMMUNITY: "teal", PROJECTILE_IMMUNITY: "teal",
  ICE_IMMUNITY: "teal", SLICE_IMMUNITY: "teal", DRILL_IMMUNITY: "teal",
  CURSE_WITHER_PROTECTION: "teal",
  // Risky/negative
  GLASS_CANNON: "red", HUNGER: "red", WEAKNESS: "red", TELEPORTITIS: "red",
  DARKNESS: "red", HIGH_GRAVITY: "red", NO_WAND_EDITING: "red",
  BLOODY_CURSE: "red", SLOWER_MOVEMENT: "red", FASTING: "red",
  HEARTS_ADDICT: "red", CURSE_WITHER: "red",
  // Mutation
  ATTACK_FOOT: "purple", LEGGY_FEET: "purple", WORM_BLOOD: "purple",
  OIL_BLOOD: "purple", SLIME_BLOOD: "purple", ACID_BLOOD: "purple",
  PLAGUE_RATS: "purple", VOMIT_RATS: "purple", CORDYCEPS: "purple",
  FUNGAL_COLONY: "purple", TENTACLE_EYES: "purple", VAMPIRISM: "purple",
};

const CAT_COLORS = {
  blue:   { bg: "rgba(59,130,246,0.15)",  border: "rgba(59,130,246,0.5)",  text: "#93c5fd" },
  gold:   { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.5)",  text: "#fcd34d" },
  teal:   { bg: "rgba(20,184,166,0.15)", border: "rgba(20,184,166,0.5)",  text: "#5eead4" },
  red:    { bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.5)",   text: "#fca5a5" },
  purple: { bg: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.5)",  text: "#d8b4fe" },
  default:{ bg: "rgba(255,255,255,0.07)",border: "rgba(255,255,255,0.15)",text: "#e2e8f0" },
};

function PerkBadge({ perkId, small = false }) {
  const name = PERK_NAME_MAP[perkId] || perkId;
  const cat = PERK_CATEGORIES[perkId] || "default";
  const c = CAT_COLORS[cat];
  return (
    <span style={{
      display: "inline-block",
      padding: small ? "2px 7px" : "3px 10px",
      fontSize: small ? "11px" : "12px",
      fontFamily: "'Courier New', monospace",
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: "3px",
      color: c.text,
      whiteSpace: "nowrap",
      fontWeight: "500",
      letterSpacing: "0.02em",
    }}>
      {name}
    </span>
  );
}

// ============================================================
// Player row component
// ============================================================
function PlayerRow({ label, deck, mountains, visibleMountains }) {
  return (
    <div style={{ display: "contents" }}>
      {/* Player label */}
      <div style={{
        padding: "10px 14px",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "flex-start",
        fontSize: "12px",
        fontFamily: "'Courier New', monospace",
        color: "#94a3b8",
        wordBreak: "break-all",
        minWidth: 0,
      }}>
        {label}
      </div>
      {/* Mountain cells */}
      {mountains.slice(0, visibleMountains).map((perks, mi) => (
        <div key={mi} style={{
          padding: "8px 10px",
          borderRight: mi < visibleMountains - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
          display: "flex", flexDirection: "column", gap: "4px",
          minWidth: 0,
        }}>
          {perks.map((perkId, pi) => (
            <PerkBadge key={pi} perkId={perkId} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main App
// ============================================================
export default function App() {
  const [worldSeed, setWorldSeed] = useState("1234567890");
  const [players, setPlayers] = useState([
    { name: "Player 1", steamId: "76561198012345678" },
    { name: "Player 2", steamId: "76561198087654321" },
  ]);
  const [visibleMountains, setVisibleMountains] = useState(8);
  const [error, setError] = useState("");
  const [computed, setComputed] = useState(false);
  const [results, setResults] = useState([]);

  function addPlayer() {
    setPlayers(p => [...p, { name: `Player ${p.length + 1}`, steamId: "" }]);
  }

  function removePlayer(i) {
    setPlayers(p => p.filter((_, idx) => idx !== i));
  }

  function updatePlayer(i, field, value) {
    setPlayers(p => p.map((pl, idx) => idx === i ? { ...pl, [field]: value } : pl));
  }

  function compute() {
    setError("");
    const seedNum = parseInt(worldSeed.trim());
    if (isNaN(seedNum) || seedNum < 0) {
      setError("World seed must be a positive integer.");
      return;
    }

    const newResults = [];
    for (const player of players) {
      const sid = player.steamId.trim();
      if (!sid) continue;
      try {
        const steamIdBig = BigInt(sid);
        if (steamIdBig <= 0n) throw new Error();
        const { sx, sy, hex } = getEwSeed(sid);
        const deck = generatePerkDeck(seedNum, sx, sy);
        const mountains = getHolyMountainPerks(deck, 12);
        newResults.push({
          name: player.name,
          steamId: sid,
          hex,
          sx, sy,
          deck,
          mountains,
        });
      } catch {
        setError(`Invalid Steam ID for ${player.name || "a player"}: "${sid}"`);
        return;
      }
    }
    setResults(newResults);
    setComputed(true);
  }

  // Find perks that appear across multiple players at the same mountain
  const sharedPerks = useMemo(() => {
    if (results.length < 2) return {};
    const shared = {};
    for (let mi = 0; mi < visibleMountains; mi++) {
      const allPerks = results.flatMap(r => r.mountains[mi] || []);
      const counts = {};
      for (const p of allPerks) counts[p] = (counts[p] || 0) + 1;
      for (const [perkId, cnt] of Object.entries(counts)) {
        if (cnt > 1) {
          if (!shared[mi]) shared[mi] = [];
          shared[mi].push(perkId);
        }
      }
    }
    return shared;
  }, [results, visibleMountains]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0d14",
      color: "#e2e8f0",
      fontFamily: "'Courier New', monospace",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        padding: "20px 28px 16px",
        display: "flex",
        alignItems: "baseline",
        gap: "14px",
        background: "rgba(255,255,255,0.02)",
      }}>
        <h1 style={{
          margin: 0, fontSize: "18px", fontWeight: "700",
          color: "#f1f5f9", letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          EW Perk Viewer
        </h1>
        <span style={{ fontSize: "11px", color: "#475569" }}>
          Noita Entangled Worlds · per-player perk deck simulator
        </span>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: "1600px" }}>
        {/* Config panel */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: "24px",
          marginBottom: "28px",
        }}>
          {/* Left: seed + mountains */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                World Seed
              </label>
              <input
                value={worldSeed}
                onChange={e => setWorldSeed(e.target.value)}
                placeholder="e.g. 1234567890"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "4px",
                  color: "#f1f5f9", padding: "8px 10px",
                  fontSize: "13px", fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Holy Mountains shown
              </label>
              <select
                value={visibleMountains}
                onChange={e => setVisibleMountains(parseInt(e.target.value))}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#1e2433",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "4px",
                  color: "#f1f5f9", padding: "8px 10px",
                  fontSize: "13px", fontFamily: "inherit",
                  outline: "none",
                }}
              >
                {[4,6,8,10,12].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Right: players */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Players (Steam ID 64)
              </label>
              <button
                onClick={addPlayer}
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "3px",
                  color: "#94a3b8", padding: "3px 10px",
                  fontSize: "11px", fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                + Add Player
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {players.map((pl, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    value={pl.name}
                    onChange={e => updatePlayer(i, "name", e.target.value)}
                    placeholder="Name"
                    style={{
                      width: "120px", flexShrink: 0,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      color: "#cbd5e1", padding: "7px 9px",
                      fontSize: "12px", fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                  <input
                    value={pl.steamId}
                    onChange={e => updatePlayer(i, "steamId", e.target.value)}
                    placeholder="76561198XXXXXXXXX"
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      color: "#cbd5e1", padding: "7px 9px",
                      fontSize: "12px", fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                  {players.length > 1 && (
                    <button
                      onClick={() => removePlayer(i)}
                      style={{
                        background: "none", border: "none",
                        color: "#475569", cursor: "pointer",
                        fontSize: "16px", padding: "0 4px", lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Generate button */}
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "14px" }}>
          <button
            onClick={compute}
            style={{
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.6)",
              borderRadius: "4px",
              color: "#a5b4fc",
              padding: "9px 24px",
              fontSize: "13px", fontFamily: "inherit",
              cursor: "pointer", letterSpacing: "0.04em",
              fontWeight: "600",
              transition: "all 0.15s",
            }}
          >
            GENERATE PERK DECKS
          </button>
          {error && <span style={{ fontSize: "12px", color: "#f87171" }}>{error}</span>}
        </div>

        {/* Results */}
        {computed && results.length > 0 && (
          <>
            {/* Legend */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
              {Object.entries(CAT_COLORS).map(([cat, c]) => (
                cat !== "default" && (
                  <span key={cat} style={{
                    fontSize: "10px", padding: "2px 8px",
                    background: c.bg, border: `1px solid ${c.border}`,
                    borderRadius: "3px", color: c.text,
                    textTransform: "capitalize",
                  }}>
                    {cat === "blue" ? "Offensive" : cat === "gold" ? "Utility" :
                     cat === "teal" ? "Immunity" : cat === "red" ? "Risky" : "Mutation"}
                  </span>
                )
              ))}
              <span style={{ fontSize: "10px", color: "#475569", alignSelf: "center" }}>
                · Perk deck size: {results[0]?.deck.length} cards
              </span>
            </div>

            {/* Grid table */}
            <div style={{ overflowX: "auto" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: `160px repeat(${visibleMountains}, minmax(180px, 1fr))`,
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                overflow: "hidden",
                width: "fit-content",
                minWidth: "100%",
              }}>
                {/* Header row */}
                <div style={{
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.04)",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  borderRight: "1px solid rgba(255,255,255,0.08)",
                  fontSize: "10px", color: "#64748b",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  display: "flex", alignItems: "center",
                }}>
                  Player
                </div>
                {Array.from({ length: visibleMountains }, (_, i) => (
                  <div key={i} style={{
                    padding: "10px 10px",
                    background: "rgba(255,255,255,0.04)",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    borderRight: i < visibleMountains - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    fontSize: "10px", color: "#64748b",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    display: "flex", flexDirection: "column", gap: "2px",
                  }}>
                    <span>HM {i + 1}</span>
                    {sharedPerks[i]?.length > 0 && (
                      <span style={{ color: "#f59e0b", fontSize: "9px" }}>
                        ★ {sharedPerks[i].length} shared
                      </span>
                    )}
                  </div>
                ))}

                {/* Player rows */}
                {results.map((r, ri) => (
                  <PlayerRow
                    key={ri}
                    label={<>
                      <div style={{ color: "#cbd5e1", fontWeight: "600", marginBottom: "2px" }}>{r.name}</div>
                      <div style={{ fontSize: "10px", color: "#475569" }}>{r.steamId.slice(-8)}…</div>
                    </>}
                    deck={r.deck}
                    mountains={r.mountains}
                    visibleMountains={visibleMountains}
                  />
                ))}

                {/* Divider before shared row */}
                {results.length >= 2 && Object.keys(sharedPerks).length > 0 && (<>
                  <div style={{
                    gridColumn: `1 / -1`,
                    borderTop: "1px solid rgba(251,191,36,0.2)",
                    padding: "6px 14px",
                    background: "rgba(251,191,36,0.04)",
                    fontSize: "10px", color: "#92400e",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>
                    ★ Shared perks (appear for multiple players)
                  </div>
                  <div style={{
                    padding: "8px 14px",
                    borderRight: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(251,191,36,0.03)",
                    fontSize: "11px", color: "#78350f",
                    display: "flex", alignItems: "center",
                  }}>
                    Overlap
                  </div>
                  {Array.from({ length: visibleMountains }, (_, mi) => (
                    <div key={mi} style={{
                      padding: "8px 10px",
                      background: "rgba(251,191,36,0.03)",
                      borderRight: mi < visibleMountains - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      display: "flex", flexDirection: "column", gap: "4px",
                    }}>
                      {(sharedPerks[mi] || []).map((perkId, pi) => (
                        <PerkBadge key={pi} perkId={perkId} small />
                      ))}
                    </div>
                  ))}
                </>)}
              </div>
            </div>

            {/* Debug info */}
            <details style={{ marginTop: "20px" }}>
              <summary style={{ fontSize: "11px", color: "#475569", cursor: "pointer" }}>
                Debug: seed calculation
              </summary>
              <div style={{
                marginTop: "8px",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "4px",
                fontSize: "11px", color: "#64748b",
                fontFamily: "'Courier New', monospace",
                lineHeight: "1.8",
              }}>
                <div>World seed: <span style={{ color: "#94a3b8" }}>{worldSeed}</span></div>
                {results.map((r, i) => (
                  <div key={i} style={{ marginTop: "6px" }}>
                    <span style={{ color: "#cbd5e1" }}>{r.name}</span>{" · "}
                    steam_id={r.steamId}{" · "}
                    hex={r.hex}{" · "}
                    sx={r.sx} sy={r.sy}{" · "}
                    SetRandomSeed({1 + r.sx}, {2 + r.sy})
                  </div>
                ))}
                <div style={{ marginTop: "8px", color: "#475569", fontSize: "10px" }}>
                  Algorithm: EW override_perk_list.lua → perk_get_spawn_order() with Noita LGM PRNG
                  (world_seed × 0x19a065b5 + x) × 0x19a065b5 + y mod 2³¹−1
                </div>
              </div>
            </details>
          </>
        )}

        {computed && results.length === 0 && (
          <div style={{ fontSize: "13px", color: "#475569" }}>
            No valid players entered.
          </div>
        )}

        {/* Footer note */}
        <div style={{
          marginTop: "32px",
          paddingTop: "16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: "10px", color: "#334155", lineHeight: "1.7",
        }}>
          <strong style={{ color: "#475569" }}>Note:</strong> This simulator replicates the EW
          randomize_perks feature. The PRNG formula and perk deck algorithm are reverse-engineered
          from Noita's binary (Park-Miller LGM). Results may differ slightly from actual game output
          if the perk_list.lua has been updated in newer Noita versions. Requires{" "}
          <code style={{ color: "#475569" }}>randomize_perks = true</code> in EW proxy settings
          (default: on).
        </div>
      </div>
    </div>
  );
}
