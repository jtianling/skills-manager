# remove 导致虚拟组成员丢失

2026-10-08 排查发现, `remove` 的各取消部署入口调用
`GroupsService.removeSkillFromAll()`, 会删除所有虚拟组中对应的成员引用.
旧 OpenSpec 和测试也要求这一行为, 因此发布前测试通过不能证明数据未受影响.

修复规则: `remove` 仅取消部署, 保留中央仓库文件和所有组成员引用.
`uninstall` 删除中央仓库 skill 时继续清理引用.

回归验证必须同时检查部署结果, 原组和其他组的成员保持不变,
以及取消部署后能按原组重新部署.  项目和全局模式均需要覆盖.

本机 develop 从 `groups.json.v1.backup` 恢复了 36 条引用,
其中 `custom/jt-code-reviewer` 的文件缺失.  恢复仅替换 develop 的 members,
保留其他组, 并提前备份当前 groups.json.
