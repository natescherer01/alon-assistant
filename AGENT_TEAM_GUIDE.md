## Software Development Team with /create Command

A production-ready software development team powered by Claude Code agents, designed to build enterprise-grade applications with zero corners cut.

## 🎯 Overview

The `/create` command launches a **senior-level software team** managed by an experienced Project Manager (PM). This team includes:

1. **Project Manager** (You interact with this) - Orchestrates the team
2. **Software Architect** - Designs scalable architectures
3. **Full-Stack Developer** - Implements features
4. **Security Specialist** - Ensures OWASP compliance
5. **ML & AI Specialist** - Builds ML/AI features
6. **Testing Specialist** - Creates comprehensive tests
7. **Best Practices Guardian** - Reviews EVERY step for quality

## 🚀 Quick Start

### Basic Usage

```bash
/create
```

Then tell the PM what you want to build:
```
"Create a REST API for user management with authentication"
"Build a React dashboard with real-time updates"
"Implement a document classification ML system"
```

The PM will:
1. Ask clarifying questions
2. Break down the work
3. Delegate to specialists
4. Coordinate quality reviews
5. Deliver production-ready code

## 📋 Project Workflow

### Phase 1: Requirements Gathering (PM)

The PM will ask questions to understand your needs:
- What are we building?
- Who are the users?
- What are the constraints?
- What defines success?

**Example**:
```
You: /create
PM: What would you like the team to create?
You: A user authentication system with JWT

PM: Great! Let me understand the requirements:
1. Backend framework (FastAPI/Django/Express)?
2. Features needed (signup, login, password reset)?
3. Security requirements (MFA, rate limiting)?
4. Database (PostgreSQL, MongoDB)?

[You answer...]

PM: Perfect! Here's the plan:
- Phase 1: Architecture (15 min)
- Phase 2: Implementation (1 hour)
- Phase 3: Security Review (20 min)
- Phase 4: Testing (30 min)
- Phase 5: Final Quality Review (15 min)

Starting with architecture...
```

### Phase 2: Architecture (Architect Agent)

The architect will:
- Design system architecture
- Choose technology stack
- Define component boundaries
- Plan for scalability
- Document decisions

**Output**: Architecture document and diagrams

### Phase 3: Implementation (Full-Stack + ML Agents)

Developers will:
- Set up project structure
- Implement backend/API
- Build frontend (if needed)
- Set up database
- Add error handling
- Configure deployment

**Output**: Working code with documentation

### Phase 4: Security Review (Security Agent)

Security specialist will:
- Check OWASP Top 10 vulnerabilities
- Review authentication/authorization
- Validate input handling
- Check secrets management
- Assess API security

**Output**: Security assessment with risk levels

### Phase 5: Testing (Testing Agent)

Testing specialist will:
- Design test strategy
- Write unit tests
- Write integration tests
- Measure coverage
- Create test documentation

**Output**: Comprehensive test suite

### Phase 6: Quality Gates (Best Practices Agent)

**CRITICAL**: The Best Practices Guardian reviews at EVERY step:

✅ After architecture design
✅ After implementation
✅ After security fixes
✅ After tests added
✅ Final approval before delivery

**Output**: Production-ready approval or blocker list

## 🎨 Example Projects

### Example 1: REST API

```
You: /create
PM: What would you like to create?
You: A REST API for managing tasks with user authentication

PM: Got it! Quick questions:
1. Framework preference? (I recommend FastAPI)
2. Database? (PostgreSQL/SQLite)
3. Features: CRUD operations, authentication, what else?

You: FastAPI, PostgreSQL, and I need task assignment between users

PM: Perfect! Starting...

[15 minutes later]

PM: ✅ Architecture complete and approved
Now implementing...

[1 hour later]

PM: ✅ Implementation complete
⚠️  Best Practices found 2 high-priority issues:
1. Missing rate limiting on auth endpoints
2. No pagination for task lists

Fixing now...

[Continues through all phases...]

PM: ✅ PROJECT COMPLETE!

Deliverables:
✅ FastAPI REST API
✅ PostgreSQL database with migrations
✅ JWT authentication
✅ Task CRUD with user assignment
✅ Rate limiting & pagination
✅ 95% test coverage
✅ Security validated
✅ Production ready

Files created:
- backend/main.py (API entry point)
- backend/models.py (Database models)
- backend/auth/ (Authentication)
- backend/tasks/ (Task management)
- tests/ (Comprehensive tests)
- README.md (Setup guide)
```

### Example 2: ML Feature

```
You: /create
PM: What would you like to create?
You: Add a document classification feature to my app

PM: Great! Questions:
1. What types of documents?
2. What categories?
3. Training data available?
4. Latency requirements?

You: PDFs and text files, 5 categories, have 1000 labeled examples, <500ms

PM: Perfect! Bringing in the ML specialist...

[ML Specialist designs solution]
ML Agent: Recommending:
- TF-IDF + Logistic Regression (fast, interpretable)
- FastAPI endpoint for predictions
- Model monitoring with drift detection

PM: Architecture approved. Implementing...

[Implementation...]

PM: ✅ ML Pipeline complete
✅ API endpoint deployed
✅ Model accuracy: 94%
✅ Latency: 120ms average
✅ Monitoring configured
✅ Tests added

Ready for production!
```

### Example 3: Full-Stack App

```
You: /create
PM: What would you like to create?
You: A full-stack web app for team collaboration

PM: Awesome! Let me understand:
1. Features needed (chat, file sharing, task management)?
2. Tech preferences (React/Vue, FastAPI/Django)?
3. Real-time updates needed?
4. Team size (affects architecture)?

You: Tasks + file sharing, React + FastAPI, yes real-time, up to 50 users

PM: Got it! This is a medium-sized project:

Phase 1: Architecture (30 min)
- Frontend: React + Vite
- Backend: FastAPI + WebSockets
- Database: PostgreSQL
- Storage: S3/local
- Real-time: WebSockets

Phase 2: Implementation (3 hours)
- Backend API
- React frontend
- WebSocket server
- File upload system
- Authentication

Phase 3: Security (45 min)
Phase 4: Testing (1.5 hours)
Phase 5: Quality Review (30 min)

Starting now...

[Team works through all phases with quality gates...]

PM: ✅ PROJECT COMPLETE!

Deliverables:
✅ React frontend with real-time updates
✅ FastAPI backend with WebSockets
✅ Task management system
✅ File upload/download
✅ User authentication & authorization
✅ Real-time collaboration
✅ Comprehensive tests (88% coverage)
✅ Security hardened
✅ Deployment ready

Time: 5.5 hours
```

## 🛡️ Quality Assurance

### Mandatory Quality Gates

The **Best Practices Guardian** reviews at EVERY step. Projects cannot proceed with:

#### Critical Issues (MUST FIX)
- Security vulnerabilities
- Data loss risks
- Authentication bypasses
- Hardcoded secrets
- SQL injection risks

#### High Priority (SHOULD FIX)
- Missing error handling
- Poor code quality
- No input validation
- Performance problems
- Missing tests

The PM will **STOP** and fix critical issues before proceeding.

### Coverage Requirements

- **Unit Tests**: 70% minimum
- **Integration Tests**: Key workflows
- **End-to-End Tests**: Critical paths
- **Security Tests**: Auth & authorization

### Review Checklist

Before delivery, code must pass:

✅ **Architecture Review**
- Scalable design
- Appropriate patterns
- Clear boundaries

✅ **Code Quality Review**
- Clean code principles
- No code smells
- Proper error handling
- Good documentation

✅ **Security Review**
- OWASP Top 10 checked
- Authentication solid
- Input validated
- Secrets managed

✅ **Testing Review**
- Adequate coverage
- Tests pass reliably
- Edge cases covered

✅ **Production Readiness**
- Logging configured
- Monitoring ready
- Deployment documented
- Backup strategy

## 🔧 Advanced Usage

### Working with Specific Agents

You can call agents directly if needed:

```bash
# Architecture only
Use the architect subagent to design a microservices architecture for...

# Implementation only
Use the fullstack-developer subagent to implement...

# Security audit only
Use the security-specialist subagent to review...

# ML feature only
Use the ml-ai-specialist subagent to build...
```

### Customizing the Workflow

Tell the PM your preferences:

```
/create

You: Build a REST API, but I want to review the architecture before implementation

PM: Understood! I'll:
1. Have architect design the system
2. Present to you for approval
3. Only proceed with implementation after you approve

[Architect designs...]

PM: Here's the architecture. Please review:
[Shows architecture]

Approve to proceed with implementation, or provide feedback.
```

### Iterative Development

```
You: /create
You: Start with user authentication, then we'll add features

PM: Got it! Building authentication first.

[Completes auth...]

PM: ✅ Authentication complete and production-ready.
Ready to add more features when you are!

You: Great! Now add task management

PM: On it! Building on the authentication foundation...
```

## 📊 Agent Capabilities

### Software Architect
- System design
- Technology selection
- Scalability planning
- Architecture patterns
- Technical documentation

### Full-Stack Developer
- React, TypeScript, Vue
- Python (FastAPI, Django)
- Node.js (Express)
- PostgreSQL, MongoDB
- Docker, CI/CD
- Cloud deployment (AWS, GCP, Vercel)

### Security Specialist
- OWASP Top 10
- Penetration testing
- Authentication/authorization
- Encryption & key management
- Secure coding practices
- Vulnerability scanning

### ML & AI Specialist
- Classical ML (scikit-learn, XGBoost)
- Deep Learning (PyTorch, TensorFlow)
- NLP & LLMs (Transformers, GPT)
- RAG systems
- Model deployment
- MLOps & monitoring

### Testing Specialist
- pytest, Jest, testing libraries
- Unit testing
- Integration testing
- End-to-end testing
- Performance testing
- Coverage analysis

### Best Practices Guardian
- Code quality review
- Production readiness
- Performance analysis
- Security validation
- Technical debt assessment
- Standards enforcement

## 🎯 When to Use Which Agent

### Use `/create` (Full Team) when:
- Building a complete feature
- Need end-to-end implementation
- Want production-ready code
- Require comprehensive quality assurance
- Building from scratch

### Use Individual Agents when:
- **Architect**: Need design advice only
- **Developer**: Have architecture, need implementation
- **Security**: Audit existing code
- **ML**: Add ML to existing app
- **Testing**: Add tests to existing code
- **Best Practices**: Code review only

## 💡 Tips for Best Results

### Be Specific
```
❌ "Build a web app"
✅ "Build a React web app for inventory management with barcode scanning"
```

### Provide Context
```
✅ "Add authentication to my existing FastAPI app at backend/"
✅ "We have 100K users, need horizontal scaling"
✅ "Must comply with HIPAA for healthcare data"
```

### State Constraints
```
✅ "Budget: < $100/month for hosting"
✅ "Must work offline"
✅ "Need <200ms API latency"
```

### Ask Questions
```
✅ "What are the trade-offs between SQLite and PostgreSQL here?"
✅ "Should we use microservices or monolith for this scale?"
✅ "What testing strategy do you recommend?"
```

## 🚧 Handling Issues

### If Project Blocked

PM will report:
```
PM: ⚠️  BLOCKER

Critical issues found:
1. Authentication has SQL injection vulnerability (CRITICAL)
2. API keys hardcoded in source (CRITICAL)

Cannot proceed until these are fixed.

Delegating to Full-Stack Developer to fix...
Then Security Specialist will re-review.
```

### If Requirements Change

```
You: Actually, can we add social login?

PM: Absolutely! This changes our authentication design.

Let me:
1. Have architect update the design
2. Full-stack developer will modify implementation
3. Security will review OAuth integration
4. Testing will add OAuth tests

Updating plan...
```

## 📚 Generated Documentation

After completion, you'll receive:

1. **README.md** - Setup and usage
2. **ARCHITECTURE.md** - System design
3. **API_DOCS.md** - API reference
4. **DEPLOYMENT.md** - Deployment guide
5. **TESTING.md** - Test strategy
6. **SECURITY.md** - Security considerations

## 🎓 Learning from the Team

The agents explain their decisions:

```
Architect: "I chose PostgreSQL over MongoDB because:
1. Your data has clear relationships (users → tasks)
2. ACID guarantees needed for task assignments
3. Team familiar with SQL
4. Easier to scale vertically first"

Security: "Rate limiting is critical here because:
1. Login endpoint is public
2. Prevents brute force attacks
3. Reduces DDoS risk
4. Low performance impact"
```

## 🔄 Continuous Improvement

### Request Enhancements
```
You: Can you add caching to improve performance?

PM: Great idea! Let me:
1. Have architect design caching strategy (Redis)
2. Full-stack implements
3. Testing adds cache tests
4. Best Practices reviews

[Proceeds with enhancement...]
```

### Refactoring
```
You: Can we refactor the authentication code for better maintainability?

PM: Absolutely! Bringing in Best Practices Guardian to analyze,
then Full-Stack Developer to refactor with proper patterns.
```

## 🌟 Success Stories

### Real-World Use Cases

1. **E-commerce Platform**: Multi-tenant SaaS in 8 hours
2. **Document Classifier**: ML pipeline production-ready in 4 hours
3. **Real-time Dashboard**: React + WebSockets in 6 hours
4. **REST API**: Full CRUD with auth in 2 hours
5. **Data Pipeline**: ETL system with monitoring in 5 hours

### Quality Metrics

- **0 critical vulnerabilities** in production
- **>85% average test coverage**
- **<48 hours** from start to production
- **100% documentation** coverage
- **Zero production hotfixes** for quality issues

## 📞 Getting Help

### Ask the PM

```
You: What's the best way to handle file uploads?

PM: Let me consult the architect...

Architect: For your scale (< 1000 users), I recommend:
1. Direct upload to server (simple)
2. Store in local filesystem or S3
3. Scan for viruses (ClamAV)
4. Limit file size to 10MB

For larger scale, use presigned S3 URLs.
```

### Request Explanation

```
You: Why did you choose this database schema?

PM: Let me have the architect explain...

Architect: This schema design:
1. Normalizes to 3NF (reduces redundancy)
2. Uses indexes on foreign keys (query performance)
3. Includes soft deletes (audit trail)
4. Has created_at/updated_at (tracking)

Alternative considered: Denormalized for speed
Trade-off: More storage vs better data integrity
Chose integrity since queries are still fast (<50ms)
```

## 🎉 Ready to Build!

The /create command gives you an entire senior software team:

✅ Expert architects
✅ Skilled developers
✅ Security specialists
✅ ML engineers
✅ QA experts
✅ Quality guardians

All coordinated by an experienced PM to deliver **production-ready code with zero corners cut**.

---

**Try it now!**

```bash
/create
```

Then tell the PM what amazing thing you want to build! 🚀
