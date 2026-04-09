## Context

本地 skill 的"身份"在当前实现里由绝对路径决定.  `sources.json` 记 `info.url = 安装时的绝对路径`, `SourceResolver.resolveLocalPath` 通过 `normalizeLocalPath(input) === normalizeLocalPath(info.url)` 精确匹配已安装的 source.  bundle 同理, bundle key 形如 `local-batch:/abs/path`, 通过 URL 精确匹配.

用户一旦 `mv /old/path /new/path`, 所有路径索引都失效:
- `update ./new/path` → resolveLocalPath 精确匹配失败, 新路径下虽然有相同结构但不被识别
- `uninstall ./new/path` → 同上
- `uninstall tdd-spec` → bareword 不认 batch bundle 的 subdirectory 名字

本地 skill 和 git skill 不同, 它的 identity 其实就是"用户给的那个目录名", 用户完全掌握命名.  搬位置又是开发中的常见操作.  这两个事实让"按 basename 识别 + 交互式 rebind"成为比"显式 relocate 命令"更自然的 UX.

前置工作已就绪:
- w01-refactor-source-resolver: `SourceResolver.resolveLocalPath` 集中在一处, 容易扩展
- w02-add-bundle-tracking: `sources.json` v2 schema 有 `bundles` 字段, 所有 local-batch 安装都已经注册 bundle
- w03-bundle-aware-update-uninstall: update/uninstall 已经走 bundle 语义, rebind 后直接复用 bundle sync 逻辑处理新路径下的新增/删除 members

## Goals / Non-Goals

**Goals:**
- `update ./tdd-spec` 在旧路径失效时, 自动按 basename 找到对应的 local bundle/source, 提示用户 rebind 后继续更新
- 阻止 `install ./tdd-spec` 把同名但不同路径的 skill 写成脏状态, 让用户明确走 "搬家 = update" 的路径
- 不改变 `uninstall`, `add`, `deploy`, `bareword update` 等命令的现有行为
- 不引入新的 CLI 入口 (没有独立 `relocate` 命令)

**Non-Goals:**
- 不做内容相似度 / Jaccard 校验, 只校验单 vs batch 类型匹配
- 不处理远程 (git/registry/zip) source 的 URL 变化
- 不自动清理历史脏数据 (同 basename 多 bundle), 只在查找时报错让用户手动清理
- 不做 `source list --stale` 或 `source doctor` 辅助命令
- 不改 bareword 解析 (`update tdd-spec` 仍按原 suffix key / repoName / skill name 查找, 不走 URL basename)
- 不让 `uninstall ./tdd-spec` 也享受 basename fallback (uninstall 不依赖原路径, 用户可用 bareword 或 `--skill` 绕开, 保持改动 scope 最小)

## Decisions

### Decision 1: rebind 只在 `update ./local` 触发, 不在其他命令触发

**选择**: 仅 `resolveLocalPath` 在 `update` 命令调用路径上返回一个可能的 "rebind candidate", 由 `update` 命令负责 prompt 和事务性重写 `sources.json`.  其他命令的 `resolveLocalPath` 行为完全不变.

**为什么**:
- rebind 是写操作, 应该和明确的写意图绑定.  `update` 是"我要把这个本地 skill 拉到最新", 语义上用户已经在对 "那个本地 skill" 做事, rebind 只是必要的前提动作, 和用户意图一致.
- `uninstall` 不需要原路径, 即便旧路径失效也能正常删 `SKILLS_MANAGER_DIR` 内的副本.  强行在 uninstall 里做 rebind 反而引入不必要的写操作.
- `add`/`deploy` 是部署到项目, 不涉及 source 本身, 不应该顺便 rebind.
- `install` 的对称操作是 "我要装一个新的", 语义上和 rebind 冲突, 所以 install 走"重名拒绝 + 引导 update"的路线.

**Alternatives**:
- 所有命令都做 rebind → 逻辑散乱, 每个命令都要处理 prompt 和错误路径
- 独立 `skillsmgr source relocate` 命令 → 增加 UX 表面积, 用户需要记住新命令, 和"我本来就在用 update"的直觉割裂

### Decision 2: basename fallback 仅在旧路径失效时触发

**选择**: `resolveLocalPath` 先做精确路径匹配, 失败后进入 fallback 分支; fallback 里找到候选 bundle/source 后, 检查候选的 `info.url` 是否仍然 `fileExists`; 旧路径仍然存在则**不**触发 rebind, 返回 not-found.

**为什么**:
- 同时存在 `/a/tdd-spec` 和 `/b/tdd-spec` 的场景, 用户在 `/b` 下运行 `update ./tdd-spec` 时意图不明确: 是想更新 `/b` 还是 rebind 原来 `/a` 的 bundle?  保守做法是不自动选择.
- 旧路径失效是"这个 bundle 已经不可能从原位置 update 了"的强信号, 此时按 basename 找到唯一候选的置信度很高.
- 用户如果确实想强制把 `/a` 的 bundle 指向 `/b` 的新内容, 可以先 `mv /a/tdd-spec /tmp/deleted`, 再 `update ./tdd-spec`, 流程依然可达.

**Alternatives**:
- 旧路径存在时也做 rebind → 有歧义, 容易误操作
- 永远不做 rebind, 只新增 relocate 命令 → 用户需要先发现命令的存在

### Decision 3: 类型校验 (单 skill vs batch) 作为 rebind 的硬门槛

**选择**: rebind 前检查新路径结构类型是否与候选 bundle/source 一致.
- 候选是单 skill (installMethod='local-copy' 且 key 形如 `custom/{name}`): 新路径必须**直接含 SKILL.md**
- 候选是 batch bundle (type='local-batch'): 新路径必须**没有 SKILL.md 但有含 SKILL.md 的子目录**

类型不匹配直接拒绝 rebind, 返回 not-found 文案 "path type mismatch".

**为什么**:
- 类型不同意味着 rebind 后 update 流程会崩 (单 skill 流程试图读根目录 SKILL.md, batch 流程试图扫子目录), 没有 "通融" 的空间.
- 这也是对 basename 碰撞的额外保护: 如果用户刚好有个无关的 `tdd-spec/` 单文件目录放在 PATH 下, 不会被错认成原来的 11 个子 skill 的 batch.

**Alternatives**:
- 只校验 basename, 不校验类型 → rebind 后 update 立即崩, 用户更困惑
- 再加内容重叠度 / Jaccard 校验 → 过度设计, install 阶段已经保证基名唯一, 类型匹配足够

### Decision 4: `install ./local` 重名检测用 `normalizeLocalPath` 做 URL 比对

**选择**: `installFromLocalDir` 和 `installFromLocalDirBatch` 在写入前, 扫描 sources/bundles 查找同 basename 的已安装记录:
- 单 skill: 在 `sources.json` 里找 `installMethod='local-copy'` 且 `repoName === basename`
- batch: 在 `sources.json` 里找 `bundle.type='local-batch'` 且 `basename(bundle.url) === basename(skillDir)`

找到后比较 `normalizeLocalPath(candidate.url)` 和 `normalizeLocalPath(skillDir)`:
- 相同 → 正常流程 (相当于重新安装同一个位置)
- 不同 → 报错:
  ```
  Error: A local skill/bundle 'tdd-spec' is already installed from:
    /old/path
  To move it to the current path, run:
    skillsmgr update ./tdd-spec
  ```

**为什么**:
- 比对已归一化的路径避免 `./`, `~`, 大小写等形式差异的误判.
- 显式报错 + 引导 update 把"搬家"这一场景闭环了, 用户不需要学新命令.
- 相同路径复装视为 idempotent, 不触发报错.

**Alternatives**:
- 自动覆盖 → 静默丢失旧状态, 和当前 batch install 的脏数据行为相同, 没解决问题
- 询问用户是否覆盖 → 用户可能不知道自己是"搬家"还是"装新的", 交互负担大

### Decision 5: rebind 是"原子"的 sources.json 重写

**选择**: 新增 `SourcesService.rebindLocalBundle(oldBundleId, newUrl)` 和 `SourcesService.rebindLocalSource(key, newUrl)`:
- 读 sources.json (一次 load)
- 重写 bundle.url 和 bundle key (因为 key 含路径, 需要 delete 旧 key + insert 新 key, 新 key 通过 `makeBundleId('local-batch', normalizeLocalPath(newUrl))` 计算)
- 重写 bundle 每个 member 的 `sources[member].url`
- 更新 `updatedAt`
- 保存 (一次 save, 复用现有 temp-file + rename 事务)

**为什么**:
- 单次 load/save 保证要么全改要么不改, 避免部分写入下的不一致.
- 复用 SourcesService 现有的 atomic write (temp + rename).
- rebind 逻辑集中在 service 层, command 层只做 prompt + 调用.

**Alternatives**:
- 多次 `addSource`/`addBundle`/`removeBundle` → 每次 load/save, 中间 crash 会留半成品
- 让 command 直接读写 sources.json → 破坏 service 封装

### Decision 6: 多匹配报错, 不进入交互式选择

**选择**: fallback 查找返回 0/1/多个候选:
- 0: not-found (原文案改进, 提示 basename 没找到)
- 1: 进入类型校验 + rebind prompt
- 多: 报错列出所有候选, 要求用户手动清理后重试

**为什么**:
- 多匹配只会出现在历史脏数据(老版本 batch install 重名时产生), 未来 install 重名检测上线后不会再产生这种状态.
- 交互式从多个"已损坏"的 bundle 里挑一个做 rebind, 用户容易选错, 风险大.
- 明确报错 + 提供 `uninstall --skill` / 手改 sources.json 的指引, 用户一次性清理干净即可.

**Alternatives**:
- 交互式选择 → 容易误操作
- 只取第一个匹配 → 隐藏问题, 脏数据永远清理不掉

## Risks / Trade-offs

- **[风险] 用户在旧路径仍存在时移动了目录, 新位置的 `update ./new` 会拿到 not-found, 困惑为何不自动 rebind** → 改进 not-found 文案, 明确说 "旧路径 /old 仍然存在, 如需切换请先删除或重命名旧路径, 再运行 update ./new"
- **[风险] 类型校验误拒: 用户的新路径下恰好放了个 `SKILL.md` 但原来是 batch** → 用清晰错误文案 "path type mismatch: existing bundle is a batch, but /new/path looks like a single skill" 引导用户检查
- **[风险] rebind 改写 sources.json 的 bundle key, 如果用户同时运行其他 skillsmgr 命令 (理论上 CLI 工具不并发, 但脚本化可能) 有 race** → 依赖现有 atomic write (temp + rename), 单次 rebind 内只做一次 save, 风险可控.  不引入 file lock.
- **[风险] install 重名拒绝是 BREAKING, 原本依赖"悄悄覆盖"行为的用户会受影响** → 报错文案明确告诉用户走 update 即可, 功能损失为 0.  并且悄悄覆盖本来就是 bug-like 行为.
- **[风险] 历史脏数据用户被多匹配报错卡住** → 报错文案要给出清理指引 (列出所有候选的 bundle key, 告诉用户用 `uninstall --skill` 或手改).
- **[权衡] uninstall 不做 basename fallback** → `uninstall ./moved-path` 仍然报 not-found, 用户需要改用 `uninstall <bare-name>` 或 `uninstall --skill`.  是为了 scope 控制和 UX 简单, 不接受"对称性"的诉求.  文档里说明.

## Migration Plan

- 零数据迁移: 新逻辑只增加 fallback 分支和 install 检测, 不修改现有 sources.json 结构.
- `install` 重名检测上线前, sources.json 里可能已有同 basename 多 bundle 的脏状态.  发现后不会自动修, 用户第一次 `update ./name` 触发 fallback 时会看到报错列表, 按指引清理.
- 无需版本号 bump, 向后兼容.
