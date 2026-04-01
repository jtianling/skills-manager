# skillsmgr

مدير مهارات موحّد لأدوات البرمجة بالذكاء الاصطناعي. يُثبّت المهارات في `~/.skills-manager/`, ثم ينشرها في المشاريع من خلال مجلد `.agents/skills/` واحد. يدعم 44 أداة بسير عمل واحد.

[English](./README.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Português](./README.pt-BR.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## أبرز الميزات

- **مستودع مركزي, نشر في أي مكان** — تُثبَّت المهارات مرة واحدة في `~/.skills-manager/`. بعد ذلك, يتيح لك أمر `add` اختيار المهارات المثبّتة محليًا بشكل تفاعلي ونشرها في أي مشروع أو على المستوى العام — دون الحاجة لتذكّر رابط المستودع الأصلي أو مساره في كل مرة.
- **مجموعات مخصّصة للإدارة الدفعية** — نظّم مهاراتك في مجموعات مسمّاة (مثل `--group my-tools`). انشر مجموعة كاملة في مشروع بأمر `add --group` واحد, مما يسهّل صيانة ومشاركة مجموعات المهارات الشخصية.
- **دعم أرشيفات Zip** — ثبّت المهارات مباشرة من ملفات `.zip` أو حزم `.skill` من Anthropic, مما يجعل تعبئة ومشاركة حزم المهارات خارج GitHub أمرًا بسيطًا.

## المتطلبات

- Node.js `>=18`

## الأدوات المدعومة

تُنشر جميع المهارات في `.agents/skills/`. تقرأ الأدوات الأصلية هذا المجلد مباشرة. أما الأدوات غير الأصلية فتستخدم جسر روابط رمزية إلى مسار المهارات القديم. يعرض الجدول أدناه الأدوات الـ 16 المعروضة في المحدّد التفاعلي. كما يتم دعم 28 وكيلاً إضافيًا يمكن استهدافهم مباشرة عبر علامة `-a` في الأوامر غير التفاعلية (مثل `skillsmgr add code-review -a amp`). راجع [docs/supported-agents.md](docs/supported-agents.md) للقائمة الكاملة.

| الأداة | النوع | مسار المشروع |
|------|------|--------------|
| Claude Code | جسر روابط رمزية | `.claude/skills -> .agents/skills` |
| Codex | أصلي | `.agents/skills` |
| Cursor | أصلي | `.agents/skills` |
| OpenClaw | جسر روابط رمزية | `skills -> .agents/skills` |
| OpenCode | أصلي | `.agents/skills` |
| Gemini CLI | أصلي | `.agents/skills` |
| GitHub Copilot | أصلي | `.agents/skills` |
| Cline | أصلي | `.agents/skills` |
| Kilo Code | جسر روابط رمزية | `.kilocode/skills -> .agents/skills` |
| Roo Code | جسر روابط رمزية | `.roo/skills -> .agents/skills` |
| Kiro CLI | جسر روابط رمزية | `.kiro/skills -> .agents/skills` |
| Trae | جسر روابط رمزية | `.trae/skills -> .agents/skills` |
| Trae CN | جسر روابط رمزية | `.trae/skills -> .agents/skills` |
| CodeBuddy | جسر روابط رمزية | `.codebuddy/skills -> .agents/skills` |
| Windsurf | جسر روابط رمزية | `.windsurf/skills -> .agents/skills` |
| Goose | جسر روابط رمزية | `.goose/skills -> .agents/skills` |

## بداية سريعة

```bash
# 1. تثبيت المهارات من مستودع Anthropic الرسمي
npx skillsmgr install anthropics/skills

# 2. نشر المهارات في المشروع الحالي
cd your-project
npx skillsmgr deploy

# 3. فحص المهارات المنشورة
npx skillsmgr list --deployed
```

## نموذج النشر

```text
project/
├── .agents/
│   └── skills/
│       ├── code-review -> ~/.skills-manager/official/anthropic/skills/code-review
│       └── example-skill -> ~/.skills-manager/custom/example-skill
├── .claude/
│   └── skills -> ../.agents/skills
└── .cursor/
    └── skills -> ../.agents/skills
```

- تقرأ الأدوات الأصلية `.agents/skills/` مباشرة.
- تُهيَّأ الأدوات غير الأصلية بإنشاء جسر روابط رمزية أثناء `deploy` أو `add`.
- النشر الافتراضي للمهارات يكون عبر الروابط الرمزية; استخدم `--copy` إذا أردت نسخًا محلية للمشروع بدلاً من ذلك.
- استخدم `-g` للنشر العام في مجلدات الوكيل على مستوى المستخدم (مثل `~/.claude/skills`).

## الأوامر

| الأمر | الاختصار | الوصف |
|---------|-------|-------------|
| `skillsmgr install <source>` | `i` | تثبيت المهارات من GitHub أو مجلد محلي أو أرشيف zip |
| `skillsmgr uninstall [identifier]` | - | إزالة المهارات من `~/.skills-manager/` |
| `skillsmgr update [source]` | - | تحديث المهارات المثبّتة من المصادر المتتبَّعة |
| `skillsmgr list` | - | عرض المهارات المثبّتة في `~/.skills-manager/` |
| `skillsmgr list --deployed` | - | عرض المهارات المنشورة والأدوات المهيّأة في المشروع الحالي |
| `skillsmgr deploy` | - | نشر تفاعلي في المشروع الحالي |
| `skillsmgr add [name]` | - | إضافة مهارة إلى المشروع |
| `skillsmgr remove [name]` | - | إزالة مهارة منشورة من المشروع |
| `skillsmgr group <subcommand>` | - | إدارة مجموعات المهارات الافتراضية |

### علامات الأوامر

**install**

| العلامة | الوصف |
|------|-------------|
| `--all` | تثبيت جميع المهارات المكتشفة بدون مطالبة |
| `--custom` | التثبيت في `custom/` بدلاً من `community/` |
| `-f, --force` | الكتابة فوق المهارة الموجودة بدون تأكيد |
| `--group <name>` | إضافة المهارات المثبّتة إلى مجموعة افتراضية |
| `-s, --skill <name>` | تحديد مهارات معيّنة (قابل للتكرار) |

**add**

| العلامة | الوصف |
|------|-------------|
| `--all` | إضافة جميع المهارات بدون مطالبة |
| `--copy` | نسخ الملفات بدلاً من إنشاء روابط رمزية |
| `-a, --agent <name>` | الوكيل المستهدف (قابل للتكرار) |
| `-s, --skill <name>` | تحديد مهارات معيّنة (قابل للتكرار) |
| `-g, --global` | النشر العام في مجلدات الوكيل على مستوى المستخدم |
| `--group <name>` | نشر دفعي لجميع المهارات من مجموعة |
| `-y, --yes` | تخطّي جميع المطالبات (يعادل --all) |
| `--same-agents` | استخدام الوكلاء المهيّأين حاليًا |

**remove**

| العلامة | الوصف |
|------|-------------|
| `--all` | إزالة جميع المهارات المطابقة بدون مطالبة |
| `-s, --skill <name>` | مهارة محدّدة للإزالة (قابل للتكرار) |
| `-a, --agent <name>` | الوكيل المستهدف (قابل للتكرار) |
| `-g, --global` | الإزالة من مجلدات الوكيل العامة |
| `--group <name>` | إزالة دفعية للمهارات المنشورة من مجموعة |
| `-y, --yes` | تخطّي جميع المطالبات (يعادل --all) |

**deploy**

| العلامة | الوصف |
|------|-------------|
| `--copy` | نسخ الملفات بدلاً من إنشاء روابط رمزية |
| `-g, --global` | نشر المهارات عالميًا في مجلدات الوكيل على مستوى المستخدم |

**uninstall**

| العلامة | الوصف |
|------|-------------|
| `--all` | تخطّي مطالبة الاختيار وإلغاء تثبيت جميع المهارات المطابقة |
| `-f, --force` | تخطّي مطالبة التأكيد |
| `-y, --yes` | تخطّي جميع المطالبات (يعادل --all --force) |
| `-s, --skill <name>` | مهارة محدّدة لإلغاء التثبيت (قابل للتكرار) |

**group**

| الأمر الفرعي | الوصف |
|------------|-------------|
| `group list [name]` | عرض جميع المجموعات أو تفاصيل مجموعة |
| `group create <name>` | إنشاء مجموعة فارغة جديدة |
| `group delete <name>` | حذف مجموعة (لا تتأثر المهارات) |
| `group add <group> <skill>` | إضافة مهارة إلى مجموعة |
| `group remove <group> <skill>` | إزالة مهارة من مجموعة |
| `group rename <old> <new>` | إعادة تسمية مجموعة |

## تثبيت المهارات

### مهارات Anthropic الرسمية

```bash
npx skillsmgr install anthropics/skills
npx skillsmgr install anthropics/skills --all
```

### مستودع GitHub

```bash
# اختصار owner/repo
npx skillsmgr install Fission-AI/OpenSpec

# رابط GitHub كامل
npx skillsmgr install https://github.com/user/skills-repo

# مسار مهارة محدّد
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### مجلد محلي أو أرشيف zip

```bash
# التثبيت من مجلد محلي (يجب أن يبدأ بـ ./ أو /)
npx skillsmgr install ./my-skill

# التثبيت من ملف zip أو حزمة .skill
npx skillsmgr install ./skills-archive.zip
npx skillsmgr install ./my-skill.skill

# التثبيت في مجموعة مخصّصة
npx skillsmgr install ./my-skill --group my-tools
```

### خيارات تثبيت مفيدة

```bash
# تثبيت جميع المهارات المكتشفة بدون مطالبة
npx skillsmgr install anthropics/skills --all

# تثبيت مهارات محدّدة بالاسم فقط
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# معاملة المصدر المثبّت كمخصّص بدلاً من مجتمعي
npx skillsmgr install https://github.com/user/repo --custom
```

يتعامل المثبّت مع تخطيطات المستودعات التالية:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- `SKILL.md` في جذر المستودع

## نشر المهارات

### النشر التفاعلي

```bash
# النشر في المشروع الحالي (اختيار تفاعلي للوكلاء والمهارات)
npx skillsmgr deploy

# النشر العام في مجلدات الوكيل على مستوى المستخدم
npx skillsmgr deploy -g
```

### النشر غير التفاعلي

```bash
# إضافة مهارة محدّدة إلى وكيل محدّد
npx skillsmgr add code-review -a claude-code

# إضافة مهارات متعدّدة إلى وكلاء متعدّدين
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# النشر العام
npx skillsmgr add code-review -g -a claude-code

# إزالة مهارة
npx skillsmgr remove code-review

# الإزالة من النشر العام
npx skillsmgr remove code-review -g -a claude-code
```

## الاستخدام التفاعلي

يستخدم كل من `install` و`deploy` و`add` و`remove` و`uninstall` محدّدًا تفاعليًا بالاختصارات التالية:

| المفتاح | الإجراء |
|-----|--------|
| `j` / `k` أو مفاتيح الأسهم | تحريك المؤشر |
| `gg` / `G` | الانتقال إلى الأعلى أو الأسفل |
| `h` / `l` | طيّ / توسيع المجموعة الحالية |
| `c` | تبديل طيّ جميع المجموعات |
| `/` | الدخول في وضع البحث (في القوائم الكبيرة) |
| `space` | تبديل التحديد |
| `ctrl+a` | تبديل تحديد جميع العناصر المرئية |
| `enter` | تأكيد |
| `q` أو `ctrl+c` | إلغاء |

## هيكل المجلدات

```text
~/.skills-manager/
├── official/
│   └── anthropic/
│       └── skills/
│           ├── code-review/SKILL.md
│           └── commit-message/SKILL.md
├── community/
│   └── owner/
│       └── repo-name/
│           └── skill-name/SKILL.md
├── custom/
│   └── example-skill/SKILL.md
├── groups.json
└── sources.json
```

- `official/`: المصادر الرسمية المضمّنة مثل `anthropic`
- `community/`: مستودعات الطرف الثالث
- `custom/`: المهارات المحلية والمهارات المثبّتة صراحة كمخصّصة
- `groups.json`: تعريفات المجموعات الافتراضية المُدارة بواسطة أوامر `group`
- `sources.json`: بيانات المصادر الوصفية المستخدمة بواسطة `update`

## شكر وتقدير

تم إنشاء هذا المشروع بشكل مستقل. العديد من التحسينات اللاحقة مستوحاة من [vercel-labs/skills](https://github.com/vercel-labs/skills).

## الرخصة

MIT
