import { join, dirname, resolve } from 'path';
import { existsSync, lstatSync, rmSync, unlinkSync } from 'fs';
import { SkillInfo, ToolConfig, ToolName } from '../types.js';
import {
  ensureDir,
  linkDir,
  copyDir,
  isSymlink,
  linkFile,
  copyFile,
} from '../utils/fs.js';
import { AGENTS_SKILLS_DIR, TOOL_CONFIGS } from '../tools/configs.js';
import { readManifest, resolveCompanionSource, resolveCompanionTarget } from './manifest.js';
import { DeploymentsRegistryService } from './deployments-registry.js';
import type { Companion } from '../types.js';

function pathOrLinkExists(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function normalizeAbs(p: string): string {
  return resolve(p).replace(/\/+$/, '');
}

export class CompanionConflictError extends Error {
  constructor(
    public skillName: string,
    public conflictingPath: string,
    public conflictingWith?: string,
  ) {
    const target = conflictingPath;
    const where = conflictingWith
      ? `already deployed by skill '${conflictingWith}'`
      : `declared twice within skill '${skillName}'`;
    super(
      `Companion conflict: skill '${skillName}' wants ${target} but it is ${where}.`,
    );
    this.name = 'CompanionConflictError';
  }
}

interface CompanionPlanItem {
  source: string;
  target: string;
  agent: string;
}

interface CompanionPlan {
  items: CompanionPlanItem[];
}

export class Deployer {
  private registry = new DeploymentsRegistryService();

  constructor(private projectDir: string) {}

  deploySkill(
    skill: SkillInfo,
    mode: 'link' | 'copy',
    selectedAgents?: ToolName[],
  ): void {
    const fullTargetDir = join(this.projectDir, AGENTS_SKILLS_DIR);
    ensureDir(fullTargetDir);

    const skillTargetPath = join(fullTargetDir, skill.name);

    const plan = this.planCompanions(skill, selectedAgents);
    if (plan && plan.items.length > 0) {
      this.preflightCompanionConflicts(skill, plan);
    }

    if (mode === 'link') {
      linkDir(skill.path, skillTargetPath);
    } else {
      copyDir(skill.path, skillTargetPath);
    }

    if (plan) {
      // Always ensure the registry tracks this skill (even with empty
      // companions) so reverse cleanup and audits know it is deployed.
      this.registry.ensureSkillRecord(skill.name, this.projectDir);
      if (plan.items.length > 0) {
        try {
          this.writeCompanions(skill, plan, mode);
        } catch (e) {
          this.rollbackCompanions(skill);
          try {
            if (pathOrLinkExists(skillTargetPath)) {
              rmSync(skillTargetPath, { recursive: true, force: true });
            }
          } catch {
            // best effort
          }
          throw e;
        }
      }
    }
  }

  deploySkills(
    skills: SkillInfo[],
    mode: 'link' | 'copy',
    selectedAgents?: ToolName[],
  ): void {
    for (const skill of skills) {
      this.deploySkill(skill, mode, selectedAgents);
    }
  }

  removeSkill(skillName: string): void {
    this.removeCompanions(skillName);

    const skillPath = join(this.projectDir, AGENTS_SKILLS_DIR, skillName);
    if (pathOrLinkExists(skillPath)) {
      rmSync(skillPath, { recursive: true, force: true });
    }
  }

  removeCompanions(skillName: string): void {
    const recorded = this.registry.getCompanionsForSkill(skillName, this.projectDir);
    if (recorded.length === 0) {
      this.registry.clearCompanions(skillName, this.projectDir);
      return;
    }

    const others = this.collectOtherSkillCompanionPaths(skillName);
    for (const abs of recorded) {
      if (others.has(normalizeAbs(abs))) {
        console.warn(
          `  ⚠ Skipping companion ${abs}: still owned by another skill in registry.`,
        );
        continue;
      }
      try {
        if (pathOrLinkExists(abs)) {
          unlinkSync(abs);
        }
      } catch {
        // idempotent: file may already be gone
      }
    }

    this.registry.clearCompanions(skillName, this.projectDir);
  }

  removeCompanionsForAgents(skill: SkillInfo, agents: ToolName[]): void {
    const recorded = new Set(
      this.registry
        .getCompanionsForSkill(skill.name, this.projectDir)
        .map((abs) => normalizeAbs(abs)),
    );
    if (recorded.size === 0) return;

    const plan = this.planCompanions(skill, agents);
    if (!plan || plan.items.length === 0) return;

    const others = this.collectOtherSkillCompanionPaths(skill.name);
    for (const item of plan.items) {
      const abs = normalizeAbs(item.target);
      if (!recorded.has(abs)) continue;
      if (others.has(abs)) continue;
      try {
        if (pathOrLinkExists(item.target)) unlinkSync(item.target);
      } catch {
        // idempotent: file may already be gone
      }
      this.registry.removeCompanion(skill.name, this.projectDir, item.target);
    }
  }

  createSymlinkBridge(config: ToolConfig): boolean {
    if (config.native || !config.symlinkDir) return false;

    const symlinkPath = join(this.projectDir, config.symlinkDir);
    const targetPath = join(this.projectDir, AGENTS_SKILLS_DIR);

    ensureDir(targetPath);

    if (existsSync(symlinkPath)) {
      if (isSymlink(symlinkPath)) {
        unlinkSync(symlinkPath);
      } else if (lstatSync(symlinkPath).isDirectory()) {
        console.log(`  ⚠ ${config.symlinkDir} is a real directory, skipping symlink`);
        return false;
      }
    }

    ensureDir(dirname(symlinkPath));
    linkDir(targetPath, symlinkPath);
    return true;
  }

  removeSymlinkBridge(config: ToolConfig): boolean {
    if (config.native || !config.symlinkDir) return false;

    const symlinkPath = join(this.projectDir, config.symlinkDir);

    if (existsSync(symlinkPath) && isSymlink(symlinkPath)) {
      unlinkSync(symlinkPath);
      return true;
    }

    return false;
  }

  isSkillDeployed(skillName: string): boolean {
    const skillPath = join(this.projectDir, AGENTS_SKILLS_DIR, skillName);
    return existsSync(skillPath);
  }

  isSymlinkBridgeActive(config: ToolConfig): boolean {
    if (config.native || !config.symlinkDir) return false;

    const symlinkPath = join(this.projectDir, config.symlinkDir);
    return existsSync(symlinkPath) && isSymlink(symlinkPath);
  }

  deploySkillGlobal(
    skill: SkillInfo,
    agents: ToolName[],
    mode: 'link' | 'copy',
  ): void {
    const processed = new Set<string>();

    for (const agentName of agents) {
      const config = TOOL_CONFIGS[agentName];
      if (!config) continue;

      const targetDir = config.globalSkillsDir;
      const skillTargetPath = join(targetDir, skill.name);

      if (processed.has(skillTargetPath)) continue;
      processed.add(skillTargetPath);

      ensureDir(targetDir);

      if (existsSync(skillTargetPath)) {
        if (isSymlink(skillTargetPath)) {
          unlinkSync(skillTargetPath);
        } else if (lstatSync(skillTargetPath).isDirectory()) {
          console.log(`  ⚠ ${skillTargetPath} is a real directory, skipping`);
          continue;
        } else if (lstatSync(skillTargetPath).isFile()) {
          console.log(`  ⚠ ${skillTargetPath} is a file, skipping`);
          continue;
        }
      }

      if (mode === 'link') {
        linkDir(skill.path, skillTargetPath);
      } else {
        copyDir(skill.path, skillTargetPath);
      }
      console.log(`  ✓ ${skill.name} → ${skillTargetPath} (${mode === 'link' ? 'linked' : 'copied'})`);
    }
  }

  removeSkillGlobal(skillName: string, agents: ToolName[]): boolean {
    const processed = new Set<string>();
    let removed = false;

    for (const agentName of agents) {
      const config = TOOL_CONFIGS[agentName];
      if (!config) continue;

      const skillPath = join(config.globalSkillsDir, skillName);

      if (processed.has(skillPath)) continue;
      processed.add(skillPath);

      if (pathOrLinkExists(skillPath)) {
        rmSync(skillPath, { recursive: true, force: true });
        console.log(`  ✓ Removed ${skillName} from ${config.globalSkillsDir}`);
        removed = true;
      }
    }

    return removed;
  }

  private planCompanions(
    skill: SkillInfo,
    selectedAgents?: ToolName[],
  ): CompanionPlan | null {
    if (!selectedAgents || selectedAgents.length === 0) return null;
    let manifest;
    try {
      manifest = readManifest(skill.path);
    } catch (e) {
      throw new Error(`Skill '${skill.name}' has invalid skill.json: ${(e as Error).message}`);
    }
    if (!manifest?.companions || manifest.companions.length === 0) {
      return { items: [] };
    }

    const selected = new Set(selectedAgents as string[]);
    const items: CompanionPlanItem[] = [];

    for (const comp of manifest.companions) {
      const sourceCheck = resolveCompanionSource(skill.path, comp.source);
      if (!sourceCheck.ok || !sourceCheck.resolvedPath) {
        throw new Error(
          `Skill '${skill.name}' companion source invalid: ${sourceCheck.error}`,
        );
      }
      for (const [agent, targetRel] of Object.entries(comp.agentTargets)) {
        if (!selected.has(agent)) continue;
        const targetCheck = resolveCompanionTarget(this.projectDir, targetRel);
        if (!targetCheck.ok || !targetCheck.resolvedPath) {
          throw new Error(
            `Skill '${skill.name}' companion target invalid for agent '${agent}': ${targetCheck.error}`,
          );
        }
        items.push({
          source: sourceCheck.resolvedPath,
          target: targetCheck.resolvedPath,
          agent,
        });
      }
    }

    return { items };
  }

  private preflightCompanionConflicts(skill: SkillInfo, plan: CompanionPlan): void {
    const seen = new Map<string, string>();
    for (const item of plan.items) {
      const key = normalizeAbs(item.target);
      if (seen.has(key)) {
        throw new CompanionConflictError(skill.name, item.target);
      }
      seen.set(key, item.agent);
    }

    const others = this.collectOtherSkillCompanionPaths(skill.name);
    for (const item of plan.items) {
      const key = normalizeAbs(item.target);
      const owner = others.get(key);
      if (owner) {
        throw new CompanionConflictError(skill.name, item.target, owner);
      }
    }
  }

  private collectOtherSkillCompanionPaths(skillName: string): Map<string, string> {
    const out = new Map<string, string>();
    const all = this.registry.listAllCompanionPaths(this.projectDir);
    for (const { skill, path } of all) {
      if (skill === skillName) continue;
      out.set(normalizeAbs(path), skill);
    }
    return out;
  }

  private writeCompanions(
    skill: SkillInfo,
    plan: CompanionPlan,
    mode: 'link' | 'copy',
  ): void {
    this.registry.clearCompanions(skill.name, this.projectDir);
    const written: string[] = [];
    try {
      for (const item of plan.items) {
        ensureDir(dirname(item.target));
        if (mode === 'link') {
          linkFile(item.source, item.target);
        } else {
          copyFile(item.source, item.target);
        }
        written.push(item.target);
        this.registry.addCompanion(skill.name, this.projectDir, item.target);
      }
    } catch (e) {
      for (const w of written) {
        try {
          if (pathOrLinkExists(w)) unlinkSync(w);
        } catch {
          // best effort
        }
      }
      this.registry.clearCompanions(skill.name, this.projectDir);
      throw e;
    }
  }

  private rollbackCompanions(skill: SkillInfo): void {
    const recorded = this.registry.getCompanionsForSkill(skill.name, this.projectDir);
    for (const abs of recorded) {
      try {
        if (pathOrLinkExists(abs)) unlinkSync(abs);
      } catch {
        // best effort
      }
    }
    this.registry.clearCompanions(skill.name, this.projectDir);
  }
}

export type { Companion };
