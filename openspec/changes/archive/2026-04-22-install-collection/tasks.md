## 1. Registry service 新增 resolve 调用

- [x] 1.1 `src/services/registry.ts` 增加 `resolveCollection(refs: string[], skills?: string[])` 方法，POST 到 `/api/collections/resolve`
- [x] 1.2 请求头在 `readAuth()` 有 token 时附加 `Authorization: Bearer <token>`
- [x] 1.3 解析响应 `{ members, warnings }`，定义 TypeScript 类型

## 2. Ref 规范化

- [x] 2.1 `src/utils/source-detection.ts` 新增 `normalizeCollectionRef(input)` 函数
- [x] 2.2 支持四种输入形式（`@owner/slug`、`owner/slug`、`skillsmgr.dev/c/...`、完整 URL）
- [x] 2.3 单测：各输入形式归一化为 `@owner/slug`

## 3. Install 命令集成

- [x] 3.1 `install.ts` 加 `--from <ref>` option
- [x] 3.2 当 `--from` 存在时：resolve → 展示 members + warnings → 确认 → 串行 installFromRegistry
- [x] 3.3 warnings 全部逐条打印
- [x] 3.4 JSON 输出：`{ collection, members, installed, failed, warnings }`
- [x] 3.5 和 `--group` 组合：所有成功 member 加入指定 group
- [x] 3.6 空 collection exit 0

## 4. Add 命令集成

- [x] 4.1 `add.ts` 加 `--from <ref>` option
- [x] 4.2 resolve → 按 members 调用 install-then-deploy 流程
- [x] 4.3 和 `--agent`、`--copy`、`--global` 组合正常

## 4b. Remove / Uninstall 命令集成

- [x] 4b.1 `remove.ts` 加 `--from <ref>` option；resolve → 对每个 member 调用 remove 流程
- [x] 4b.2 `uninstall.ts` 加 `--from <ref>` option；resolve → 对每个 member 调用 uninstall 流程
- [x] 4b.3 JSON 输出对称：remove/uninstall 复用现有命令的 JSON 结构（先 expand 再走原流程）

## 5. 测试

- [x] 5.1 单测：normalizeCollectionRef 四种形式
- [x] 5.2 单测：resolveCollection mock fetch 验证 body/headers
- [x] 5.3 单测：install --from 全部成功（mock endpoint + registry）
- [x] 5.4 单测：warnings 透传（每种 kind）
- [x] 5.5 单测：单 member 失败不阻塞
- [x] 5.6 单测：空 members exit 0
- [x] 5.7 单测：--group 组合（由 install-collection 流程覆盖）
- [x] 5.8 单测：--json 输出 schema
- [x] 5.9 单测：remove --from 跳过未部署 member
- [x] 5.10 单测：uninstall --from 跳过未安装 member
