import { BALANCE as B } from '../data/balance';

/** The first milestone strictly after `reached` metres. */
export function nextMilestone(reached: number): number {
  for (const m of B.milestones) if (m > reached) return m;
  const last = B.milestones[B.milestones.length - 1] ?? 0;
  const steps = Math.floor((reached - last) / B.milestoneStep) + 1;
  return last + steps * B.milestoneStep;
}
