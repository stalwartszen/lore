# Security Policy

The Lore maintainers take security seriously. We appreciate responsible disclosure and will work to acknowledge and fix issues promptly.

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x (current) | Yes |

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub Issues.**

Send an email to **stalwartszen@gmail.com** with:

1. **Subject**: `[SECURITY] Brief description`
2. **Description**: What is affected and how
3. **Steps to reproduce**: Minimal reproduction steps
4. **Impact**: What an attacker could accomplish
5. **Suggested fix** (optional)

### Response Timeline

| Milestone | Target |
|-----------|--------|
| Acknowledgment | Within 48 hours |
| Severity assessment | Within 5 business days |
| Patch release (Critical/High) | Within 30 days |
| Patch release (Medium/Low) | Next minor release |

---

## Security Considerations for Self-Hosted Deployments

Lore is designed to be self-hosted. The security of your deployment is your responsibility. Key areas to consider:

### Authentication
The default Lore server has **no authentication**. Anyone who can reach port 3000 can search your commits and add repositories. For production:
- Run Lore behind a reverse proxy (nginx, Caddy) with basic auth or mTLS
- Restrict network access with firewall rules
- Authentication middleware is on the [v0.2.0 roadmap](README.md#roadmap)

### Database
- Change the default MySQL password in `docker-compose.yml` before deploying
- Never expose MySQL port 3306 to the public internet
- Use a strong `JWT_SECRET` in `.env`

### API Keys
- `GROQ_API_KEY` and `ANTHROPIC_API_KEY` are stored in `.env` — never commit this file
- Rotate keys if they are accidentally exposed

### Network
- Use HTTPS in production (terminate TLS at your reverse proxy)
- The Lore server should only be accessible within your internal network

---

## Contact

- **Security issues**: [stalwartszen@gmail.com](mailto:stalwartszen@gmail.com)
- **General questions**: [GitHub Discussions](https://github.com/stalwartszen/lore/discussions)

Thank you for helping keep Lore secure.
