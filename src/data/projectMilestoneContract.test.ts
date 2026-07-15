import { describe, expect, it } from 'vitest';
import {
  PROJECT_MILESTONE_CONTRACT_VERSION,
  projectMilestoneContract,
} from './projectMilestoneContract';

describe('Plant Pending milestone contract', () => {
  it('keeps one explicit authoritative contract', () => {
    expect(PROJECT_MILESTONE_CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(projectMilestoneContract.authority.greenAcresDataset).toContain('production truth');
    expect(projectMilestoneContract.authority.oneSourceRule).toContain('Rules live here once');
  });

  it('prohibits function-breaking recipe substitutions', () => {
    const rejects = projectMilestoneContract.recipeMatching.hardRejects.join(' | ');
    expect(rejects).toContain('hedge or screen replaced by grass');
    expect(rejects).toContain('shade plant replaced by a full-sun plant');
    expect(projectMilestoneContract.recipeMatching.noShortcutPool).toContain('full clean Green Acres dataset');
  });

  it('locks the approved Recipe Grid Lab behaviors', () => {
    const required = new Set(projectMilestoneContract.physicsMilestone.mustPreserve);
    expect(required.has('front-fill placement following selected front edges')).toBe(true);
    expect(required.has('back-attract placement distributed along selected back edges and offset inward')).toBe(true);
    expect(required.has('open-space fill levels')).toBe(true);
    expect(required.has('seed changes create visibly different layouts without losing recipe structure')).toBe(true);
  });

  it('forbids simplified parallel milestone implementations', () => {
    const prohibited = projectMilestoneContract.milestonePreservation.prohibited.join(' | ');
    expect(prohibited).toContain('simplified parallel implementation');
    expect(prohibited).toContain('second engine or catalog');
    expect(prohibited).toContain('before parity is proven');
  });
});
