## 1. Source 识别与路由重构

- [ ] 1.1 创建 `src/utils/source-detection.ts`, 实现 `detectSourceType(input: string)` 函数, 返回 `'remote-zip' | 'local-zip' | 'remote-url' | 'owner-repo' | 'local-path'`
- [ ] 1.2 为 `detectSourceType` 编写单元测试, 覆盖所有 scenario(裸词, 路径前缀, zip, URL, owner/repo)
- [ ] 1.3 重构 `install.ts` 的 `executeInstall` 函数, 用 `detectSourceType` 替换现有的 shorthand/alias/URL 判断链

## 2. 删除 custom-install 和 provider shorthand

- [ ] 2.1 删除 `src/commands/custom-install.ts` 文件
- [ ] 2.2 从 CLI 注册中移除 `custom-install` / `ci` 命令
- [ ] 2.3 删除 `install.ts` 中的 official provider shorthand 匹配逻辑(直接匹配 `OFFICIAL_PROVIDERS[source]`)
- [ ] 2.4 删除 `resolveProviderAlias` 调用和相关代码
- [ ] 2.5 删除 `custom-install` 相关测试文件

## 3. 本地目录安装并入 install

- [ ] 3.1 在 `install.ts` 中新增 `installFromLocalDir(path, options)` 函数, 复用 `custom-install` 的核心逻辑(SKILL.md 验证, 目录拷贝, 覆盖确认)
- [ ] 3.2 为 `install` 命令添加 `--group` (`-g`) 和 `--force` (`-f`) 参数
- [ ] 3.3 本地目录安装后写入 sources.json, `installMethod: 'local-copy'`
- [ ] 3.4 编写本地目录安装的测试用例

## 4. Zip 安装支持

- [ ] 4.1 在 `install.ts` 中新增 `installFromZip(zipPath, options)` 函数: 解压到 temp → 扫描 SKILL.md → 选择 skill → 拷贝到目标
- [ ] 4.2 在 `install.ts` 中新增 `installFromRemoteZip(url, options)` 函数: 下载到 temp → 调用 `installFromZip`
- [ ] 4.3 zip 安装后写入 sources.json, `installMethod: 'zip'`
- [ ] 4.4 编写 zip 安装的测试用例(本地 zip 和远程 zip)

## 5. sources.json 扩展

- [ ] 5.1 在 `SourceInfo` 接口中添加可选字段 `installMethod?: 'git' | 'zip' | 'local-copy'`
- [ ] 5.2 `update` 命令检查 `installMethod`, 跳过 zip 和 local-copy 来源并提示用户

## 6. add 命令路由简化

- [ ] 6.1 修改 `add.ts` 的 `handleSkillName`, 未找到已安装 skill 时调用统一的 `installSource` 而非报错
- [ ] 6.2 为 `add` 命令添加 `--group` (`-g`) 参数并透传给 install
- [ ] 6.3 更新 `add` 命令的测试用例

## 7. --group 参数全局支持

- [ ] 7.1 `installFromOfficial` 和 `installFromGitHubUrl` 支持 `--group` 参数: 有 group 时安装到 `custom/{group}/{skill}/`
- [ ] 7.2 `installViaGitClone` 支持 `--group` 参数
- [ ] 7.3 编写 group 参数的集成测试(本地 + 远程)
