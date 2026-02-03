---
name: example-skill
description: An example skill template. Use when you want to understand how to create custom skills.
---

# Example Skill

This is a template to help you create your own skills.

## SKILL.md Structure

Every skill needs a `SKILL.md` file with two parts:

1. **YAML Frontmatter** (between `---` markers)
   - `name`: Short identifier for the skill
   - `description`: Explains what the skill does and when to use it

2. **Markdown Content**
   - Instructions the AI follows when the skill is invoked

## Tips for Writing Skills

- Be specific in the description - it determines when the skill activates
- Keep instructions clear and actionable
- You can add supporting files (scripts, templates) in the same directory

## Directory Structure

```
my-skill/
├── SKILL.md           # Required: main instructions
├── resources/         # Optional: reference materials
│   └── checklist.md
└── scripts/           # Optional: automation scripts
    └── validate.sh
```

## Next Steps

1. Copy this directory: `cp -r example-skill my-new-skill`
2. Edit `my-new-skill/SKILL.md` with your content
3. Deploy with: `skillsmgr add my-new-skill`
