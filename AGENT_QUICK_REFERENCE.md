# Agent Team Quick Reference

## Commands

### Primary Command

```bash
/create
```
Launches the full software development team with PM orchestration.

### Direct Agent Access

```bash
# Use specific agent directly
Use the <agent-name> subagent to...
```

## Agent Names

| Agent | Name | Use When |
|-------|------|----------|
| 🏗️ | `architect` | Need system design, architecture advice |
| 💻 | `fullstack-developer` | Implementing features, APIs, UIs |
| 🔒 | `security-specialist` | Security review, vulnerability assessment |
| 🤖 | `ml-ai-specialist` | ML features, LLM integration, data pipelines |
| 🧪 | `testing-specialist` | Writing tests, test strategy |
| ✅ | `best-practices` | Code review, quality assurance |

## Quick Examples

### Full Stack Web App
```
/create
"Build a task management web app with React and FastAPI"
```

### API Only
```
/create
"Create a REST API for user management with authentication"
```

### Add ML Feature
```
/create
"Add document classification to my existing app"
```

### Security Audit
```
Use the security-specialist subagent to review my authentication implementation
```

### Code Review
```
Use the best-practices subagent to review the code in src/
```

### Architecture Advice
```
Use the architect subagent to design a microservices architecture for...
```

## Workflow Phases

1. **Requirements** (PM asks questions)
2. **Architecture** (Architect designs)
3. **Implementation** (Developer builds)
4. **Security** (Security reviews)
5. **Testing** (Testing adds tests)
6. **Quality Gates** (Best Practices reviews at EVERY step)

## Quality Gates

Best Practices agent reviews:
- ✅ After architecture
- ✅ After implementation
- ✅ After security fixes
- ✅ After tests added
- ✅ Final approval

**Critical issues = STOP**. Fix before proceeding.

## Agent Specialties

### Architect
- System design
- Technology choices
- Scalability planning
- Patterns & best practices

### Full-Stack Developer
- **Frontend**: React, TypeScript, Vue
- **Backend**: Python (FastAPI, Django), Node.js
- **Database**: PostgreSQL, MongoDB, Redis
- **Cloud**: AWS, GCP, Vercel, Railway

### Security Specialist
- OWASP Top 10
- Authentication/authorization
- Penetration testing
- Secure coding
- Vulnerability scanning

### ML & AI Specialist
- Classical ML (scikit-learn)
- Deep Learning (PyTorch)
- LLMs & RAG
- Model deployment
- MLOps

### Testing Specialist
- pytest, Jest
- Unit/integration/e2e tests
- Coverage analysis
- Test automation

### Best Practices Guardian
- Code quality
- Production readiness
- Security validation
- Performance review
- Zero corners cut

## Tips

### Be Specific
```
❌ "Build an app"
✅ "Build a React inventory app with barcode scanning"
```

### Provide Context
```
✅ "Add auth to my FastAPI app at backend/"
✅ "Scale to 100K users"
✅ "Must be HIPAA compliant"
```

### State Constraints
```
✅ "Budget: $100/month"
✅ "Must work offline"
✅ "Latency: <200ms"
```

## Common Patterns

### New Feature
```
/create → PM asks questions → Team builds → Quality gates → Delivery
```

### Add to Existing
```
/create
"Add [feature] to my existing app at [path]"
```

### Architecture Review
```
Use the architect subagent to review the architecture in...
```

### Security Audit
```
Use the security-specialist subagent to perform security audit of...
```

### Add Tests
```
Use the testing-specialist subagent to add tests for...
```

### Code Review
```
Use the best-practices subagent to review...
```

## Expected Timelines

| Project Size | Time Estimate |
|--------------|---------------|
| Small (API endpoint) | 30 min - 1 hour |
| Medium (Feature) | 1-3 hours |
| Large (Full app) | 3-8 hours |
| Complex (Multi-feature) | 8-16 hours |

*All include full quality assurance*

## Deliverables

### Code
- Production-ready implementation
- Proper error handling
- Environment configuration
- Clean code structure

### Tests
- >80% coverage
- Unit tests
- Integration tests
- Test documentation

### Documentation
- README.md
- ARCHITECTURE.md
- API documentation
- Deployment guide

### Quality Assurance
- Security validated
- Performance optimized
- Best practices followed
- Zero corners cut

## Getting Help

### Ask PM
```
You: "What's the best approach for [problem]?"
PM: [Consults specialist and provides recommendation]
```

### Request Explanation
```
You: "Why did you choose [decision]?"
PM: [Has specialist explain reasoning]
```

### Change Requirements
```
You: "Actually, can we add [feature]?"
PM: [Updates plan and implements]
```

## File Locations

### Agent Definitions
```
.claude/agents/
├── architect.md
├── fullstack-developer.md
├── security-specialist.md
├── ml-ai-specialist.md
├── testing-specialist.md
└── best-practices.md
```

### Commands
```
.claude/commands/
└── create.md
```

## Support

### Documentation
- [AGENT_TEAM_GUIDE.md](AGENT_TEAM_GUIDE.md) - Full guide
- This file - Quick reference

### In-App Help
```
/help
```

## Pro Tips

1. **Always use /create for new features** - Gets full team coordination
2. **Let PM ask questions** - Better results with clarity
3. **Trust the quality gates** - They prevent production bugs
4. **Review architecture first** - Easier to change before coding
5. **Provide context** - More context = better decisions
6. **Be specific about constraints** - Budget, time, scale matter
7. **Ask questions** - PM can explain any decision

## Success Formula

```
Clear Requirements
    ↓
Good Architecture
    ↓
Clean Implementation
    ↓
Security Review
    ↓
Comprehensive Testing
    ↓
Quality Assurance
    ↓
Production-Ready Code ✨
```

---

**Ready to build!** Type `/create` and tell the PM what you want! 🚀
