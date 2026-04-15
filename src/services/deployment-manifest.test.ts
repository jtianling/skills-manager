import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';
import {
  DeploymentManifestService,
  getManifestPath,
  skillToKey,
} from './deployment-manifest.js';
import { GroupsService } from './groups.js';
import { SkillsService } from './skills.js';

describe('DeploymentManifestService', () => {
  let projectRoot: string;
  let skillsManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    projectRoot = join(tmpdir(), `skillsmgr-manifest-${id}`);
    skillsManagerDir = join(tmpdir(), `skillsmgr-manifest-mgr-${id}`);
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(skillsManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: skillsManagerDir,
      writable: true,
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(skillsManagerDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function writeSkill(path: string, name: string): void {
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'SKILL.md'), `---\nname: ${name}\n---\n${name}`);
  }

  it('readManifest returns null when file missing', () => {
    const service = new DeploymentManifestService();
    expect(service.readManifest(projectRoot)).toBeNull();
  });

  it('readManifest + writeManifest round trip', () => {
    const service = new DeploymentManifestService();
    const manifest = {
      mode: 'link' as const,
      followGroups: ['tdd-spec'],
      pinnedSkills: ['custom/jt-codex'],
      deployedAt: '2026-04-15T00:00:00.000Z',
    };
    service.writeManifest(projectRoot, manifest);
    expect(service.readManifest(projectRoot)).toEqual(manifest);
  });

  it('writeManifest creates .skills-manager directory if missing', () => {
    const service = new DeploymentManifestService();
    service.writeManifest(projectRoot, {
      mode: 'copy',
      followGroups: [],
      pinnedSkills: [],
      deployedAt: '2026-04-15T00:00:00.000Z',
    });
    const path = getManifestPath(projectRoot);
    expect(JSON.parse(readFileSync(path, 'utf-8')).mode).toBe('copy');
  });

  it('readManifest throws on invalid JSON', () => {
    const service = new DeploymentManifestService();
    const path = getManifestPath(projectRoot);
    mkdirSync(join(projectRoot, '.skills-manager'));
    writeFileSync(path, '{ not valid json');
    expect(() => service.readManifest(projectRoot)).toThrow(/Invalid deployment manifest/);
  });

  it('resolveExpectedSkills expands followGroups and pinnedSkills with dedup', () => {
    writeSkill(join(skillsManagerDir, 'custom', 'tdd-spec', 'ts-apply'), 'ts-apply');
    writeSkill(join(skillsManagerDir, 'custom', 'tdd-spec', 'ts-new'), 'ts-new');
    writeSkill(join(skillsManagerDir, 'custom', 'jt-codex'), 'jt-codex');

    const groupsService = new GroupsService();
    groupsService.addSkill('tdd-spec', 'custom/tdd-spec/ts-apply');
    groupsService.addSkill('tdd-spec', 'custom/tdd-spec/ts-new');

    const skillsService = new SkillsService(skillsManagerDir);
    const service = new DeploymentManifestService();
    const result = service.resolveExpectedSkills(
      {
        mode: 'link',
        followGroups: ['tdd-spec'],
        pinnedSkills: ['custom/jt-codex', 'custom/tdd-spec/ts-apply'],
        deployedAt: '',
      },
      groupsService,
      skillsService,
    );

    expect(result.skillKeys.size).toBe(3);
    expect(result.skillKeys.has('custom/tdd-spec/ts-apply')).toBe(true);
    expect(result.skillKeys.has('custom/tdd-spec/ts-new')).toBe(true);
    expect(result.skillKeys.has('custom/jt-codex')).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('resolveExpectedSkills warns when follow group does not exist', () => {
    const groupsService = new GroupsService();
    const skillsService = new SkillsService(skillsManagerDir);
    const service = new DeploymentManifestService();
    const result = service.resolveExpectedSkills(
      {
        mode: 'link',
        followGroups: ['gone'],
        pinnedSkills: [],
        deployedAt: '',
      },
      groupsService,
      skillsService,
    );

    expect(result.skillKeys.size).toBe(0);
    expect(result.warnings).toEqual(["follow group 'gone' does not exist, skipping"]);
  });

  it('resolveExpectedSkills warns when pinned skill no longer exists', () => {
    const groupsService = new GroupsService();
    const skillsService = new SkillsService(skillsManagerDir);
    const service = new DeploymentManifestService();
    const result = service.resolveExpectedSkills(
      {
        mode: 'link',
        followGroups: [],
        pinnedSkills: ['custom/missing'],
        deployedAt: '',
      },
      groupsService,
      skillsService,
    );

    expect(result.skillKeys.size).toBe(0);
    expect(result.warnings).toEqual(["pinned skill 'custom/missing' no longer exists, skipping"]);
  });

  it('mergeForDeploy overwrites pinned and unions follow', () => {
    const service = new DeploymentManifestService();
    const merged = service.mergeForDeploy(
      {
        mode: 'link',
        followGroups: ['openspec'],
        pinnedSkills: ['custom/old-a', 'custom/old-b'],
        deployedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        mode: 'copy',
        followGroups: ['tdd-spec'],
        pinnedSkills: ['custom/new'],
      },
    );

    expect(merged.mode).toBe('copy');
    expect(merged.followGroups).toEqual(['openspec', 'tdd-spec']);
    expect(merged.pinnedSkills).toEqual(['custom/new']);
    expect(merged.deployedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('mergeForDeploy with no prev manifest', () => {
    const service = new DeploymentManifestService();
    const merged = service.mergeForDeploy(null, {
      mode: 'link',
      followGroups: ['tdd-spec'],
      pinnedSkills: ['custom/a'],
    });

    expect(merged.followGroups).toEqual(['tdd-spec']);
    expect(merged.pinnedSkills).toEqual(['custom/a']);
  });

  it('skillToKey produces source/name format', () => {
    expect(skillToKey({ source: 'custom', name: 'foo', description: '', path: '' })).toBe(
      'custom/foo',
    );
    expect(
      skillToKey({ source: 'custom/openspec', name: 'bar', description: '', path: '' }),
    ).toBe('custom/openspec/bar');
  });
});
