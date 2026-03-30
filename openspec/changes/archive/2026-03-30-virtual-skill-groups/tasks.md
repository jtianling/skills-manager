## 1. GroupsService 核心

- [x] 1.1 创建 `src/services/groups.ts`, 实现 GroupsService (listGroups, getGroup, createGroup, deleteGroup, addSkill, removeSkill, removeSkillFromAll), 读写 `~/.skills-manager/groups.json`
- [x] 1.2 创建 `src/services/groups.test.ts`, 测试 GroupsService 所有方法 (CRUD, 自动创建 group, 重复添加幂等, removeSkillFromAll 全局清理)

## 2. group 子命令

- [x] 2.1 创建 `src/commands/group.ts`, 实现 group 子命令 (list, create, delete, add, remove), 注册到 Commander
- [x] 2.2 实现 `group add` 的 skill name 解析: name 唯一匹配 → 使用, 同名冲突 → 报错列出完整 key, 无匹配 → 尝试作为完整 key
- [x] 2.3 创建 `src/commands/group.test.ts`, 测试 group 子命令

## 3. 废弃物理 group

- [x] 3.1 修改 `src/services/skills.ts`: custom 目录扫描只取一级子目录, 不再递归 group 子目录
- [x] 3.2 修改 `src/commands/install-utils.ts`: `getCustomSkillDir` 和 `getCustomSkillKey` 移除 group 参数, `validateGroupName` 移除或转移到 GroupsService
- [x] 3.3 修改 `src/commands/install-local.ts`: 所有 install 函数中移除 `options.group` 对安装路径的影响
- [x] 3.4 更新 `src/services/skills.test.ts` 和 `src/commands/install-utils.test.ts` 中的 group 相关测试

## 4. 移除 custom-install 命令

- [x] 4.1 删除 `custom-install` (`ci`) 命令注册和相关代码 (已不存在, 无需操作)
- [x] 4.2 清理相关测试文件中的 ci 命令测试 (已不存在, 无需操作)

## 5. install --group 入组

- [x] 5.1 修改 `src/commands/install.ts` (或 install 入口): 安装完成后, 若指定 `--group`, 调用 `GroupsService.addSkill` 将每个已安装 skill 的 source key 加入 group
- [x] 5.2 测试 install --group 自动入组行为

## 6. add --group 改为读 groups.json

- [x] 6.1 修改 `src/commands/add.ts`: `handleGroupBatchDeploy` 从 `GroupsService.getGroup()` 读取 skill key 列表, 通过 SkillsService 查找对应 skill, 处理悬空引用
- [x] 6.2 更新 `src/commands/add.test.ts` 中的 group 相关测试

## 7. uninstall 清理 group 引用

- [x] 7.1 修改 uninstall 流程: 删除 skill 后调用 `GroupsService.removeSkillFromAll(skillKey)` 清理 groups.json
- [x] 7.2 更新 uninstall 测试

## 8. custom-update 和 custom-skill-lookup 简化

- [x] 8.1 修改 `findInstalledCustomSkill`: 移除 group 子目录扫描, 只检查 `custom/{name}/`
- [x] 8.2 修改 `custom-update`: 移除分组路径查找逻辑, 错误消息中 `custom-install` 改为 `install`
- [x] 8.3 更新相关测试

## 9. skill-grouping 显示简化

- [x] 9.1 修改 `src/utils/prompts.ts`: custom skill 的 subGroup 解析移除 group 部分, 全部平铺
- [x] 9.2 修改 `src/commands/list.ts`: custom skill 不再显示 group-header
- [x] 9.3 更新 prompts 和 list 的相关测试
