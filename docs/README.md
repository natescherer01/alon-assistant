# Personal AI Assistant - Documentation Index

Welcome to the documentation for the Personal AI Assistant (Sam - Alon Assistant). This directory contains comprehensive guides for developers, administrators, and security teams.

---

## 📚 Documentation Overview

### Security & Encryption

#### [DATABASE_ENCRYPTION.md](./DATABASE_ENCRYPTION.md)
**Complete guide to database security and encryption**

Topics covered:
- Why you can see all user data in development (and why it's normal)
- Database encryption at rest (filesystem, PostgreSQL native, cloud providers)
- Database encryption in transit (SSL/TLS configuration)
- Application-level encryption for sensitive fields
- Row-level security (PostgreSQL RLS)
- Production deployment security checklist
- GDPR and HIPAA compliance considerations
- Audit logging and monitoring

**Key takeaway:** Your application enforces user isolation at the API level. Direct database access bypasses this (which is normal for developers/DBAs).

---

### Learning Science & Memory Optimization

#### [MEMORY_OPTIMIZATION.md](./MEMORY_OPTIMIZATION.md)
**Research-backed strategies for exam preparation and learning**

Topics covered:
- Active recall (2x more effective than passive review)
- Spaced repetition and optimal review intervals
- Memory consolidation through sleep (50% improvement)
- Testing effect and retrieval practice
- Interleaving practice (can double exam performance)
- Practical implementation strategies for Sam
- Research citations from 2024-2025 studies

**Use case:** Reference guide for understanding the learning science behind Sam's study recommendations.

#### [MEMORY_OPTIMIZATION_IMPLEMENTATION.md](./MEMORY_OPTIMIZATION_IMPLEMENTATION.md)
**Technical implementation of memory optimization features**

Topics covered:
- Enhanced AI system prompt for exam/quiz detection
- Database models for study sessions and active recall
- Spaced repetition scheduling (SM-2 algorithm)
- Example user interactions and Sam's responses
- Testing recommendations
- List of all modified/created files

**Use case:** Developer guide for understanding how memory optimization features work in the codebase.

---

## 🗂️ Documentation by Category

### Security
- [DATABASE_ENCRYPTION.md](./DATABASE_ENCRYPTION.md) - Complete encryption & security guide

### Features
- [MEMORY_OPTIMIZATION.md](./MEMORY_OPTIMIZATION.md) - Learning science research
- [MEMORY_OPTIMIZATION_IMPLEMENTATION.md](./MEMORY_OPTIMIZATION_IMPLEMENTATION.md) - Technical implementation

---

## 🚀 Quick Links for Common Tasks

### For Developers

**Setting up encryption for production:**
1. Read: [DATABASE_ENCRYPTION.md - Production Deployment Checklist](./DATABASE_ENCRYPTION.md#production-deployment-checklist)
2. Generate keys
3. Configure environment variables
4. Enable cloud provider encryption

**Understanding memory optimization:**
1. Read: [MEMORY_OPTIMIZATION_IMPLEMENTATION.md - How It Works](./MEMORY_OPTIMIZATION_IMPLEMENTATION.md#how-it-works)
2. Review: [System prompt enhancements](../backend/chat/service.py#L284-L400)
3. Check: [Database migration](../backend/alembic/versions/0a61bbb1cba0_add_study_sessions_and_active_recall_.py)

### For Security Auditors

**Security review checklist:**
1. [Current Security Measures](./DATABASE_ENCRYPTION.md#current-security-measures)
2. [Encryption at Rest](./DATABASE_ENCRYPTION.md#database-encryption-at-rest)
3. [Encryption in Transit](./DATABASE_ENCRYPTION.md#database-encryption-in-transit)
4. [Application-Level Encryption](./DATABASE_ENCRYPTION.md#application-level-encryption)
5. [Audit Logging](./DATABASE_ENCRYPTION.md#monitoring--compliance)

### For Product Managers

**Understanding Sam's capabilities:**
1. [Memory Optimization Overview](./MEMORY_OPTIMIZATION.md#overview) - Research backing
2. [User Interaction Examples](./MEMORY_OPTIMIZATION_IMPLEMENTATION.md#example-user-interactions)
3. [Expected Impact](./MEMORY_OPTIMIZATION_IMPLEMENTATION.md#expected-impact)

---

## 📊 Feature Status

| Feature | Status | Documentation |
|---------|--------|---------------|
| JWT Authentication | ✅ Implemented | [DATABASE_ENCRYPTION.md](./DATABASE_ENCRYPTION.md) |
| Password Hashing (bcrypt) | ✅ Implemented | [DATABASE_ENCRYPTION.md](./DATABASE_ENCRYPTION.md) |
| Row-Level Access Control | ✅ Implemented | [DATABASE_ENCRYPTION.md](./DATABASE_ENCRYPTION.md) |
| Database Encryption (Transit) | ⚠️ Configuration Required | [DATABASE_ENCRYPTION.md](./DATABASE_ENCRYPTION.md#database-encryption-in-transit) |
| Database Encryption (Rest) | ⚠️ Configuration Required | [DATABASE_ENCRYPTION.md](./DATABASE_ENCRYPTION.md#database-encryption-at-rest) |
| Application-Level Encryption | 📋 Optional/Advanced | [DATABASE_ENCRYPTION.md](./DATABASE_ENCRYPTION.md#application-level-encryption) |
| Active Recall Detection | ✅ Implemented | [MEMORY_OPTIMIZATION_IMPLEMENTATION.md](./MEMORY_OPTIMIZATION_IMPLEMENTATION.md) |
| Spaced Repetition Scheduling | ✅ Implemented | [MEMORY_OPTIMIZATION_IMPLEMENTATION.md](./MEMORY_OPTIMIZATION_IMPLEMENTATION.md) |
| Study Session Tracking | ✅ Models Ready (Migration Pending) | [MEMORY_OPTIMIZATION_IMPLEMENTATION.md](./MEMORY_OPTIMIZATION_IMPLEMENTATION.md) |

---

## 🔐 Security FAQ

### Q: Why can I see everyone's chat history when I open the database?

**A:** You have direct database access, which bypasses application-level security. This is normal for developers. In production, only DBAs would have this access, and it would be logged. Regular users access data through the API, which enforces user_id filtering.

See: [DATABASE_ENCRYPTION.md - Why You Can See Other Users' Data](./DATABASE_ENCRYPTION.md#why-you-can-see-other-users-data)

### Q: Is my data encrypted?

**A:**
- ✅ Passwords: Yes (bcrypt hashing)
- ✅ In transit (HTTPS): Yes
- ⚠️ Database at rest: Requires configuration (see docs)
- ⚠️ Application-level: Optional for extra security

See: [DATABASE_ENCRYPTION.md](./DATABASE_ENCRYPTION.md)

### Q: What happens to my data if I delete my account?

**A:** All your data is permanently deleted via CASCADE constraints:
- Tasks
- Chat history
- Study sessions
- Active recall questions

See: [backend/models.py](../backend/models.py) - ForeignKey constraints with `ondelete="CASCADE"`

---

## 🎓 Learning Science FAQ

### Q: How does Sam know when I'm studying for an exam?

**A:** Sam detects keywords like "exam", "quiz", "test", "studying for", etc., and automatically activates memory optimization mode.

See: [MEMORY_OPTIMIZATION_IMPLEMENTATION.md - Automatic Exam/Quiz Detection](./MEMORY_OPTIMIZATION_IMPLEMENTATION.md#automatic-examquiz-detection)

### Q: Why does Sam recommend sleep instead of cramming?

**A:** Research shows sleep after studying improves retention by 50%. Cramming all night actually hurts performance.

See: [MEMORY_OPTIMIZATION.md - Memory Consolidation](./MEMORY_OPTIMIZATION.md#memory-consolidation)

### Q: What is active recall and why does Sam push it so hard?

**A:** Active recall (self-testing) is 2x more effective than passive review (57% vs 29% retention). Sam actively discourages re-reading notes because research proves it's ineffective.

See: [MEMORY_OPTIMIZATION.md - Active Recall](./MEMORY_OPTIMIZATION.md#active-recall)

---

## 📝 Contributing to Documentation

When adding new features or documentation:

1. **Create a new .md file** in this directory
2. **Update this README.md** with a link and description
3. **Include code examples** where relevant
4. **Cite research** for learning-related features
5. **Add to Feature Status table** above

### Documentation Standards

- Use clear section headers with anchors
- Include table of contents for long docs
- Provide code examples with syntax highlighting
- Link to relevant source code files
- Keep language concise and technical
- Update "Last Updated" date when modifying

---

## 🔗 External Resources

### Learning Science
- [Retrieval Practice Guide](https://www.retrievalpractice.org/)
- [Ebbinghaus Forgetting Curve Research](https://en.wikipedia.org/wiki/Forgetting_curve)
- [Interleaving Practice Studies](http://uweb.cas.usf.edu/~drohrer/)

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [PostgreSQL SSL Documentation](https://www.postgresql.org/docs/current/ssl-tcp.html)

### FastAPI & SQLAlchemy
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/en/20/orm/)
- [Alembic Migrations](https://alembic.sqlalchemy.org/en/latest/)

---

**Last Updated:** 2025-11-12
**Maintained By:** Development Team
