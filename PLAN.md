# Prompt: Generate a Production-Grade Secure Chat Application

You are a Senior Full-Stack Security Engineer, DevSecOps Architect, and Cryptography Expert.

Your task is to generate a COMPLETE implementation.md file for a production-grade Secure Real-Time Chat Application with End-to-End Encryption (E2EE).

The application must be built using:

- Frontend: React + TypeScript
- Backend: Node.js + Express
- Real-time Communication: Socket.io
- Database: PostgreSQL
- ORM: Prisma
- Authentication: JWT + Refresh Tokens + MFA support
- Encryption: AES-256-GCM for message encryption
- Key Exchange: RSA-4096 or ECDH
- Password Hashing: Argon2id
- Containerization: Docker + Docker Compose
- Reverse Proxy: Nginx
- CI/CD: GitHub Actions
- Secrets Management: Vault or Docker Secrets
- Monitoring: Prometheus + Grafana
- Logging: Winston + Loki
- Security Testing: OWASP ZAP + Snyk + Semgrep + Trivy
- Infrastructure: Kubernetes-ready architecture
- Deployment: Secure production deployment
- Rate Limiting + WAF protections
- Secure Coding + DevSecOps best practices

The implementation.md file MUST be extremely detailed and step-by-step.

---

# MAIN OBJECTIVE

Generate a COMPLETE secure engineering blueprint and implementation guide for building the application from scratch following:

- OWASP Top 10
- DevSecOps principles
- Zero Trust Architecture
- Secure SDLC
- Defense in Depth
- Principle of Least Privilege
- Secure by Default
- Privacy by Design

The generated document must be suitable for:

- Professional portfolio projects
- Production-grade SaaS applications
- Cybersecurity showcases
- Enterprise-level secure architecture

---

# APPLICATION FEATURES

The secure chat application must include:

## Core Features

- User registration/login
- Email verification
- MFA/TOTP authentication
- Secure password reset
- Real-time messaging
- Private chats
- Group chats
- Presence indicators
- Typing indicators
- Message delivery status
- File sharing
- Secure image upload
- Message search
- Notifications
- Session management
- Device management
- Secure logout everywhere
- Refresh token rotation

---

# END-TO-END ENCRYPTION REQUIREMENTS

Implement REAL E2EE.

Messages MUST NEVER be stored plaintext in database.

Include:

- AES-256-GCM encryption
- Secure IV generation
- Key derivation
- Public/private key generation
- Key exchange mechanism
- Per-session encryption keys
- Perfect Forward Secrecy
- Secure key storage
- Message signing
- Replay attack protection
- Nonce validation
- Integrity verification
- Authenticated encryption
- Secure encrypted attachments
- Encrypted metadata considerations

Explain:

- Why each cryptographic decision is used
- Threat model
- Security tradeoffs
- Key lifecycle management

---

# SECURITY REQUIREMENTS

The implementation must explain protections against:

## Web Vulnerabilities

- XSS
- CSRF
- SQL Injection
- NoSQL Injection
- SSRF
- XXE
- RCE
- Clickjacking
- Open Redirects
- Path Traversal
- Prototype Pollution
- Deserialization attacks
- Command Injection
- CORS misconfiguration
- DOM-based attacks

## Authentication Security

- Credential stuffing
- Brute force attacks
- Session hijacking
- JWT attacks
- Token theft
- Password spraying
- Account enumeration
- MFA bypass

## Real-Time Security

- Socket hijacking
- Event spoofing
- Unauthorized socket events
- Replay attacks
- MITM attacks
- WebSocket abuse

## Infrastructure Security

- Container escape
- Secret leakage
- Supply chain attacks
- CI/CD compromise
- Dependency confusion
- Malicious packages
- Kubernetes hardening
- Docker security

---

# REQUIRED DOCUMENT STRUCTURE

The generated implementation.md must contain ALL of the following sections:

# 1. Project Overview

- Architecture goals
- Security-first design
- Threat model
- Security assumptions

# 2. System Architecture

Include:

- Frontend architecture
- Backend architecture
- WebSocket architecture
- Encryption architecture
- Database architecture
- Deployment architecture

Provide Mermaid diagrams for:

- High-level architecture
- Authentication flow
- Encryption flow
- Socket.io communication flow
- CI/CD pipeline
- Secure deployment architecture

# 3. Secure Tech Stack Rationale

Explain WHY each technology is chosen from a security perspective.

# 4. Project Initialization

Provide step-by-step setup:

- Frontend initialization
- Backend initialization
- TypeScript configuration
- Secure ESLint configuration
- Prettier
- Husky hooks
- Commit signing
- Environment configuration

# 5. Frontend Secure Development

Include:

- React folder structure
- Secure routing
- CSP implementation
- Secure state management
- Secure local storage handling
- Secure token handling
- Input validation
- Output encoding
- XSS prevention
- Secure file uploads
- Dependency hardening

# 6. Backend Secure Development

Include:

- Express secure configuration
- Helmet configuration
- CORS hardening
- Rate limiting
- Input sanitization
- Validation middleware
- Secure error handling
- Secure logging
- API versioning
- JWT security
- Refresh token rotation
- RBAC
- Secure Socket.io middleware

# 7. Cryptography Implementation

This section MUST be extremely detailed.

Include:

- AES-256-GCM implementation
- Key generation
- Key exchange
- Encryption utilities
- Decryption flow
- Secure random generation
- Replay protection
- Key rotation
- Secure memory handling
- Crypto attack mitigations

Provide production-grade TypeScript examples.

# 8. Database Security

Include:

- Prisma secure schema
- Secure migrations
- Encryption at rest
- Database least privilege
- Row-level security
- SQL injection prevention
- Secure backups
- Audit logging

# 9. Authentication & Authorization

Include:

- Registration flow
- Login flow
- MFA/TOTP flow
- JWT architecture
- Secure cookies
- Session revocation
- Device tracking
- OAuth considerations

# 10. Secure File Upload System

Include:

- MIME validation
- Malware scanning
- File size limits
- Content validation
- Signed URLs
- Secure storage
- Image processing sandboxing

# 11. DevSecOps Pipeline

Include:

- GitHub Actions workflows
- SAST
- DAST
- Dependency scanning
- Secret scanning
- Container scanning
- IaC scanning
- SBOM generation
- Signed builds
- Branch protection

Provide YAML examples.

# 12. Docker Security

Include:

- Minimal images
- Non-root containers
- Read-only filesystem
- Capabilities dropping
- Secure networking
- Multi-stage builds

# 13. Kubernetes Security

Include:

- Pod security
- Network policies
- RBAC
- Secrets management
- Ingress security
- Runtime security

# 14. Monitoring & Incident Response

Include:

- Audit logs
- SIEM integration
- Alerting
- Metrics
- Threat detection
- Incident response playbook

# 15. Secure Deployment

Include:

- HTTPS/TLS hardening
- HSTS
- Secure Nginx configuration
- Reverse proxy security
- CDN security
- WAF integration
- Production hardening checklist

# 16. Security Testing

Include:

- Unit testing
- Integration testing
- Security testing
- Fuzzing
- Penetration testing
- OWASP testing methodology

# 17. Performance + Security Optimization

Include:

- Secure caching
- WebSocket scaling
- Horizontal scaling
- Redis security
- Secure load balancing

# 18. Compliance Considerations

Include:

- GDPR
- Data retention
- Privacy considerations
- Secure deletion
- Audit requirements

# 19. Production Hardening Checklist

Provide a VERY detailed checklist.

# 20. Future Security Improvements

Include:

- Signal Protocol migration
- Post-quantum cryptography
- Hardware-backed keys
- Secure enclaves
- Advanced threat detection

---

# IMPLEMENTATION REQUIREMENTS

The generated implementation.md MUST:

- Be highly detailed
- Be step-by-step
- Include secure code examples
- Include production-grade folder structures
- Include CLI commands
- Include Dockerfiles
- Include Kubernetes manifests
- Include GitHub Actions workflows
- Include secure Nginx configs
- Include Prisma schemas
- Include TypeScript examples
- Include environment variable examples
- Include security explanations for every important choice

---

# CODE QUALITY REQUIREMENTS

All generated code must follow:

- Clean Architecture
- SOLID principles
- Secure coding principles
- Type safety
- Modular design
- Error handling best practices
- Structured logging
- Secure defaults

---

# SECURITY MANDATES

NEVER:

- Store plaintext passwords
- Store plaintext messages
- Use insecure crypto
- Use deprecated algorithms
- Hardcode secrets
- Use weak JWT secrets
- Disable TLS verification
- Trust client-side validation alone
- Expose stack traces
- Use unsafe deserialization
- Use eval()
- Use innerHTML unsafely

ALWAYS:

- Validate inputs
- Sanitize outputs
- Use parameterized queries
- Use least privilege
- Rotate secrets
- Implement rate limiting
- Use secure headers
- Log security events
- Implement monitoring
- Scan dependencies
- Verify uploads
- Use secure cookies
- Use HTTPS everywhere

---

# OUTPUT FORMAT

Generate ONLY the complete implementation.md content.

The output must be:

- Professional
- Structured
- Enterprise-grade
- Extremely detailed
- Security-focused
- Production-ready

The implementation guide should feel like it was written by:
- A Senior Security Engineer
- A DevSecOps Architect
- A Secure Systems Architect
- A Cryptography Engineer

The final output should exceed 15,000+ words if necessary.