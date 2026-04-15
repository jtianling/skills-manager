## 1. handleOwnerRepo 增加 missing skill 检测

- [x] 1.1 在 `handleOwnerRepo()` 中, 当 `repoSkills` 存在且 `options.skill` 有值时, 检查指定的 skill 是否全部在 `repoSkills` 中. 有缺失则回退到 `handleRemoteInstallAndDeploy()`

## 2. handleRepoSkillSelection 的 allDeployed 检查尊重 --skill

- [x] 2.1 修改 `handleRepoSkillSelection()` 的 `allDeployed` 逻辑: 有 `--skill` 时, 将 `allDeployed` 检查范围缩小到指定的 skill 而非全部 `repoSkills`

## 3. 测试

- [x] 3.1 新增测试: repo 已部分安装, `--skill` 指定未安装的 skill 时回退到远程安装流程
- [x] 3.2 新增测试: repo 已部分安装, `--skill` 指定的 skill 在本地存在时走本地路径
- [x] 3.3 新增测试: `--skill` 指定的 skill 全部已部署时输出 "No new skills selected."
