import type { ReactNode } from "react";
import { Button, Card } from "@/components/ui";
import PetEgg from "@/components/PetEgg";
import { ScanIcon } from "@/components/icons";
import type { User } from "@/lib/user";

// Home = the pet screen (owner Dev 3). Layout with slots; task 7c wires the real data:
// pet stage + mood, total points and weekly diversity from src/lib/rewards.ts, and Dev 2's QuestCards (6b).
// Points only come from discovery, mastery, quests, combos and complete meals. Never from grams or price.

export type PetStage = "egg" | "young" | "evolved";
export type PetMood = "happy" | "content" | "sleepy";

export type HomeGame = {
  points: number; // lifetime total from points_log
  diversity: number; // distinct protein groups this week (Mon-Sun, Lagos time)
  stage: PetStage;
  mood: PetMood;
};

/** What a brand-new player sees until 7c loads real numbers. */
export const NEW_PLAYER: HomeGame = { points: 0, diversity: 0, stage: "egg", mood: "sleepy" };

const STAGE_LABEL: Record<PetStage, string> = { egg: "Egg", young: "Sprout", evolved: "Evolved" };
const NEXT_STAGE_AT: Record<PetStage, number | null> = { egg: 100, young: 400, evolved: null };

const MOOD_LINE: Record<PetMood, string> = {
  happy: "Your pet is buzzing. 3+ protein groups this week!",
  content: "Your pet is content. One more protein group makes it happy.",
  sleepy: "Your pet is sleepy. Scan a meal with protein to wake it up.",
};

type Props = {
  user: User;
  game?: HomeGame;
  /** SLOT: the pet. 7c passes <Pet stage mood /> from src/components/pet once 7b merges. */
  pet?: ReactNode;
  /** SLOT: Dev 2's <QuestCards /> (task 6b). */
  quests?: ReactNode;
  onSwitchUser?: () => void;
};

export default function HomeScreen({ user, game = NEW_PLAYER, pet, quests, onSwitchUser }: Props) {
  const next = NEXT_STAGE_AT[game.stage];
  const progress = next ? Math.min(100, Math.round((game.points / next) * 100)) : 100;

  return (
    <section className="flex flex-1 flex-col gap-5">
      {/* Greeting */}
      <header className="flex items-center justify-between gap-3 motion-safe:animate-rise">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-black">Hi, {user.nickname}</h1>
          <p className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-ink-soft px-3 py-1 text-sm font-bold text-on-ink">
            Playing for <span className="truncate text-gold">{user.group_name}</span>
          </p>
        </div>
      </header>

      {/* Pet hero */}
      <Card className="flex flex-col items-center gap-3 text-center" data-slot="pet">
        <div className="flex min-h-40 items-end justify-center">{pet ?? <PetEgg size={130} />}</div>
        <div className="w-full">
          <div className="flex items-baseline justify-between text-sm font-bold">
            <span>{STAGE_LABEL[game.stage]}</span>
            <span className="text-muted tabular-nums">
              {next ? `${game.points} / ${next} pts to grow` : "Fully grown"}
            </span>
          </div>
          <div
            className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-mist"
            role="progressbar"
            aria-label="Pet growth"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="h-full rounded-full bg-leaf transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <p className="text-pretty text-sm text-muted">{MOOD_LINE[game.mood]}</p>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3" data-slot="stats">
        <Stat value={game.points} label="Total points" />
        <Stat value={game.diversity} label={game.diversity === 1 ? "Protein group this week" : "Protein groups this week"} />
      </div>

      {/* Quests */}
      <div className="flex flex-col gap-2" data-slot="quests">
        <h2 className="text-lg font-black">This week&apos;s quests</h2>
        {quests ?? (
          <Card className="text-sm text-muted">
            No quests yet. Scan a meal and accept a protein upgrade to start one.
          </Card>
        )}
      </div>

      <Button href="/scan" size="lg" block icon={<ScanIcon />}>
        Scan a meal
      </Button>

      {onSwitchUser && (
        <Button variant="ghost" onClick={onSwitchUser} className="text-sm font-semibold">
          Not {user.nickname}? Switch player
        </Button>
      )}
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-3xl bg-ink-soft px-4 py-3 text-on-ink">
      <span className="block text-3xl font-black tabular-nums leading-none">{value}</span>
      <span className="mt-1 block text-xs font-bold text-on-ink-muted">{label}</span>
    </div>
  );
}
