import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  symlinkSync,
  lstatSync,
  readFileSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Deployer, CompanionConflictError } from './deployer.js';
import { DeploymentsRegistryService } from './deployments-registry.js';
import { SkillInfo, ToolConfig } from '../types.js';
import { isSymlink } from '../utils/fs.js';
import { AGENTS_SKILLS_DIR, TOOL_CONFIGS } from '../tools/configs.js';
import * as constants from '../constants.js';
import { SUPPORTED_TOOLS } from '../constants.js';
import type { ToolName } from '../types.js';

describe('Deployer', () => {
  const testDir = join(tmpdir(), `skillsmgr-deployer-test-${Date.now()}`);
  const projectDir = join(testDir, 'project');
  const skillsDir = join(testDir, 'skills-manager');
  const globalDir = join(testDir, 'global');
  let deployer: Deployer;
  const savedGlobalDirs = new Map<string, string>();

  const mockSkill: SkillInfo = {
    name: 'test-skill',
    description: 'Test skill',
    path: '',
    source: 'official/anthropic',
  };

  beforeEach(() => {
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    mkdirSync(join(skillsDir, 'official', 'anthropic', 'test-skill'), { recursive: true });
    writeFileSync(
      join(skillsDir, 'official', 'anthropic', 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test\n---\n# Test'
    );
    mockSkill.path = join(skillsDir, 'official', 'anthropic', 'test-skill');
    deployer = new Deployer(projectDir);

    for (const name of SUPPORTED_TOOLS) {
      savedGlobalDirs.set(name, TOOL_CONFIGS[name].globalSkillsDir);
      (TOOL_CONFIGS[name] as { globalSkillsDir: string }).globalSkillsDir = join(globalDir, name);
    }
  });

  afterEach(() => {
    for (const [name, dir] of savedGlobalDirs) {
      (TOOL_CONFIGS[name as ToolName] as { globalSkillsDir: string }).globalSkillsDir = dir;
    }
    savedGlobalDirs.clear();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('deploySkill', () => {
    it('creates symlink in .agents/skills in link mode', () => {
      deployer.deploySkill(mockSkill, 'link');
      const targetPath = join(projectDir, AGENTS_SKILLS_DIR, 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(true);
    });

    it('copies directory to .agents/skills in copy mode', () => {
      deployer.deploySkill(mockSkill, 'copy');
      const targetPath = join(projectDir, AGENTS_SKILLS_DIR, 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(false);
      expect(existsSync(join(targetPath, 'SKILL.md'))).toBe(true);
    });
  });

  describe('removeSkill', () => {
    it('removes deployed skill from .agents/skills', () => {
      deployer.deploySkill(mockSkill, 'link');
      const targetPath = join(projectDir, AGENTS_SKILLS_DIR, 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      deployer.removeSkill('test-skill');
      expect(existsSync(targetPath)).toBe(false);
    });
  });

  describe('createSymlinkBridge', () => {
    const symlinkConfig: ToolConfig = {
      name: 'claude-code',
      displayName: 'Claude Code',
      skillsDir: AGENTS_SKILLS_DIR,
      globalSkillsDir: '/tmp/test-global/.claude/skills',
      supportsLink: true,
      native: false,
      symlinkDir: '.claude/skills',
      showInList: true,
    };

    it('creates symlink from .claude/skills to .agents/skills', () => {
      deployer.deploySkill(mockSkill, 'link');
      const result = deployer.createSymlinkBridge(symlinkConfig);
      expect(result).toBe(true);

      const symlinkPath = join(projectDir, '.claude', 'skills');
      expect(existsSync(symlinkPath)).toBe(true);
      expect(isSymlink(symlinkPath)).toBe(true);
    });

    it('creates parent directory if it does not exist', () => {
      deployer.deploySkill(mockSkill, 'link');
      deployer.createSymlinkBridge(symlinkConfig);

      const parentDir = join(projectDir, '.claude');
      expect(existsSync(parentDir)).toBe(true);
    });

    it('replaces existing symlink', () => {
      const symlinkPath = join(projectDir, '.claude', 'skills');
      mkdirSync(join(projectDir, '.claude'), { recursive: true });
      mkdirSync(join(projectDir, '.agents', 'skills'), { recursive: true });
      const dummyTarget = join(projectDir, '.agents');
      symlinkSync(dummyTarget, symlinkPath);

      const result = deployer.createSymlinkBridge(symlinkConfig);
      expect(result).toBe(true);
      expect(isSymlink(symlinkPath)).toBe(true);
    });

    it('skips when target is a real directory', () => {
      const symlinkPath = join(projectDir, '.claude', 'skills');
      mkdirSync(symlinkPath, { recursive: true });

      const result = deployer.createSymlinkBridge(symlinkConfig);
      expect(result).toBe(false);
    });

    it('returns false for native tools', () => {
      const nativeConfig: ToolConfig = {
        name: 'codex',
        displayName: 'Codex',
        skillsDir: AGENTS_SKILLS_DIR,
        globalSkillsDir: '/tmp/test-global/.codex/skills',
        supportsLink: true,
        native: true,
        showInList: true,
      };
      const result = deployer.createSymlinkBridge(nativeConfig);
      expect(result).toBe(false);
    });
  });

  describe('removeSymlinkBridge', () => {
    const symlinkConfig: ToolConfig = {
      name: 'claude-code',
      displayName: 'Claude Code',
      skillsDir: AGENTS_SKILLS_DIR,
      globalSkillsDir: '/tmp/test-global/.claude/skills',
      supportsLink: true,
      native: false,
      symlinkDir: '.claude/skills',
      showInList: true,
    };

    it('removes symlink without affecting .agents/skills', () => {
      deployer.deploySkill(mockSkill, 'link');
      deployer.createSymlinkBridge(symlinkConfig);

      const symlinkPath = join(projectDir, '.claude', 'skills');
      expect(isSymlink(symlinkPath)).toBe(true);

      const result = deployer.removeSymlinkBridge(symlinkConfig);
      expect(result).toBe(true);
      expect(existsSync(symlinkPath)).toBe(false);

      const agentsPath = join(projectDir, AGENTS_SKILLS_DIR, 'test-skill');
      expect(existsSync(agentsPath)).toBe(true);
    });

    it('returns false when no symlink exists', () => {
      const result = deployer.removeSymlinkBridge(symlinkConfig);
      expect(result).toBe(false);
    });
  });

  describe('deploySkillGlobal', () => {
    it('creates per-skill symlink in global dir', () => {
      deployer.deploySkillGlobal(mockSkill, ['claude-code'], 'link');

      const targetPath = join(globalDir, 'claude-code', 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(true);
    });

    it('copies skill in copy mode', () => {
      deployer.deploySkillGlobal(mockSkill, ['claude-code'], 'copy');

      const targetPath = join(globalDir, 'claude-code', 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(false);
      expect(existsSync(join(targetPath, 'SKILL.md'))).toBe(true);
    });

    it('deduplicates agents sharing same globalSkillsDir', () => {
      const sharedDir = join(globalDir, 'shared');
      (TOOL_CONFIGS['amp'] as { globalSkillsDir: string }).globalSkillsDir = sharedDir;
      (TOOL_CONFIGS['kimi-cli'] as { globalSkillsDir: string }).globalSkillsDir = sharedDir;

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      deployer.deploySkillGlobal(mockSkill, ['amp', 'kimi-cli'], 'link');

      const logCalls = spy.mock.calls.filter((c) => String(c[0]).includes('✓ test-skill'));
      expect(logCalls.length).toBe(1);
      spy.mockRestore();
    });

    it('skips when target is a real directory', () => {
      const targetDir = join(globalDir, 'claude-code');
      mkdirSync(join(targetDir, 'test-skill', 'subdir'), { recursive: true });

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      deployer.deploySkillGlobal(mockSkill, ['claude-code'], 'link');

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('is a real directory, skipping'));
      spy.mockRestore();
    });

    it('replaces existing symlink', () => {
      const targetDir = join(globalDir, 'claude-code');
      mkdirSync(targetDir, { recursive: true });
      symlinkSync('/tmp/dummy', join(targetDir, 'test-skill'));

      deployer.deploySkillGlobal(mockSkill, ['claude-code'], 'link');

      const targetPath = join(targetDir, 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(true);
    });
  });
});

describe('Deployer companions', () => {
  let testDir: string;
  let projectDir: string;
  let registryDir: string;
  let savedManagerDir: string;

  function makeSkill(
    name: string,
    manifest: Record<string, unknown>,
    files: Record<string, string> = {},
  ): SkillInfo {
    const dir = join(testDir, 'skills', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: ${name}\n---\n# ${name}\n`,
    );
    writeFileSync(
      join(dir, 'skill.json'),
      JSON.stringify({
        name,
        version: '0.1.0',
        description: name,
        ...manifest,
      }, null, 2),
    );
    for (const [rel, content] of Object.entries(files)) {
      const full = join(dir, rel);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, content);
    }
    return {
      name,
      description: name,
      path: dir,
      source: 'custom',
    };
  }

  beforeEach(() => {
    testDir = join(tmpdir(), `skillsmgr-deployer-comp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    projectDir = join(testDir, 'project');
    registryDir = join(testDir, 'home-skills-manager');
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(registryDir, { recursive: true });
    savedManagerDir = constants.SKILLS_MANAGER_DIR;
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: registryDir,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: savedManagerDir,
      writable: true,
    });
    rmSync(testDir, { recursive: true, force: true });
  });

  it('deploys companion as symlink for matching agent (link mode)', () => {
    const skill = makeSkill(
      'jt-codex-fixture',
      {
        targetAgents: ['claude-code'],
        companions: [
          {
            source: 'agents/runner.md',
            agentTargets: { 'claude-code': '.claude/agents/runner.md' },
          },
        ],
      },
      { 'agents/runner.md': '# runner\n' },
    );
    const deployer = new Deployer(projectDir);
    deployer.deploySkill(skill, 'link', ['claude-code']);

    const target = join(projectDir, '.claude', 'agents', 'runner.md');
    expect(existsSync(target)).toBe(true);
    expect(lstatSync(target).isSymbolicLink()).toBe(true);

    const registryFile = join(registryDir, 'deployments.json');
    expect(existsSync(registryFile)).toBe(true);
    const reg = JSON.parse(readFileSync(registryFile, 'utf-8'));
    const regStr = JSON.stringify(reg);
    expect(regStr).toContain('jt-codex-fixture');
    expect(regStr).toContain('deployedCompanions');
    expect(regStr).toContain('runner.md');
  });

  it('deploys companion as real file in copy mode', () => {
    const skill = makeSkill(
      'copy-skill',
      {
        targetAgents: ['claude-code'],
        companions: [
          {
            source: 'agents/runner.md',
            agentTargets: { 'claude-code': '.claude/agents/runner.md' },
          },
        ],
      },
      { 'agents/runner.md': '# runner real\n' },
    );
    const deployer = new Deployer(projectDir);
    deployer.deploySkill(skill, 'copy', ['claude-code']);
    const target = join(projectDir, '.claude', 'agents', 'runner.md');
    expect(existsSync(target)).toBe(true);
    expect(lstatSync(target).isSymbolicLink()).toBe(false);
    const content = readFileSync(target, 'utf-8');
    expect(content).toContain('runner real');
  });

  it('skips companion when no agent in selected matches', () => {
    const skill = makeSkill(
      'mixed-skill',
      {
        companions: [
          {
            source: 'helpers/c.md',
            agentTargets: { 'claude-code': '.claude/helpers/c.md' },
          },
        ],
      },
      { 'helpers/c.md': '# c\n' },
    );
    const deployer = new Deployer(projectDir);
    deployer.deploySkill(skill, 'link', ['codex']);
    expect(existsSync(join(projectDir, '.claude', 'helpers', 'c.md'))).toBe(false);
    // skill body still deployed
    expect(existsSync(join(projectDir, '.agents', 'skills', 'mixed-skill'))).toBe(true);
  });

  it('deploys companion to multi-agent when intersection has multiple', () => {
    const skill = makeSkill(
      'multi-skill',
      {
        targetAgents: ['claude-code', 'codex'],
        companions: [
          {
            source: 'agents/x.md',
            agentTargets: {
              'claude-code': '.claude/agents/x.md',
              'codex': '.codex/agents/x.md',
            },
          },
        ],
      },
      { 'agents/x.md': '# x\n' },
    );
    const deployer = new Deployer(projectDir);
    deployer.deploySkill(skill, 'link', ['claude-code', 'codex']);
    expect(existsSync(join(projectDir, '.claude', 'agents', 'x.md'))).toBe(true);
    expect(existsSync(join(projectDir, '.codex', 'agents', 'x.md'))).toBe(true);
  });

  it('preflight detects cross-skill companion conflict', () => {
    const a = makeSkill(
      'skill-a',
      {
        targetAgents: ['claude-code'],
        companions: [
          {
            source: 'agents/r.md',
            agentTargets: { 'claude-code': '.claude/agents/runner.md' },
          },
        ],
      },
      { 'agents/r.md': '# a\n' },
    );
    const b = makeSkill(
      'skill-b',
      {
        targetAgents: ['claude-code'],
        companions: [
          {
            source: 'agents/r.md',
            agentTargets: { 'claude-code': '.claude/agents/runner.md' },
          },
        ],
      },
      { 'agents/r.md': '# b\n' },
    );
    const deployer = new Deployer(projectDir);
    deployer.deploySkill(a, 'link', ['claude-code']);
    expect(() => deployer.deploySkill(b, 'link', ['claude-code'])).toThrow(
      CompanionConflictError,
    );
    // b's body must NOT have been deployed
    expect(existsSync(join(projectDir, '.agents', 'skills', 'skill-b'))).toBe(false);
    // a's content unchanged
    const content = readFileSync(
      join(projectDir, '.claude', 'agents', 'runner.md'),
      'utf-8',
    );
    expect(content).toContain('a');
  });

  it('preflight detects self-conflict within one skill', () => {
    const skill = makeSkill(
      'self-conflict',
      {
        targetAgents: ['claude-code'],
        companions: [
          {
            source: 'agents/a.md',
            agentTargets: { 'claude-code': '.claude/agents/x.md' },
          },
          {
            source: 'agents/b.md',
            agentTargets: { 'claude-code': '.claude/agents/x.md' },
          },
        ],
      },
      {
        'agents/a.md': '# a\n',
        'agents/b.md': '# b\n',
      },
    );
    const deployer = new Deployer(projectDir);
    expect(() => deployer.deploySkill(skill, 'link', ['claude-code'])).toThrow(
      CompanionConflictError,
    );
    expect(existsSync(join(projectDir, '.claude', 'agents', 'x.md'))).toBe(false);
    expect(existsSync(join(projectDir, '.agents', 'skills', 'self-conflict'))).toBe(false);
  });

  it('removeSkill cleans up companions and registry entry', () => {
    const skill = makeSkill(
      'clean-skill',
      {
        targetAgents: ['claude-code'],
        companions: [
          {
            source: 'agents/r.md',
            agentTargets: { 'claude-code': '.claude/agents/r.md' },
          },
        ],
      },
      { 'agents/r.md': '# r\n' },
    );
    const deployer = new Deployer(projectDir);
    deployer.deploySkill(skill, 'link', ['claude-code']);
    const target = join(projectDir, '.claude', 'agents', 'r.md');
    expect(existsSync(target)).toBe(true);

    deployer.removeSkill('clean-skill');
    expect(existsSync(target)).toBe(false);
    expect(existsSync(join(projectDir, '.agents', 'skills', 'clean-skill'))).toBe(false);
  });

  it('removeSkill is idempotent when companion file missing', () => {
    const skill = makeSkill(
      'gone-skill',
      {
        targetAgents: ['claude-code'],
        companions: [
          {
            source: 'agents/r.md',
            agentTargets: { 'claude-code': '.claude/agents/r.md' },
          },
        ],
      },
      { 'agents/r.md': '# r\n' },
    );
    const deployer = new Deployer(projectDir);
    deployer.deploySkill(skill, 'link', ['claude-code']);
    const target = join(projectDir, '.claude', 'agents', 'r.md');
    rmSync(target, { force: true });
    expect(() => deployer.removeSkill('gone-skill')).not.toThrow();
  });

  it('removeCompanions warns and skips when path also owned by another skill (defensive)', () => {
    const a = makeSkill(
      'skill-a',
      {
        targetAgents: ['claude-code'],
        companions: [
          {
            source: 'agents/r.md',
            agentTargets: { 'claude-code': '.claude/agents/shared.md' },
          },
        ],
      },
      { 'agents/r.md': '# a\n' },
    );
    const deployer = new Deployer(projectDir);
    deployer.deploySkill(a, 'link', ['claude-code']);

    // Manually inject a second skill record for the same target path to
    // simulate registry corruption and verify defensive skip.
    const reg = new DeploymentsRegistryService();
    reg.addCompanion('skill-b', projectDir, join(projectDir, '.claude/agents/shared.md'));

    const target = join(projectDir, '.claude', 'agents', 'shared.md');
    expect(existsSync(target)).toBe(true);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    deployer.removeSkill('skill-a');
    expect(warn).toHaveBeenCalled();
    // Path preserved because skill-b still claims it
    expect(existsSync(target)).toBe(true);
    warn.mockRestore();
  });

  it('removeSkill does not follow symlink (only unlinks)', () => {
    const skill = makeSkill(
      'symlink-skill',
      {
        targetAgents: ['claude-code'],
        companions: [
          {
            source: 'agents/r.md',
            agentTargets: { 'claude-code': '.claude/agents/r.md' },
          },
        ],
      },
      { 'agents/r.md': '# real content\n' },
    );
    const deployer = new Deployer(projectDir);
    deployer.deploySkill(skill, 'link', ['claude-code']);
    const realFile = join(skill.path, 'agents', 'r.md');
    deployer.removeSkill('symlink-skill');
    expect(existsSync(realFile)).toBe(true);
  });
});

